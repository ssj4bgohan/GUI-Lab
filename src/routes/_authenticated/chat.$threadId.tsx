import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type { UIMessage } from "ai";
import {
  createThread,
  deleteThread,
  getThreadMessages,
  listThreads,
} from "@/lib/chat.functions";
import { getAccount } from "@/lib/account.functions";
import { ChatWindow, type GeneratedAssetPart } from "@/components/ChatWindow";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import {
  Coins,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Shield,
  Trash2,
} from "lucide-react";
import logo from "@/assets/guilab-logo.png";

export const DISCORD_URL = "https://discord.gg/dXx94qf2RS";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ChatThreadPage,
  head: () => ({
    meta: [
      { title: "Chat — GUI Lab" },
      {
        name: "description",
        content:
          "Converse com a GUI Lab e gere GUIs, modelos 3D, thumbnails e roupas para Roblox em segundos.",
      },
      { property: "og:title", content: "Chat — GUI Lab" },
      {
        property: "og:description",
        content: "Crie assets de Roblox conversando com a IA da GUI Lab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3c-.2.36-.43.84-.59 1.22a18.27 18.27 0 0 0-3.937 0A12.6 12.6 0 0 0 11.44 3a19.74 19.74 0 0 0-3.76 1.37C3.9 9.03 3.03 13.58 3.46 18.06A19.9 19.9 0 0 0 9.4 21c.48-.65.9-1.34 1.27-2.07-.7-.26-1.36-.58-1.98-.96.17-.12.33-.25.49-.38a14.2 14.2 0 0 0 11.65 0c.16.13.32.26.49.38-.63.38-1.29.7-1.99.96.37.73.8 1.42 1.27 2.07a19.87 19.87 0 0 0 5.95-2.94c.5-5.18-.87-9.69-3.23-13.69ZM9.68 15.33c-1.16 0-2.12-1.06-2.12-2.36 0-1.3.94-2.37 2.12-2.37 1.19 0 2.14 1.07 2.12 2.37 0 1.3-.94 2.36-2.12 2.36Zm6.64 0c-1.16 0-2.11-1.06-2.11-2.36 0-1.3.93-2.37 2.11-2.37 1.19 0 2.14 1.07 2.12 2.37 0 1.3-.93 2.36-2.12 2.36Z" />
    </svg>
  );
}

function ChatThreadPage() {
  const { threadId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const fetchThreads = useServerFn(listThreads);
  const fetchMessages = useServerFn(getThreadMessages);
  const fetchAccount = useServerFn(getAccount);
  const newThread = useServerFn(createThread);
  const removeThread = useServerFn(deleteThread);

  const threadsQuery = useQuery({
    queryKey: ["threads"],
    queryFn: () => fetchThreads(),
  });

  const accountQuery = useQuery({
    queryKey: ["account"],
    queryFn: () => fetchAccount(),
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", threadId],
    queryFn: async () => {
      const rows = await fetchMessages({ data: { threadId } });
      return rows.map((row) => ({
        id: row.id,
        role: row.role,
        parts: JSON.parse(row.parts),
      })) as UIMessage[];
    },
  });

  const handleAsset = useCallback(
    (_next: GeneratedAssetPart) => {
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    [queryClient],
  );

  async function handleNew() {
    const thread = await newThread();
    await queryClient.invalidateQueries({ queryKey: ["threads"] });
    setMenuOpen(false);
    navigate({ to: "/chat/$threadId", params: { threadId: thread.id } });
  }

  async function handleDelete(id: string) {
    await removeThread({ data: { id } });
    const remaining = await queryClient.fetchQuery({
      queryKey: ["threads"],
      queryFn: () => fetchThreads(),
    });
    if (id === threadId) {
      const next = remaining[0] ?? (await newThread());
      navigate({ to: "/chat/$threadId", params: { threadId: next.id } });
    }
  }

  const account = accountQuery.data;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border p-4">
        <img src={logo} alt="GUI Lab" className="size-7 rounded-lg" width={28} height={28} />
        <span className="text-sm font-semibold tracking-tight">GUI Lab</span>
      </div>
      <div className="p-3">
        <Button className="w-full" size="sm" onClick={handleNew}>
          <Plus className="mr-2 size-4" /> Nova conversa
        </Button>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {threadsQuery.data?.map((thread) => (
          <div
            key={thread.id}
            className={`group flex items-center gap-1 rounded-md px-2 transition ${
              thread.id === threadId ? "bg-secondary" : "hover:bg-secondary/60"
            }`}
          >
            <Link
              to="/chat/$threadId"
              params={{ threadId: thread.id }}
              onClick={() => setMenuOpen(false)}
              className="flex min-w-0 flex-1 items-center gap-2 py-2 text-sm"
            >
              <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{thread.title}</span>
            </Link>
            <button
              type="button"
              aria-label="Excluir conversa"
              className="opacity-60 transition hover:opacity-100"
              onClick={() => handleDelete(thread.id)}
            >
              <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-border p-3">
        {account?.isAdmin && (
          <Link
            to="/admin"
            onClick={() => setMenuOpen(false)}
            className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary/60"
          >
            <Shield className="size-4 text-accent" /> Painel admin
          </Link>
        )}
        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-secondary/60"
        >
          <DiscordIcon className="size-4 text-primary" /> Discord / Suporte
        </a>
        <div className="mt-1 flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-2 py-2">
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-xs font-semibold text-primary">
            {account?.avatarUrl ? (
              <img
                src={account.avatarUrl}
                alt={account.displayName ?? "Foto de perfil"}
                className="size-full object-cover"
                width={32}
                height={32}
                referrerPolicy="no-referrer"
              />
            ) : (
              (account?.displayName ?? account?.email ?? "?")
                .charAt(0)
                .toUpperCase()
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {account?.robloxUsername ??
                account?.displayName ??
                account?.email?.split("@")[0] ??
                "Você"}
            </p>
            {account?.email && (
              <p
                title="Clique para mostrar"
                className="group/email truncate text-xs text-muted-foreground blur-[3px] transition hover:blur-0 focus:blur-0"
                tabIndex={0}
              >
                {account.email}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sair"
            onClick={async () => {
              await supabase.auth.signOut();
              queryClient.clear();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>

    </div>
  );

  return (
    <div className="flex h-[100dvh] bg-background text-foreground">
      <Toaster />

      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar/60 md:block">
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-2 md:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Abrir menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              {sidebar}
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <img src={logo} alt="GUI Lab" className="size-6 rounded-md" width={24} height={24} />
            <span className="text-sm font-semibold">GUI Lab</span>
          </div>
          <Link
            to="/credits"
            className="flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs"
          >
            <Coins className="size-3.5 text-primary" />
            {account?.credits ?? "—"}
          </Link>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          {messagesQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">
              Carregando conversa...
            </div>
          ) : (
            <ChatWindow
              key={threadId}
              threadId={threadId}
              initialMessages={messagesQuery.data ?? []}
              credits={account?.credits ?? null}
              onAsset={handleAsset}
              onFinish={() => {
                void queryClient.invalidateQueries({ queryKey: ["threads"] });
              }}
            />
          )}
        </main>
      </div>

    </div>
  );
}
