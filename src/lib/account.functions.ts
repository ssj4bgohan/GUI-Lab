import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountInfo = {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
  credits: number;
  isAdmin: boolean;
  robloxUsername: string | null;
  robloxUserId: number | null;
  robloxVerified: boolean;
  verificationCode: string | null;
};

export type CreditProduct = {
  id: string;
  gamepass_id: number;
  name: string;
  credits: number;
  robux_price: number;
  active: boolean;
  claimed: boolean;
};

type AuthedContext = { supabase: unknown; userId: string };

async function requireAdmin(supabase: AuthedContext["supabase"], userId: string) {
  const client = supabase as {
    rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => Promise<{ data: unknown }>;
  };
  const { data } = await client.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (data !== true) throw new Error("Acesso restrito a administradores.");
}


export const getAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountInfo> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select(
        "id, display_name, credits, roblox_username, roblox_user_id, roblox_verified_at, verification_code",
      )
      .eq("id", context.userId)
      .maybeSingle();

    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const { data: userData } = await context.supabase.auth.getUser();
    const meta = (userData?.user?.user_metadata ?? {}) as Record<string, unknown>;
    let avatarUrl =
      typeof meta.avatar_url === "string"
        ? meta.avatar_url
        : typeof meta.picture === "string"
          ? meta.picture
          : null;

    if (profile?.roblox_user_id) {
      const { getRobloxAvatarUrl } = await import("@/lib/roblox.server");
      const robloxAvatar = await getRobloxAvatarUrl(profile.roblox_user_id);
      if (robloxAvatar) avatarUrl = robloxAvatar;
    }

    return {
      id: context.userId,
      displayName:
        profile?.roblox_username ??
        profile?.display_name ??
        (typeof meta.full_name === "string" ? meta.full_name : null),
      email: userData?.user?.email ?? null,
      avatarUrl,
      credits: profile?.credits ?? 0,
      isAdmin: isAdmin === true,
      robloxUsername: profile?.roblox_username ?? null,
      robloxUserId: profile?.roblox_user_id ?? null,
      robloxVerified: Boolean(profile?.roblox_verified_at),
      verificationCode: profile?.verification_code ?? null,
    };
  });

export const startRobloxLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().trim().min(3).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { resolveRobloxUser, makeVerificationCode } = await import(
      "@/lib/roblox.server"
    );
    const robloxUser = await resolveRobloxUser(data.username);
    if (!robloxUser) throw new Error("Usuário do Roblox não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("roblox_user_id", robloxUser.id)
      .not("roblox_verified_at", "is", null)
      .neq("id", context.userId)
      .maybeSingle();
    if (taken) throw new Error("Essa conta do Roblox já está vinculada a outro usuário.");

    const code = makeVerificationCode();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        roblox_username: robloxUser.name,
        roblox_user_id: robloxUser.id,
        roblox_verified_at: null,
        verification_code: code,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    return { username: robloxUser.name, robloxUserId: robloxUser.id, code };
  });

export const confirmRobloxLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("roblox_user_id, verification_code")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.roblox_user_id || !profile.verification_code) {
      throw new Error("Comece informando seu nome de usuário do Roblox.");
    }

    const { getRobloxDescription } = await import("@/lib/roblox.server");
    const description = await getRobloxDescription(profile.roblox_user_id);

    if (!description.includes(profile.verification_code)) {
      throw new Error(
        "Não encontrei o código na descrição do seu perfil. Cole o código, salve e tente de novo.",
      );
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        roblox_verified_at: new Date().toISOString(),
        verification_code: null,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const listCreditProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditProduct[]> => {
    const { data: products } = await context.supabase
      .from("gamepass_products")
      .select("id, gamepass_id, name, credits, robux_price, active")
      .order("robux_price", { ascending: true });

    const { data: claims } = await context.supabase
      .from("gamepass_claims")
      .select("product_id");

    const claimed = new Set((claims ?? []).map((c) => c.product_id));
    return (products ?? []).map((p) => ({ ...p, claimed: claimed.has(p.id) }));
  });

export const claimGamepass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ productId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits, roblox_user_id, roblox_verified_at")
      .eq("id", context.userId)
      .maybeSingle();

    if (!profile?.roblox_user_id || !profile.roblox_verified_at) {
      throw new Error("Vincule e verifique sua conta do Roblox antes de comprar.");
    }

    const { data: product } = await supabaseAdmin
      .from("gamepass_products")
      .select("id, gamepass_id, credits, name, active")
      .eq("id", data.productId)
      .maybeSingle();
    if (!product || !product.active) throw new Error("Pacote indisponível.");

    const { data: existing } = await supabaseAdmin
      .from("gamepass_claims")
      .select("id")
      .eq("user_id", context.userId)
      .eq("product_id", product.id)
      .maybeSingle();
    if (existing) throw new Error("Você já resgatou este pacote.");

    const { ownsGamepass } = await import("@/lib/roblox.server");
    const owns = await ownsGamepass(profile.roblox_user_id, product.gamepass_id);
    if (!owns) {
      throw new Error(
        "Ainda não vejo essa gamepass na sua conta. Compre no Roblox e clique de novo em alguns segundos.",
      );
    }

    const { error: claimError } = await supabaseAdmin.from("gamepass_claims").insert({
      user_id: context.userId,
      product_id: product.id,
      roblox_user_id: profile.roblox_user_id,
      credits_granted: product.credits,
    });
    if (claimError) throw new Error(claimError.message);

    const nextCredits = (profile.credits ?? 0) + product.credits;
    await supabaseAdmin
      .from("profiles")
      .update({ credits: nextCredits })
      .eq("id", context.userId);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: context.userId,
      amount: product.credits,
      reason: `Compra via gamepass: ${product.name}`,
    });

    return { credits: nextCredits, granted: product.credits };
  });

/* ---------------------------------- admin --------------------------------- */

export type AdminUser = {
  id: string;
  display_name: string | null;
  credits: number;
  roblox_username: string | null;
  roblox_verified: boolean;
  is_admin: boolean;
  created_at: string;
};

export const adminListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().trim().max(80).nullable() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<AdminUser[]> => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("profiles")
      .select(
        "id, display_name, credits, roblox_username, roblox_verified_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200);

    if (data.search) {
      query = query.or(
        `display_name.ilike.%${data.search}%,roblox_username.ilike.%${data.search}%`,
      );
    }

    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");
    const admins = new Set((roles ?? []).map((r) => r.user_id));

    return (profiles ?? []).map((p) => ({
      id: p.id,
      display_name: p.display_name,
      credits: p.credits,
      roblox_username: p.roblox_username,
      roblox_verified: Boolean(p.roblox_verified_at),
      is_admin: admins.has(p.id),
      created_at: p.created_at,
    }));
  });

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        amount: z.number().int(),
        reason: z.string().trim().max(200).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("credits")
      .eq("id", data.userId)
      .maybeSingle();
    if (!profile) throw new Error("Usuário não encontrado.");

    const next = Math.max(0, profile.credits + data.amount);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ credits: next })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await supabaseAdmin.from("credit_transactions").insert({
      user_id: data.userId,
      amount: data.amount,
      reason: data.reason ?? "Ajuste manual do administrador",
      created_by: context.userId,
    });

    return { credits: next };
  });

export const adminSetAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), isAdmin: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.isAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.userId, role: "admin" },
          { onConflict: "user_id,role" },
        );
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
    }
    return { ok: true };
  });

export const adminUpsertProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid().nullable(),
        gamepassId: z.number().int().positive(),
        name: z.string().trim().min(1).max(80),
        credits: z.number().int().positive(),
        robuxPrice: z.number().int().positive(),
        active: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const row = {
      gamepass_id: data.gamepassId,
      name: data.name,
      credits: data.credits,
      robux_price: data.robuxPrice,
      active: data.active,
    };

    const { error } = data.id
      ? await supabaseAdmin.from("gamepass_products").update(row).eq("id", data.id)
      : await supabaseAdmin.from("gamepass_products").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("gamepass_products")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
