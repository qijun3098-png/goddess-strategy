import { randomUUID } from 'node:crypto';

const SEEDREAM_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/images/generations';
const DEFAULT_TRY_ON_MODEL = 'doubao-seedream-5-0-260128';
const TRY_ON_TIMEOUT_MS = 170_000;

interface SeedreamErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
}

interface SeedreamImageResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
  }>;
}

export interface TryOnResult {
  url?: string;
  base64?: string;
  requestId: string;
}

export class SeedreamServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'SeedreamServiceError';
  }
}

function providerError(status: number, detail?: SeedreamErrorBody['error']) {
  if (status === 401 || status === 403) {
    return new SeedreamServiceError('图片服务鉴权失败，请检查 API Key 和模型权限', 401, detail?.code);
  }
  if (status === 429) {
    return new SeedreamServiceError('换衣请求较多，请稍后再试', 429, detail?.code);
  }
  if (/sensitive|risk|content policy/i.test(detail?.message ?? '')) {
    return new SeedreamServiceError('衣服图片未通过内容安全检查，请更换一张日常服装图片', 400, detail?.code);
  }
  const summary = detail?.message?.slice(0, 180);
  return new SeedreamServiceError(summary ? `换衣服务暂时不可用：${summary}` : `换衣服务暂时不可用（${status}）`, 502, detail?.code);
}

export async function generateTryOn(
  personImage: string,
  clothingImage: string,
  requestId = randomUUID(),
): Promise<TryOnResult> {
  const apiKey = process.env.ARK_API_KEY;
  const model = process.env.ARK_TRYON_MODEL ?? DEFAULT_TRY_ON_MODEL;
  if (!apiKey) throw new SeedreamServiceError('尚未配置 ARK_API_KEY，暂时不能换衣', 503);

  const startedAt = Date.now();
  console.info('[try-on] provider request started', { requestId, model });

  try {
    const response = await fetch(SEEDREAM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: '让图1中的人物穿上图2展示的日常服装。完整保留图1人物的脸部身份、发型、年龄感、身材比例、姿势、构图、背景和光线，准确还原图2服装的款式、材质、颜色及细节，穿着自然合体。保持单人构图，画面真实、健康、自然，不添加文字或水印。',
        image: [personImage, clothingImage],
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size: '2K',
        stream: false,
        watermark: false,
      }),
      signal: AbortSignal.timeout(TRY_ON_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null) as SeedreamErrorBody | null;
      console.error('[try-on] provider request failed', {
        requestId,
        model,
        status: response.status,
        code: detail?.error?.code,
        durationMs: Date.now() - startedAt,
      });
      throw providerError(response.status, detail?.error);
    }

    const payload = await response.json() as SeedreamImageResponse;
    const image = payload.data?.[0];
    if (!image?.url && !image?.b64_json) {
      throw new SeedreamServiceError('换衣服务没有返回图片', 502);
    }

    console.info('[try-on] provider request completed', {
      requestId,
      model,
      durationMs: Date.now() - startedAt,
      responseType: image.url ? 'url' : 'base64',
    });
    return { url: image.url, base64: image.b64_json, requestId };
  } catch (error) {
    if (error instanceof SeedreamServiceError) throw error;
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      console.error('[try-on] provider request timed out', { requestId, model, durationMs: Date.now() - startedAt });
      throw new SeedreamServiceError('换衣生成超时，请稍后再试', 504);
    }
    console.error('[try-on] provider request error', {
      requestId,
      model,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message.slice(0, 180) : 'unknown',
    });
    throw new SeedreamServiceError('换衣服务连接失败，请稍后再试', 502);
  }
}
