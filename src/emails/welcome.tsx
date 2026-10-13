import { Text } from '@react-email/components';
import { EmailLayout, paragraphStyle } from './layout';

export function WelcomeEmail({ userName }: { userName: string }) {
  return (
    <EmailLayout preview="你的心动故事，从这里开始。" eyebrow="WELCOME" title={`Hi ${userName}，欢迎来到女神攻略！`} buttonText="开启我的心动故事">
      <Text style={paragraphStyle}>你的心动故事，从这里开始。</Text>
      <Text style={paragraphStyle}>选择喜欢的角色，聊聊今天发生的趣事，或分享你的心情。</Text>
      <Text style={paragraphStyle}>期待与你相遇，开启属于你的故事。</Text>
      <Text style={paragraphStyle}>—— 女神攻略</Text>
    </EmailLayout>
  );
}
