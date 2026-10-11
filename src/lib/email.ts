import 'server-only';

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
