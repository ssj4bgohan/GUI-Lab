export const STYLES = [
  { value: "classic-studs", label: "Classic Studs" },
  { value: "simulator-glossy", label: "Simulator Glossy" },
  { value: "hybrid", label: "Hybrid" },
] as const;

export const ELEMENT_TYPES = [
  { value: "frame", label: "Frame/Window" },
  { value: "button", label: "Button" },
  { value: "hud", label: "HUD Bar" },
  { value: "icon", label: "Icon" },
] as const;

export type StyleValue = (typeof STYLES)[number]["value"];
export type ElementTypeValue = (typeof ELEMENT_TYPES)[number]["value"];

const STUDS_SUFFIX =
  "flat 2D Roblox UI element, classic Lego-like circular stud pattern texture tiled on the surface, clean blocky retro-modern game style, isolated on a solid white background, no text, front-facing orthographic view, no realistic shadows";

const GLOSSY_SUFFIX =
  "chunky glossy plastic Roblox simulator UI style, thick dark borders, vibrant cartoonish design, flat 2D vector asset, isolated on a solid white background, no text, front-facing, no realistic 3D depth";

const ELEMENT_HINTS: Record<ElementTypeValue, string> = {
  frame: "a rectangular GUI frame / window panel with a header bar area",
  button: "a single wide rounded rectangular GUI button",
  hud: "a horizontal HUD progress bar element with a filled track",
  icon: "a single square GUI icon badge",
};

const ALWAYS =
  "no text, no letters, no numbers, blank template, solid pure white background for easy cropping, centered, generous white margin";

export function enrichPrompt(input: {
  userPrompt: string;
  style: StyleValue;
  elementType: ElementTypeValue;
  primaryColor: string;
  borderColor: string;
}): string {
  const styleSuffix =
    input.style === "classic-studs"
      ? STUDS_SUFFIX
      : input.style === "simulator-glossy"
        ? GLOSSY_SUFFIX
        : `${STUDS_SUFFIX}, blended with ${GLOSSY_SUFFIX}`;

  return [
    input.userPrompt.trim(),
    ELEMENT_HINTS[input.elementType],
    `primary fill color ${input.primaryColor}, border/outline color ${input.borderColor}`,
    styleSuffix,
    ALWAYS,
  ].join(", ");
}
