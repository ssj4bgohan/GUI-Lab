import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  usePromptInputAttachments,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "@tanstack/react-router";
import { Coins, Download, Eraser, Image as ImageIcon, Languages, Paperclip, X } from "lucide-react";
import { downloadPng } from "@/lib/remove-bg";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import logo from "@/assets/guilab-logo.png";

export const CHAT_LANGUAGES = [
  { value: "pt-BR", label: "Português (BR)" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "ru", label: "Русский" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "zh", label: "中文" },
] as const;

const LANGUAGE_STORAGE_KEY = "gui-lab-chat-language";

export type GeneratedAssetPart = {
  assetId: string;
  url: string;
  kind?: string;
  style: string;
  elementType: string;
  enrichedPrompt: string;
  creditsLeft?: number;
  transparent?: boolean;
};

async function authedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const { data } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  if (data.session?.access_token) {
    headers.set("Authorization", `Bearer ${data.session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}

/** Attachment strip + picker (AI Elements ships no attachment preview primitive). */
function Attachments() {
  const attachments = usePromptInputAttachments();
  return (
    <>
      {attachments.files.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {attachments.files.map((file) => (
            <div
              key={file.id}
              className="group relative size-16 overflow-hidden rounded-md border border-border bg-muted"
            >
              {file.url ? (
                <img
                  src={file.url}
                  alt={file.filename ?? "Referência"}
                  className="size-full object-cover"
                />
              ) : (
                <ImageIcon className="m-auto size-5 text-muted-foreground" />
              )}
              <button
                type="button"
                aria-label="Remover anexo"
                onClick={() => attachments.remove(file.id)}
                className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5"
              >
                <X className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AttachButton() {
  const attachments = usePromptInputAttachments();
  return (
    <Button
      type="button"
      size="icon-sm"
      variant="ghost"
      aria-label="Anexar imagem de referência"
      onClick={() => attachments.openFileDialog()}
    >
      <Paperclip className="size-4" />
    </Button>
  );
}

export function ChatWindow({
  threadId,
  initialMessages,
  onAsset,
  onFinish,
  credits,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  onAsset: (asset: GeneratedAssetPart) => void;
  onFinish?: () => void;
  credits?: number | null;
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [language, setLanguage] = useState<string>(() => {
    if (typeof window === "undefined") return "pt-BR";
    return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) ?? "pt-BR";
  });

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        fetch: authedFetch,
        body: { threadId, language },
      }),
    [threadId, language],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (err) => toast.error(err.message || "Erro ao falar com a IA"),
    onFinish: () => onFinish?.(),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, [threadId]);

  useEffect(() => {
    if (isLoading) return;
    inputRef.current?.focus();
  }, [isLoading]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    for (const part of last.parts) {
      if (
        part.type === "tool-generate_asset" &&
        "state" in part &&
        part.state === "output-available"
      ) {
        const output = part.output as { ok?: boolean } & GeneratedAssetPart;
        if (output?.ok && output.url) onAsset(output);
      }
    }
  }, [messages, onAsset]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-3 sm:px-4">
          {messages.length === 0 && (
            <ConversationEmptyState
              icon={
                <img
                  src={logo}
                  alt="GUI Lab"
                  className="size-12 rounded-xl"
                  width={48}
                  height={48}
                />
              }
              title="O que vamos criar hoje?"
              description="Peça GUIs, modelos 3D, thumbnails ou roupas para Roblox. Ex: 'frame de loja azul com studs e fundo transparente'. Você também pode anexar uma imagem de referência."
            />
          )}

          {messages.map((message) => (
            <Message key={message.id} from={message.role}>
              <MessageContent
                className={
                  message.role === "assistant"
                    ? "bg-transparent p-0 text-foreground"
                    : undefined
                }
              >
                {message.parts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <MessageResponse key={index}>{part.text}</MessageResponse>
                    );
                  }
                  if (
                    part.type === "file" &&
                    part.mediaType?.startsWith("image/")
                  ) {
                    return (
                      <img
                        key={index}
                        src={part.url}
                        alt="Imagem de referência enviada"
                        className="mt-2 max-h-48 rounded-lg border border-border"
                      />
                    );
                  }
                  if (part.type === "tool-generate_asset") {
                    const state = "state" in part ? part.state : undefined;
                    if (state === "output-available") {
                      const output = part.output as {
                        ok?: boolean;
                        error?: string;
                      } & GeneratedAssetPart;
                      if (!output?.ok) {
                        return (
                          <p key={index} className="text-sm text-destructive">
                            Falha ao gerar: {output?.error}
                          </p>
                        );
                      }
                      return (
                        <div key={index} className="mt-2 w-full max-w-sm">
                          <div className="checkerboard overflow-hidden rounded-lg border border-border">
                            <img
                              src={output.url}
                              alt={`Asset ${output.kind ?? "gui"} gerado`}
                              className="w-full"
                            />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Button asChild size="sm" variant="secondary">
                              <a
                                href={output.url}
                                download={`${output.assetId}.png`}
                              >
                                <Download className="mr-2 size-4" /> PNG
                              </a>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void downloadPng(
                                  output.url,
                                  `${output.assetId}-sem-fundo.png`,
                                  true,
                                )
                              }
                            >
                              <Eraser className="mr-2 size-4" /> Remover fundo
                            </Button>
                            {typeof output.creditsLeft === "number" && (
                              <span className="text-xs text-muted-foreground">
                                {output.creditsLeft} crédito(s) restante(s)
                              </span>
                            )}
                          </div>

                        </div>
                      );
                    }
                    return (
                      <Shimmer key={index} className="text-sm">
                        Gerando asset...
                      </Shimmer>
                    );
                  }
                  return null;
                })}
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && (
            <Shimmer className="text-sm">Pensando...</Shimmer>
          )}
          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border bg-background/70 p-3 backdrop-blur sm:p-4">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput
            accept="image/*"
            multiple
            maxFiles={3}
            globalDrop
            onError={(err) => toast.error(err.message)}
            onSubmit={(message) => {
              const text = message.text?.trim();
              if ((!text && message.files.length === 0) || isLoading) return;
              void sendMessage({
                text: text || "Use esta imagem como referência.",
                files: message.files,
              });
            }}
          >
            <Attachments />
            <PromptInputTextarea
              ref={inputRef}
              placeholder="Descreva seu asset do Roblox... (ou arraste uma imagem de referência)"
            />
            <PromptInputFooter className="flex-wrap justify-between gap-2">
              <div className="flex items-center gap-1">
                <AttachButton />
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger
                    className="h-8 w-[150px] text-xs"
                    aria-label="Idioma da conversa"
                  >
                    <Languages className="size-3.5 opacity-70" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHAT_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Link
                  to="/credits"
                  aria-label="Ver créditos"
                  className="flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground transition hover:bg-secondary/60"
                >
                  <Coins className="size-3.5 text-primary" />
                  <span className="font-semibold text-primary">
                    {credits ?? "—"}
                  </span>
                  <span className="hidden sm:inline">créditos</span>
                </Link>
              </div>

              <PromptInputSubmit status={status} disabled={isLoading} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
