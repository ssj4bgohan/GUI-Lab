import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  enrichPrompt,
  type ElementTypeValue,
  type StyleValue,
} from "./prompt-enrichment";

const GenerateInput = z.object({
  userPrompt: z.string().trim().min(3).max(400),
  style: z.enum(["classic-studs", "simulator-glossy", "hybrid"]),
  elementType: z.enum(["frame", "button", "hud", "icon"]),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  borderColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export type AssetRecord = {
  id: string;
  user_prompt: string;
  enriched_prompt: string;
  style_used: string;
  element_type: string;
  primary_color: string | null;
  border_color: string | null;
  created_at: string;
  url: string;
};

const SIGN_TTL = 60 * 60 * 24 * 7;

export const generateAsset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data }): Promise<AssetRecord> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI is not configured yet.");

    const enriched = enrichPrompt({
      userPrompt: data.userPrompt,
      style: data.style as StyleValue,
      elementType: data.elementType as ElementTypeValue,
      primaryColor: data.primaryColor,
      borderColor: data.borderColor,
    });

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
          messages: [{ role: "user", content: enriched }],
          modalities: ["image", "text"],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429)
        throw new Error("Rate limit reached. Please try again in a moment.");
      if (res.status === 402)
        throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`Image generation failed: ${res.status} ${text}`);
    }

    const payload = (await res.json()) as {
      data?: Array<{ b64_json?: string }>;
    };
    const b64 = payload.data?.[0]?.b64_json;
    if (!b64) throw new Error("The model did not return an image.");

    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const path = `${crypto.randomUUID()}.png`;

    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const upload = await supabaseAdmin.storage
      .from("gui-assets")
      .upload(path, bytes, { contentType: "image/png", upsert: false });
    if (upload.error) throw new Error(upload.error.message);

    const { data: row, error } = await supabaseAdmin
      .from("assets")
      .insert({
        user_prompt: data.userPrompt,
        enriched_prompt: enriched,
        style_used: data.style,
        element_type: data.elementType,
        primary_color: data.primaryColor,
        border_color: data.borderColor,
        image_url: path,
      })
      .select()
      .single();
    if (error || !row) throw new Error(error?.message ?? "Could not save asset");

    const signed = await supabaseAdmin.storage
      .from("gui-assets")
      .createSignedUrl(path, SIGN_TTL);

    return { ...row, url: signed.data?.signedUrl ?? "" };
  });

export const listAssets = createServerFn({ method: "GET" }).handler(
  async (): Promise<AssetRecord[]> => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    const { data, error } = await supabaseAdmin
      .from("assets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    if (!data?.length) return [];

    const signed = await supabaseAdmin.storage
      .from("gui-assets")
      .createSignedUrls(
        data.map((row) => row.image_url),
        SIGN_TTL,
      );

    return data.map((row, i) => ({
      ...row,
      url: signed.data?.[i]?.signedUrl ?? "",
    }));
  },
);
