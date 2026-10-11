import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { DailyEmailNotConfiguredError, sendDailyLoveLetterToAll } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret?.trim()) {
    console.error('每日情话任务缺少 CRON_SECRET 配置');
    return NextResponse.json({ error: '定时任务尚未配置' }, { status: 503 });
  }

  const actual = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: '未授权访问' }, { status: 401 });
  }

  try {
    const result = await sendDailyLoveLetterToAll();
    return NextResponse.json({
      success: result.failed === 0,
      message: result.failed === 0 ? '每日情话发送完成' : '部分邮件发送失败',
      ...result,
      time: new Date().toISOString(),
    }, { status: result.failed === 0 ? 200 : 500 });
  } catch (error) {
    if (error instanceof DailyEmailNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error('每日情话任务执行失败');
    return NextResponse.json({ error: '发送失败' }, { status: 500 });
  }
}
