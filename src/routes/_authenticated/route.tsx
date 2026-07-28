import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return { user: sessionData.session.user };
    }
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      return { user: userData.user };
    }
    throw redirect({ to: "/auth" });
  },
  component: () => <Outlet />,
});
