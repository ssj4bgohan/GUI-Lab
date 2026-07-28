import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { robloxLoginStart, robloxLoginVerify } from "@/lib/roblox-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Check, Copy, Loader2 } from "lucide-react";
import logo from "@/assets/guilab-logo.png";

const DISCORD_URL = "https://discord.gg/dXx94qf2RS";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Entrar com Roblox — GUI Lab" },
      {
        name: "description",
        content:
          "Entre na GUI Lab com sua conta do Roblox e crie GUIs, modelos 3D, thumbnails e roupas conversando com a IA.",
      },
      { property: "og:title", content: "Entrar com Roblox — GUI Lab" },
      {
        property: "og:description",
        content: "Acesse seu laboratório de assets para Roblox.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AuthPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/chat" });
    });
  }, [navigate]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/roblox-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        username?: string;
        code?: string;
        error?: string;
      };
      if (!res.ok || !data.code) {
        throw new Error(data.error || "Falha ao consultar usuário no servidor");
      }
      setUsername(data.username || username);
      setCode(data.code);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao gerar o código");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setLoading(true);
    try {
      const res = await fetch("/api/roblox-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        email?: string;
        password?: string;
        username?: string;
        error?: string;
      };

      if (!res.ok || !data.email || !data.password) {
        throw new Error(
          data.error ||
            "Não encontrei o código na descrição do seu perfil no Roblox. Cole o código no perfil, salve e tente de novo.",
        );
      }

      let { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (loginData?.session) {
        toast.success(`Bem-vindo ao GUI Lab, ${data.username || username}!`);
        navigate({ to: "/chat" });
        return;
      }

      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.username || username,
          },
        },
      });

      if (signUpData?.session) {
        toast.success(`Bem-vindo ao GUI Lab, ${data.username || username}!`);
        navigate({ to: "/chat" });
        return;
      }

      const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            full_name: data.username || username,
            roblox_username: data.username || username,
          },
        },
      });

      if (anonData?.session) {
        toast.success(`Bem-vindo ao GUI Lab, ${data.username || username}!`);
        navigate({ to: "/chat" });
        return;
      }

      if (loginErr?.message.toLowerCase().includes("email not confirmed")) {
        throw new Error(
          "O Supabase está exigindo confirmação de e-mail. No painel do Supabase, vá em Authentication > Providers > Email e desmarque 'Confirm email'.",
        );
      }

      if (loginErr) throw loginErr;
      if (signUpErr) throw signUpErr;
      if (anonErr) throw anonErr;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na verificação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background tech-grid px-4 py-10">
      <Toaster />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 glow-border">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src={logo} alt="GUI Lab" className="size-14 rounded-2xl" width={56} height={56} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-gradient-tech">
              GUI Lab
            </h1>
            <p className="text-xs text-muted-foreground">
              Entre com sua conta do Roblox · 5 créditos grátis
            </p>
          </div>
        </div>

        {!code ? (
          <form onSubmit={handleStart} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="roblox-username">Nome de usuário do Roblox</Label>
              <Input
                id="roblox-username"
                required
                minLength={3}
                maxLength={20}
                autoComplete="username"
                placeholder="ex.: Builderman"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Continuar
            </Button>
          </form>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li>1. Copie o código abaixo.</li>
              <li>2. Cole na descrição (&quot;Sobre mim&quot;) do seu perfil no Roblox e salve.</li>
              <li>3. Volte aqui e clique em &quot;Verificar e entrar&quot;.</li>
            </ol>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-sm"
            >
              <span className="truncate">{code}</span>
              {copied ? (
                <Check className="size-4 text-primary" />
              ) : (
                <Copy className="size-4 text-muted-foreground" />
              )}
            </button>

            <Button className="w-full" disabled={loading} onClick={handleVerify}>
              {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
              Verificar e entrar
            </Button>

            <button
              type="button"
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              onClick={() => {
                setCode(null);
                setCopied(false);
              }}
            >
              Usar outro nome de usuário
            </button>
          </div>
        )}

        <a
          href={DISCORD_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-4 block text-center text-xs text-primary hover:underline"
        >
          Suporte e compras no Discord
        </a>
      </div>
    </main>
  );
}
