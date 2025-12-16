import { useState } from 'react';

import styles from './MessageInput.module.css';
import { useChatStore } from '../../store/chatStore';

export function MessageInput({ disabled, afterSend }: { disabled: boolean; afterSend?: () => void }) {
  const [text, setText] = useState('');
  const sendMessage = useChatStore((s) => s.sendMessage);

  const send = () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    // В React 18 ожидание (await) внутри обработчиков событий может задерживать батченные UI-обновления.
    // Нам нужно, чтобы оптимистичное сообщение появлялось сразу.
    void sendMessage(value);
    afterSend?.();
  };

  return (
    <div className={styles.Root}>
      <input
        className={styles.Input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={disabled ? 'Выберите чат…' : 'Напишите сообщение…'}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Enter') send();
        }}
      />
      <button className={styles.Button} type="button" onClick={send} disabled={disabled || !text.trim()}>
        Отправить
      </button>
    </div>
  );
}


