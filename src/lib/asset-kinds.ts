/** Kinds of assets GUI Lab can generate (client-safe module). */
export const ASSET_KINDS = [
  { value: "gui", label: "GUI" },
  { value: "3d", label: "3D" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "shirt", label: "Shirt" },
  { value: "pants", label: "Pants" },
] as const;

export type AssetKind = (typeof ASSET_KINDS)[number]["value"];

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
  gui: "GUI",
  "3d": "Modelo 3D (concept render)",
  thumbnail: "Thumbnail",
  shirt: "Camisa (shirt)",
  pants: "Calça (pants)",
};

const TRANSPARENT_RULES =
  "isolated single object, perfectly flat pure white background #FFFFFF with zero gradient, zero vignette, zero drop shadow and zero reflection touching the background, hard clean anti-aliased edges, generous even white margin around the subject, nothing else in the frame, so the background can be color-keyed away for a transparent PNG";

const NO_TEXT = "no text, no letters, no numbers, no watermark, no logo, blank template";

const STUDS_SUFFIX =
  "flat 2D Roblox UI element, classic Lego-like circular stud pattern texture tiled on the surface, clean blocky retro-modern game style, front-facing orthographic view, no realistic shadows";

const GLOSSY_SUFFIX =
  "chunky glossy plastic Roblox simulator UI style, thick dark borders, vibrant cartoonish design, flat 2D vector asset, front-facing, no realistic 3D depth";

export const GUI_STYLES = [
  { value: "classic-studs", label: "Classic Studs" },
  { value: "simulator-glossy", label: "Simulator Glossy" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export type GuiStyle = (typeof GUI_STYLES)[number]["value"];

export const GUI_ELEMENTS = [
  { value: "frame", label: "Frame/Window" },
  { value: "button", label: "Button" },
  { value: "hud", label: "HUD Bar" },
  { value: "icon", label: "Icon" },
] as const;

export type GuiElement = (typeof GUI_ELEMENTS)[number]["value"];

const ELEMENT_HINTS: Record<GuiElement, string> = {
  frame: "a rectangular GUI frame / window panel with a header bar area",
  button: "a single wide rounded rectangular GUI button",
  hud: "a horizontal HUD progress bar element with a filled track",
  icon: "a single square GUI icon badge",
};

export type EnrichInput = {
  kind: AssetKind;
  userPrompt: string;
  style?: GuiStyle;
  elementType?: GuiElement;
  primaryColor?: string | null;
  borderColor?: string | null;
  /** Whether the user wants a cut-out / transparent-ready asset. */
  transparent?: boolean;
};

export function enrichAssetPrompt(input: EnrichInput): string {
  const colors = [
    input.primaryColor ? `primary fill color ${input.primaryColor}` : null,
    input.borderColor ? `border/outline color ${input.borderColor}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const parts: string[] = [input.userPrompt.trim()];

  switch (input.kind) {
    case "gui": {
      const style = input.style ?? "simulator-glossy";
      const element = input.elementType ?? "frame";
      const styleSuffix =
        style === "classic-studs"
          ? STUDS_SUFFIX
          : style === "simulator-glossy"
            ? GLOSSY_SUFFIX
            : `${STUDS_SUFFIX}, blended with ${GLOSSY_SUFFIX}`;
      parts.push(ELEMENT_HINTS[element], styleSuffix, NO_TEXT, TRANSPARENT_RULES);
      break;
    }
    case "3d": {
      parts.push(
        "high quality 3D concept render of a Roblox-style low-poly game model, chunky stylized proportions, clean studio lighting, three-quarter hero angle, vibrant game-ready colors, single asset centered",
        NO_TEXT,
        TRANSPARENT_RULES,
      );
      break;
    }
    case "thumbnail": {
      parts.push(
        "Roblox game thumbnail artwork, 16:9 composition, dramatic lighting, bold saturated colors, glossy stylized 3D characters and props, eye-catching high-contrast game cover art, cinematic depth, no white background, full bleed background scene",
        "no text, no letters, no numbers, no watermark",
      );
      break;
    }
    case "shirt": {
      parts.push(
        "Roblox classic shirt texture design, flat 2D clothing texture artwork laid out for the R6 shirt template, front torso and both sleeves, seamless fabric detailing, crisp vector-like shapes, no wrinkles photography, straight-on flat view",
        NO_TEXT,
        TRANSPARENT_RULES,
      );
      break;
    }
    case "pants": {
      parts.push(
        "Roblox classic pants texture design, flat 2D clothing texture artwork laid out for the R6 pants template, both legs and waist panels, seamless fabric detailing, crisp vector-like shapes, straight-on flat view",
        NO_TEXT,
        TRANSPARENT_RULES,
      );
      break;
    }
  }

  if (colors) parts.splice(1, 0, colors);

  if (input.transparent && input.kind !== "thumbnail") {
    parts.push(
      "CRITICAL: the subject must never touch or blend into the background, keep the background one single uniform pure white tone with no soft shadow so automatic background removal produces a perfectly clean cut-out",
    );
  }

  return parts.filter(Boolean).join(", ");
}
