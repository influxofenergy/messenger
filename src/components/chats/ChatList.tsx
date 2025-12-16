import * as React from 'react';
import { Virtuoso } from 'react-virtuoso';
import type { StateSnapshot, VirtuosoHandle } from 'react-virtuoso';
import styles from './ChatList.module.css';
import { useChatStore } from '../../store/chatStore';
import { ChatListItem } from './ChatListItem';

let savedState: StateSnapshot | null = null;

export function ChatList({ onChatSelected }: { onChatSelected?: () => void }) {
  const chats = useChatStore((s) => s.chats);
  const selectedChatId = useChatStore((s) => s.selectedChatId);
  const isLoadingChats = useChatStore((s) => s.isLoadingChats);
  const virtuosoRef = React.useRef<VirtuosoHandle>(null);
  const scrollerElRef = React.useRef<HTMLElement | null>(null);
  const scrollTopRef = React.useRef<number>(savedState?.scrollTop ?? 0);

  const Scroller = React.useMemo(() => {
    return React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>((props, ref) => (
      <div
        {...props}
        ref={ref}
        style={{
          ...(props.style ?? {}),
          overflowAnchor: 'none',
          scrollbarGutter: 'stable',
          contain: 'layout paint',
          margin: 8,
          boxSizing: 'border-box'
        }}
      />
    ));
  }, []);

  React.useLayoutEffect(() => {
    const el = scrollerElRef.current;
    if (!el) return;
    el.scrollTop = scrollTopRef.current;
  }, [chats]);

  React.useEffect(() => {
    const onScroll = () => {
      const el = scrollerElRef.current;
      if (!el) return;
      scrollTopRef.current = el.scrollTop;
    };
    const el = scrollerElRef.current;
    if (!el) return;
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [scrollerElRef.current]);

  React.useEffect(() => {
    return () => {
      virtuosoRef.current?.getState((s) => {
        savedState = s;
        scrollTopRef.current = s.scrollTop;
      });
    };
  }, []);

  return (
    <div className={styles.Root}>
      <div className={styles.Header}>Чаты</div>
      {isLoadingChats && chats.length === 0 ? (
        <div className={styles.Empty}>Загрузка…</div>
      ) : chats.length === 0 ? (
        <div className={styles.Empty}>Нет чатов</div>
      ) : (
        <div className={styles.List} role="list">
          <Virtuoso
            ref={virtuosoRef}
            data={chats}
            style={{ height: '100%' }}
            restoreStateFrom={savedState ?? undefined}
            scrollerRef={(el) => {
              const node = el && el !== window ? (el as HTMLElement) : null;
              scrollerElRef.current = node;
              if (node && savedState) {
                scrollTopRef.current = savedState.scrollTop;
              }
            }}
            components={{ Scroller }}
            computeItemKey={(_i, chat) => chat.id}
            itemContent={(_i, chat) => {
              return (
                <div style={{ paddingBottom: 6 }}>
                  <ChatListItem chat={chat} selected={chat.id === selectedChatId} onSelected={onChatSelected} />
                </div>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}


