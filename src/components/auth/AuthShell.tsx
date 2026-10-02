import Link from 'next/link';
import CodeBackground from '@/components/ui/code-background';

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
  codeBackground = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  codeBackground?: boolean;
}) {
  return (
    <main className={codeBackground ? 'auth-page has-code-background' : 'auth-page'}>
      {codeBackground && <CodeBackground label="EMAIL // LOGIN" />}
      <section className="auth-card">
        <Link className="auth-brand" href="/" aria-label="返回女神攻略首页">
          <span>♥</span>
          <div><strong>女神攻略</strong><small>YOUR AI LOVE STORY</small></div>
        </Link>
        <div className="auth-heading">
          <small>{eyebrow}</small>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
        {footer && <div className="auth-footer">{footer}</div>}
      </section>
      <p className="auth-safety">所有角色均为成年人 · AI 生成内容</p>
    </main>
  );
}
