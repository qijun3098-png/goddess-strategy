import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getCharacter } from '@/lib/characters';
import { getAuthenticatedAppUser } from '@/lib/auth/user';
import type { CharacterId } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 180;

const UNSAFE_REQUEST = /(未成年|学生妹|裸照|全裸|裸体|性器官|色情|做爱|性交)/i;

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedAppUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const { characterId, text } = await request.json() as { characterId?: CharacterId; text?: string };
    if (!characterId || !text) return NextResponse.json({ error: '图片请求不完整' }, { status: 400 });
    if (UNSAFE_REQUEST.test(text)) return NextResponse.json({ error: '这个图片请求不符合内容安全规则' }, { status: 400 });
    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: '尚未配置 ARK_API_KEY，暂时不能生成自拍' }, { status: 503 });
    const character = getCharacter(characterId);
    const fileName = character.image.split('/').at(-1);
    const reference = await readFile(path.join(process.cwd(), 'public', 'characters', fileName ?? ''));
    const image = `data:image/png;base64,${reference.toString('base64')}`;
    const prompt = `以参考图中的成年女性为唯一人物，严格保持她的脸部身份、发型、年龄感、身材比例、服装和主要场景一致。${character.imageIdentity}。现在她${text}。生成一张自然真实的手机自拍，生活感，镜头自然，光线细腻，姿势和表情可以变化。禁止文字、水印、裸露、内衣、色情姿势和未成年人形象。`;
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: process.env.ARK_IMAGE_MODEL ?? 'doubao-seedream-4-0-250828', prompt, image, size: '1024x1536', sequential_image_generation: 'disabled', response_format: 'url', watermark: false }),
      signal: AbortSignal.timeout(170_000),
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      throw new Error(detail?.error?.message ? `自拍生成失败：${detail.error.message}` : `自拍生成失败（${response.status}）`);
    }
    const data = await response.json() as { data?: Array<{ url?: string; b64_json?: string }> };
    const result = data.data?.[0];
    if (result?.b64_json) return new Response(Buffer.from(result.b64_json, 'base64'), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
    if (!result?.url) throw new Error('图片服务没有返回结果');
    const imageResponse = await fetch(result.url);
    if (!imageResponse.ok) throw new Error('图片下载失败');
    return new Response(await imageResponse.arrayBuffer(), { headers: { 'Content-Type': imageResponse.headers.get('content-type') ?? 'image/jpeg', 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : '自拍生成失败' }, { status: 500 });
  }
}
