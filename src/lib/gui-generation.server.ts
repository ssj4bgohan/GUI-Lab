import {
  enrichAssetPrompt,
  type AssetKind,
  type GuiElement,
  type GuiStyle,
} from "./asset-kinds";

export const SIGN_TTL = 60 * 60 * 24 * 7;
export const CREDITS_PER_GENERATION = 1;

export type GenerateAssetArgs = {
  kind: AssetKind;
  userPrompt: string;
  style?: GuiStyle;
  elementType?: GuiElement;
  primaryColor?: string | null;
  borderColor?: string | null;
  transparent?: boolean;
  /** Optional reference image (https URL or data:image/...;base64,...). */
  referenceImage?: string | null;
  userId: string;
  threadId?: string | null;
};

export type GeneratedAsset = {
  id: string;
  user_prompt: string;
  enriched_prompt: string;
  style_used: string;
  element_type: string;
  asset_kind: string;
  primary_color: string | null;
  border_color: string | null;
  created_at: string;
  url: string;
  creditsLeft: number;
};

export class CreditsError extends Error {}

/** Atomically spends credits. Throws CreditsError when the balance is too low. */
async function spendCredit(userId: string, reason: string): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();

  const current = profile?.credits ?? 0;
  if (current < CREDITS_PER_GENERATION) {
    throw new CreditsError(
      "Você está sem créditos. Compre mais créditos com Robux na página Créditos.",
    );
  }

  const { data: updated, error } = await supabaseAdmin
    .from("profiles")
    .update({ credits: current - CREDITS_PER_GENERATION })
    .eq("id", userId)
    .gte("credits", CREDITS_PER_GENERATION)
    .select("credits")
    .maybeSingle();

  if (error || !updated) {
    throw new CreditsError("Não foi possível debitar seus créditos. Tente novamente.");
  }

  await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: -CREDITS_PER_GENERATION,
    reason,
  });

  return updated.credits;
}

async function refundCredit(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return;
  await supabaseAdmin
    .from("profiles")
    .update({ credits: profile.credits + CREDITS_PER_GENERATION })
    .eq("id", userId);
  await supabaseAdmin.from("credit_transactions").insert({
    user_id: userId,
    amount: CREDITS_PER_GENERATION,
    reason: "Estorno automático (falha na geração)",
  });
}

/** Generates the image through Lovable AI, stores it and returns a signed URL. */
export async function generateGuiAsset(
  args: GenerateAssetArgs,
): Promise<GeneratedAsset> {
  const apiKey = process.env.LOVABLE_API_KEY || process.env.VITE_LOVABLE_API_KEY;
  if (!apiKey) throw new Error("AI is not configured yet. Configure LOVABLE_API_KEY no painel da Cloudflare.");

  const enriched = enrichAssetPrompt({
    kind: args.kind,
    userPrompt: args.userPrompt,
    style: args.style,
    elementType: args.elementType,
    primaryColor: args.primaryColor,
    borderColor: args.borderColor,
    transparent: args.transparent,
  });

  const creditsLeft = await spendCredit(args.userId, `Geração de asset (${args.kind})`);

  try {
    const content: Array<Record<string, unknown>> = [{ type: "text", text: enriched }];
    if (args.referenceImage) {
      content.push({
        type: "image_url",
        image_url: { url: args.referenceImage },
      });
      content.push({
        type: "text",
        text: "Use the attached image strictly as a visual style/shape reference for the asset described above.",
      });
    }

    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/images/generations",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image",
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429)
        throw new Error("Limite de uso atingido. Tente novamente em instantes.");
      if (res.status === 402)
        throw new Error("Créditos de IA esgotados. Adicione créditos para continuar.");
      throw new Error(`Falha ao gerar a imagem: ${res.status} ${text}`);
    }

    const payload = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) throw new Error("O modelo não retornou uma imagem.");

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${args.userId}/${crypto.randomUUID()}.png`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const upload = await supabaseAdmin.storage
      .from("gui-assets")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upload.error) throw new Error(upload.error.message);

    const { data: row, error } = await supabaseAdmin
      .from("assets")
      .insert({
        user_prompt: args.userPrompt,
        enriched_prompt: enriched,
        style_used: args.style ?? args.kind,
        element_type: args.elementType ?? args.kind,
        asset_kind: args.kind,
        primary_color: args.primaryColor ?? null,
        border_color: args.borderColor ?? null,
        image_url: path,
        user_id: args.userId,
        thread_id: args.threadId ?? null,
      })
      .select()
      .single();
    if (error || !row)
      throw new Error(error?.message ?? "Não foi possível salvar o asset");

    const signed = await supabaseAdmin.storage
      .from("gui-assets")
      .createSignedUrl(path, SIGN_TTL);

    return { ...row, url: signed.data?.signedUrl ?? "", creditsLeft };
  } catch (error) {
    await refundCredit(args.userId).catch(() => undefined);
    throw error;
  }
}
