export type CharacterId = 'zhixia' | 'keke' | 'wanqing' | 'xiaoman';
export type MediaIntent = 'none' | 'image' | 'voice';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  mediaType?: 'image' | 'audio';
  mediaUrl?: string;
  mediaKey?: string;
  pending?: boolean;
  failed?: boolean;
  error?: string;
  requestedMedia?: Exclude<MediaIntent, 'none'>;
  requestedQuota?: 'imageRemaining' | 'voiceRemaining' | 'tryOnRemaining';
}

export interface ChatResponse {
  reply: string;
  emotion: string;
  mediaIntent: MediaIntent;
  mediaReason: string;
  voiceText: string;
  imagePrompt: string;
  demo?: boolean;
}

export interface GameState {
  selectedCharacter: CharacterId | null;
  messages: Partial<Record<CharacterId, ChatMessage[]>>;
  textRemaining: number;
  imageRemaining: number;
  voiceRemaining: number;
  tryOnRemaining: number;
}
