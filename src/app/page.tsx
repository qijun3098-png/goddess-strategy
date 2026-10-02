import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { data: session } = await auth.getSession();
  redirect(session?.user ? '/game' : '/auth/sign-in');
}
