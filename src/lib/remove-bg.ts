/** Remove a cor sólida de fundo de uma imagem usando flood fill pelas bordas. */
export function keyOutBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tolerance = 40,
) {
  const image = ctx.getImageData(0, 0, width, height);
  const p = image.data;

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

  const visited = new Uint8Array(width * height);
  const stack: number[] = [];
  for (let x = 0; x < width; x++) stack.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) stack.push(y * width, y * width + width - 1);

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
    const ratio = Math.min(
      1,
      Math.max(0, (dist - tolerance) / (soft - tolerance || 1)),
    );
    p[i + 3] = Math.round(p[i + 3] * ratio);
  }

  ctx.putImageData(image, 0, 0);
}

/** Baixa uma imagem remota como PNG, opcionalmente com o fundo removido. */
export async function downloadPng(
  url: string,
  filename: string,
  removeBg: boolean,
) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("load"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
  if (removeBg) keyOutBackground(ctx, canvas.width, canvas.height);
  await new Promise<void>((resolve) =>
    canvas.toBlob((blob) => {
      if (blob) {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        URL.revokeObjectURL(link.href);
      }
      resolve();
    }, "image/png"),
  );
}
