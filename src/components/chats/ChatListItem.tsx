import type { Chat } from '../../types/chat';
import { useChatStore } from '../../store/chatStore';

import styles from './ChatListItem.module.css';

export function ChatListItem({
  chat,
  selected,
  onSelected
}: {
  chat: Chat;
  selected: boolean;
  onSelected?: () => void;
}) {
  const selectChat = useChatStore((s) => s.selectChat);
  const unread = useChatStore((s) => s.newMessagesByChatId[chat.id] ?? 0);
  const atBottom = useChatStore((s) => (selected ? !!s.isAtBottomByChatId[chat.id] : false));
  const showUnread = unread > 0 && !(selected && atBottom);

  return (
    <button
      type="button"
      className={`${styles.Root} ${selected ? styles.Selected : ''}`}
      data-chat-id={chat.id}
      onClick={() => {
        void selectChat(chat.id);
        onSelected?.();
      }}
      aria-current={selected ? 'true' : undefined}
    >
      <div className={styles.Avatar} aria-hidden="true">
        {chat.avatarUrl ? (
          <img className={styles.AvatarImg} src={chat.avatarUrl} alt="" />
        ) : (
          chat.avatarText
        )}
      </div>
      <div className={styles.Body}>
        <div className={styles.TopRow}>
          <div className={styles.Title}>{chat.title}</div>
          <div className={styles.Time}>
            {new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <div className={styles.PreviewRow}>
          <div className={styles.Preview}>{chat.lastMessagePreview}</div>
          {showUnread ? <div className={styles.Unread}>{unread}</div> : null}
        </div>
      </div>
    </button>
  );
}


