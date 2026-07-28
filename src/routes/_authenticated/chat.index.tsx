import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }

      const user = sessionData.session.user;

      // Fetch user's threads directly from Supabase
      const { data: threads } = await supabase
        .from("threads")
        .select("id, title, created_at, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100);

      let targetId = threads?.[0]?.id;

      if (!targetId) {
        const newId = crypto.randomUUID();
        const { data: created } = await supabase
          .from("threads")
          .insert({ id: newId, user_id: user.id, title: "Nova conversa" })
          .select("id")
          .maybeSingle();

        targetId = created?.id ?? newId;
      }

      navigate({ to: "/chat/$threadId", params: { threadId: targetId }, replace: true });
    })().catch((err) => {
      console.error("ChatIndex error:", err);
      navigate({ to: "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Abrindo seu estúdio...
    </div>
  );
}
