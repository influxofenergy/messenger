export type ChatId = `c${number}`;

export type Chat = {
  id: ChatId;
  title: string;
  avatarText: string;
  avatarUrl?: string; 
  lastMessagePreview: string;
  lastMessageAt: number;
};


