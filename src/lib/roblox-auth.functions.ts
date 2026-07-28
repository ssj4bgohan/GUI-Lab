import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Login exclusivo por conta do Roblox (código na descrição do perfil). */

function robloxEmail(robloxUserId: number) {
  return `roblox_${robloxUserId}@guilab.app`;
}

export const robloxLoginStart = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().trim().min(3).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    try {
      const { resolveRobloxUser, makeVerificationCode } = await import(
        "@/lib/roblox.server"
      );
      const user = await resolveRobloxUser(data.username);
      if (!user) throw new Error("Usuário do Roblox não encontrado.");

      const code = makeVerificationCode();

      const url = "https://fvjewtcidvjiinhngjf.supabase.co/rest/v1/roblox_login_challenges";
      const key = (
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        "sb_publishable_msahQInVg4QO_dgtGhaciA_NP38HvMM"
      ).trim();

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify({
          roblox_user_id: user.id,
          roblox_username: user.name,
          code,
          updated_at: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.error("[robloxLoginStart REST Error]", res.status, errText);
        // Fallback: try supabaseAdmin
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("roblox_login_challenges")
          .upsert(
            {
              roblox_user_id: user.id,
              roblox_username: user.name,
              code,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "roblox_user_id" },
          );
        if (error) throw new Error(`Status ${res.status}: ${errText || error.message}`);
      }

      return { username: user.name, robloxUserId: user.id, code };
    } catch (err) {
      console.error("[robloxLoginStart Exception]", err);
      throw new Error(
        err instanceof Error ? err.message : "Falha ao consultar usuário do Roblox",
      );
    }
  });

export const robloxLoginVerify = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().trim().min(3).max(20) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveRobloxUser, getRobloxDescription, getRobloxAvatarUrl } =
      await import("@/lib/roblox.server");
    const user = await resolveRobloxUser(data.username);
    if (!user) throw new Error("Usuário do Roblox não encontrado.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: challenge } = await supabaseAdmin
      .from("roblox_login_challenges")
      .select("code")
      .eq("roblox_user_id", user.id)
      .maybeSingle();

    if (!challenge?.code) {
      throw new Error("Comece gerando um novo código de verificação.");
    }

    const description = await getRobloxDescription(user.id);
    if (!description.includes(challenge.code)) {
      throw new Error(
        "Não encontrei o código na descrição do seu perfil do Roblox. Cole o código, salve e tente de novo.",
      );
    }

    const email = robloxEmail(user.id);
    const avatarUrl = await getRobloxAvatarUrl(user.id);

    // Encontra ou cria o usuário atrelado a essa conta do Roblox.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("roblox_user_id", user.id)
      .maybeSingle();

    let userId = existingProfile?.id ?? null;
    let loginEmail = email;

    if (userId) {
      // Reaproveita a conta já ligada a esse Roblox (mesmo que tenha outro e-mail).
      const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      if (existingUser?.user?.email) loginEmail = existingUser.user.email;
    } else {
      const { data: created, error: createError } =
        await supabaseAdmin.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            full_name: user.name,
            avatar_url: avatarUrl,
            roblox_user_id: user.id,
            roblox_username: user.name,
          },
        });
      if (createError || !created?.user) {
        throw new Error(createError?.message ?? "Não consegui criar sua conta.");
      }
      userId = created.user.id;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: user.name,
          roblox_username: user.name,
          roblox_user_id: user.id,
          roblox_verified_at: new Date().toISOString(),
          verification_code: null,
        },
        { onConflict: "id" },
      );
    if (profileError) throw new Error(profileError.message);

    await supabaseAdmin
      .from("roblox_login_challenges")
      .delete()
      .eq("roblox_user_id", user.id);

    const { data: link, error: linkError } =
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: loginEmail,
      });
    if (linkError || !link?.properties?.hashed_token) {
      throw new Error(linkError?.message ?? "Não consegui iniciar sua sessão.");
    }

    return {
      email: loginEmail,
      tokenHash: link.properties.hashed_token,
      username: user.name,
    };
  });

