import { createFileRoute } from "@tanstack/react-router";
import { resolveRobloxUser, makeVerificationCode } from "@/lib/roblox.server";

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

          const supabaseUrl = (
            process.env.SUPABASE_URL ||
            process.env.VITE_SUPABASE_URL ||
            "https://fvjewtcidvjiinhngjf.supabase.co"
          ).trim().replace(/\/+$/, "");

          const supabaseKey = (
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            "sb_publishable_msahQInVg4QO_dgtGhaciA_NP38HvMM"
          ).trim();

          const dbRes = await fetch(`${supabaseUrl}/rest/v1/roblox_login_challenges`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: supabaseKey,
              Authorization: `Bearer ${supabaseKey}`,
              Prefer: "resolution=merge-duplicates",
            },
            body: JSON.stringify({
              roblox_user_id: user.id,
              roblox_username: user.name,
              code,
              updated_at: new Date().toISOString(),
            }),
          });

          if (!dbRes.ok) {
            const errText = await dbRes.text().catch(() => "");
            console.error("[roblox-start DB Error]", dbRes.status, errText);
            return new Response(
              JSON.stringify({
                error: `Banco de dados (${dbRes.status}): ${errText || "Falha na conexão com Supabase"}`,
              }),
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
