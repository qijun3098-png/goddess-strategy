import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

export const GAME_URL = 'https://goddess-strategy.vercel.app/game';

export function EmailLayout({ preview, eyebrow, title, children, buttonText }: {
  preview: string; eyebrow: string; title: string; children: ReactNode; buttonText: string;
}) {
  return (
    <Html lang="zh-CN">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: '#f7efed', margin: 0, padding: '32px 12px', fontFamily: 'Arial, "Microsoft YaHei", sans-serif', color: '#332b29' }}>
        <Container style={{ maxWidth: '560px', backgroundColor: '#fffaf7', borderRadius: '20px', border: '1px solid #eaded9' }}>
          <Section style={{ padding: '36px 24px' }}>
            <Text style={{ color: '#8e3045', fontSize: '18px', fontWeight: 700, margin: '0 0 6px' }}>♥ 女神攻略</Text>
            <Text style={{ color: '#9b8a84', fontSize: '11px', letterSpacing: '2px', margin: '0 0 32px' }}>YOUR AI LOVE STORY</Text>
            <Text style={{ color: '#8e3045', fontSize: '12px', letterSpacing: '2px', margin: '0 0 10px' }}>{eyebrow}</Text>
            <Heading as="h1" style={{ fontSize: '26px', lineHeight: '1.5', margin: '0 0 24px' }}>{title}</Heading>
            {children}
            <Section style={{ marginTop: '28px', marginBottom: '28px' }}>
              <Button href={GAME_URL} style={{ backgroundColor: '#8e3045', color: '#ffffff', borderRadius: '10px', padding: '14px 24px', fontSize: '16px', fontWeight: 700, textDecoration: 'none' }}>{buttonText}</Button>
            </Section>
            <Hr style={{ borderColor: '#eaded9' }} />
            <Text style={{ color: '#93837d', fontSize: '12px', lineHeight: '1.8', marginBottom: 0 }}>女神攻略 · 你的心动故事<br />所有角色均为成年人 · AI 生成内容</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const paragraphStyle = { fontSize: '16px', lineHeight: '1.9', color: '#5c4d47', margin: '0 0 16px' };
