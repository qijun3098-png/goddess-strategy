-- migrate:up

ALTER TABLE public.users
  ADD COLUMN auth_user_id uuid;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE auth_user_id IS NULL) THEN
    RAISE EXCEPTION 'public.users contains legacy rows that must be linked before enabling Neon Auth';
  END IF;
END
$$;

ALTER TABLE public.users
  ALTER COLUMN auth_user_id SET NOT NULL,
  ADD CONSTRAINT users_auth_user_id_key UNIQUE (auth_user_id),
  ADD CONSTRAINT users_auth_user_id_fkey
    FOREIGN KEY (auth_user_id)
    REFERENCES neon_auth."user"(id)
    ON DELETE CASCADE;

COMMENT ON COLUMN public.users.auth_user_id IS
  'Neon Managed Better Auth user id. Passwords and sessions stay in neon_auth.';

-- migrate:down

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_auth_user_id_fkey,
  DROP CONSTRAINT IF EXISTS users_auth_user_id_key,
  DROP COLUMN IF EXISTS auth_user_id;
