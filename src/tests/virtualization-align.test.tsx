import { render } from '@testing-library/react';

const virtuosoMock = jest.fn((_props: any) => <div data-testid="virtuoso" />);

jest.mock('react-virtuoso', () => ({
  Virtuoso: (props: any) => virtuosoMock(props)
}));

import { MessagePane } from '../components/messages/MessagePane';
import { useChatStore } from '../store/chatStore';
import type { HistoryMessageId, Message } from '../types/message';
import type { ChatId } from '../types/chat';

function seedMessages(count: number): Message[] {
  const chatId: ChatId = 'c1';
  const start = Date.now() - 1000 * 60 * 60;
  return new Array(count).fill(null).map((_, i) => ({
    id: `${chatId}:${i}` as HistoryMessageId,
    chatId,
    authorId: i % 2 === 0 ? 'me' : 'other',
    text: `m${i}`,
    createdAtTimestamp: start + i * 1000,
    status: 'sent'
  }));
}

beforeEach(() => {
  virtuosoMock.mockClear();
  useChatStore.getState().socketUnsub?.();
  useChatStore.setState({
    chats: [{ id: 'c1', title: 'Alice', avatarText: 'A', lastMessagePreview: 'x', lastMessageAt: Date.now() }],
    selectedChatId: 'c1',
    messagesByChatId: { c1: seedMessages(10) },
    isLoadingChats: false,
    isLoadingMessagesByChatId: {},
    isAtBottomByChatId: { c1: true },
    socketUnsub: null
  });
});

test('MessagePane правильно встраивается в окно, и ничего не съезжает', () => {
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });

  render(<MessagePane />);

  expect(virtuosoMock).toHaveBeenCalled();
  const props = (virtuosoMock.mock.calls[0]?.[0] ?? null) as any;
  expect(props).not.toBeNull();

  expect(props.alignToBottom).toBe(true);
  expect(props.initialTopMostItemIndex).toEqual({ index: 'LAST', align: 'end' });
  expect(props.increaseViewportBy).toEqual({ top: 1536, bottom: 1536 });
  expect(typeof props.followOutput).toBe('function');
});


