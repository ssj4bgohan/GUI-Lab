import { createFileRoute } from "@tanstack/react-router";
import { resolveRobloxUser, getRobloxDescription } from "@/lib/roblox.server";

function robloxEmail(robloxUserId: number) {
  return `roblox_${robloxUserId}@guilab.app`;
}

function robloxPassword(robloxUserId: number) {
  return `GuiLab_Auth_${robloxUserId}_SecuredPass!`;
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

          const description = await getRobloxDescription(user.id);

          const isMatch = description.includes("GUILAB-");

          if (!isMatch) {
            return new Response(
              JSON.stringify({
                error:
                  "Não encontrei o código GUILAB- na descrição do seu perfil do Roblox. Cole o código na sua biografia do Roblox, salve o perfil e tente novamente.",
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({
              success: true,
              email: robloxEmail(user.id),
              password: robloxPassword(user.id),
              username: user.name,
              robloxUserId: user.id,
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
