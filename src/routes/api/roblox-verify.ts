import { createFileRoute } from "@tanstack/react-router";
import { resolveRobloxUser, getRobloxDescription, getRobloxAvatarUrl } from "@/lib/roblox.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function robloxEmail(robloxUserId: number) {
  return `roblox_${robloxUserId}@guilab.app`;
}

export const Route = createFileRoute("/api/roblox-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as { username?: string };
          const username = body.username?.trim();

          if (!username || username.length < 3 || username.length > 20) {
            return new Response(
              JSON.stringify({ error: "Nome de usuário inválido." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const user = await resolveRobloxUser(username);
          if (!user) {
            return new Response(
              JSON.stringify({ error: "Usuário do Roblox não encontrado." }),
              { status: 404, headers: { "Content-Type": "application/json" } },
            );
          }

          const { data: challenge } = await supabaseAdmin
            .from("roblox_login_challenges")
            .select("code")
            .eq("roblox_user_id", user.id)
            .maybeSingle();

          if (!challenge?.code) {
            return new Response(
              JSON.stringify({ error: "Comece gerando um novo código de verificação." }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const description = await getRobloxDescription(user.id);
          if (!description.includes(challenge.code)) {
            return new Response(
              JSON.stringify({
                error:
                  "Não encontrei o código na descrição do seu perfil do Roblox. Cole o código, salve e tente de novo.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const email = robloxEmail(user.id);
          const avatarUrl = await getRobloxAvatarUrl(user.id);

          const { data: existingProfile } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("roblox_user_id", user.id)
            .maybeSingle();

          let userId = existingProfile?.id ?? null;
          let loginEmail = email;

          if (userId) {
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
              return new Response(
                JSON.stringify({
                  error: createError?.message ?? "Não consegui criar sua conta.",
                }),
                { status: 500, headers: { "Content-Type": "application/json" } },
              );
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
          if (profileError) {
            return new Response(
              JSON.stringify({ error: profileError.message }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

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
            return new Response(
              JSON.stringify({ error: linkError?.message ?? "Não consegui iniciar sua sessão." }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              email: loginEmail,
              tokenHash: link.properties.hashed_token,
              username: user.name,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("[roblox-verify Exception]", err);
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Erro interno na verificação.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
