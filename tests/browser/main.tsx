import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from '../../src/components/GameApp';
import '../../src/app/globals.css';

let failNext = false;
window.fetch = async (_input, options) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 250);
    options?.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });
  if (failNext) { failNext = false; return new Response(JSON.stringify({ error: '模拟网络失败' }), { status: 503 }); }
  return new Response(JSON.stringify({ reply: '验收回复：我收到啦。', mediaIntent: 'none' }), { status: 200 });
};
function BrowserCheck() {
  const [account, setAccount] = useState('A');
  return <><div style={{ position: 'fixed', top: 0, left: 0, zIndex: 100, background: '#fff', color: '#000', padding: 8 }}>
    <strong>仅本地模拟验收 · 当前账号 {account}</strong>{' '}
    <button onClick={() => setAccount(account === 'A' ? 'B' : 'A')}>切换账号</button>{' '}
    <button onClick={() => { failNext = true; }}>下一次请求模拟失败</button>
  </div><GameApp userId={`browser-test-${account}`} userEmail={`${account}@example.test`} /></>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserCheck /></StrictMode>);
