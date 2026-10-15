'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS, getCharacter, type CharacterProfile } from '@/lib/characters';
import { authClient } from '@/lib/auth/client';
import { loadMedia, saveMedia } from '@/lib/mediaStore';
import type { CharacterId, ChatMessage, ChatResponse, GameState, MediaIntent } from '@/lib/types';

import { initialGame, readAccountGame, writeAccountGame } from '@/lib/game/storage';
import { conversationHistory, latestRetryable } from '@/lib/game/chat';
import { withAbort } from '@/lib/game/abort';

const Icon = ({ name }: { name: 'back' | 'more' | 'image' | 'voice' | 'shirt' | 'send' | 'sparkle' | 'heart' | 'close' | 'upload' | 'chat' | 'users' | 'archive' | 'settings' | 'phone' | 'video' | 'plus' }) => {
  const paths = {
    back: <path d="m15 18-6-6 6-6" />,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    image: <><rect width="18" height="16" x="3" y="4" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 21"/></>,
    voice: <><rect width="8" height="14" x="8" y="2" rx="4"/><path d="M4 10v2a8 8 0 0 0 16 0v-2M12 20v2"/></>,
    shirt: <path d="M9 3 5 5 2 9l3 2 1-1v11h12V10l1 1 3-2-3-4-4-2c-.5 1.3-1.5 2-3 2S9.5 4.3 9 3Z" />,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    sparkle: <path d="m12 3-1.4 4.2a5 5 0 0 1-3.2 3.2L3 12l4.4 1.6a5 5 0 0 1 3.2 3.2L12 21l1.4-4.2a5 5 0 0 1 3.2-3.2L21 12l-4.4-1.6a5 5 0 0 1-3.2-3.2Z"/>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    close: <><path d="m6 6 12 12"/><path d="M18 6 6 18"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></>,
    chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    archive: <><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v13h16V8M10 12h4"/></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.94 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.57 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.94a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.57 1.7 1.7 0 0 0 10 3V3h4v.08A1.7 1.7 0 0 0 15.06 4.6a1.7 1.7 0 0 0 1.88-.34L17 4.2 19.83 7l-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.69 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.33 1.84.56 2.8.69A2 2 0 0 1 22 16.92Z" />,
    video: <><path d="m16 13 5 3V8l-5 3"/><rect width="13" height="14" x="3" y="5" rx="2"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: Date.now() };
}

export function GameApp(props: { userId: string; userEmail: string }) {
  return <GameSession key={props.userId} {...props} />;
}

function GameSession({ userId, userEmail }: { userId: string; userEmail: string }) {
  const router = useRouter();
  const [game, setGame] = useState<GameState>(initialGame);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [conversationQuery, setConversationQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingCharacter, setSendingCharacter] = useState<CharacterId | null>(null);
  const [storageWarning, setStorageWarning] = useState('');
  const [leaving, setLeaving] = useState(false);
  const mountedRef = useRef(false);
  const sendingRef = useRef(false);
  const controllersRef = useRef(new Set<AbortController>());
  const urlsRef = useRef(new Set<string>());
  const canPersistRef = useRef(true);
  const [toast, setToast] = useState('');
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [tryOnFile, setTryOnFile] = useState<File | null>(null);
  const [tryOnPreview, setTryOnPreview] = useState('');
  const [tryOnSending, setTryOnSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);
  const mediaRestoredRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const controllers = controllersRef.current;
    const urls = urlsRef.current;
    let loaded;
    try { loaded = readAccountGame(window.localStorage, userId); }
    catch { loaded = { game: initialGame(), warning: '浏览器禁止了本地存储，本次聊天不会保存。', canPersist: false }; }
    setGame(loaded.game);
    setStorageWarning(loaded.warning);
    canPersistRef.current = loaded.canPersist;
    setHydrated(true);
    return () => {
      mountedRef.current = false;
      controllers.forEach((controller) => controller.abort());
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, [userId]);

  useEffect(() => {
    if (!hydrated || leaving || !canPersistRef.current) return;
    let saved = false;
    try { saved = writeAccountGame(window.localStorage, userId, game); } catch { /* 禁用存储 */ }
    if (!saved) setStorageWarning('本地存储空间不足或不可用，本次新消息可能无法保存。');
  }, [game, hydrated, leaving, userId]);

  useEffect(() => {
    if (!hydrated || leaving) return;
    if (mediaRestoredRef.current) return;
    mediaRestoredRef.current = true;
    const restore = async () => {
      const updates: Array<{ id: string; url: string }> = [];
      for (const messages of Object.values(game.messages)) {
        for (const message of messages ?? []) {
          if (message.mediaKey && !message.mediaUrl) {
            const blob = await loadMedia(userId, message.mediaKey).catch(() => undefined);
            if (blob && mountedRef.current) {
              const url = URL.createObjectURL(blob);
              urlsRef.current.add(url);
              updates.push({ id: message.id, url });
            }
          }
        }
      }
      if (updates.length && mountedRef.current) {
        const urls = new Map(updates.map((item) => [item.id, item.url]));
        setGame((current) => ({ ...current, messages: Object.fromEntries(Object.entries(current.messages).map(([key, messages]) => [key, messages?.map((message) => urls.has(message.id) ? { ...message, mediaUrl: urls.get(message.id) } : message)])) }));
      }
    };
    void restore();
  }, [hydrated, game.messages, userId, leaving]);

  const current = game.selectedCharacter ? getCharacter(game.selectedCharacter) : null;
  const currentMessages = useMemo(() => current ? game.messages[current.id] ?? [] : [], [current, game.messages]);
  const filteredCharacters = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    if (!query) return CHARACTERS;
    return CHARACTERS.filter((character) => `${character.name}${character.archetype}${character.status}`.toLowerCase().includes(query));
  }, [conversationQuery]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [currentMessages, sending]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!tryOnFile) {
      setTryOnPreview('');
      return;
    }
    const previewUrl = URL.createObjectURL(tryOnFile);
    setTryOnPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [tryOnFile]);

  const updateMessages = useCallback((characterId: CharacterId, updater: (messages: ChatMessage[]) => ChatMessage[]) => {
    if (!mountedRef.current) return;
    setGame((currentGame) => ({ ...currentGame, messages: { ...currentGame.messages, [characterId]: updater(currentGame.messages[characterId] ?? []) } }));
  }, []);

  const generateMedia = useCallback(async (characterId: CharacterId, intent: Exclude<MediaIntent, 'none'>, content: string) => {
    const mediaId = crypto.randomUUID();
    const mediaKey = `media-${mediaId}`;
    const type = intent === 'image' ? 'image' : 'audio';
    const pending: ChatMessage = { id: mediaId, role: 'assistant', content: intent === 'image' ? '正在为你拍一张照片…' : '正在录一段语音…', createdAt: Date.now(), mediaType: type, requestedQuota: intent === 'image' ? 'imageRemaining' : 'voiceRemaining', pending: true };
    updateMessages(characterId, (messages) => [...messages, pending]);
    setGame((state) => ({ ...state, [intent === 'image' ? 'imageRemaining' : 'voiceRemaining']: Math.max(0, state[intent === 'image' ? 'imageRemaining' : 'voiceRemaining'] - 1) }));

    const controller = new AbortController();
    controllersRef.current.add(controller);
    const timer = window.setTimeout(() => controller.abort(), 180_000);
    try {
      const endpoint = intent === 'image' ? '/api/image' : '/api/tts';
      const response = await withAbort(fetch(endpoint, { signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId, text: content }) }), controller.signal);
      if (!response.ok) throw new Error((await withAbort(response.json().catch(() => null), controller.signal))?.error ?? '生成失败');
      const blob = await withAbort(response.blob(), controller.signal);
      if (!mountedRef.current) return;
      if (controller.signal.aborted) throw new DOMException('Timeout', 'AbortError');
      await withAbort(saveMedia(userId, mediaKey, blob), controller.signal);
      if (!mountedRef.current) return;
      if (controller.signal.aborted) throw new DOMException('Timeout', 'AbortError');
      const mediaUrl = URL.createObjectURL(blob);
      urlsRef.current.add(mediaUrl);
      updateMessages(characterId, (messages) => messages.map((message) => message.id === mediaId ? { ...message, content: intent === 'image' ? '只给你看哦。' : content, mediaUrl, mediaKey, pending: false } : message));
    } catch (error) {
      if (!mountedRef.current) return;
      setGame((state) => ({ ...state, [intent === 'image' ? 'imageRemaining' : 'voiceRemaining']: Math.min(3, state[intent === 'image' ? 'imageRemaining' : 'voiceRemaining'] + 1) }));
      updateMessages(characterId, (messages) => messages.map((message) => message.id === mediaId ? { ...message, content: controller.signal.aborted ? '生成超时，请稍后再试' : error instanceof Error ? error.message : '生成失败，请稍后再试', pending: false, failed: true } : message));
    } finally { window.clearTimeout(timer); controllersRef.current.delete(controller); }
  }, [updateMessages, userId]);

  const selectClothingImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setToast('衣服图片仅支持 JPG、PNG 或 WebP');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setToast('衣服图片不能超过 8 MB');
      return;
    }
    setTryOnFile(file);
  };

  const closeTryOn = () => {
    if (tryOnSending) return;
    setTryOnOpen(false);
    setTryOnFile(null);
  };

  const generateTryOn = useCallback(async () => {
    if (!current || !tryOnFile || tryOnSending) return;
    if (game.tryOnRemaining <= 0) {
      setToast('今天的换衣次数已经用完');
      return;
    }

    const characterId = current.id;
    const messageId = crypto.randomUUID();
    const mediaKey = `media-${messageId}`;
    const pending: ChatMessage = {
      id: messageId,
      role: 'assistant',
      content: '正在试穿这件衣服…',
      createdAt: Date.now(),
      mediaType: 'image',
      requestedQuota: 'tryOnRemaining',
      pending: true,
    };

    setTryOnSending(true);
    updateMessages(characterId, (messages) => [...messages, pending]);
    setGame((state) => ({ ...state, tryOnRemaining: Math.max(0, state.tryOnRemaining - 1) }));

    const controller = new AbortController();
    controllersRef.current.add(controller);
    const timer = window.setTimeout(() => controller.abort(), 180_000);
    try {
      const formData = new FormData();
      formData.append('characterId', characterId);
      formData.append('clothingImage', tryOnFile);
      const response = await withAbort(fetch('/api/try-on', { signal: controller.signal, method: 'POST', body: formData }), controller.signal);
      if (!response.ok) throw new Error((await withAbort(response.json().catch(() => null), controller.signal))?.error ?? '换衣生成失败');

      const blob = await withAbort(response.blob(), controller.signal);
      if (!mountedRef.current) return;
      if (controller.signal.aborted) throw new DOMException('Timeout', 'AbortError');
      await withAbort(saveMedia(userId, mediaKey, blob), controller.signal);
      if (!mountedRef.current) return;
      if (controller.signal.aborted) throw new DOMException('Timeout', 'AbortError');
      const mediaUrl = URL.createObjectURL(blob);
      urlsRef.current.add(mediaUrl);
      updateMessages(characterId, (messages) => messages.map((message) => message.id === messageId ? {
        ...message,
        content: '换好啦，看看这身怎么样？',
        mediaUrl,
        mediaKey,
        pending: false,
      } : message));
      setTryOnOpen(false);
      setTryOnFile(null);
      setToast('换衣完成');
    } catch (error) {
      if (!mountedRef.current) return;
      setGame((state) => ({ ...state, tryOnRemaining: Math.min(3, state.tryOnRemaining + 1) }));
      updateMessages(characterId, (messages) => messages.map((message) => message.id === messageId ? {
        ...message,
        content: controller.signal.aborted ? '换衣生成超时，请稍后再试' : error instanceof Error ? error.message : '换衣生成失败，请稍后再试',
        pending: false,
        failed: true,
      } : message));
    } finally {
      window.clearTimeout(timer);
      controllersRef.current.delete(controller);
      if (mountedRef.current) setTryOnSending(false);
    }
  }, [current, game.tryOnRemaining, tryOnFile, tryOnSending, updateMessages, userId]);

  const send = useCallback(async (forcedText?: string, forcedMedia?: Exclude<MediaIntent, 'none'>, retryId?: string) => {
    const characterId = game.selectedCharacter;
    const text = (forcedText ?? input).trim();
    if (!characterId || !text || sendingRef.current || leaving) return;
    const messages = game.messages[characterId] ?? [];
    const retry = retryId ? messages.find((m) => m.id === retryId) : undefined;
    if (retryId && (!retry || !latestRetryable(messages, retryId))) return;
    const requestedMedia = retry?.requestedMedia ?? forcedMedia;
    if (game.textRemaining <= 0) { setToast('免费文字消息已经用完啦'); return; }
    if (text.length > 50) { setToast('每条消息最多 50 个字'); return; }
    if (requestedMedia === 'image' && game.imageRemaining <= 0) { setToast('今天的自拍额度已经用完'); return; }
    if (requestedMedia === 'voice' && game.voiceRemaining <= 0) { setToast('今天的语音额度已经用完'); return; }

    sendingRef.current = true;
    const userMessage: ChatMessage = { ...(retry ?? createMessage('user', text)), pending: true, failed: false, error: undefined, requestedMedia };
    const history = conversationHistory(messages, userMessage);
    if (!retry) setInput('');
    setSending(true);
    setSendingCharacter(characterId);
    updateMessages(characterId, (items) => retry ? items.map((m) => m.id === retry.id ? userMessage : m) : [...items, userMessage]);
    setGame((state) => ({ ...state, textRemaining: state.textRemaining - 1 }));
    const controller = new AbortController();
    controllersRef.current.add(controller);
    const timer = window.setTimeout(() => controller.abort(), 50_000);
    try {
      const response = await withAbort(fetch('/api/chat', { signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId, messages: history, forcedMedia: requestedMedia }) }), controller.signal);
      if (!response.ok) throw new Error((await withAbort(response.json().catch(() => null), controller.signal))?.error ?? '消息发送失败');
      const result = await withAbort(response.json(), controller.signal) as ChatResponse;
      if (typeof result.reply !== 'string' || !result.reply.trim()) throw new Error('回复暂时不可用，请重试');
      if (!mountedRef.current) return;
      if (controller.signal.aborted) throw new DOMException('Timeout', 'AbortError');
      updateMessages(characterId, (items) => [...items.map((m) => m.id === userMessage.id ? { ...m, pending: false } : m), createMessage('assistant', result.reply)]);
      const intent = requestedMedia ?? result.mediaIntent;
      if (intent === 'image') {
        if (game.imageRemaining > 0) void generateMedia(characterId, 'image', result.imagePrompt || text);
        else setToast('她想发照片，但自拍额度已经用完了');
      }
      if (intent === 'voice') {
        if (game.voiceRemaining > 0) void generateMedia(characterId, 'voice', result.voiceText || result.reply);
        else setToast('她想发语音，但语音额度已经用完了');
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setGame((state) => ({ ...state, textRemaining: Math.min(100, state.textRemaining + 1) }));
      const reason = controller.signal.aborted ? '回复超时，请重试' : error instanceof Error ? error.message : '网络开小差了，请重试';
      updateMessages(characterId, (items) => items.map((m) => m.id === userMessage.id ? { ...m, pending: false, failed: true, error: reason } : m));
    } finally {
      window.clearTimeout(timer);
      controllersRef.current.delete(controller);
      sendingRef.current = false;
      if (mountedRef.current) { setSending(false); setSendingCharacter(null); }
    }
  }, [game, input, leaving, updateMessages, generateMedia]);

  const chooseCharacter = (character: CharacterProfile) => {
    setGame((state) => {
      const existing = state.messages[character.id] ?? [];
      const messages = existing.length ? existing : [createMessage('assistant', character.greeting)];
      return { ...state, selectedCharacter: character.id, messages: { ...state.messages, [character.id]: messages } };
    });
  };

  const reset = () => {
    if (sendingRef.current || tryOnSending || Object.values(game.messages).some((items) => items?.some((m) => m.pending))) { setToast('请等待当前请求结束后再清空'); return; }
    if (!confirm('确定要清空当前账号的聊天记录和本地额度吗？')) return;
    canPersistRef.current = true;
    setStorageWarning('');
    setGame(initialGame());
  };

  const signOut = async () => {
    setLeaving(true);
    try {
      const result = await authClient.signOut();
      if (result?.error) throw new Error('退出失败');
      mountedRef.current = false;
      controllersRef.current.forEach((controller) => controller.abort());
      router.replace('/auth/sign-in');
      router.refresh();
    } catch { setLeaving(false); setToast('退出失败，请稍后重试'); }
  };

  if (!hydrated || leaving) return <div className="splash"><span>♥</span><p>正在准备心动相遇…</p></div>;
  if (!current) return <CharacterSelect warning={[storageWarning, toast].filter(Boolean).join(' ')} userEmail={userEmail} onChoose={chooseCharacter} onSignOut={() => void signOut()} />;

  return (
    <main className="chat-shell" style={{ '--accent': current.accent, '--accent-soft': current.accentSoft } as React.CSSProperties}>
      {storageWarning && <div className="storage-warning" role="status">{storageWarning}</div>}
      {toast && <div className="toast"><Icon name="sparkle" />{toast}</div>}
      <div className="chat-window">
        <aside className="chat-rail" aria-label="主要功能">
          <div className="rail-top">
            <button className="rail-brand" onClick={() => setGame((state) => ({ ...state, selectedCharacter: null }))} aria-label="返回角色选择">♥</button>
            <button className="rail-button active" aria-label="聊天"><Icon name="chat" /></button>
            <button className="rail-button" onClick={() => setGame((state) => ({ ...state, selectedCharacter: null }))} aria-label="选择角色"><Icon name="users" /></button>
            <button className="rail-button" onClick={reset} aria-label="清空聊天记录"><Icon name="archive" /></button>
          </div>
          <div className="rail-bottom">
            <i className="rail-online" aria-label="在线" />
            <button className="rail-button" onClick={() => void signOut()} aria-label="退出登录"><Icon name="settings" /></button>
          </div>
        </aside>

        <aside className="conversation-panel">
          <header className="conversation-heading">
            <div><small>AI LOVE STORY</small><strong>女神攻略</strong></div>
            <button onClick={() => setGame((state) => ({ ...state, selectedCharacter: null }))} aria-label="选择新角色"><Icon name="plus" /></button>
          </header>
          <label className="conversation-search">
            <span aria-hidden="true">⌕</span>
            <input value={conversationQuery} onChange={(event) => setConversationQuery(event.target.value)} placeholder="搜索会话" aria-label="搜索会话" />
          </label>
          <div className="conversation-list">
            {filteredCharacters.map((character) => {
              const lastMessage = game.messages[character.id]?.at(-1);
              const lastTime = lastMessage ? new Date(lastMessage.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
              return (
                <button key={character.id} className={`conversation-item ${current.id === character.id ? 'active' : ''}`} onClick={() => chooseCharacter(character)}>
                  <Image src={character.image} alt="" width={42} height={42} />
                  <span className="conversation-copy">
                    <span className="conversation-name"><strong>{character.name}</strong><time>{lastTime}</time></span>
                    <span className="conversation-preview">{lastMessage?.content ?? character.status}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="conversation-spacer" />
          <section className="relationship-strip" aria-label="剩余额度">
            <div><span>文字</span><strong>{game.textRemaining}</strong></div>
            <div><span>自拍</span><strong>{game.imageRemaining}</strong></div>
            <div><span>语音</span><strong>{game.voiceRemaining}</strong></div>
            <div><span>换衣</span><strong>{game.tryOnRemaining}</strong></div>
          </section>
          <div className="conversation-account"><span title={userEmail}>{userEmail}</span><button onClick={() => void signOut()}>退出</button></div>
        </aside>

        <section className="chat-phone">
        <header className="chat-header">
          <button className="icon-button mobile-back" onClick={() => setGame((state) => ({ ...state, selectedCharacter: null }))} aria-label="返回角色选择"><Icon name="back" /></button>
          <div className="header-person">
            <i className="header-online" />
            <div><strong>{current.name}</strong><span>在线 · {current.status}</span></div>
          </div>
          <div className="header-actions">
            <button className="icon-button" disabled aria-label="语音通话"><Icon name="phone" /></button>
            <button className="icon-button" disabled aria-label="视频通话"><Icon name="video" /></button>
            <button className="icon-button" onClick={reset} aria-label="清空记录"><Icon name="more" /></button>
          </div>
        </header>

        <div className="message-list" ref={scrollRef}>
          <div className="date-divider"><span>今天 · 心动相遇第 1 天</span></div>
          {currentMessages.map((message) => <MessageBubble key={message.id} message={message} character={current} retryDisabled={sending} onRetry={latestRetryable(currentMessages, message.id) ? () => void send(message.content, message.requestedMedia, message.id) : undefined} />)}
          {sending && sendingCharacter === current.id && <div className="message-row assistant"><Image src={current.image} alt="" width={34} height={34} /><div className="typing"><i/><i/><i/></div></div>}
        </div>

        <div className="suggestions">
          {['今天过得怎么样？', '你会喜欢什么样的人？', '我有点想你了'].map((text) => <button key={text} disabled={sending} onClick={() => void send(text)}>{text}</button>)}
        </div>

        <footer className="composer-wrap">
          <div className="media-actions">
            <button onClick={() => void send('好想看看你现在的样子', 'image')} disabled={!game.imageRemaining || sending}><Icon name="image" /><span>想看她</span><em>{game.imageRemaining}</em></button>
            <button onClick={() => void send('想听你对我说句话', 'voice')} disabled={!game.voiceRemaining || sending}><Icon name="voice" /><span>听语音</span><em>{game.voiceRemaining}</em></button>
            <button onClick={() => setTryOnOpen(true)} disabled={!game.tryOnRemaining || sending || tryOnSending}><Icon name="shirt" /><span>给她换衣</span><em>{game.tryOnRemaining}</em></button>
          </div>
          <div className="composer">
            <textarea value={input} onChange={(event) => setInput(event.target.value.slice(0, 50))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }} placeholder="和她说点什么…" rows={1} />
            <span className={input.length > 42 ? 'warn' : ''}>{input.length}/50 · {game.textRemaining}</span>
            <button onClick={() => void send()} disabled={!input.trim() || sending}><Icon name="send" /></button>
          </div>
        </footer>
        </section>
      </div>

      {tryOnOpen && (
        <div className="try-on-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeTryOn(); }}>
          <section className="try-on-dialog" role="dialog" aria-modal="true" aria-labelledby="try-on-title">
            <header>
              <div><small>AI VIRTUAL TRY-ON</small><h2 id="try-on-title">给{current.name}换一身衣服</h2></div>
              <button onClick={closeTryOn} disabled={tryOnSending} aria-label="关闭换衣面板"><Icon name="close" /></button>
            </header>
            <p className="try-on-tip">上传一张清晰的衣服图片，AI 会保留她的脸、发型、姿势和背景，只替换服装。</p>
            <div className="try-on-images">
              <figure><Image src={current.image} alt={`${current.name}当前照片`} width={240} height={320} priority /><figcaption>当前女友照片</figcaption></figure>
              <span>＋</span>
              <figure className={tryOnPreview ? 'has-preview' : ''}>
                {tryOnPreview ? <Image src={tryOnPreview} alt="待试穿服装" width={240} height={320} unoptimized /> : <button onClick={() => clothingInputRef.current?.click()}><Icon name="upload" /><strong>上传衣服图片</strong><small>JPG / PNG / WebP · 最大 8 MB</small></button>}
                <figcaption>{tryOnPreview ? '待试穿服装' : '服装参考图'}</figcaption>
              </figure>
            </div>
            <input ref={clothingInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectClothingImage} />
            {tryOnPreview && <button className="try-on-reselect" onClick={() => clothingInputRef.current?.click()} disabled={tryOnSending}>重新选择衣服</button>}
            <button className="try-on-submit" onClick={() => void generateTryOn()} disabled={!tryOnFile || tryOnSending}>
              {tryOnSending ? <><span className="try-on-spinner" />正在为她换衣，可能需要一点时间…</> : <><Icon name="sparkle" />开始换衣 · 剩余 {game.tryOnRemaining} 次</>}
            </button>
            <small className="try-on-safe">所有角色均为成年人 · 仅支持正常日常服装</small>
          </section>
        </div>
      )}
    </main>
  );
}

function CharacterSelect({ userEmail, warning, onChoose, onSignOut }: { warning: string; userEmail: string; onChoose: (character: CharacterProfile) => void; onSignOut: () => void }) {
  const [active, setActive] = useState<CharacterId>('zhixia');
  const selected = useMemo(() => getCharacter(active), [active]);
  return (
    <main className="select-shell" style={{ '--accent': selected.accent, '--accent-soft': selected.accentSoft } as React.CSSProperties}>
      <header className="select-header">
        <div className="brand-heart">♥</div>
        <div><strong>女神攻略</strong><span>YOUR AI LOVE STORY</span></div>
        <div className="account-controls"><span title={userEmail}>{userEmail}</span><button onClick={onSignOut}>退出</button></div>
      </header>
      {warning && <p className="storage-warning" role="status">{warning}</p>}
      <section className="select-intro"><span>CHAPTER 01 · 初次心动</span><h1>今晚，想和谁聊聊？</h1><p>四种性格，四段不同的故事。选择让你心动的她。</p></section>
      <section className="character-grid">
        {CHARACTERS.map((character) => (
          <button key={character.id} className={`character-card ${active === character.id ? 'active' : ''}`} onClick={() => setActive(character.id)} onDoubleClick={() => onChoose(character)} style={{ '--card-accent': character.accent } as React.CSSProperties}>
            <Image src={character.image} alt={`${character.name}，${character.age}岁，${character.archetype}`} fill sizes="(max-width: 760px) 44vw, 260px" priority />
            <div className="card-wash"/><span className="online-dot">在线</span>
            <div className="card-copy"><small>{character.archetype}</small><h2>{character.name}<em>{character.age}</em></h2><p>{character.tagline}</p></div>
            <i className="selected-mark">✓</i>
          </button>
        ))}
      </section>
      <section className="selected-profile">
        <div><span>你选择了</span><strong>{selected.name}</strong><p>{selected.age}岁 · {selected.archetype} · {selected.status}</p></div>
        <button onClick={() => onChoose(selected)}>和她相遇 <b>→</b></button>
      </section>
      <footer className="select-footer"><Icon name="sparkle" /> 所有角色均为成年人 · AI 生成内容</footer>
    </main>
  );
}

function MessageBubble({ message, character, onRetry, retryDisabled }: { message: ChatMessage; character: CharacterProfile; onRetry?: () => void; retryDisabled: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className={`message-row ${message.role}`}>
      {message.role === 'assistant' && <Image src={character.image} alt="" width={34} height={34} />}
      <div className={`bubble ${message.failed ? 'failed' : ''} ${message.mediaType ? 'media' : ''}`}>
        {message.pending && <span className="media-loading"><i /><i /><i /></span>}
        {!message.pending && message.mediaType === 'image' && message.mediaUrl && <Image src={message.mediaUrl} alt={`${character.name}发来的自拍`} width={280} height={380} unoptimized />}
        {!message.pending && message.mediaType === 'audio' && message.mediaUrl && <audio controls preload="metadata" src={message.mediaUrl} />}
        <p>{message.content}</p><time>{time}{message.pending && message.role === 'user' ? ' · 发送中' : message.failed ? ' · 失败' : ''}</time>
        {message.role === 'user' && message.failed && <div className="message-error" role="status"><span>{message.error ?? '消息未发送成功'}</span>{onRetry && <button onClick={onRetry} disabled={retryDisabled}>重试发送</button>}</div>}
      </div>
    </div>
  );
}
