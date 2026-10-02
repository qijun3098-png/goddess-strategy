-- migrate:up

CREATE TABLE public.daily_quotas (
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  quota_date date NOT NULL DEFAULT current_date,
  text_used integer NOT NULL DEFAULT 0 CHECK (text_used >= 0),
  image_used integer NOT NULL DEFAULT 0 CHECK (image_used >= 0),
  voice_used integer NOT NULL DEFAULT 0 CHECK (voice_used >= 0),
  try_on_used integer NOT NULL DEFAULT 0 CHECK (try_on_used >= 0),
  text_limit integer NOT NULL DEFAULT 100 CHECK (text_limit >= 0),
  image_limit integer NOT NULL DEFAULT 3 CHECK (image_limit >= 0),
  voice_limit integer NOT NULL DEFAULT 3 CHECK (voice_limit >= 0),
  try_on_limit integer NOT NULL DEFAULT 3 CHECK (try_on_limit >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, quota_date),
  CHECK (text_used <= text_limit),
  CHECK (image_used <= image_limit),
  CHECK (voice_used <= voice_limit),
  CHECK (try_on_used <= try_on_limit)
);

CREATE TABLE public.generation_jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  conversation_id bigint REFERENCES public.conversations(id) ON DELETE SET NULL,
  character_id varchar(20) NOT NULL CHECK (character_id IN ('zhixia', 'keke', 'wanqing', 'xiaoman')),
  kind varchar(16) NOT NULL CHECK (kind IN ('image', 'voice', 'try_on')),
  status varchar(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider_request_id text,
  error_code text,
  error_message text,
  duration_ms integer CHECK (duration_ms IS NULL OR duration_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX generation_jobs_user_created_idx
  ON public.generation_jobs (user_id, created_at DESC);

CREATE INDEX generation_jobs_status_created_idx
  ON public.generation_jobs (status, created_at);

CREATE TRIGGER daily_quotas_set_updated_at
BEFORE UPDATE ON public.daily_quotas
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER generation_jobs_set_updated_at
BEFORE UPDATE ON public.generation_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- migrate:down

DROP TRIGGER IF EXISTS generation_jobs_set_updated_at ON public.generation_jobs;
DROP TRIGGER IF EXISTS daily_quotas_set_updated_at ON public.daily_quotas;
DROP TABLE IF EXISTS public.generation_jobs;
DROP TABLE IF EXISTS public.daily_quotas;
