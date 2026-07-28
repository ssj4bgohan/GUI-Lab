import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  claimGamepass,
  confirmRobloxLink,
  getAccount,
  listCreditProducts,
  startRobloxLink,
} from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Coins,
  Copy,
  Loader2,
  RefreshCw,
} from "lucide-react";
import logo from "@/assets/guilab-logo.png";

const DISCORD_URL = "https://discord.gg/dXx94qf2RS";

export const Route = createFileRoute("/_authenticated/credits")({
  component: CreditsPage,
  head: () => ({
    meta: [
      { title: "Créditos e conta Roblox — GUI Lab" },
      {
        name: "description",
        content:
          "Vincule sua conta do Roblox e compre créditos com Robux para gerar mais assets na GUI Lab.",
      },
      { property: "og:title", content: "Créditos — GUI Lab" },
      {
        property: "og:description",
        content: "Compre créditos com Robux via gamepass e continue criando.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CreditsPage() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getAccount);
  const fetchProducts = useServerFn(listCreditProducts);
  const startLink = useServerFn(startRobloxLink);
  const confirmLink = useServerFn(confirmRobloxLink);
  const claim = useServerFn(claimGamepass);

  const [username, setUsername] = useState("");

  const accountQuery = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount() });
  const productsQuery = useQuery({
    queryKey: ["credit-products"],
    queryFn: () => fetchProducts(),
  });

  const account = accountQuery.data;

  const startMutation = useMutation({
    mutationFn: () => startLink({ data: { username: username.trim() } }),
    onSuccess: () => {
      toast.success("Cole o código na descrição do seu perfil do Roblox.");
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMutation = useMutation({
    mutationFn: () => confirmLink({}),
    onSuccess: () => {
      toast.success("Conta do Roblox verificada!");
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const claimMutation = useMutation({
    mutationFn: (productId: string) => claim({ data: { productId } }),
    onSuccess: (result) => {
      toast.success(`+${result.granted} créditos adicionados!`);
      void queryClient.invalidateQueries({ queryKey: ["account"] });
      void queryClient.invalidateQueries({ queryKey: ["credit-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="min-h-[100dvh] bg-background tech-grid">
      <Toaster />
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="GUI Lab" className="size-9 rounded-xl" width={36} height={36} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Créditos</h1>
              <p className="text-sm text-muted-foreground">
                Saldo atual:{" "}
                <span className="font-semibold text-primary">
                  {account?.credits ?? "—"}
                </span>{" "}
                crédito(s)
              </p>
            </div>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/chat">
              <ArrowLeft className="mr-2 size-4" /> Voltar ao chat
            </Link>
          </Button>
        </div>

        <section className="mb-8 rounded-xl border border-border bg-card p-5 glow-border">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <BadgeCheck className="size-4 text-primary" /> Conta do Roblox
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Vincule sua conta para comprar créditos com Robux.
          </p>

          {account?.robloxVerified ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
              <Check className="size-4 text-primary" />
              Verificado como <strong>{account.robloxUsername}</strong>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="roblox-username">Nome de usuário do Roblox</Label>
                  <Input
                    id="roblox-username"
                    value={username}
                    placeholder="ex: Builderman"
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => startMutation.mutate()}
                  disabled={username.trim().length < 3 || startMutation.isPending}
                >
                  {startMutation.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Gerar código
                </Button>
              </div>

              {account?.verificationCode && (
                <div className="space-y-3 rounded-lg border border-border bg-secondary/40 p-3">
                  <p className="text-sm">
                    1. Copie o código abaixo. 2. Cole na{" "}
                    <strong>descrição (About)</strong> do seu perfil do Roblox e
                    salve. 3. Clique em verificar.
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-background px-3 py-2 font-mono text-sm">
                      {account.verificationCode}
                    </code>
                    <Button
                      size="icon-sm"
                      variant="secondary"
                      aria-label="Copiar código"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          account.verificationCode ?? "",
                        );
                        toast.success("Código copiado");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 size-4" />
                    )}
                    Verificar agora
                  </Button>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-1 flex items-center gap-2 text-base font-semibold">
            <Coins className="size-4 text-primary" /> Planos de créditos (Robux)
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            1 crédito = 1 asset gerado. Compre a gamepass no Roblox e clique em
            “Já comprei” para receber os créditos automaticamente.
          </p>

          {productsQuery.data?.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {productsQuery.data.map((product) => (
                <div
                  key={product.id}
                  className={`flex flex-col justify-between rounded-lg border border-border bg-secondary/30 p-4 ${product.active ? "" : "opacity-60"}`}
                >
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {product.credits} créditos · {product.robux_price} Robux
                    </p>
                  </div>
                  {product.active ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="secondary">
                        <a
                          href={`https://www.roblox.com/game-pass/${product.gamepass_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Comprar no Roblox
                        </a>
                      </Button>
                      <Button
                        size="sm"
                        disabled={product.claimed || claimMutation.isPending}
                        onClick={() => claimMutation.mutate(product.id)}
                      >
                        {product.claimed ? "Resgatado" : "Já comprei"}
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Em breve — aguardando liberação da gamepass.
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum pacote disponível no momento.
            </p>
          )}

          <p className="mt-4 text-sm text-muted-foreground">
            Precisa de mais créditos agora? Fale com a equipe no{" "}
            <a
              className="text-primary underline"
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
            >
              Discord
            </a>
            .
          </p>
        </section>

      </div>
    </main>
  );
}
