-- 1) Harden has_role: only allow checking your own roles (admins may check anyone).
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _caller uuid := auth.uid();
BEGIN
  IF _caller IS NOT NULL AND _user_id IS DISTINCT FROM _caller THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _caller AND role = 'admin'
    ) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- 2) Owner-scoped write policies on assets
CREATE POLICY "Users insert own assets"
  ON public.assets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own assets"
  ON public.assets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own assets"
  ON public.assets FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

-- 3) Storage policies for the private gui-assets bucket (files stored under <user_id>/...)
CREATE POLICY "Users read own gui assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'gui-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users upload own gui assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'gui-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own gui assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'gui-assets' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'gui-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own gui assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'gui-assets' AND auth.uid()::text = (storage.foldername(name))[1]);