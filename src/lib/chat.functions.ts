import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
export type StoredMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  parts: string;
};

export type ThreadRecord = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadRecord[]> => {
    const { data, error } = await context.supabase
      .from("threads")
      .select("id, title, created_at, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ThreadRecord> => {
    const { data, error } = await context.supabase
      .from("threads")
      .insert({ user_id: context.userId, title: "Nova conversa" })
      .select("id, title, created_at, updated_at")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Falha ao criar conversa");
    return data;
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string().trim().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("threads")
      .update({ title: data.title })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ threadId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<StoredMessage[]> => {
    const { data: rows, error } = await context.supabase
      .from("messages")
      .select("id, role, parts, client_message_id, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((row) => ({
      id: row.client_message_id ?? row.id,
      role: row.role as StoredMessage["role"],
      parts: JSON.stringify(row.parts ?? []),
    }));
  });

export type ChatAssetRecord = {
  id: string;
  user_prompt: string;
  enriched_prompt: string;
  style_used: string;
  element_type: string;
  created_at: string;
  url: string;
};

export const listMyAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatAssetRecord[]> => {
    const { data, error } = await context.supabase
      .from("assets")
      .select("id, user_prompt, enriched_prompt, style_used, element_type, created_at, image_url")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    if (!data?.length) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage
      .from("gui-assets")
      .createSignedUrls(
        data.map((row) => row.image_url),
        60 * 60 * 24 * 7,
      );

    return data.map((row, i) => ({
      id: row.id,
      user_prompt: row.user_prompt,
      enriched_prompt: row.enriched_prompt,
      style_used: row.style_used,
      element_type: row.element_type,
      created_at: row.created_at,
      url: signed.data?.[i]?.signedUrl ?? "",
    }));
  });
