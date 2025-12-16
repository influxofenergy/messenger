import type { ChatId } from './chat';

export type UserId = 'me' | 'other';

export type MessageStatus = 'sent' | 'sending' | 'failed';

// используется для пагинации
export type HistoryMessageId = `${ChatId}:${number}`;
// приходит из сокета мока
export type LiveMessageId = `${ChatId}:live:${number}` | `${ChatId}:live:${number}:${number}`;
// генерится на фронте когда мы сами отправляем сообщение
export type LocalMessageId = `${ChatId}:local:${number}:${string}`;

export type MessageId = HistoryMessageId | LiveMessageId | LocalMessageId;

export type Message = {
  id: MessageId;
  chatId: ChatId;
  authorId: UserId;
  text: string;
  createdAtTimestamp: number;
  status: MessageStatus;
};


