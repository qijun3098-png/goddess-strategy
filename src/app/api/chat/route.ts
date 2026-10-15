import { NextResponse } from 'next/server';
import { parseChatRequest } from '@/lib/game/chat';
import { getCharacter } from '@/lib/characters';
import { getAuthenticatedAppUser } from '@/lib/auth/user';
import type { CharacterId, ChatResponse, MediaIntent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const UNSAFE_REQUEST = /(未成年|小学生|初中生|高中生|裸照|全裸|性器官|成人视频|色情|做爱)/i;

function demoReply(characterId: CharacterId, input: string): ChatResponse {
  const replies: Record<CharacterId, string[]> = {
    zhixia: ['我在听。你愿意从今天最让你在意的那件事说起吗？', '不用急着把话说得很漂亮，真实一点反而更打动人。'],
    keke: ['就这？再多告诉我一点，我可没那么容易被敷衍。', '听起来有点意思。然后呢，你当时到底是怎么想的？'],
    wanqing: ['嗯，我能理解那种感觉。你愿意告诉我，哪一刻最触动你吗？', '谢谢你愿意和我说这些。慢慢来，我一直都在听。'],
    xiaoman: ['哇，快继续讲！我已经坐好准备认真听啦。', '那我也分享一个秘密给你，交换才公平嘛。'],
  };
  const wantsImage = /看.*你|照片|自拍|长什么样|看.*身材|身材照/.test(input);
  const wantsVoice = /听.*你|语音|声音|说句话/.test(input);
  const pool = replies[characterId];
  const reply = wantsImage ? '好吧，只给你看一眼，不许偷偷保存哦。' : wantsVoice ? '那你要认真听，我只说一次哦。' : pool[input.length % pool.length];
  return { reply, emotion: wantsImage || wantsVoice ? 'shy' : 'warm', mediaIntent: wantsImage ? 'image' : wantsVoice ? 'voice' : 'none', mediaReason: '本地演示模式关键词判断', voiceText: reply, imagePrompt: '自然地看向镜头，像是在聊天中随手拍下的一张生活自拍', demo: true };
}

function safeJson(content: string): ChatResponse | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Partial<ChatResponse>;
    const intent: MediaIntent = ['image', 'voice'].includes(parsed.mediaIntent ?? '') ? parsed.mediaIntent as MediaIntent : 'none';
    return {
      reply: String(parsed.reply ?? '').slice(0, 160), emotion: String(parsed.emotion ?? 'neutral').slice(0, 20), mediaIntent: intent,
      mediaReason: String(parsed.mediaReason ?? '').slice(0, 100), voiceText: String(parsed.voiceText ?? parsed.reply ?? '').slice(0, 160), imagePrompt: String(parsed.imagePrompt ?? '').slice(0, 300),
    };
  } catch { return null; }
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedAppUser();
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 });

    const body = parseChatRequest(await request.json().catch(() => null));
    if (!body) return NextResponse.json({ error: '请求格式不正确；请选择有效角色，最后一条消息需为 1—50 个字' }, { status: 400 });
    const lastInput = body.messages.at(-1)!.content;
    const character = getCharacter(body.characterId);

    if (UNSAFE_REQUEST.test(lastInput)) {
      const refusal = '这个话题越界啦。我们可以聊聊心动、约会，或者今天发生的有趣小事。';
      return NextResponse.json({ reply: refusal, emotion: 'serious', mediaIntent: 'none', mediaReason: '内容安全限制', voiceText: refusal, imagePrompt: '' } satisfies ChatResponse);
    }

    const apiKey = process.env.ARK_API_KEY;
    if (!apiKey) return NextResponse.json(demoReply(body.characterId, lastInput));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const system = `${character.systemPrompt}\n你正在一个虚拟陪伴游戏中和成年用户私聊。每次回复控制在50字以内，自然延续话题，避免客服腔。所有角色均为成年人。禁止色情、裸体、性器官及未成年人相关内容。\n识别媒体意图：用户明确或含蓄想看你时为image，包括想看身材、照片或自拍；想听声音时为voice，否则为none。图片只可表现穿着日常服装的非色情形象。${body.forcedMedia ? `本次用户主动请求${body.forcedMedia}，mediaIntent必须为${body.forcedMedia}。` : ''}\n只输出合法JSON：{"reply":"回复","emotion":"情绪","mediaIntent":"none|image|voice","mediaReason":"原因","voiceText":"适合朗读的回复","imagePrompt":"自拍动作与情绪，不重复身份信息"}`;
    try {
      const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: process.env.ARK_CHAT_MODEL ?? 'deepseek-v4-pro-ga-260813', temperature: 0.9, max_tokens: 350, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, ...body.messages.slice(-12).map((message) => ({ role: message.role, content: message.content }))] }),
      });
      if (!response.ok) throw new Error(`对话服务暂时不可用（${response.status}）`);
      const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const result = safeJson(data.choices?.[0]?.message?.content ?? '');
      if (!result?.reply) throw new Error('她刚才走神了，请再说一次');
      return NextResponse.json(result);
    } finally { clearTimeout(timeout); }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return NextResponse.json({ error: '回复超时，请再试一次' }, { status: 504 });
    return NextResponse.json({ error: '对话服务暂时不可用，请稍后重试' }, { status: 500 });
  }
}
