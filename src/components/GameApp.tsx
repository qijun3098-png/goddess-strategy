'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHARACTERS, getCharacter, type CharacterProfile } from '@/lib/characters';
import { authClient } from '@/lib/auth/client';
import { loadMedia, saveMedia } from '@/lib/mediaStore';
import type { CharacterId, ChatMessage, ChatResponse, GameState, MediaIntent } from '@/lib/types';

const STORAGE_KEY = 'goddess-strategy-v1';
const DEFAULT_STATE: GameState = { selectedCharacter: null, messages: {}, textRemaining: 100, imageRemaining: 3, voiceRemaining: 3, tryOnRemaining: 3 };

const Icon = ({ name }: { name: 'back' | 'more' | 'image' | 'voice' | 'shirt' | 'send' | 'sparkle' | 'heart' | 'close' | 'upload' }) => {
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
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

function createMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return { id: crypto.randomUUID(), role, content, createdAt: Date.now() };
}

export function GameApp({ userEmail }: { userEmail: string }) {
  const router = useRouter();
  const [game, setGame] = useState<GameState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [tryOnOpen, setTryOnOpen] = useState(false);
  const [tryOnFile, setTryOnFile] = useState<File | null>(null);
  const [tryOnPreview, setTryOnPreview] = useState('');
  const [tryOnSending, setTryOnSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const clothingInputRef = useRef<HTMLInputElement>(null);
  const mediaRestoredRef = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setGame({ ...DEFAULT_STATE, ...(JSON.parse(raw) as GameState) });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const persistable: GameState = {
      ...game,
      messages: Object.fromEntries(Object.entries(game.messages).map(([key, messages]) => [key, messages?.map((message) => ({ ...message, mediaUrl: undefined }))])),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
  }, [game, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (mediaRestoredRef.current) return;
    mediaRestoredRef.current = true;
    const restore = async () => {
      const updates: Array<{ id: string; url: string }> = [];
      for (const messages of Object.values(game.messages)) {
        for (const message of messages ?? []) {
          if (message.mediaKey && !message.mediaUrl) {
            const blob = await loadMedia(message.mediaKey).catch(() => undefined);
            if (blob) updates.push({ id: message.id, url: URL.createObjectURL(blob) });
          }
        }
      }
      if (updates.length) {
        const urls = new Map(updates.map((item) => [item.id, item.url]));
        setGame((current) => ({ ...current, messages: Object.fromEntries(Object.entries(current.messages).map(([key, messages]) => [key, messages?.map((message) => urls.has(message.id) ? { ...message, mediaUrl: urls.get(message.id) } : message)])) }));
      }
    };
    void restore();
  }, [hydrated, game.messages]);

  const current = game.selectedCharacter ? getCharacter(game.selectedCharacter) : null;
  const currentMessages = useMemo(() => current ? game.messages[current.id] ?? [] : [], [current, game.messages]);

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
    setGame((currentGame) => ({ ...currentGame, messages: { ...currentGame.messages, [characterId]: updater(currentGame.messages[characterId] ?? []) } }));
  }, []);

  const generateMedia = useCallback(async (characterId: CharacterId, intent: Exclude<MediaIntent, 'none'>, content: string) => {
    const mediaId = crypto.randomUUID();
    const mediaKey = `media-${mediaId}`;
    const type = intent === 'image' ? 'image' : 'audio';
    const pending: ChatMessage = { id: mediaId, role: 'assistant', content: intent === 'image' ? '正在为你拍一张照片…' : '正在录一段语音…', createdAt: Date.now(), mediaType: type, pending: true };
    updateMessages(characterId, (messages) => [...messages, pending]);
    setGame((state) => ({ ...state, [intent === 'image' ? 'imageRemaining' : 'voiceRemaining']: Math.max(0, state[intent === 'image' ? 'imageRemaining' : 'voiceRemaining'] - 1) }));

    try {
      const endpoint = intent === 'image' ? '/api/image' : '/api/tts';
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId, text: content }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? '生成失败');
      const blob = await response.blob();
      await saveMedia(mediaKey, blob);
      const mediaUrl = URL.createObjectURL(blob);
      updateMessages(characterId, (messages) => messages.map((message) => message.id === mediaId ? { ...message, content: intent === 'image' ? '只给你看哦。' : content, mediaUrl, mediaKey, pending: false } : message));
    } catch (error) {
      setGame((state) => ({ ...state, [intent === 'image' ? 'imageRemaining' : 'voiceRemaining']: Math.min(3, state[intent === 'image' ? 'imageRemaining' : 'voiceRemaining'] + 1) }));
      updateMessages(characterId, (messages) => messages.map((message) => message.id === mediaId ? { ...message, content: error instanceof Error ? error.message : '生成失败，请稍后再试', pending: false, failed: true } : message));
    }
  }, [updateMessages]);

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
      pending: true,
    };

    setTryOnSending(true);
    updateMessages(characterId, (messages) => [...messages, pending]);
    setGame((state) => ({ ...state, tryOnRemaining: Math.max(0, state.tryOnRemaining - 1) }));

    try {
      const formData = new FormData();
      formData.append('characterId', characterId);
      formData.append('clothingImage', tryOnFile);
      const response = await fetch('/api/try-on', { method: 'POST', body: formData });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? '换衣生成失败');

      const blob = await response.blob();
      await saveMedia(mediaKey, blob);
      const mediaUrl = URL.createObjectURL(blob);
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
      setGame((state) => ({ ...state, tryOnRemaining: Math.min(3, state.tryOnRemaining + 1) }));
      updateMessages(characterId, (messages) => messages.map((message) => message.id === messageId ? {
        ...message,
        content: error instanceof Error ? error.message : '换衣生成失败，请稍后再试',
        pending: false,
        failed: true,
      } : message));
    } finally {
      setTryOnSending(false);
    }
  }, [current, game.tryOnRemaining, tryOnFile, tryOnSending, updateMessages]);

  const send = useCallback(async (forcedText?: string, forcedMedia?: Exclude<MediaIntent, 'none'>) => {
    const characterId = game.selectedCharacter;
    const text = (forcedText ?? input).trim();
    if (!characterId || !text || sending) return;
    if (game.textRemaining <= 0) { setToast('免费文字消息已经用完啦'); return; }
    if (text.length > 50) { setToast('每条消息最多 50 个字'); return; }
    if (forcedMedia === 'image' && game.imageRemaining <= 0) { setToast('今天的自拍额度已经用完'); return; }
    if (forcedMedia === 'voice' && game.voiceRemaining <= 0) { setToast('今天的语音额度已经用完'); return; }

    const userMessage = createMessage('user', text);
    const history = [...(game.messages[characterId] ?? []), userMessage].filter((message) => !message.mediaType).slice(-12);
    setInput('');
    setSending(true);
    updateMessages(characterId, (messages) => [...messages, userMessage]);
    setGame((state) => ({ ...state, textRemaining: state.textRemaining - 1 }));

    try {
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterId, messages: history, forcedMedia }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? '消息发送失败');
      const result = await response.json() as ChatResponse;
      updateMessages(characterId, (messages) => [...messages, createMessage('assistant', result.reply)]);
      const intent = forcedMedia ?? result.mediaIntent;
      if (intent === 'image') {
        if (game.imageRemaining > 0) void generateMedia(characterId, 'image', result.imagePrompt || text);
        else setToast('她想发照片，但自拍额度已经用完了');
      }
      if (intent === 'voice') {
        if (game.voiceRemaining > 0) void generateMedia(characterId, 'voice', result.voiceText || result.reply);
        else setToast('她想发语音，但语音额度已经用完了');
      }
    } catch (error) {
      setGame((state) => ({ ...state, textRemaining: Math.min(100, state.textRemaining + 1) }));
      updateMessages(characterId, (messages) => [...messages, { ...createMessage('assistant', error instanceof Error ? error.message : '网络开小差了，再试一次吧'), failed: true }]);
    } finally {
      setSending(false);
    }
  }, [game, input, sending, updateMessages, generateMedia]);

  const chooseCharacter = (character: CharacterProfile) => {
    setGame((state) => {
      const existing = state.messages[character.id] ?? [];
      const messages = existing.length ? existing : [createMessage('assistant', character.greeting)];
      return { ...state, selectedCharacter: character.id, messages: { ...state.messages, [character.id]: messages } };
    });
  };

  const reset = () => {
    if (!confirm('确定要清空所有聊天记录和本地额度吗？')) return;
    setGame(DEFAULT_STATE);
  };

  const signOut = async () => {
    await authClient.signOut();
    router.replace('/auth/sign-in');
    router.refresh();
  };

  if (!hydrated) return <div className="splash"><span>♥</span><p>正在准备心动相遇…</p></div>;
  if (!current) return <CharacterSelect userEmail={userEmail} onChoose={chooseCharacter} onSignOut={() => void signOut()} />;

  return (
    <main className="chat-shell" style={{ '--accent': current.accent, '--accent-soft': current.accentSoft } as React.CSSProperties}>
      {toast && <div className="toast"><Icon name="sparkle" />{toast}</div>}
      <div className="chat-phone">
        <header className="chat-header">
          <button className="icon-button" onClick={() => setGame((state) => ({ ...state, selectedCharacter: null }))} aria-label="返回角色选择"><Icon name="back" /></button>
          <div className="header-person">
            <Image src={current.image} alt={current.name} width={46} height={46} priority />
            <div><strong>{current.name}</strong><span><i />在线 · {current.status}</span></div>
          </div>
          <button className="icon-button" onClick={reset} aria-label="清空记录"><Icon name="more" /></button>
        </header>

        <section className="relationship-strip">
          <div><span>文字</span><strong>{game.textRemaining}</strong></div>
          <div><span>自拍</span><strong>{game.imageRemaining}</strong></div>
          <div><span>语音</span><strong>{game.voiceRemaining}</strong></div>
          <div><span>换衣</span><strong>{game.tryOnRemaining}</strong></div>
          <p><Icon name="heart" /> 心动相遇 · 第 1 天</p>
        </section>

        <div className="message-list" ref={scrollRef}>
          <div className="date-divider"><span>今天</span></div>
          {currentMessages.map((message) => <MessageBubble key={message.id} message={message} character={current} />)}
          {sending && <div className="message-row assistant"><Image src={current.image} alt="" width={34} height={34} /><div className="typing"><i/><i/><i/></div></div>}
        </div>

        <div className="suggestions">
          {['今天过得怎么样？', '你会喜欢什么样的人？', '我有点想你了'].map((text) => <button key={text} onClick={() => void send(text)}>{text}</button>)}
        </div>

        <footer className="composer-wrap">
          <div className="media-actions">
            <button onClick={() => void send('好想看看你现在的样子', 'image')} disabled={!game.imageRemaining || sending}><Icon name="image" /><span>想看她</span><em>{game.imageRemaining}</em></button>
            <button onClick={() => void send('想听你对我说句话', 'voice')} disabled={!game.voiceRemaining || sending}><Icon name="voice" /><span>听语音</span><em>{game.voiceRemaining}</em></button>
            <button onClick={() => setTryOnOpen(true)} disabled={!game.tryOnRemaining || sending || tryOnSending}><Icon name="shirt" /><span>给她换衣</span><em>{game.tryOnRemaining}</em></button>
          </div>
          <div className="composer">
            <textarea value={input} onChange={(event) => setInput(event.target.value.slice(0, 50))} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="和她说点什么…" rows={1} />
            <span className={input.length > 42 ? 'warn' : ''}>{input.length}/50</span>
            <button onClick={() => void send()} disabled={!input.trim() || sending}><Icon name="send" /></button>
          </div>
        </footer>
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

function CharacterSelect({ userEmail, onChoose, onSignOut }: { userEmail: string; onChoose: (character: CharacterProfile) => void; onSignOut: () => void }) {
  const [active, setActive] = useState<CharacterId>('zhixia');
  const selected = useMemo(() => getCharacter(active), [active]);
  return (
    <main className="select-shell" style={{ '--accent': selected.accent, '--accent-soft': selected.accentSoft } as React.CSSProperties}>
      <header className="select-header">
        <div className="brand-heart">♥</div>
        <div><strong>女神攻略</strong><span>YOUR AI LOVE STORY</span></div>
        <div className="account-controls"><span title={userEmail}>{userEmail}</span><button onClick={onSignOut}>退出</button></div>
      </header>
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

function MessageBubble({ message, character }: { message: ChatMessage; character: CharacterProfile }) {
  const time = new Date(message.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  return (
    <div className={`message-row ${message.role}`}>
      {message.role === 'assistant' && <Image src={character.image} alt="" width={34} height={34} />}
      <div className={`bubble ${message.failed ? 'failed' : ''} ${message.mediaType ? 'media' : ''}`}>
        {message.pending && <span className="media-loading"><i /><i /><i /></span>}
        {!message.pending && message.mediaType === 'image' && message.mediaUrl && <Image src={message.mediaUrl} alt={`${character.name}发来的自拍`} width={280} height={380} unoptimized />}
        {!message.pending && message.mediaType === 'audio' && message.mediaUrl && <audio controls preload="metadata" src={message.mediaUrl} />}
        <p>{message.content}</p><time>{time}{message.failed ? ' · 失败' : ''}</time>
      </div>
    </div>
  );
}
