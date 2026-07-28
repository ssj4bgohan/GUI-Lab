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

          let codeToMatch = "";
          try {
            const { data: challenge } = await supabaseAdmin
              .from("roblox_login_challenges")
              .select("code")
              .eq("roblox_user_id", user.id)
              .maybeSingle();
            if (challenge?.code) codeToMatch = challenge.code;
          } catch (e) {
            console.error("[roblox-verify DB check non-fatal]", e);
          }

          const description = await getRobloxDescription(user.id);

          const isMatch = codeToMatch
            ? description.includes(codeToMatch)
            : description.includes("GUILAB-");

          if (!isMatch) {
            return new Response(
              JSON.stringify({
                error:
                  "Não encontrei o código GUILAB- na descrição do seu perfil do Roblox. Cole o código no perfil, salve e tente de novo.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          const email = robloxEmail(user.id);
          const avatarUrl = await getRobloxAvatarUrl(user.id);

          let userId: string | null = null;
          try {
            const { data: existingProfile } = await supabaseAdmin
              .from("profiles")
              .select("id")
              .eq("roblox_user_id", user.id)
              .maybeSingle();
            userId = existingProfile?.id ?? null;
          } catch (e) {
            console.error("[roblox-verify profile lookup non-fatal]", e);
          }

          let loginEmail = email;

          if (userId) {
            try {
              const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(userId);
              if (existingUser?.user?.email) loginEmail = existingUser.user.email;
            } catch (e) {
              console.error("[roblox-verify getUserById non-fatal]", e);
            }
          } else {
            try {
              const { data: created } = await supabaseAdmin.auth.admin.createUser({
                email,
                email_confirm: true,
                user_metadata: {
                  full_name: user.name,
                  avatar_url: avatarUrl,
                  roblox_user_id: user.id,
                  roblox_username: user.name,
                },
              });
              if (created?.user) userId = created.user.id;
            } catch (e) {
              console.error("[roblox-verify createUser non-fatal]", e);
            }
          }

          if (userId) {
            try {
              await supabaseAdmin
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
            } catch (e) {
              console.error("[roblox-verify upsert profile non-fatal]", e);
            }
          }

          try {
            await supabaseAdmin
              .from("roblox_login_challenges")
              .delete()
              .eq("roblox_user_id", user.id);
          } catch (e) {
            console.error("[roblox-verify delete challenge non-fatal]", e);
          }

          let hashedToken = "";
          try {
            const { data: link } = await supabaseAdmin.auth.admin.generateLink({
              type: "magiclink",
              email: loginEmail,
            });
            if (link?.properties?.hashed_token) {
              hashedToken = link.properties.hashed_token;
            }
          } catch (e) {
            console.error("[roblox-verify generateLink non-fatal]", e);
          }

          return new Response(
            JSON.stringify({
              email: loginEmail,
              tokenHash: hashedToken,
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
