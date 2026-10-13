import { Text } from '@react-email/components';
import { EmailLayout, paragraphStyle } from './layout';

export function DailyLoveEmail({ userName, loveLetter }: { userName: string; loveLetter: string }) {
  return (
    <EmailLayout preview={`送给 ${userName} 的一封早安情话。`} eyebrow="A LETTER FOR YOU" title={`早安，${userName}`} buttonText="回来聊聊今天的心情">
      {loveLetter.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => (
        <Text key={index} style={paragraphStyle}>{line}</Text>
      ))}
      <Text style={{ ...paragraphStyle, color: '#8e3045', marginTop: '24px' }}>—— 你的虚拟伴侣 · 女神攻略</Text>
    </EmailLayout>
  );
}
