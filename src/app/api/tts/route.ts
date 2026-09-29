import { NextResponse } from 'next/server';
import { DEFAULT_SPEAKERS, SPEAKER_ENV } from '@/lib/characters';
import type { CharacterId } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

function decodeAudio(raw: string) {
  const buffers: Buffer[] = [];
  for (const line of raw.split(/\r?\n/).map((part) => part.trim()).filter(Boolean)) {
    try {
      const event = JSON.parse(line.replace(/^data:\s*/, '')) as { code?: number; message?: string; data?: string };
      if (event.code && event.code !== 0 && event.message !== 'OK') throw new Error(event.message ?? `语音服务错误 ${event.code}`);
      if (event.data) buffers.push(Buffer.from(event.data, 'base64'));
    } catch (error) {
      if (error instanceof SyntaxError) continue;
      throw error;
    }
  }
  if (!buffers.length) {
    try {
      const event = JSON.parse(raw) as { code?: number; message?: string; data?: string };
      if (event.code && event.code !== 0 && event.message !== 'OK') throw new Error(event.message ?? `语音服务错误 ${event.code}`);
      if (event.data) buffers.push(Buffer.from(event.data, 'base64'));
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
    }
  }
  return Buffer.concat(buffers);
}

export async function POST(request: Request) {
  try {
    const { characterId, text } = await request.json() as { characterId?: CharacterId; text?: string };
    if (!characterId || !text?.trim()) return NextResponse.json({ error: '语音请求不完整' }, { status: 400 });
    const apiKey = process.env.VOLCENGINE_TTS_API_KEY;
    if (!apiKey) return NextResponse.json({ error: '尚未配置 VOLCENGINE_TTS_API_KEY，暂时不能生成语音' }, { status: 503 });
    const envName = SPEAKER_ENV[characterId];
    const speaker = process.env[envName] ?? DEFAULT_SPEAKERS[characterId];
    const keyPrefix = process.env.VOLCENGINE_TTS_KEY_PREFIX?.trim();
    const authorization = keyPrefix ? `${keyPrefix} ${apiKey.replace(/^Bearer\s+/i, '')}` : apiKey.replace(/^Bearer\s+/i, '');
    const response = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
      method: 'POST',
      headers: { 'X-Api-Key': authorization, 'X-Api-Resource-Id': process.env.VOLCENGINE_TTS_RESOURCE_ID ?? 'seed-tts-2.0', 'X-Api-Request-Id': crypto.randomUUID(), Connection: 'keep-alive', 'Content-Type': 'application/json' },
      body: JSON.stringify({ req_params: { text: text.slice(0, 160), speaker, audio_params: { format: 'mp3', sample_rate: 24000 }, additions: JSON.stringify({ disable_markdown_filter: true, enable_language_detector: true }) } }),
      signal: AbortSignal.timeout(110_000),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.error('TTS provider error', response.status, detail.slice(0, 500));
      throw new Error(`语音生成失败（${response.status}）`);
    }
    const audio = decodeAudio(await response.text());
    if (!audio.length) throw new Error('语音服务没有返回音频');
    return new Response(audio, { headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '语音生成失败' }, { status: 500 });
  }
}
