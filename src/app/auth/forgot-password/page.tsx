import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { ForgotPasswordForm } from '@/components/auth/AuthForms';

export default function ForgotPasswordPage() {
  return (
    <AuthShell eyebrow="PASSWORD RECOVERY" title="找回账号密码" description="填写注册邮箱，我们会发送一次性验证码。" footer={<Link href="/auth/sign-in">想起密码了，返回登录</Link>}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
