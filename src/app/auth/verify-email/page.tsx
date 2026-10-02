import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { VerifyEmailForm } from '@/components/auth/AuthForms';

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams;
  return (
    <AuthShell eyebrow="VERIFY EMAIL" title="查收邮箱验证码" description="输入邮件中的 6 位验证码。验证完成后会自动登录。" footer={<Link href="/auth/sign-in">返回登录</Link>}>
      <VerifyEmailForm initialEmail={email} />
    </AuthShell>
  );
}
