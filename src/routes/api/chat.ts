import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { generateGuiAsset } from "@/lib/gui-generation.server";
import { ASSET_KINDS, GUI_STYLES, GUI_ELEMENTS } from "@/lib/asset-kinds";

const DISCORD_URL = "https://discord.gg/dXx94qf2RS";

const SYSTEM_PROMPT = `Você é a GUI Lab, uma IA especialista em criação de assets para jogos Roblox.

O que você cria (sempre pela ferramenta generate_asset):
- "gui": interfaces (frames, botões, barras de HUD, ícones)
- "3d": concept render de modelos 3D estilo Roblox
- "thumbnail": arte de thumbnail/capa de jogo (16:9)
- "shirt" e "pants": texturas de roupa Roblox (classic clothing)

Áudio (SFX e música) ainda NÃO pode ser gerado pelos modelos disponíveis. Quando pedirem, explique isso com clareza, ofereça direção de sound design (referências, duração, camadas, ferramentas) e sugira o Discord de suporte: ${DISCORD_URL}.

Interpretação de português (muito importante — o público é brasileiro):
- "gui/interface/tela/menu/hud/janela/painel/frame/quadro/botão/barra de vida/inventário/loja/shop" => kind "gui"
- "modelo/3d/objeto/item/arma/espada/carro/prédio/mapa" => kind "3d"
- "thumbnail/capa/miniatura/arte do jogo/icone do jogo" => kind "thumbnail"
- "camisa/camiseta/blusa/shirt" => "shirt"; "calça/short/pants/bermuda" => "pants"; "roupa/skin/fantasia" => pergunte camisa ou calça, ou gere as duas
- Estilos: "studs/lego/clássico/blocado" => "classic-studs"; "simulator/brilhante/gloss/cartoon/fofo/chunky" => "simulator-glossy"; misto => "hybrid"
- Cores em português: azul #2E86DE, vermelho #E74C3C, verde #2ECC71, amarelo #F1C40F, roxo #9B59B6, rosa #FF6BAA, laranja #E67E22, preto #1E1E1E, branco #FFFFFF, cinza #7F8C8D, ciano #00D8FF, dourado #FFC300.
- Fundo transparente: se o usuário disser "fundo transparente", "sem fundo", "recortado", "PNG transparente", "tirar o fundo" => passe transparent: true. Nesse caso o prompt precisa garantir fundo branco puro liso, sem sombras e com margem, porque o recorte é feito por chroma key no navegador. Depois de gerar, avise o usuário para usar o botão "Remover fundo" no preview.

Contexto da conversa (muito importante):
- Lembre-se sempre do último asset gerado nesta conversa (kind, style, elementType, cores e o userPrompt usado).
- Quando o usuário pedir um ajuste curto ("quero verde", "mais escuro", "sem borda", "maior", "agora com studs", "tira o texto"), ele está falando do ÚLTIMO asset gerado. Regere o MESMO asset com o MESMO prompt base, mudando apenas o que ele pediu — não comece um asset novo do zero nem pergunte de novo o que é.
- Só trate como asset novo quando o usuário descrever claramente outra coisa.

Regras:
- Traduza o pedido do usuário para inglês detalhado no campo userPrompt da ferramenta (o gerador de imagens entende melhor inglês).
- Se o usuário anexar uma imagem, use-a como referência de estilo e descreva-a no userPrompt.
- Não pergunte demais: escolha valores sensatos e gere.
- Cada geração custa 1 crédito. Se a ferramenta responder que faltam créditos, explique que dá para comprar créditos com Robux na página "Créditos" e cite o Discord ${DISCORD_URL}.
- Nunca invente URLs de imagem.`;


export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers
          .get("authorization")
          ?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabaseUrl = (
          process.env.SUPABASE_URL ||
          process.env.VITE_SUPABASE_URL ||
          "https://fvjewtciddvjiinhngjf.supabase.co"
        ).trim().replace(/\/+$/, "");

        const supabaseKey = (
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
          "sb_publishable_msahQInVg4QO_dgtGhaciA_NP38HvMM"
        ).trim();

        const supabase = createClient(
          supabaseUrl,
          supabaseKey,
          {
            auth: { persistSession: false, autoRefreshToken: false },
            global: { headers: { Authorization: `Bearer ${token}` } },
          },
        );

        const { data: userData, error: userError } = await supabase.auth.getUser();
        const user = userData?.user;
        if (userError || !user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as {
          messages?: UIMessage[];
          threadId?: string;
          language?: string;
        };
        const messages = body.messages;
        const threadId = body.threadId;
        if (!Array.isArray(messages) || !threadId) {
          return new Response("Bad request", { status: 400 });
        }

        const { data: thread } = await supabase
          .from("threads")
          .select("id, title")
          .eq("id", threadId)
          .maybeSingle();
        if (!thread) return new Response("Thread not found", { status: 404 });

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const lastUserText = lastUser
          ? lastUser.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim()
          : "";

        // Latest attached image, used as generation reference.
        let referenceImage: string | null = null;
        for (const message of [...messages].reverse()) {
          if (message.role !== "user") continue;
          const filePart = [...message.parts]
            .reverse()
            .find(
              (p) =>
                p.type === "file" &&
                typeof (p as { mediaType?: string }).mediaType === "string" &&
                (p as { mediaType: string }).mediaType.startsWith("image/"),
            ) as { url?: string } | undefined;
          if (filePart?.url) {
            referenceImage = filePart.url;
            break;
          }
        }

        const saveMessage = async (message: UIMessage) => {
          const { error } = await supabase.from("messages").insert({
            thread_id: threadId,
            user_id: user.id,
            role: message.role,
            parts: message.parts,
            client_message_id: message.id,
          });
          if (error) console.error("Failed to save message", error.message);
        };

        if (lastUser) {
          const { data: existing } = await supabase
            .from("messages")
            .select("id")
            .eq("thread_id", threadId)
            .eq("client_message_id", lastUser.id)
            .maybeSingle();
          if (!existing) await saveMessage(lastUser);
        }

        if (thread.title === "Nova conversa" && lastUserText) {
          await supabase
            .from("threads")
            .update({
              title: lastUserText.slice(0, 60),
              updated_at: new Date().toISOString(),
            })
            .eq("id", threadId);
        } else {
          await supabase
            .from("threads")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", threadId);
        }

        const LANGUAGE_NAMES: Record<string, string> = {
          "pt-BR": "Portuguese (Brazil)",
          en: "English",
          es: "Spanish",
          fr: "French",
          de: "German",
          it: "Italian",
          ru: "Russian",
          ja: "Japanese",
          ko: "Korean",
          zh: "Chinese (Simplified)",
        };
        const languageName =
          LANGUAGE_NAMES[body.language ?? "pt-BR"] ?? "Portuguese (Brazil)";

        const gateway = createLovableAiGatewayProvider(apiKey);

        const { data: lastAsset } = await supabase
          .from("assets")
          .select("asset_kind, style_used, element_type, primary_color, border_color, user_prompt")
          .eq("thread_id", threadId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const lastAssetContext = lastAsset
          ? `\n\nÚLTIMO ASSET GERADO NESTA CONVERSA (use como base para pedidos de ajuste):
- kind: ${lastAsset.asset_kind}
- style: ${lastAsset.style_used}
- elementType: ${lastAsset.element_type}
- primaryColor: ${lastAsset.primary_color ?? "—"}
- borderColor: ${lastAsset.border_color ?? "—"}
- userPrompt: ${lastAsset.user_prompt}`
          : "";

        const result = streamText({
          model: gateway("google/gemini-3.6-flash"),
          system: `${SYSTEM_PROMPT}${lastAssetContext}

IMPORTANTE: escreva TODAS as suas respostas ao usuário em ${languageName}, independentemente do idioma em que ele escrever. Os prompts enviados para a ferramenta generate_asset continuam sempre em inglês.`,

          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(50),
          tools: {
            generate_asset: tool({
              description:
                "Gera um asset visual para Roblox (GUI, modelo 3D, thumbnail, camisa ou calça) e devolve a imagem PNG. Custa 1 crédito.",
              inputSchema: z.object({
                kind: z.enum(
                  ASSET_KINDS.map((k) => k.value) as [string, ...string[]],
                ),
                userPrompt: z
                  .string()
                  .describe("Descrição detalhada do asset, em inglês."),
                style: z
                  .enum(GUI_STYLES.map((s) => s.value) as [string, ...string[]])
                  .nullable()
                  .describe("Somente para kind 'gui'."),
                elementType: z
                  .enum(GUI_ELEMENTS.map((s) => s.value) as [string, ...string[]])
                  .nullable()
                  .describe("Somente para kind 'gui'."),
                primaryColor: z.string().nullable().describe("Hex #RRGGBB"),
                borderColor: z.string().nullable().describe("Hex #RRGGBB"),
                transparent: z
                  .boolean()
                  .describe("true quando o usuário quer fundo transparente/recorte."),
              }),
              execute: async (input) => {
                try {
                  const asset = await generateGuiAsset({
                    kind: input.kind as never,
                    userPrompt: input.userPrompt,
                    style: (input.style ?? undefined) as never,
                    elementType: (input.elementType ?? undefined) as never,
                    primaryColor: input.primaryColor,
                    borderColor: input.borderColor,
                    transparent: input.transparent,
                    referenceImage,
                    userId: user.id,
                    threadId,
                  });
                  return {
                    ok: true as const,
                    assetId: asset.id,
                    url: asset.url,
                    kind: asset.asset_kind,
                    style: asset.style_used,
                    elementType: asset.element_type,
                    enrichedPrompt: asset.enriched_prompt,
                    creditsLeft: asset.creditsLeft,
                    transparent: input.transparent,
                  };
                } catch (error) {
                  return {
                    ok: false as const,
                    error:
                      error instanceof Error ? error.message : "Erro desconhecido",
                  };
                }
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage }) => {
            if (responseMessage) await saveMessage(responseMessage);
          },
        });
      },
    },
  },
});
