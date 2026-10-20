import { DOMParser, XMLSerializer } from "@xmldom/xmldom";

export const initiativeIcons = ["heart", "lightbulb", "sprout", "users", "compass", "hammer", "sparkles", "flag", "book-open", "target", "globe", "handshake"] as const;
export type InitiativeIcon = typeof initiativeIcons[number];
export interface InitiativeAppearance {
  color: string;
  icon?: InitiativeIcon;
  svg?: string;
}
export const initiativeColors = [
  { name: "Red", value: "#d13d46" }, { name: "Orange", value: "#df741b" },
  { name: "Yellow", value: "#e4bf24" }, { name: "Green", value: "#267c65" },
  { name: "Blue", value: "#3276b0" }, { name: "Purple", value: "#8560bb" },
  { name: "Pink", value: "#c74998" }, { name: "Slate", value: "#526578" },
] as const;
export function isPresetAppearance(appearance: InitiativeAppearance): boolean {
  return appearance.svg === undefined &&
    initiativeColors.some(color => color.value === appearance.color) &&
    (appearance.icon === undefined || initiativeIcons.includes(appearance.icon));
}
export const maxInitiativeSvgBytes = 20_000;
const svgError = "Choose a plain SVG icon up to 20 KB with a viewBox. Scripts, styles, embedded images and external references are not supported.";
const elements = new Set(["svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon", "title", "desc"]);
const attributes = new Set(["xmlns", "viewBox", "width", "height", "d", "points", "x", "y", "x1", "y1", "x2", "y2",
  "cx", "cy", "r", "rx", "ry", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-miterlimit", "stroke-dasharray", "stroke-dashoffset", "fill-rule", "clip-rule", "opacity",
  "fill-opacity", "stroke-opacity", "transform", "vector-effect", "color"]);

// Compatibility validation for previously saved SVGs and focus snapshots.
// New configuration choices are restricted to presets in saveDirection.
export function validateInitiativeSvg(value: unknown): string {
  const fail = (): never => { throw new Error(svgError); };
  if (typeof value !== "string" || new TextEncoder().encode(value).length > maxInitiativeSvgBytes ||
      /<!DOCTYPE|<!ENTITY/i.test(value)) return fail();
  try {
    const doc = new DOMParser({ onError: fail }).parseFromString(value, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.tagName !== "svg") return fail();
    const viewBox = root.getAttribute("viewBox")?.trim().split(/[\s,]+/).map(Number);
    if (!viewBox || viewBox.length !== 4 || !viewBox.every(Number.isFinite) || viewBox[2]! <= 0 || viewBox[3]! <= 0) return fail();
    const nodes = [doc as import("@xmldom/xmldom").Node];
    let count = 0;
    while (nodes.length) {
      const node = nodes.pop()!;
      if (++count > 500) return fail();
      if (node.nodeType === 1) {
        const el = node as import("@xmldom/xmldom").Element;
        if (!elements.has(el.tagName) || (el.namespaceURI && el.namespaceURI !== "http://www.w3.org/2000/svg") ||
            (el.tagName === "svg" && el !== root)) return fail();
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes.item(i)!;
          if (!attributes.has(attr.name) || /url\s*\(|[<>]/i.test(attr.value) ||
              (attr.name === "xmlns" && attr.value !== "http://www.w3.org/2000/svg")) return fail();
          if (["fill", "stroke", "color"].includes(attr.name) &&
              !/^(none|currentColor|transparent|[a-z]+|#[a-f0-9]{3,8}|rgba?\([\d\s.,%]+\))$/i.test(attr.value)) return fail();
        }
      } else if (![3, 8, 9].includes(node.nodeType)) return fail();
      for (let i = 0; i < node.childNodes.length; i++) nodes.push(node.childNodes.item(i)!);
    }
    root.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    return new XMLSerializer().serializeToString(root);
  } catch { return fail(); }
}

export function validateInitiativeAppearance(value: unknown): InitiativeAppearance {
  const fail = (): never => { throw new Error("Choose an initiative icon and a six-digit hex color."); };
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail();
  const data = value as InitiativeAppearance;
  if (Object.keys(data).some(key => !["icon", "svg", "color"].includes(key)) ||
      typeof data.color !== "string" || !/^#[a-f0-9]{6}$/i.test(data.color) ||
      (data.icon !== undefined && !initiativeIcons.includes(data.icon)) ||
      (data.svg !== undefined && data.icon !== undefined)) return fail();
  return { color: data.color.toLowerCase(),
    ...(data.icon !== undefined ? { icon: data.icon } : {}),
    ...(data.svg !== undefined ? { svg: validateInitiativeSvg(data.svg) } : {}) };
}
