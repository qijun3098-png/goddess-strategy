import 'server-only';

import { createHash } from 'node:crypto';
import { Resend } from 'resend';

const WELCOME_EMAIL_FROM = '女神攻略 <onboarding@resend.dev>';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character]!));
}

/** Resend 测试发件人只能向 Resend 账号绑定的邮箱发送普通测试邮件。 */
export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error('缺少 RESEND_API_KEY，欢迎邮件服务尚未配置');

  const to = userEmail.trim();
  if (to.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('收件人邮箱格式不正确');
  }
  const name = userName.trim().slice(0, 100) || '玩家';
  const safeName = escapeHtml(name);
  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from: WELCOME_EMAIL_FROM,
      to,
      subject: '你好呀，欢迎来到女神攻略 💌',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; line-height: 1.8;">
          <h2>Hi ${safeName}，欢迎来到女神攻略！</h2>
          <p>你的心动故事，从这里开始。</p>
          <p>选择喜欢的角色，聊聊今天发生的趣事，或分享你的心情。</p>
          <p>期待与你相遇，开启属于你的故事。</p>
          <br />
          <p>—— 女神攻略</p>
        </div>
      `,
      text: `Hi ${name}，欢迎来到女神攻略！\n\n你的心动故事，从这里开始。\n选择喜欢的角色，聊聊今天发生的趣事，或分享你的心情。\n期待与你相遇，开启属于你的故事。\n\n—— 女神攻略`,
    }, {
      // 同一邮箱的欢迎邮件在 Resend 的 24 小时幂等窗口内去重。
      idempotencyKey: `welcome-email/v1/${createHash('sha256').update(to.toLowerCase()).digest('hex')}`,
    });
    if (error || !data?.id) throw new Error('Resend 未接受邮件');
    return { id: data.id };
  } catch {
    // 不把第三方错误中的邮箱、请求信息或凭据传给调用方。
    throw new Error('欢迎邮件发送失败，请检查 Resend 配置和收件人限制');
  }
}

export interface DailyEmailResult {
  sent: number;
  failed: number;
  skipped: number;
}

export class DailyEmailNotConfiguredError extends Error {
  constructor() {
    super('每日情话邮件发送服务尚未配置');
    this.name = 'DailyEmailNotConfiguredError';
  }
}

export async function sendDailyLoveLetterToAll(): Promise<DailyEmailResult> {
  // 后续在此接入收件人筛选、邮件发送和每日去重。
  throw new DailyEmailNotConfiguredError();
}
