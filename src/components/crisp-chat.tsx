'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    $crisp?: { push(command: unknown[]): unknown };
    CRISP_WEBSITE_ID?: string;
  }
}

/** 全站共用一个 Crisp 会话；页面导航或 Strict Mode 重挂载不会重置它。 */
export default function CrispChat() {
  useEffect(() => {
    const websiteId = process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID?.trim();
    if (!websiteId || document.getElementById('crisp-chat-script')) return;

    window.$crisp ??= [];
    window.CRISP_WEBSITE_ID = websiteId;
    const script = document.createElement('script');
    script.id = 'crisp-chat-script';
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    // 加载失败时允许后续挂载重试；第三方服务故障不影响游戏。
    script.onerror = () => script.remove();
    document.head.appendChild(script);
    // SDK 属于根布局的全站单例，保留脚本以避免开发模式重复加载。
  }, []);

  return null;
}
