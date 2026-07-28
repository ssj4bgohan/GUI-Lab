import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminAdjustCredits,
  adminDeleteProduct,
  adminListUsers,
  adminSetAdmin,
  adminUpsertProduct,
  getAccount,
  listCreditProducts,
} from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { ArrowLeft, Loader2, Minus, Plus, Shield, Trash2 } from "lucide-react";
import logo from "@/assets/guilab-logo.png";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Painel admin — GUI Lab" },
      {
        name: "description",
        content:
          "Gerencie créditos dos usuários e os pacotes de Robux da GUI Lab.",
      },
      { property: "og:title", content: "Painel admin — GUI Lab" },
      {
        property: "og:description",
        content: "Administração de créditos e pacotes da GUI Lab.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function AdminPage() {
  const queryClient = useQueryClient();
  const fetchAccount = useServerFn(getAccount);
  const listUsers = useServerFn(adminListUsers);
  const adjust = useServerFn(adminAdjustCredits);
  const setAdmin = useServerFn(adminSetAdmin);
  const fetchProducts = useServerFn(listCreditProducts);
  const upsertProduct = useServerFn(adminUpsertProduct);
  const deleteProduct = useServerFn(adminDeleteProduct);

  const [search, setSearch] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    gamepassId: "",
    name: "",
    credits: "",
    robuxPrice: "",
  });

  const accountQuery = useQuery({ queryKey: ["account"], queryFn: () => fetchAccount() });

  const usersQuery = useQuery({
    queryKey: ["admin-users", search],
    queryFn: () => listUsers({ data: { search: search.trim() || null } }),
    enabled: accountQuery.data?.isAdmin === true,
  });

  const productsQuery = useQuery({
    queryKey: ["credit-products"],
    queryFn: () => fetchProducts(),
    enabled: accountQuery.data?.isAdmin === true,
  });

  const adjustMutation = useMutation({
    mutationFn: (vars: { userId: string; amount: number }) =>
      adjust({ data: { ...vars, reason: null } }),
    onSuccess: () => {
      toast.success("Créditos atualizados");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      void queryClient.invalidateQueries({ queryKey: ["account"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMutation = useMutation({
    mutationFn: (vars: { userId: string; isAdmin: boolean }) =>
      setAdmin({ data: vars }),
    onSuccess: () => {
      toast.success("Cargo atualizado");
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const productMutation = useMutation({
    mutationFn: () =>
      upsertProduct({
        data: {
          id: null,
          gamepassId: Number(form.gamepassId),
          name: form.name.trim(),
          credits: Number(form.credits),
          robuxPrice: Number(form.robuxPrice),
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success("Pacote salvo");
      setForm({ gamepassId: "", name: "", credits: "", robuxPrice: "" });
      void queryClient.invalidateQueries({ queryKey: ["credit-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeProductMutation = useMutation({
    mutationFn: (id: string) => deleteProduct({ data: { id } }),
    onSuccess: () => {
      toast.success("Pacote removido");
      void queryClient.invalidateQueries({ queryKey: ["credit-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (accountQuery.isLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!accountQuery.data?.isAdmin) {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <Shield className="size-8 text-muted-foreground" />
        <p className="text-muted-foreground">
          Esta área é restrita a administradores.
        </p>
        <Button asChild variant="secondary">
          <Link to="/chat">Voltar ao chat</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background tech-grid">
      <Toaster />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="GUI Lab" className="size-9 rounded-xl" width={36} height={36} />
            <h1 className="text-xl font-semibold tracking-tight">Painel admin</h1>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/chat">
              <ArrowLeft className="mr-2 size-4" /> Voltar ao chat
            </Link>
          </Button>
        </div>

        <section className="mb-8 rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Usuários e créditos</h2>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou usuário do Roblox"
            className="mb-4 max-w-sm"
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-2">Usuário</th>
                  <th className="py-2">Roblox</th>
                  <th className="py-2">Créditos</th>
                  <th className="py-2">Ajustar</th>
                  <th className="py-2">Admin</th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.data?.map((user) => {
                  const amount = Number(amounts[user.id] ?? "5") || 5;
                  return (
                    <tr key={user.id} className="border-t border-border">
                      <td className="py-2 pr-3">{user.display_name ?? "—"}</td>
                      <td className="py-2 pr-3">
                        {user.roblox_username ?? "—"}
                        {user.roblox_verified && (
                          <span className="ml-1 text-xs text-primary">✓</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-semibold text-primary">
                        {user.credits}
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon-sm"
                            variant="secondary"
                            aria-label="Remover créditos"
                            onClick={() =>
                              adjustMutation.mutate({
                                userId: user.id,
                                amount: -amount,
                              })
                            }
                          >
                            <Minus className="size-4" />
                          </Button>
                          <Input
                            className="h-8 w-16"
                            inputMode="numeric"
                            value={amounts[user.id] ?? "5"}
                            onChange={(e) =>
                              setAmounts((prev) => ({
                                ...prev,
                                [user.id]: e.target.value,
                              }))
                            }
                          />
                          <Button
                            size="icon-sm"
                            aria-label="Adicionar créditos"
                            onClick={() =>
                              adjustMutation.mutate({
                                userId: user.id,
                                amount,
                              })
                            }
                          >
                            <Plus className="size-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="py-2">
                        <Switch
                          checked={user.is_admin}
                          aria-label="Alternar administrador"
                          onCheckedChange={(checked) =>
                            roleMutation.mutate({
                              userId: user.id,
                              isAdmin: checked,
                            })
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-base font-semibold">Pacotes de Robux</h2>

          <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="gp-name">Nome</Label>
              <Input
                id="gp-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-id">Gamepass ID</Label>
              <Input
                id="gp-id"
                inputMode="numeric"
                value={form.gamepassId}
                onChange={(e) => setForm({ ...form, gamepassId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-credits">Créditos</Label>
              <Input
                id="gp-credits"
                inputMode="numeric"
                value={form.credits}
                onChange={(e) => setForm({ ...form, credits: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gp-price">Preço (Robux)</Label>
              <Input
                id="gp-price"
                inputMode="numeric"
                value={form.robuxPrice}
                onChange={(e) => setForm({ ...form, robuxPrice: e.target.value })}
              />
            </div>
          </div>

          <Button
            onClick={() => productMutation.mutate()}
            disabled={
              productMutation.isPending ||
              !form.name.trim() ||
              !Number(form.gamepassId) ||
              !Number(form.credits) ||
              !Number(form.robuxPrice)
            }
          >
            {productMutation.isPending && (
              <Loader2 className="mr-2 size-4 animate-spin" />
            )}
            Adicionar pacote
          </Button>

          <p className="mt-5 text-xs text-muted-foreground">
            Dica: crie a gamepass no seu jogo do Roblox, copie o número do link
            (roblox.com/game-pass/<strong>ID</strong>/...) e cole no campo
            “Gamepass ID” abaixo. Só pacotes ativos aparecem na página de
            créditos.
          </p>

          <div className="mt-3 space-y-2">
            {productsQuery.data?.map((product) => (
              <div
                key={product.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
              >
                <strong className="min-w-32 flex-1">{product.name}</strong>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  Gamepass
                  <Input
                    className="h-8 w-32"
                    inputMode="numeric"
                    defaultValue={product.gamepass_id}
                    aria-label={`Gamepass ID de ${product.name}`}
                    onBlur={(e) => {
                      const gamepassId = Number(e.target.value);
                      if (!gamepassId || gamepassId === product.gamepass_id) return;
                      upsertProduct({
                        data: {
                          id: product.id,
                          gamepassId,
                          name: product.name,
                          credits: product.credits,
                          robuxPrice: product.robux_price,
                          active: product.active,
                        },
                      })
                        .then(() => {
                          toast.success("Gamepass atualizada");
                          return queryClient.invalidateQueries({
                            queryKey: ["credit-products"],
                          });
                        })
                        .catch((err: Error) => toast.error(err.message));
                    }}
                  />
                </label>
                <span className="text-muted-foreground">
                  {product.credits} créditos · {product.robux_price} Robux
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Switch
                    checked={product.active}
                    aria-label="Ativar pacote"
                    onCheckedChange={(checked) =>
                      upsertProduct({
                        data: {
                          id: product.id,
                          gamepassId: product.gamepass_id,
                          name: product.name,
                          credits: product.credits,
                          robuxPrice: product.robux_price,
                          active: checked,
                        },
                      })
                        .then(() =>
                          queryClient.invalidateQueries({
                            queryKey: ["credit-products"],
                          }),
                        )
                        .catch((e: Error) => toast.error(e.message))
                    }
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Remover pacote"
                    onClick={() => removeProductMutation.mutate(product.id)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

        </section>
      </div>
    </main>
  );
}
