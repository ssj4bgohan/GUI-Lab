import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ELEMENT_TYPES, STYLES } from "@/lib/prompt-enrichment";
import { Loader2, Sparkles } from "lucide-react";

export type GenerateForm = {
  userPrompt: string;
  style: string;
  elementType: string;
  primaryColor: string;
  borderColor: string;
};

export function GeneratePanel({
  form,
  setForm,
  onGenerate,
  isPending,
}: {
  form: GenerateForm;
  setForm: (next: GenerateForm) => void;
  onGenerate: () => void;
  isPending: boolean;
}) {
  const set = <K extends keyof GenerateForm>(key: K, value: GenerateForm[K]) =>
    setForm({ ...form, [key]: value });

  return (
    <div className="space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="space-y-2">
        <Label htmlFor="prompt">Describe your GUI element</Label>
        <Textarea
          id="prompt"
          rows={3}
          maxLength={400}
          placeholder="e.g. Blue Shop Frame, Green Buy Button"
          value={form.userPrompt}
          onChange={(e) => set("userPrompt", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label>Style</Label>
        <Select value={form.style} onValueChange={(v) => set("style", v)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Element Type</Label>
        <Select
          value={form.elementType}
          onValueChange={(v) => set("elementType", v)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ELEMENT_TYPES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="primary">Primary color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="primary"
              type="color"
              className="h-10 w-14 cursor-pointer p-1"
              value={form.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {form.primaryColor}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="border">Border color</Label>
          <div className="flex items-center gap-2">
            <Input
              id="border"
              type="color"
              className="h-10 w-14 cursor-pointer p-1"
              value={form.borderColor}
              onChange={(e) => set("borderColor", e.target.value)}
            />
            <span className="font-mono text-xs text-muted-foreground">
              {form.borderColor}
            </span>
          </div>
        </div>
      </div>

      <Button
        className="w-full"
        size="lg"
        onClick={onGenerate}
        disabled={isPending || form.userPrompt.trim().length < 3}
      >
        {isPending ? (
          <>
            <Loader2 className="animate-spin" /> Generating…
          </>
        ) : (
          <>
            <Sparkles /> Generate Asset
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground">
        Your description is automatically enriched with Roblox-specific style
        rules before it reaches the image model.
      </p>
    </div>
  );
}
