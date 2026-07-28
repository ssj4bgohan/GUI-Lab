CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_prompt TEXT NOT NULL,
  enriched_prompt TEXT NOT NULL,
  style_used TEXT NOT NULL,
  element_type TEXT NOT NULL,
  primary_color TEXT,
  border_color TEXT,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.assets TO anon;
GRANT SELECT ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view assets"
ON public.assets FOR SELECT
TO anon, authenticated
USING (true);