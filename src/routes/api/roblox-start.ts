import { createFileRoute } from "@tanstack/react-router";
import { resolveRobloxUser, makeVerificationCode } from "@/lib/roblox.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/roblox-start")({
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

          const code = makeVerificationCode();

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

          if (error) {
            console.error("[roblox-start DB Error]", error);
            return new Response(
              JSON.stringify({ error: `Banco de dados: ${error.message}` }),
              { status: 500, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({ username: user.name, robloxUserId: user.id, code }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("[roblox-start Exception]", err);
          return new Response(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Erro interno no servidor.",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
