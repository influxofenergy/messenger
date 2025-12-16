import { render, screen } from '@testing-library/react';

import { MessagePane } from '../components/messages/MessagePane';
import { useChatStore } from '../store/chatStore';
import type { HistoryMessageId, Message } from '../types/message';
import type { ChatId } from '../types/chat';

jest.mock('react-virtuoso', () => ({
  Virtuoso: (props: any) => {
    const { itemContent, atBottomStateChange, data } = props;
    if (typeof atBottomStateChange === 'function') {
      Promise.resolve().then(() => atBottomStateChange(true));
    }

    const totalItemCount = Array.isArray(data) ? data.length : 0;
    const renderCount = Math.min(totalItemCount, 160);

    return (
      <div data-testid="virtuoso-mock">
        {new Array(renderCount).fill(null).map((_, idx) => (
          <div key={idx}>{itemContent(idx, data?.[idx], null)}</div>
        ))}
      </div>
    );
  }
}));

function seedHistory(chatId: ChatId, count = 5200): Message[] {
  const start = Date.now() - 1000 * 60 * 60 * 24 * 10;
  const step = 1000 * 30;
  return new Array(count).fill(null).map((_, i) => ({
    id: `${chatId}:${i}` as HistoryMessageId,
    chatId,
    authorId: i % 3 === 0 ? 'me' : 'other',
    text: `m${i}`,
    createdAtTimestamp: start + i * step,
    status: 'sent'
  }));
}

beforeEach(() => {
  jest.useFakeTimers();
  useChatStore.getState().socketUnsub?.();
  useChatStore.setState({
    chats: [{ id: 'c1', title: 'Alice', avatarText: 'A', lastMessagePreview: 'x', lastMessageAt: Date.now() }],
    selectedChatId: 'c1',
    messagesByChatId: { c1: seedHistory('c1', 5200) },
    isLoadingChats: false,
    isLoadingMessagesByChatId: {},
    isAtBottomByChatId: { c1: true },
    socketUnsub: null
  });
});

afterEach(() => {
  jest.useRealTimers();
});

test('в DOM элементов сообщений меньше, чем сообщений в истории, т.е. виртуализация работает', async () => {
  const all = useChatStore.getState().messagesByChatId.c1;
  expect(all?.length).toBeGreaterThanOrEqual(5000);

  render(<MessagePane />);

  const bubbles = screen.getAllByTestId('message-bubble');
  expect(bubbles.length).toBeGreaterThan(0);
  expect(bubbles.length).toBeLessThan(200);
});

test('сообщение после отправки оптимистично отображается, не дожидаясь бекенда', async () => {
  const chatId = useChatStore.getState().selectedChatId!;
  const before = useChatStore.getState().messagesByChatId[chatId]!;
  const beforeLen = before.length;

  void useChatStore.getState().sendMessage('hello');
  const optimistic = useChatStore.getState().messagesByChatId[chatId]!;
  expect(optimistic.length).toBe(beforeLen + 1);
  expect(optimistic[optimistic.length - 1].status).toBe('sending');

  jest.advanceTimersByTime(400);
  await Promise.resolve();
  const done = useChatStore.getState().messagesByChatId[chatId]!;
  expect(done[done.length - 1].status).not.toBe('sending');
});

test('входящее сообщение обновляет превью последнего сообщения в чате (аналог вебсокета)', () => {
  const before = useChatStore.getState().chats[0]?.lastMessagePreview;

  const incoming: Message = {
    id: 'c1:live:1',
    chatId: 'c1',
    authorId: 'other',
    text: 'incoming update',
    createdAtTimestamp: Date.now(),
    status: 'sent'
  };
  useChatStore.getState().receiveMessage(incoming);
  jest.advanceTimersByTime(60);

  const after = useChatStore.getState().chats[0]?.lastMessagePreview;
  expect(after).not.toEqual(before);
});


