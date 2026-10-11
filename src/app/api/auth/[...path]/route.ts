import { after, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';
import { sendWelcomeEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const maxDuration = 60;

const handlers = auth.handler();
export const { GET, PUT, DELETE, PATCH } = handlers;

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const response = await handlers.POST(request, context);
  if (!response.ok) return response;

  try {
    const { path } = await context.params;
    if (path.length !== 2 || path[0] !== 'sign-up' || path[1] !== 'email') return response;

    // 读取副本，原始响应正文、状态和 Cookie 保持完整。
    const body = await response.clone().json() as {
      error?: unknown;
      user?: { id?: unknown; email?: unknown; name?: unknown };
    } | null;
    const user = body?.user;
    if (body?.error || !user || typeof user.id !== 'string' || typeof user.email !== 'string') return response;
    if (!user.id.trim()) return response;
    const userEmail = user.email;
    const userName = typeof user.name === 'string' ? user.name : '玩家';

    after(async () => {
      try {
        await sendWelcomeEmail(userEmail, userName);
      } catch {
        console.error('注册成功后的欢迎邮件发送失败，请检查服务端邮件配置和收件人限制');
      }
    });
  } catch {
    console.error('注册成功后的欢迎邮件任务未安排，请检查认证响应和后台任务配置');
  }

  return response;
}
