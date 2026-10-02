import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignUpForm } from '@/components/auth/AuthForms';

export default function SignUpPage() {
  return (
    <AuthShell eyebrow="CREATE ACCOUNT" title="创建你的专属账号" description="只需邮箱和密码。注册后输入邮件验证码，即可进入游戏。" footer={<>已经注册？<Link href="/auth/sign-in">返回登录</Link></>}>
      <SignUpForm />
    </AuthShell>
  );
}
