import 'server-only';

import { createHash } from 'node:crypto';
import { Resend } from 'resend';
import { getDb } from '@/lib/db';
import { generateLoveLetter } from '@/lib/loveLetter';

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

function dailyConfig() {
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.ARK_API_KEY?.trim()
    || !process.env.DAILY_EMAIL_TEST_RECIPIENT?.trim()) {
    throw new DailyEmailNotConfiguredError();
  }
}

function shanghaiDay() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

async function sendDailyEmail(userEmail: string, userName: string, day: string) {
  dailyConfig();
  const to = userEmail.trim().toLowerCase();
  // 使用 Resend 测试发件人时，只允许显式配置的测试邮箱；其他用户不调用 AI。
  if (to !== process.env.DAILY_EMAIL_TEST_RECIPIENT!.trim().toLowerCase()) {
    return { id: null, skipped: true };
  }
  if (to.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    throw new Error('收件人邮箱格式不正确');
  }
  const name = userName.replace(/[\r\n]/g, ' ').trim().slice(0, 100) || '玩家';
  const loveLetter = await generateLoveLetter(name);
  const chatUrl = 'https://goddess-strategy.vercel.app/game';
  try {
    const { data, error } = await new Resend(process.env.RESEND_API_KEY!.trim()).emails.send({
      from: WELCOME_EMAIL_FROM,
      to,
      subject: `早安 ${name}，今天也想你了`,
      html: `<div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; line-height: 1.8;">
        <p>${escapeHtml(loveLetter).replace(/\r?\n/g, '<br />')}</p>
        <br /><p>—— 你的虚拟伴侣 · 女神攻略</p>
        <p style="color: #999; font-size: 12px;">想跟我聊天？<a href="${chatUrl}">点这里回来找我</a></p>
      </div>`,
      text: `${loveLetter}\n\n—— 你的虚拟伴侣 · 女神攻略\n想跟我聊天？${chatUrl}`,
    }, {
      // 同一上海日期、同一邮箱共用幂等键；Resend 保存 24 小时。
      idempotencyKey: `daily-love/v1/${day}/${createHash('sha256').update(to).digest('hex')}`,
    });
    // 再次生成的 AI 文案可能不同；此错误表示相同键已用于其他内容，不能再次发送。
    if (error?.name === 'invalid_idempotent_request') return { id: null, skipped: true };
    if (error || !data?.id) throw new Error('Resend 未接受邮件');
    return { id: data.id, skipped: false };
  } catch {
    throw new Error('每日情话发送失败，请检查 Resend 配置和收件人限制');
  }
}

export async function sendDailyLoveLetter(userEmail: string, userName: string) {
  return sendDailyEmail(userEmail, userName, shanghaiDay());
}

/** public.users 是已进入游戏、建立游戏档案的用户；单个失败不终止群发。 */
export async function sendDailyLoveLetterToAll(): Promise<DailyEmailResult> {
  dailyConfig();
  if (!process.env.DATABASE_URL?.trim()) throw new DailyEmailNotConfiguredError();
  const result: DailyEmailResult = { sent: 0, failed: 0, skipped: 0 };
  const day = shanghaiDay();
  const db = getDb();
  let cursor = 0;
  while (true) {
    const { rows } = await db.query<{ id: number; email: string; username: string | null }>(
      'SELECT id, email, username FROM public.users WHERE id > $1 ORDER BY id LIMIT 100', [cursor],
    );
    if (rows.length === 0) break;
    for (const user of rows) {
      try {
        const delivery = await sendDailyEmail(user.email, user.username ?? '玩家', day);
        if (delivery.skipped) result.skipped++;
        else result.sent++;
      } catch {
        result.failed++;
        // 不记录邮箱、AI 原文或第三方错误。
        console.error('每日情话邮件发送失败');
      }
      // 串行发送并限速，避免快速生成时超过 Resend 的请求频率限制。
      await new Promise((resolve) => setTimeout(resolve, 600));
    }
    cursor = rows[rows.length - 1].id;
  }
  return result;
}
