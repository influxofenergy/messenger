import { useEffect, useMemo, useState } from 'react';

import styles from './App.module.css';
import { ChatList } from './components/chats/ChatList';
import { MessagePane } from './components/messages/MessagePane';
import { useChatStore } from './store/chatStore';

function useMediaQuery(query: string) {
  const getMatch = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);

  return matches;
}

function App() {
  const loadChats = useChatStore((s) => s.loadChats);
  const isMobile = useMediaQuery('(max-width: 860px)');
  const [mobileScreen, setMobileScreen] = useState<'list' | 'chat'>('list');

  useEffect(() => {
    if (isMobile) setMobileScreen('list');
  }, [isMobile]);

  useEffect(() => {
    void loadChats();
  }, [loadChats]);

  const showList = !isMobile || mobileScreen === 'list';
  const showChat = !isMobile || mobileScreen === 'chat';
  const onMobileChatSelected = useMemo(() => (isMobile ? () => setMobileScreen('chat') : undefined), [isMobile]);

  return (
    <div className={styles.Root}>
      {showList ? (
        <aside className={styles.Left}>
          <ChatList onChatSelected={onMobileChatSelected} />
        </aside>
      ) : null}
      {showChat ? (
        <main className={styles.Right}>
          <MessagePane isMobile={isMobile} onMobileBack={isMobile ? () => setMobileScreen('list') : undefined} />
        </main>
      ) : null}
      </div>
  );
}

export default App
