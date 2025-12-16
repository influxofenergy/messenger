import type { Chat, ChatId } from '../types/chat';
import type { HistoryMessageId, Message, UserId } from '../types/message';

export type MessagesPage = {
  messages: Message[]; 
  hasMore: boolean;
  nextBeforeId: HistoryMessageId | null; 
};

type MessagesPageArgs = {
  chatId: ChatId;
  limit: number;
  beforeId?: HistoryMessageId; 
};

type ConnectArgs = {
  chatId: ChatId;
  onMessage: (message: Message) => void;
  intervalMs?: number;
};

type ConnectAllArgs = {
  chatIds: ChatId[];
  onMessage: (message: Message) => void;
  intervalMs?: number;
};

const NETWORK_LATENCY_MS = 250;
const HISTORY_COUNT = 5200;

const AVATAR_POOL = ['/avatars/u1.svg', '/avatars/u2.svg', '/avatars/u3.svg', '/avatars/u4.svg', '/avatars/u5.svg', '/avatars/u6.svg'] as const;

const CHAT_SEEDS: Array<Pick<Chat, 'id' | 'title' | 'avatarText' | 'avatarUrl'>> = [
  { id: 'c1', title: 'Алиса Котова', avatarText: 'АК', avatarUrl: '/avatars/alisa.svg' },
  { id: 'c2', title: 'Борис Егоров', avatarText: 'БЕ', avatarUrl: '/avatars/boris.svg' },
  { id: 'c3', title: 'Анна Петрова', avatarText: 'АП', avatarUrl: AVATAR_POOL[0] },
  { id: 'c4', title: 'Мария Смирнова', avatarText: 'МС', avatarUrl: AVATAR_POOL[1] },
  { id: 'c5', title: 'Екатерина Волкова', avatarText: 'ЕВ', avatarUrl: AVATAR_POOL[2] },
  { id: 'c6', title: 'Ольга Фёдорова', avatarText: 'ОФ', avatarUrl: AVATAR_POOL[3] },
  { id: 'c7', title: 'Наталья Орлова', avatarText: 'НО', avatarUrl: AVATAR_POOL[4] },
  { id: 'c8', title: 'Ирина Соколова', avatarText: 'ИС', avatarUrl: AVATAR_POOL[5] },
  { id: 'c9', title: 'Татьяна Морозова', avatarText: 'ТМ', avatarUrl: AVATAR_POOL[0] },
  { id: 'c10', title: 'Елена Кузнецова', avatarText: 'ЕК', avatarUrl: AVATAR_POOL[1] },
  { id: 'c11', title: 'Светлана Новикова', avatarText: 'СН', avatarUrl: AVATAR_POOL[2] },
  { id: 'c12', title: 'Юлия Павлова', avatarText: 'ЮП', avatarUrl: AVATAR_POOL[3] },
  { id: 'c13', title: 'Дарья Васильева', avatarText: 'ДВ', avatarUrl: AVATAR_POOL[4] },
  { id: 'c14', title: 'Полина Николаева', avatarText: 'ПН', avatarUrl: AVATAR_POOL[5] },
  { id: 'c15', title: 'Вероника Михайлова', avatarText: 'ВМ', avatarUrl: AVATAR_POOL[0] },
  { id: 'c16', title: 'Ксения Захарова', avatarText: 'КЗ', avatarUrl: AVATAR_POOL[1] },
  { id: 'c17', title: 'Алина Иванова', avatarText: 'АИ', avatarUrl: AVATAR_POOL[2] },
  { id: 'c18', title: 'Александр Громов', avatarText: 'АГ', avatarUrl: AVATAR_POOL[3] },
  { id: 'c19', title: 'Дмитрий Лебедев', avatarText: 'ДЛ', avatarUrl: AVATAR_POOL[4] },
  { id: 'c20', title: 'Сергей Комаров', avatarText: 'СК', avatarUrl: AVATAR_POOL[5] },
  { id: 'c21', title: 'Андрей Трофимов', avatarText: 'АТ', avatarUrl: AVATAR_POOL[0] },
  { id: 'c22', title: 'Алексей Белов', avatarText: 'АБ' },
  { id: 'c23', title: 'Максим Карпов', avatarText: 'МК' },
  { id: 'c24', title: 'Илья Назаров', avatarText: 'ИН' },
  { id: 'c25', title: 'Никита Гусев', avatarText: 'НГ' },
  { id: 'c26', title: 'Павел Титов', avatarText: 'ПТ' },
  { id: 'c27', title: 'Михаил Жуков', avatarText: 'МЖ' },
  { id: 'c28', title: 'Артём Фомин', avatarText: 'АФ' },
  { id: 'c29', title: 'Иван Доронин', avatarText: 'ИД' },
  { id: 'c30', title: 'Константин Воронов', avatarText: 'КВ' }
];

function pause(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const LOREM_SHORT = [
  'Lorem ipsum dolor sit amet.',
  'Ut enim ad minim veniam.'
];

const LOREM_LONG = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
];

const makeHistoryMessageId = (chatId: ChatId, i: number): HistoryMessageId => `${chatId}:${i}` as HistoryMessageId;
const makeLiveMessageId = (chatId: ChatId, n: number): `${ChatId}:live:${number}` =>
  `${chatId}:live:${n}` as `${ChatId}:live:${number}`;
const makeLiveMessageIdWithSuffix = (chatId: ChatId, n: number, suffix: number): `${ChatId}:live:${number}:${number}` =>
  `${chatId}:live:${n}:${suffix}` as `${ChatId}:live:${number}:${number}`;

function randomText() {
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]!;
  const count = 2 + Math.floor(Math.random() * 3); // 2..4
  const parts: string[] = [];
  for (let i = 0; i < count; i++) {
    parts.push(Math.random() < 0.6 ? pick(LOREM_SHORT) : pick(LOREM_LONG));
  }
  // чтобы дополнительно разного размера были пузыри и сообщения реальнее, иногда добавляем /n
  return Math.random() < 0.35 ? `${parts[0]}\n${parts.slice(1).join(' ')}` : parts.join(' ');
}

function makeHistory(chatId: ChatId): Message[] {
  const step = 1000 * 12;
  const now = Date.now();
  const startAt = now - step * (HISTORY_COUNT - 1);

  const messages: Message[] = [];
  for (let i = 0; i < HISTORY_COUNT; i++) {
    const authorId: UserId = i % 3 === 0 ? 'me' : 'other';
    const text = randomText();
    messages.push({
      id: makeHistoryMessageId(chatId, i),
      chatId,
      authorId,
      text,
      createdAtTimestamp: startAt + i * step,
      status: 'sent'
    });
  }
  return messages;
}

const historyCache = new Map<ChatId, Message[]>();

export async function getChats(): Promise<Chat[]> {
  await pause(NETWORK_LATENCY_MS);
  const now = Date.now();
  return CHAT_SEEDS.map((c, idx) => ({
    ...c,
    lastMessagePreview: '',
    lastMessageAt: now - idx * 1000 * 60 * 7
  }));
}

function getHistory(chatId: ChatId): Message[] {
  const existing = historyCache.get(chatId);
  if (existing) return existing;
  const history = makeHistory(chatId);
  historyCache.set(chatId, history);
  return history;
}

function parseHistoryIndex(chatId: ChatId, id: HistoryMessageId): number | null {
  if (!id.startsWith(`${chatId}:`)) return null;
  const last = id.split(':').at(-1);
  if (!last) return null;
  const n = Number(last);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

export async function getMessagesPage({ chatId, limit, beforeId }: MessagesPageArgs): Promise<MessagesPage> {
  await pause(NETWORK_LATENCY_MS);
  const history = getHistory(chatId);

  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  let endExclusive = history.length;

  if (beforeId) {
    const idx = parseHistoryIndex(chatId, beforeId);
    if (idx != null) {
      endExclusive = Math.max(0, Math.min(history.length, idx));
    }
  }

  const start = Math.max(0, endExclusive - safeLimit);
  const slice = history.slice(start, endExclusive);
  const hasMore = start > 0;
  const nextBeforeId: HistoryMessageId | null = hasMore ? ((slice[0]?.id ?? null) as HistoryMessageId | null) : null;

  return { messages: slice, hasMore, nextBeforeId };
}

let liveCounter = 0;

export function connectToMockSocket({ chatId, onMessage, intervalMs = 2500 }: ConnectArgs) {
  let closed = false;

  const tick = () => {
    if (closed) return;
    const msg: Message = {
      id: makeLiveMessageId(chatId, liveCounter++),
      chatId,
      authorId: 'other',
      text: randomText(),
      createdAtTimestamp: Date.now(),
      status: 'sent'
    };
    onMessage(msg);
  };

  const handle = setInterval(tick, intervalMs);
  return () => {
    closed = true;
    clearInterval(handle);
  };
}

export function connectToMockSocketAllChats({ chatIds, onMessage, intervalMs = 1000 }: ConnectAllArgs) {
  let closed = false;
  const countersByChat = new Map<ChatId, number>();

  for (const id of chatIds) {
    countersByChat.set(id, 0);
  }

  const perChatSpacingMs = 1000;
  const pending: Array<ReturnType<typeof setTimeout>> = [];

  const sendOne = (chatId: ChatId) => {
    if (closed) return;
    const n = countersByChat.get(chatId) ?? 0;
    countersByChat.set(chatId, n + 1);
    const msg: Message = {
      id: makeLiveMessageIdWithSuffix(chatId, liveCounter++, n),
      chatId,
      authorId: 'other',
      text: randomText(),
      createdAtTimestamp: Date.now(),
      status: 'sent'
    };
    onMessage(msg);
  };

  const tick = () => {
    if (closed) return;
    // Разнос по чатам: 1с между контактами внутри цикла
    chatIds.forEach((chatId, idx) => {
      const h = setTimeout(() => sendOne(chatId), idx * perChatSpacingMs);
      pending.push(h);
    });
  };

  const jitter = 500;
  const base = Math.max(1000, intervalMs);
  const nextDelay = () => {
    const min = Math.max(250, base - jitter);
    const max = base + jitter;
    return Math.floor(min + Math.random() * (max - min + 1));
  };

  let timeout: ReturnType<typeof setTimeout> | null = null;
  const schedule = () => {
    if (closed) return;
    timeout = setTimeout(() => {
      tick();
      schedule();
    }, nextDelay());
  };

  schedule();
  return () => {
    closed = true;
    if (timeout) clearTimeout(timeout);
    for (const h of pending) clearTimeout(h);
  };
}


