import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Download, Eraser, ImageOff, Loader2, Trees } from "lucide-react";
import baseplate from "@/assets/baseplate.jpg";

export function AssetPreview({
  url,
  isPending,
  title,
}: {
  url: string | null;
  isPending: boolean;
  title: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [showBaseplate, setShowBaseplate] = useState(false);
  const [removeBg, setRemoveBg] = useState(true);
  const [tolerance, setTolerance] = useState(40);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    imgRef.current = null;
    if (!url) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      setReady(true);
    };
    img.src = url;
  }, [url]);

  useEffect(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!ready || !img || !canvas) return;

    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    if (!removeBg) return;

    const { width, height } = canvas;
    const image = ctx.getImageData(0, 0, width, height);
    const p = image.data;

    // Reference background colour: average of the four corners.
    const corners = [
      0,
      (width - 1) * 4,
      (height - 1) * width * 4,
      ((height - 1) * width + width - 1) * 4,
    ];
    let kr = 0;
    let kg = 0;
    let kb = 0;
    for (const c of corners) {
      kr += p[c];
      kg += p[c + 1];
      kb += p[c + 2];
    }
    kr /= 4;
    kg /= 4;
    kb /= 4;

    const near = (i: number, limit: number) =>
      Math.max(
        Math.abs(p[i] - kr),
        Math.abs(p[i + 1] - kg),
        Math.abs(p[i + 2] - kb),
      ) <= limit;

    // Flood fill from the borders so background-coloured details INSIDE the
    // asset (white highlights, icons) are preserved.
    const visited = new Uint8Array(width * height);
    const stack: number[] = [];
    for (let x = 0; x < width; x++) {
      stack.push(x, (height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      stack.push(y * width, y * width + width - 1);
    }

    while (stack.length) {
      const idx = stack.pop() as number;
      if (idx < 0 || idx >= width * height || visited[idx]) continue;
      const i = idx * 4;
      if (!near(i, tolerance)) continue;
      visited[idx] = 1;
      p[i + 3] = 0;
      const x = idx % width;
      if (x > 0) stack.push(idx - 1);
      if (x < width - 1) stack.push(idx + 1);
      stack.push(idx - width, idx + width);
    }

    // Feather the cut edge: semi-transparent halo pixels get partial alpha and
    // are pulled away from the background colour to kill white fringing.
    const soft = Math.round(tolerance * 1.8);
    for (let idx = 0; idx < width * height; idx++) {
      if (visited[idx]) continue;
      const i = idx * 4;
      if (!near(i, soft)) continue;
      const x = idx % width;
      const y = (idx - x) / width;
      let touchesBg = false;
      for (let dy = -1; dy <= 1 && !touchesBg; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (visited[ny * width + nx]) {
            touchesBg = true;
            break;
          }
        }
      }
      if (!touchesBg) continue;
      const dist = Math.max(
        Math.abs(p[i] - kr),
        Math.abs(p[i + 1] - kg),
        Math.abs(p[i + 2] - kb),
      );
      const ratio = Math.min(1, Math.max(0, (dist - tolerance) / (soft - tolerance || 1)));
      p[i + 3] = Math.round(p[i + 3] * ratio);
    }

    ctx.putImageData(image, 0, 0);
  }, [ready, removeBg, tolerance]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${title.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "guilab-asset"}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, "image/png");
  };

  return (
    <div className="flex h-full flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
      <div
        className={`relative flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-lg border border-border sm:min-h-[300px] ${showBaseplate ? "" : "checkerboard"}`}
        style={
          showBaseplate
            ? {
                backgroundImage: `url(${baseplate})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {isPending && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">Renderizando seu asset…</p>
          </div>
        )}
        {!isPending && !url && (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <ImageOff className="size-8" />
            <p className="max-w-xs text-center text-sm">
              Seu asset gerado aparece aqui.
            </p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className={`max-h-[60vh] max-w-full object-contain ${url && !isPending ? "" : "hidden"}`}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-3 py-2">
        <Label htmlFor="baseplate" className="flex items-center gap-2 text-sm">
          <Trees className="size-4" /> Ver na Baseplate
        </Label>
        <Switch
          id="baseplate"
          checked={showBaseplate}
          onCheckedChange={setShowBaseplate}
        />
      </div>

      {removeBg && (
        <div className="space-y-2">
          <Label className="text-sm">Precisão do recorte: {tolerance}</Label>
          <Slider
            value={[tolerance]}
            min={0}
            max={120}
            step={1}
            onValueChange={([v]) => setTolerance(v)}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={download} disabled={!url || !ready} variant="secondary">
          <Download /> Baixar PNG
        </Button>
        <Button
          variant={removeBg ? "default" : "outline"}
          onClick={() => setRemoveBg((v) => !v)}
          aria-pressed={removeBg}
        >
          <Eraser /> {removeBg ? "Fundo removido" : "Remover fundo"}
        </Button>
      </div>


    </div>
  );
}
