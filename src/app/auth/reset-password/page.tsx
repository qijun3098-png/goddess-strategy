import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { ResetPasswordForm } from '@/components/auth/AuthForms';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams;
  return (
    <AuthShell eyebrow="SET NEW PASSWORD" title="设置一个新密码" description="输入邮箱验证码和新密码，完成后重新登录。" footer={<Link href="/auth/sign-in">返回登录</Link>}>
      <ResetPasswordForm initialEmail={email} />
    </AuthShell>
  );
}
