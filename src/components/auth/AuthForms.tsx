'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { authClient } from '@/lib/auth/client';

function errorMessage(error: { code?: string; message?: string } | null) {
  const code = error?.code ?? '';
  const message = error?.message ?? '';
  if (/INVALID_EMAIL|email/i.test(code) && /invalid/i.test(message)) return '请输入有效的邮箱地址。';
  if (/INVALID_PASSWORD|PASSWORD_TOO_SHORT/i.test(code)) return '密码至少需要 8 个字符。';
  if (/USER_ALREADY_EXISTS|already.*exist/i.test(`${code} ${message}`)) return '这个邮箱已经注册，请直接登录。';
  if (/INVALID_OTP|OTP_EXPIRED/i.test(code)) return '验证码错误或已经过期，请重新获取。';
  if (/EMAIL_NOT_VERIFIED/i.test(code)) return '邮箱尚未验证，请先输入邮件中的验证码。';
  if (/INVALID_EMAIL_OR_PASSWORD|INVALID_PASSWORD|credential/i.test(`${code} ${message}`)) return '邮箱或密码不正确。';
  return message || '操作失败，请稍后再试。';
}

function Notice({ error, success }: { error?: string; success?: string }) {
  if (!error && !success) return null;
  return <p className={`auth-notice ${error ? 'error' : 'success'}`} role="status">{error || success}</p>;
}

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    try {
      const result = await authClient.signIn.email({ email: email.trim().toLowerCase(), password });
      if (result.error) {
        setError(errorMessage(result.error));
        return;
      }
      router.replace('/game');
      router.refresh();
    } catch {
      setError('登录服务暂时不可用，请稍后再试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>邮箱<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>密码<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required /></label>
      <div className="auth-form-row"><Link href="/auth/forgot-password">忘记密码？</Link></div>
      <Notice error={error} />
      <button className="auth-submit" disabled={pending}>{pending ? '正在登录…' : '登录并继续'}</button>
      {email && <Link className="auth-secondary-link" href={`/auth/verify-email?email=${encodeURIComponent(email.trim())}`}>没有收到或需要重新输入验证码？</Link>}
    </form>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致。');
      return;
    }
    setPending(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const result = await authClient.signUp.email({ email: normalizedEmail, password, name: '玩家' });
      if (result.error) {
        setError(errorMessage(result.error));
        return;
      }
      router.push(`/auth/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
    } catch {
      setError('注册服务暂时不可用，请稍后再试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>邮箱<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>密码<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required /><small>至少 8 个字符</small></label>
      <label>确认密码<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required /></label>
      <Notice error={error} />
      <button className="auth-submit" disabled={pending}>{pending ? '正在创建账号…' : '注册并获取验证码'}</button>
    </form>
  );
}

export function VerifyEmailForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setPending(true);
    try {
      const result = await authClient.emailOtp.verifyEmail({ email: email.trim().toLowerCase(), otp: otp.trim() });
      if (result.error) {
        setError(errorMessage(result.error));
        return;
      }
      router.replace('/game');
      router.refresh();
    } catch {
      setError('验证服务暂时不可用，请稍后再试。');
    } finally {
      setPending(false);
    }
  }

  async function resend() {
    setError('');
    setSuccess('');
    if (!email.trim()) {
      setError('请先填写邮箱地址。');
      return;
    }
    setPending(true);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email: email.trim().toLowerCase(), type: 'email-verification' });
      if (result.error) setError(errorMessage(result.error));
      else setSuccess('新的验证码已经发送，请检查邮箱。');
    } catch {
      setError('验证码发送失败，请稍后再试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={verify}>
      <label>邮箱<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>6 位验证码<input className="auth-otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} minLength={6} maxLength={6} required /></label>
      <Notice error={error} success={success} />
      <button className="auth-submit" disabled={pending || otp.length !== 6}>{pending ? '正在验证…' : '验证邮箱并进入游戏'}</button>
      <button className="auth-text-button" type="button" disabled={pending} onClick={() => void resend()}>重新发送验证码</button>
    </form>
  );
}

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setPending(true);
    const normalizedEmail = email.trim().toLowerCase();
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({ email: normalizedEmail, type: 'forget-password' });
      if (result.error) {
        setError(errorMessage(result.error));
        return;
      }
      router.push(`/auth/reset-password?email=${encodeURIComponent(normalizedEmail)}`);
    } catch {
      setError('验证码发送失败，请稍后再试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>注册邮箱<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <Notice error={error} />
      <button className="auth-submit" disabled={pending}>{pending ? '正在发送…' : '发送重置验证码'}</button>
    </form>
  );
}

export function ResetPasswordForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('两次输入的新密码不一致。');
      return;
    }
    setPending(true);
    try {
      const result = await authClient.emailOtp.resetPassword({ email: email.trim().toLowerCase(), otp: otp.trim(), password });
      if (result.error) {
        setError(errorMessage(result.error));
        return;
      }
      router.replace('/auth/sign-in?reset=1');
    } catch {
      setError('密码重置失败，请稍后再试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label>注册邮箱<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>验证码<input className="auth-otp" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} minLength={6} maxLength={6} required /></label>
      <label>新密码<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required /></label>
      <label>确认新密码<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} maxLength={128} required /></label>
      <Notice error={error} />
      <button className="auth-submit" disabled={pending || otp.length !== 6}>{pending ? '正在重置…' : '设置新密码'}</button>
    </form>
  );
}
