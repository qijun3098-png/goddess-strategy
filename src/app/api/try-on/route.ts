import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { CHARACTERS, getCharacter } from '@/lib/characters';
import type { CharacterId } from '@/lib/types';
import { generateTryOn, SeedreamServiceError } from '@/services/seedream';

export const runtime = 'nodejs';
export const maxDuration = 180;

const MAX_CLOTHING_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const RESULT_DOWNLOAD_TIMEOUT_MS = 30_000;

function isCharacterId(value: string): value is CharacterId {
  return CHARACTERS.some((character) => character.id === value);
}

function toDataUrl(buffer: Buffer | ArrayBuffer, mimeType: string) {
  const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  return `data:${mimeType};base64,${Buffer.from(bytes).toString('base64')}`;
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();

  try {
    const formData = await request.formData();
    const characterId = String(formData.get('characterId') ?? '');
    const clothingImage = formData.get('clothingImage');

    if (!isCharacterId(characterId)) {
      return NextResponse.json({ error: '请选择需要换衣的角色', requestId }, { status: 400 });
    }
    if (!(clothingImage instanceof File) || clothingImage.size === 0) {
      return NextResponse.json({ error: '请上传衣服图片', requestId }, { status: 400 });
    }
    if (!ALLOWED_IMAGE_TYPES.has(clothingImage.type)) {
      return NextResponse.json({ error: '衣服图片仅支持 JPG、PNG 或 WebP', requestId }, { status: 400 });
    }
    if (clothingImage.size > MAX_CLOTHING_FILE_SIZE) {
      return NextResponse.json({ error: '衣服图片不能超过 8 MB', requestId }, { status: 400 });
    }

    console.info('[try-on] request received', {
      requestId,
      characterId,
      clothingType: clothingImage.type,
      clothingSize: clothingImage.size,
    });

    const character = getCharacter(characterId);
    const characterFileName = character.image.split('/').at(-1);
    if (!characterFileName) throw new Error('角色照片不存在');

    const [characterBuffer, clothingBuffer] = await Promise.all([
      readFile(path.join(process.cwd(), 'public', 'characters', characterFileName)),
      clothingImage.arrayBuffer(),
    ]);
    const result = await generateTryOn(
      toDataUrl(characterBuffer, 'image/png'),
      toDataUrl(clothingBuffer, clothingImage.type),
      requestId,
    );

    let imageBuffer: Buffer;
    let contentType = 'image/jpeg';
    if (result.base64) {
      imageBuffer = Buffer.from(result.base64, 'base64');
      contentType = 'image/png';
    } else if (result.url) {
      const imageResponse = await fetch(result.url, { signal: AbortSignal.timeout(RESULT_DOWNLOAD_TIMEOUT_MS) });
      if (!imageResponse.ok) throw new SeedreamServiceError('换衣图片下载失败，请重试', 502);
      imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      contentType = imageResponse.headers.get('content-type') ?? contentType;
    } else {
      throw new SeedreamServiceError('换衣服务没有返回图片', 502);
    }

    console.info('[try-on] request completed', {
      requestId,
      characterId,
      outputBytes: imageBuffer.byteLength,
      durationMs: Date.now() - startedAt,
    });
    return new Response(Uint8Array.from(imageBuffer).buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError');
    const status = timedOut ? 504 : error instanceof SeedreamServiceError ? error.status : 500;
    const message = timedOut ? '换衣图片下载超时，请稍后再试' : error instanceof Error ? error.message : '换衣生成失败';
    console.error('[try-on] request failed', {
      requestId,
      status,
      durationMs: Date.now() - startedAt,
      error: message.slice(0, 180),
    });
    return NextResponse.json({ error: message, requestId }, { status });
  }
}
