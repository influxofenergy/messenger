import * as React from 'react';
import type { Message } from '../../types/message';
import styles from './MessageBubble.module.css';

export const MessageBubble = React.memo(function MessageBubble({ message }: { message: Message }) {
  const isMe = message.authorId === 'me';
  const time = React.useMemo(
    () => new Date(message.createdAtTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [message.createdAtTimestamp]
  );
  return (
    <div
      className={`${styles.Row} ${isMe ? styles.RowMe : styles.RowOther}`}
      data-testid="message-bubble"
      data-author={message.authorId}
    >
      <div className={`${styles.Bubble} ${isMe ? styles.BubbleMe : styles.BubbleOther}`}>
        <div className={styles.Text}>{message.text}</div>
        <div className={styles.Meta}>
          <span className={styles.Time}>{time}</span>
          {isMe ? (
            <span className={styles.Status} data-status={message.status}>
              {message.status === 'sending' ? '…' : message.status === 'failed' ? '!' : '✓'}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
},
// Дефолтного shallow compare хватило бы, если бы ссылка на message была стабильной.
// Надо гарантировать, что события вроде смены статуса прочитано/непрочитано
// Перерендерят только нужный блок с сообщением
(prev, next) =>
  prev.message === next.message ||
  (prev.message.id === next.message.id &&
    prev.message.status === next.message.status &&
    prev.message.text === next.message.text &&
    prev.message.createdAtTimestamp === next.message.createdAtTimestamp)
);


