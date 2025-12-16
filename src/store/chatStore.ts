import { create } from 'zustand';

import type { Chat, ChatId } from '../types/chat';
import type { HistoryMessageId, LocalMessageId, Message, MessageId } from '../types/message';
import { connectToMockSocketAllChats, getChats, getMessagesPage } from '../mock/chatService';

type ChatState = {
  chats: Chat[];
  selectedChatId: ChatId | null;

  messagesByChatId: Record<ChatId, Message[] | undefined>;
  isLoadingChats: boolean;
  isLoadingMessagesByChatId: Record<ChatId, boolean | undefined>;
  isLoadingOlderByChatId: Record<ChatId, boolean | undefined>;
  hasMoreByChatId: Record<ChatId, boolean | undefined>;
  oldestCursorByChatId: Record<ChatId, HistoryMessageId | undefined>;

  isAtBottomByChatId: Record<ChatId, boolean | undefined>;
  newMessagesByChatId: Record<ChatId, number | undefined>;

  socketUnsub: (() => void) | null;

  loadChats: () => Promise<void>;
  selectChat: (chatId: ChatId) => Promise<void>;
  loadOlder: (chatId: ChatId) => Promise<void>;

  setAtBottom: (chatId: ChatId, atBottom: boolean) => void;
  clearNewMessages: (chatId: ChatId) => void;

  sendMessage: (text: string) => Promise<void>;
  receiveMessage: (msg: Message) => void;
};

const SEND_FAIL_RATE = 0;
const INCOMING_FLUSH_MS = 50;
const PREVIEW_LIMIT = 50;
const OLDER_PAGE_LIMIT = 100;

type IncomingBuffer = {
  queue: Message[];
  timer: ReturnType<typeof setTimeout> | null;
  requestAnimationFrameNumber: number | null;
};

const incomingBuffer: IncomingBuffer = { queue: [], timer: null, requestAnimationFrameNumber: null };

function cancelIncomingSchedule() {
  if (incomingBuffer.timer) {
    clearTimeout(incomingBuffer.timer);
    incomingBuffer.timer = null;
  }
  if (incomingBuffer.requestAnimationFrameNumber != null && typeof globalThis.cancelAnimationFrame === 'function') {
    globalThis.cancelAnimationFrame(incomingBuffer.requestAnimationFrameNumber);
    incomingBuffer.requestAnimationFrameNumber = null;
  }
}

function upsertChatLastMessage(chats: Chat[], chatId: ChatId, msg: Message): Chat[] {
  const preview = msg.text.replace(/\s+/g, ' ').slice(0, 60);
  const next = chats.slice();
  const idx = next.findIndex((c) => c.id === chatId);
  if (idx === -1) return next;
  const updated: Chat = {
    ...next[idx],
    lastMessagePreview: preview,
    lastMessageAt: msg.createdAtTimestamp
  };
  next[idx] = updated;
  next.sort((a, b) => b.lastMessageAt - a.lastMessageAt);
  return next;
}

function addMessage(list: Message[] | undefined, msg: Message): Message[] {
  const arr = list ? list.slice() : [];
  arr.push(msg);
  return arr;
}

function mergeUniqueById(existing: Message[] | undefined, incoming: Message[]): Message[] {
  const byId = new Map<MessageId, Message>();
  for (const m of existing ?? []) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  const merged = Array.from(byId.values());
  merged.sort((a, b) => (a.createdAtTimestamp - b.createdAtTimestamp) || a.id.localeCompare(b.id));
  return merged;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  selectedChatId: null,

  messagesByChatId: {},
  isLoadingChats: false,
  isLoadingMessagesByChatId: {},
  isLoadingOlderByChatId: {},
  hasMoreByChatId: {},
  oldestCursorByChatId: {},

  isAtBottomByChatId: {},
  newMessagesByChatId: {},

  socketUnsub: null,

  loadChats: async () => {
    const state = get();
    if (state.isLoadingChats) return;
    set({ isLoadingChats: true });
    try {
      get().socketUnsub?.();
      set({ socketUnsub: null });

      const chats = await getChats();
      set({ chats });

      // Подтягиваем последние сообщения по каждому чату, чтобы список чатов показывал текст последнего сообщения,
      // не загружая всю историю на 5000+.
      // Думаю, в реальных условиях мы бы не подгружали сразу 5000 сообщений,
      // а сделали что-то вроде пагинации. Собственно, это я и сделал, и тут, и на моке
      // Пользователь скроллит вверх - подгружаем больше, т.е. все 5000 загрузить можно,
      // просто не сразу
      await Promise.all(
        chats.map(async (c) => {
          const page = await getMessagesPage({ chatId: c.id, limit: PREVIEW_LIMIT });
          const last = page.messages[page.messages.length - 1];
          set((s) => ({
            chats: last ? upsertChatLastMessage(s.chats, c.id, last) : s.chats,
            messagesByChatId: page.messages.length
              ? { ...s.messagesByChatId, [c.id]: page.messages }
              : s.messagesByChatId,
            hasMoreByChatId: { ...s.hasMoreByChatId, [c.id]: page.hasMore },
            oldestCursorByChatId: page.nextBeforeId
              ? { ...s.oldestCursorByChatId, [c.id]: page.nextBeforeId }
              : s.oldestCursorByChatId
          }));
        })
      );

      const unsub = connectToMockSocketAllChats({
        chatIds: chats.map((c) => c.id),
        intervalMs: 4500,
        onMessage: (msg) => get().receiveMessage(msg)
      });
      set({ socketUnsub: unsub });
    } finally {
      set({ isLoadingChats: false });
    }
  },

  selectChat: async (chatId) => {
    set({ selectedChatId: chatId });

    // по умолчанию считаем, что пользователь внизу
    set((s) => ({
      isAtBottomByChatId: { ...s.isAtBottomByChatId, [chatId]: true },
      // Открытие чата помечает все текущие непрочитанные как прочитанные
      newMessagesByChatId: { ...s.newMessagesByChatId, [chatId]: 0 }
    }));
  },

  loadOlder: async (chatId) => {
    const state = get();
    if (state.isLoadingOlderByChatId[chatId]) return;
    if (state.hasMoreByChatId[chatId] === false) return;
    const beforeId = state.oldestCursorByChatId[chatId];
    if (!beforeId) return;

    set((s) => ({ isLoadingOlderByChatId: { ...s.isLoadingOlderByChatId, [chatId]: true } }));
    try {
      const page = await getMessagesPage({ chatId, limit: OLDER_PAGE_LIMIT, beforeId });
      set((s) => ({
        messagesByChatId: {
          ...s.messagesByChatId,
          [chatId]: mergeUniqueById(s.messagesByChatId[chatId], page.messages)
        },
        hasMoreByChatId: { ...s.hasMoreByChatId, [chatId]: page.hasMore },
        oldestCursorByChatId: page.nextBeforeId ? { ...s.oldestCursorByChatId, [chatId]: page.nextBeforeId } : s.oldestCursorByChatId
      }));
    } finally {
      set((s) => ({ isLoadingOlderByChatId: { ...s.isLoadingOlderByChatId, [chatId]: false } }));
    }
  },

  setAtBottom: (chatId, atBottom) => {
    set((s) => {
      const prev = !!s.isAtBottomByChatId[chatId];
      if (prev === atBottom) return s;
      return {
        isAtBottomByChatId: { ...s.isAtBottomByChatId, [chatId]: atBottom },
        newMessagesByChatId: atBottom ? { ...s.newMessagesByChatId, [chatId]: 0 } : s.newMessagesByChatId
      };
    });
  },

  clearNewMessages: (chatId) => {
    set((s) => ({
      newMessagesByChatId: { ...s.newMessagesByChatId, [chatId]: 0 }
    }));
  },

  receiveMessage: (msg) => {
    // Буферизуем входящие и сбрасываем сразу батч, чтобы уменьшить лишние глитчи виртуализации
    incomingBuffer.queue.push(msg);
    if (incomingBuffer.timer || incomingBuffer.requestAnimationFrameNumber != null) return;

    const flush = () => {
      cancelIncomingSchedule();
      const batch = incomingBuffer.queue.splice(0, incomingBuffer.queue.length);
      if (batch.length === 0) return;

      set((s) => {
        const nextMessagesByChatId: Record<ChatId, Message[] | undefined> = { ...s.messagesByChatId };

        // группируем по чатам
        const perChat = new Map<ChatId, Message[]>();
        for (const m of batch) {
          const arr = perChat.get(m.chatId);
          if (arr) arr.push(m);
          else perChat.set(m.chatId, [m]);
        }

        let nextChats = s.chats;
        let nextNew = s.newMessagesByChatId;

        for (const [chatId, msgs] of perChat.entries()) {
          const existing = nextMessagesByChatId[chatId];
          const appended = existing ? existing.slice() : [];
          for (const m of msgs) appended.push(m);
          // Для неоткрытых чатов держим только последние PREVIEW_LIMIT.
          const wasPreviewOnly = (existing?.length ?? 0) <= PREVIEW_LIMIT && s.selectedChatId !== chatId;
          nextMessagesByChatId[chatId] = wasPreviewOnly ? appended.slice(-PREVIEW_LIMIT) : appended;

          // обновляем превью в списке чатов по последнему сообщению в батче
          const last = msgs[msgs.length - 1]!;
          nextChats = upsertChatLastMessage(nextChats, chatId, last);

          // Непрочитанные сообщения
          const inc = msgs.filter((m) => m.authorId !== 'me').length;
          if (inc > 0) {
            const isSelected = s.selectedChatId === chatId;
            const atBottom = !!s.isAtBottomByChatId[chatId];
            const shouldCount = !isSelected || !atBottom;
            if (shouldCount) {
              const current = nextNew[chatId] ?? 0;
              if (nextNew === s.newMessagesByChatId) nextNew = { ...s.newMessagesByChatId };
              nextNew[chatId] = current + inc;
            }
          }
        }

        return {
          messagesByChatId: nextMessagesByChatId,
          chats: nextChats,
          newMessagesByChatId: nextNew
        };
      });
    };

    if (typeof globalThis.requestAnimationFrame === 'function') {
      incomingBuffer.requestAnimationFrameNumber = globalThis.requestAnimationFrame(() => flush());
    }
    incomingBuffer.timer = setTimeout(() => flush(), INCOMING_FLUSH_MS);
  },

  sendMessage: async (text) => {
    const chatId = get().selectedChatId;
    if (!chatId) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    const localId: LocalMessageId = `${chatId}:local:${Date.now()}:${Math.random().toString(16).slice(2)}` as LocalMessageId;
    const now = Date.now();
    const optimistic: Message = {
      id: localId,
      chatId,
      authorId: 'me',
      text: trimmed,
      createdAtTimestamp: now,
      status: 'sending'
    };

    set((s) => ({
      messagesByChatId: {
        ...s.messagesByChatId,
        [chatId]: addMessage(s.messagesByChatId[chatId], optimistic)
      },
      chats: upsertChatLastMessage(s.chats, chatId, optimistic)
    }));

    await new Promise<void>((r) => setTimeout(r, 300));
    const fail = Math.random() < SEND_FAIL_RATE;

    set((s) => {
      const list = s.messagesByChatId[chatId];
      if (!list) return s;
      const next: Message[] = list.map((m) => {
        if (m.id !== localId) return m;
        return { ...m, status: (fail ? 'failed' : 'sent') as Message['status'] };
      });
      return {
        ...s,
        messagesByChatId: { ...s.messagesByChatId, [chatId]: next }
      };
    });
  }
}));


