import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignInForm } from '@/components/auth/AuthForms';

export default function SignInPage() {
  return (
    <AuthShell codeBackground eyebrow="WELCOME BACK" title="继续你的心动故事" description="使用注册邮箱登录，聊天记录与额度将绑定到你的账号。" footer={<>还没有账号？<Link href="/auth/sign-up">立即注册</Link></>}>
      <SignInForm />
    </AuthShell>
  );
}
