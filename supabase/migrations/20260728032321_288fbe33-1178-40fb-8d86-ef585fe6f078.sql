CREATE TABLE public.roblox_login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roblox_user_id bigint NOT NULL UNIQUE,
  roblox_username text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.roblox_login_challenges TO service_role;

ALTER TABLE public.roblox_login_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct access to roblox login challenges"
ON public.roblox_login_challenges
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE TRIGGER update_roblox_login_challenges_updated_at
BEFORE UPDATE ON public.roblox_login_challenges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();