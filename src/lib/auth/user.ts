import 'server-only';

import { auth } from '@/lib/auth/server';
import { getDb } from '@/lib/db';

export interface AppUser {
  id: number;
  authUserId: string;
  email: string;
  username: string | null;
  profileImage: string | null;
}

export async function getAuthenticatedAppUser(): Promise<AppUser | null> {
  const { data: session } = await auth.getSession();
  if (!session?.user) return null;

  const result = await getDb().query<{
    id: number;
    auth_user_id: string;
    email: string;
    username: string | null;
    profile_image: string | null;
  }>(
    `INSERT INTO public.users (auth_user_id, email, profile_image)
     VALUES ($1::uuid, lower($2), $3)
     ON CONFLICT (auth_user_id) DO UPDATE
       SET email = EXCLUDED.email,
           profile_image = COALESCE(EXCLUDED.profile_image, public.users.profile_image)
     RETURNING id, auth_user_id, email, username, profile_image`,
    [session.user.id, session.user.email, session.user.image ?? null],
  );

  const user = result.rows[0];
  return {
    id: user.id,
    authUserId: user.auth_user_id,
    email: user.email,
    username: user.username,
    profileImage: user.profile_image,
  };
}
