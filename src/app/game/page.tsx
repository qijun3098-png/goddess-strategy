import { redirect } from 'next/navigation';
import { GameApp } from '@/components/GameApp';
import { getAuthenticatedAppUser } from '@/lib/auth/user';

export const dynamic = 'force-dynamic';

export default async function GamePage() {
  const user = await getAuthenticatedAppUser();
  if (!user) redirect('/auth/sign-in');

  return <GameApp userId={user.authUserId} userEmail={user.email} />;
}
