import * as React from 'react';
import { useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { VirtuosoHandle } from 'react-virtuoso';

import styles from './MessagePane.module.css';
import { useChatStore } from '../../store/chatStore';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import type { Message, MessageId } from '../../types/message';
import type { ChatId } from '../../types/chat';

const VIRTUOSO_STYLE = { height: '100%' } as const;
const MIN_OVERSCAN = { top: 5, bottom: 5 } as const;
const INITIAL_TOP_MOST_ITEM_INDEX = { index: 'LAST', align: 'end' } as const;
// Автоскролл вниз, если пользователь близко к нижней границе
const AUTO_SCROLL_THRESHOLD_PX = 25;
// Подгружаем более старые сообщения чуть раньше верхней границы
const TOP_PREFETCH_PX = 300;

const VirtuosoScroller = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  (props, ref) => (
    <div
      {...props}
      ref={ref}
      style={{
        ...(props.style ?? {}),
        // Изоляция раскладки и отрисовки для стабильности
        contain: 'layout paint size',
        // Отключаем якорение скролла внутри контейнера
        overflowAnchor: 'none',
        // Резервируем место под скроллбар, чтобы не было сдвигов при рендере
        scrollbarGutter: 'stable',
        // Чуть больше паддинга справа, чтобы пузыри не липли к скроллбару
        padding: '14px 28px 14px 16px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        overscrollBehaviorY: 'contain'
      }}
    />
  )
);

function TopLoader() {
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const isLoadingOlder = useChatStore((s) => (selectedChatId ? !!s.isLoadingOlderByChatId[selectedChatId] : false));
  if (!isLoadingOlder) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
      <svg style={{ width: 22, height: 22, opacity: 0.8 }} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="4" opacity="0.25" />
        <path
          d="M40 22C40 12.0589 31.9411 4 22 4"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.9"
        />
      </svg>
    </div>
  );
}

export function MessagePane({ isMobile, onMobileBack }: { isMobile?: boolean; onMobileBack?: () => void }) {
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const messages = useChatStore((s) => (selectedChatId ? s.messagesByChatId[selectedChatId] : undefined));
  const isLoading = useChatStore((s) => (selectedChatId ? s.isLoadingMessagesByChatId[selectedChatId] : false));
  const isLoadingOlder = useChatStore((s) =>
    selectedChatId ? !!s.isLoadingOlderByChatId[selectedChatId] : false
  );
  const hasMore = useChatStore((s) => (selectedChatId ? s.hasMoreByChatId[selectedChatId] !== false : false));
  const setAtBottom = useChatStore((s) => s.setAtBottom);
  const loadOlder = useChatStore((s) => s.loadOlder);
  const clearNewMessages = useChatStore((s) => s.clearNewMessages);

  const headerChat = useChatStore((s) => {
    const id = s.selectedChatId;
    if (!id) return null;
    return s.chats.find((c) => c.id === id) ?? null;
  });
  const title = headerChat?.title ?? (selectedChatId ? 'Чат' : 'Выберите чат');

  type PaneItem =
    | { kind: 'date'; key: string } // YYYY-MM-DD
    | { kind: 'message'; message: Message };

  const { items, dateKeyByIndex, lastDateKey } = useMemo(() => {
    const src = messages ?? [];
    const out: PaneItem[] = [];
    const keys: Array<string | null> = [];
    let currentKey: string | null = null;

    for (const m of src) {
      const d = new Date(m.createdAtTimestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(
        2,
        '0'
      )}`;
      if (key !== currentKey) {
        currentKey = key;
        out.push({ kind: 'date', key });
        keys.push(currentKey);
      }
      out.push({ kind: 'message', message: m });
      keys.push(currentKey);
    }
    return { items: out, dateKeyByIndex: keys, lastDateKey: currentKey };
  }, [messages]);

  const extraSizePx = useExtraViewportPx();
  const virtuosoComponents = useMemo(() => ({ Scroller: VirtuosoScroller, Header: TopLoader }), []);
  const virtuosoRef = React.useRef<VirtuosoHandle>(null);
  const increaseViewportBy = useMemo(() => ({ top: extraSizePx, bottom: extraSizePx }), [extraSizePx]);
  const scrollerElRef = React.useRef<HTMLElement | null>(null);
  const detachScrollListenerRef = React.useRef<(() => void) | null>(null);
  const forceScrollToBottomRef = React.useRef(false);
  const hasUserScrolledRef = React.useRef(false);
  const scrollStateRef = React.useRef<{
    chatId: ChatId | null;
    scrollTop: number;
    atBottom: boolean;
    distanceFromBottom: number;
    total: number;
  }>({
    chatId: null,
    scrollTop: 0,
    atBottom: true,
    distanceFromBottom: 0,
    total: 0
  });

  const onAtBottomStateChange = React.useCallback(
    (atBottom: boolean) => {
      if (!selectedChatId) return;
      setAtBottom(selectedChatId, atBottom);
      const el = scrollerElRef.current;
      if (el) {
        const distanceFromBottom = Math.max(0, el.scrollHeight - (el.scrollTop + el.clientHeight));
        scrollStateRef.current = {
          ...scrollStateRef.current,
          chatId: selectedChatId,
          atBottom,
          distanceFromBottom
        };
      } else {
        scrollStateRef.current = {
          ...scrollStateRef.current,
          chatId: selectedChatId,
          atBottom,
          distanceFromBottom: atBottom ? 0 : scrollStateRef.current.distanceFromBottom
        };
      }
    },
    [selectedChatId, setAtBottom]
  );

  // Автоскролл вниз при atBottom и сразу после отправки сообщения
  const followOutput = React.useCallback((isAtBottom: boolean) => {
    if (forceScrollToBottomRef.current) return 'smooth' as const;
    return isAtBottom ? ('smooth' as const) : false;
  }, []);

  const teleportToBottom = React.useCallback(() => {
    virtuosoRef.current?.scrollToIndex({ index: 'LAST', align: 'end', behavior: 'auto' });
  }, []);

  const computeItemKey = React.useCallback((index: number, item: PaneItem) => {
    if (item.kind === 'date') return `d:${item.key}`;
    return item.message.id ?? `m:idx:${index}`;
  }, []);

  const dateLabelCacheRef = React.useRef<Map<string, string>>(new Map());
  const formatGroupLabel = React.useCallback((key: string) => {
    const cached = dateLabelCacheRef.current.get(key);
    if (cached) return cached;

    // Формат: 16 дек 2025
    const monthsShortRu = [
      'янв',
      'фев',
      'мар',
      'апр',
      'мая',
      'июн',
      'июл',
      'авг',
      'сен',
      'окт',
      'ноя',
      'дек'
    ];

    // Ключ даты: YYYY-MM-DD
    const [yStr, mStr, dStr] = key.split('-');
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);
    const month = monthsShortRu[(m || 1) - 1] ?? '';
    const label = `${d || ''} ${month} ${y || ''}`.trim();
    dateLabelCacheRef.current.set(key, label);
    return label;
  }, []);

  const [activeDateKey, setActiveDateKey] = React.useState<string | null>(null);
  const activeDateKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    activeDateKeyRef.current = activeDateKey;
  }, [activeDateKey]);

  React.useEffect(() => {
    setActiveDateKey(lastDateKey ?? null);
  }, [selectedChatId, lastDateKey]);

  const onRangeChanged = React.useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      const next = dateKeyByIndex[range.startIndex] ?? null;
      if (next !== activeDateKeyRef.current) setActiveDateKey(next);
    },
    [dateKeyByIndex]
  );

  const itemContent = React.useCallback(
    (_index: number, item: PaneItem) => {
      if (item.kind === 'date') {
        return (
          <div className={styles.DateSeparator} style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 12px' }}>
            <div
              style={{
                fontSize: 12,
                opacity: 0.85,
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 999,
                padding: '4px 10px'
              }}
            >
              {formatGroupLabel(item.key)}
            </div>
          </div>
        );
      }
      return (
        <div style={{ paddingBottom: 10 }}>
          <MessageBubble message={item.message} />
        </div>
      );
    },
    [formatGroupLabel]
  );

  const onScrollerRef = React.useCallback((el: HTMLElement | null | Window) => {
    // react-virtuoso может передать Window, но нам нужен только HTMLElement
    detachScrollListenerRef.current?.();
    detachScrollListenerRef.current = null;

    const node = el && el !== window ? (el as HTMLElement) : null;
    scrollerElRef.current = node;
    if (!node) return;

    const update = () => {
      const chatId = selectedChatId ?? null;
      const scrollTop = node.scrollTop;
      const distanceFromBottom = Math.max(0, node.scrollHeight - (node.scrollTop + node.clientHeight));
      const atBottom = distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
      scrollStateRef.current = { ...scrollStateRef.current, chatId, scrollTop, atBottom, distanceFromBottom };
    };

    update();
    const onScroll = () => {
      hasUserScrolledRef.current = true;
      update();
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    detachScrollListenerRef.current = () => node.removeEventListener('scroll', onScroll);
  }, []);

  const prependSnapshotRef = React.useRef<{ scrollTop: number; scrollHeight: number } | null>(null);
  const prependAnchorRef = React.useRef<{ chatId: ChatId; anchorMessageId: MessageId } | null>(null);
  const atTopRef = React.useRef(false);
  const loadOlderRequestedRef = React.useRef(false);

  React.useEffect(() => {
    atTopRef.current = false;
    loadOlderRequestedRef.current = false;
    prependSnapshotRef.current = null;
    prependAnchorRef.current = null;
    hasUserScrolledRef.current = false;
  }, [selectedChatId]);

  React.useEffect(() => {
    if (!isLoadingOlder) {
      loadOlderRequestedRef.current = false;
      if (atTopRef.current && hasUserScrolledRef.current) requestLoadOlder();
    }
  }, [isLoadingOlder]);

  const requestLoadOlder = React.useCallback(() => {
    if (!selectedChatId) return;
    if (!hasMore) return;
    if (isLoadingOlder) return;
    if (loadOlderRequestedRef.current) return;
    loadOlderRequestedRef.current = true;
    const el = scrollerElRef.current;
    // Для prepend запоминаем id первого сообщения, после подгрузки возвращаемся к нему
    const anchorId = messages?.[0]?.id;
    if (anchorId) prependAnchorRef.current = { chatId: selectedChatId, anchorMessageId: anchorId };
    if (el) prependSnapshotRef.current = { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight };
    void loadOlder(selectedChatId);
  }, [hasMore, isLoadingOlder, loadOlder, messages, selectedChatId]);

  // Если пользователь не внизу, после добавления новых элементов возвращаем scrollTop
  React.useLayoutEffect(() => {
    const el = scrollerElRef.current;
    if (!el) return;

    const prev = scrollStateRef.current;
    const chatId = selectedChatId ?? null;
    const total = items.length;

    // После prepend сохраняем позицию вьюпорта
    const snap = prependSnapshotRef.current;
    const anchor = prependAnchorRef.current;
    if (snap && prev.chatId === chatId && total > prev.total) {
      if (anchor && anchor.chatId === chatId) {
        const idx = items.findIndex(
          (it) => it.kind === 'message' && it.message.id === anchor.anchorMessageId
        );
        if (idx >= 0) {
          virtuosoRef.current?.scrollToIndex({ index: idx, align: 'start', behavior: 'auto' });
          prependSnapshotRef.current = null;
          prependAnchorRef.current = null;
        } else {
          const delta = el.scrollHeight - snap.scrollHeight;
          if (delta > 0) el.scrollTop = snap.scrollTop + delta;
          prependSnapshotRef.current = null;
          prependAnchorRef.current = null;
        }
      } else {
        const delta = el.scrollHeight - snap.scrollHeight;
        if (delta > 0) el.scrollTop = snap.scrollTop + delta;
        prependSnapshotRef.current = null;
        prependAnchorRef.current = null;
      }
    } else if (prev.chatId === chatId && total > prev.total) {
      // После отправки всегда скроллим вниз
      if (forceScrollToBottomRef.current) {
        forceScrollToBottomRef.current = false;
      } else {
        // При подгрузке сообщений сохраняем scrollTop, если скролл выше
        const wasNearBottom = prev.atBottom || prev.distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX;
        if (!wasNearBottom) el.scrollTop = prev.scrollTop;
      }
    }

    const distanceFromBottom = Math.max(0, el.scrollHeight - (el.scrollTop + el.clientHeight));
    scrollStateRef.current = {
      chatId,
      scrollTop: el.scrollTop,
      atBottom: distanceFromBottom <= AUTO_SCROLL_THRESHOLD_PX,
      distanceFromBottom,
      total
    };
  }, [items.length, selectedChatId]);

  React.useEffect(() => {
    return () => {
      detachScrollListenerRef.current?.();
      detachScrollListenerRef.current = null;
    };
  }, []);

  return (
    <div className={styles.Root}>
      <div className={styles.Header}>
        {isMobile && onMobileBack ? (
          <button type="button" className={styles.BackButton} onClick={onMobileBack} aria-label="Назад">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M15 18L9 12L15 6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        ) : null}
        {isMobile && headerChat ? (
          <span className={styles.HeaderAvatar} aria-hidden="true">
            {headerChat.avatarUrl ? (
              <img className={styles.HeaderAvatarImg} src={headerChat.avatarUrl} alt="" />
            ) : (
              headerChat.avatarText
            )}
          </span>
        ) : null}
        <span className={styles.HeaderTitle}>{title}</span>
      </div>
      <div className={styles.Body}>
        {!selectedChatId ? (
          <div className={styles.EmptyState}>
            <div className={styles.EmptyCard}>
              <h2 className={styles.EmptyTitle}>Выберите, кому хотели бы написать</h2>
            </div>
          </div>
        ) : null}
        {selectedChatId && activeDateKey ? (
          <div className={styles.ActiveDate} aria-hidden="true">
            <div className={styles.ActiveDatePill}>{formatGroupLabel(activeDateKey)}</div>
          </div>
        ) : null}
        {!selectedChatId ? null : isLoading && !messages ? (
          <div className={styles.LoaderWrap} aria-label="Loading messages">
            <svg className={styles.Spinner} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle className={styles.SpinnerCircle} cx="22" cy="22" r="18" stroke="currentColor" strokeWidth="4" />
              <path
                className={styles.SpinnerArc}
                d="M40 22C40 12.0589 31.9411 4 22 4"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : (
          <Virtuoso<PaneItem>
            key={selectedChatId}
            ref={virtuosoRef}
            style={VIRTUOSO_STYLE}
            data={items}
            rangeChanged={onRangeChanged}
            scrollerRef={onScrollerRef}
            atTopThreshold={TOP_PREFETCH_PX}
            atTopStateChange={(atTop) => {
              atTopRef.current = atTop;
              if (atTop && hasUserScrolledRef.current) requestLoadOlder();
            }}
            atBottomThreshold={AUTO_SCROLL_THRESHOLD_PX}
            atBottomStateChange={onAtBottomStateChange}
            followOutput={followOutput}
            increaseViewportBy={increaseViewportBy}
            minOverscanItemCount={MIN_OVERSCAN}
            initialTopMostItemIndex={INITIAL_TOP_MOST_ITEM_INDEX}
            alignToBottom
            components={virtuosoComponents}
            computeItemKey={computeItemKey}
            itemContent={itemContent}
            startReached={() => {
              if (hasUserScrolledRef.current) requestLoadOlder();
            }}
          />
        )}
      </div>
      {selectedChatId ? (
        <div className={styles.Footer}>
          <NewMessagesBadge chatId={selectedChatId} onTeleportToBottom={teleportToBottom} />
          <MessageInput
            disabled={!selectedChatId}
            afterSend={() => {
              if (!selectedChatId) return;
              forceScrollToBottomRef.current = true;
              clearNewMessages(selectedChatId);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

function NewMessagesBadge({
  chatId,
  onTeleportToBottom
}: {
  chatId: ChatId | null;
  onTeleportToBottom: () => void;
}) {
  const clearNewMessages = useChatStore((s) => s.clearNewMessages);
  const isAtBottom = useChatStore((s) => (chatId ? !!s.isAtBottomByChatId[chatId] : true));
  const newCount = useChatStore((s) => (chatId ? (s.newMessagesByChatId[chatId] ?? 0) : 0));

  if (!chatId) return null;
  const visible = !isAtBottom && newCount > 0;

  return (
    <div className={`${styles.NewMessagesBadge} ${visible ? styles.NewMessagesBadgeVisible : ''}`}>
      <button
        type="button"
        className={styles.NewMessagesButton}
        onClick={() => {
          onTeleportToBottom();
          clearNewMessages(chatId);
        }}
      >
        <svg
          className={styles.ArrowIcon}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M12 4.5V17.2M12 17.2L7.6 12.8M12 17.2L16.4 12.8"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Новые сообщения ({newCount})
      </button>
    </div>
  );
}

function useExtraViewportPx() {
  return React.useSyncExternalStore(
    (onStoreChange: () => void) => {
      window.addEventListener('resize', onStoreChange);
      return () => window.removeEventListener('resize', onStoreChange);
    },
    () => Math.max(700, window.innerHeight) * 2,
    () => 1400
  );
}


