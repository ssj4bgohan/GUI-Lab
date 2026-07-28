import { useMemo, useState } from "react";
import type { AssetRecord } from "@/lib/assets.functions";
import { Button } from "@/components/ui/button";
import { STYLES } from "@/lib/prompt-enrichment";
import { Download, Eye } from "lucide-react";

export function AssetGallery({
  assets,
  onSelect,
  variant = "grid",
}: {
  assets: AssetRecord[];
  onSelect: (asset: AssetRecord) => void;
  variant?: "grid" | "sidebar";
}) {
  const [filter, setFilter] = useState<string>("all");
  const sidebar = variant === "sidebar";

  const filtered = useMemo(
    () =>
      filter === "all"
        ? assets
        : assets.filter((a) => a.style_used === filter),
    [assets, filter],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Past Generations</h2>
        <div className="flex flex-wrap gap-2">
          {[{ value: "all", label: "All" }, ...STYLES].map((s) => (
            <Button
              key={s.value}
              size="sm"
              variant={filter === s.value ? "default" : "secondary"}
              onClick={() => setFilter(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No assets yet — generate your first GUI element.
        </p>
      ) : (
        <div
          className={
            sidebar
              ? "grid grid-cols-2 gap-3 lg:grid-cols-1"
              : "grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
          }
        >

          {filtered.map((asset) => (
            <article
              key={asset.id}
              className="group overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="checkerboard aspect-square">
                <img
                  src={asset.url}
                  alt={`${asset.user_prompt} — Roblox GUI asset`}
                  loading="lazy"
                  className="size-full object-contain"
                />
              </div>
              <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-sm font-medium">
                  {asset.user_prompt}
                </p>
                <p className="text-xs text-muted-foreground">
                  {STYLES.find((s) => s.value === asset.style_used)?.label ??
                    asset.style_used}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => onSelect(asset)}
                  >
                    <Eye /> View
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <a href={asset.url} download target="_blank" rel="noreferrer">
                      <Download />
                    </a>
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
