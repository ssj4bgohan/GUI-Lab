import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { createThread, listThreads } from "@/lib/chat.functions";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  const navigate = useNavigate();
  const fetchThreads = useServerFn(listThreads);
  const newThread = useServerFn(createThread);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const threads = await fetchThreads();
      const target = threads[0] ?? (await newThread());
      navigate({ to: "/chat/$threadId", params: { threadId: target.id }, replace: true });
    })().catch(() => navigate({ to: "/auth" }));
  }, [fetchThreads, newThread, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-muted-foreground">
      Abrindo seu estúdio...
    </div>
  );
}
