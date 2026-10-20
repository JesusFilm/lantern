import type { CSSProperties } from "react";
import { Heart, Lightbulb, Sprout, Users, Compass, Hammer, Sparkles, Flag, BookOpen, Target, Globe, Handshake } from "lucide-react";
import type { InitiativeAppearance, InitiativeIcon } from "../../shared/initiative-appearance.js";

const icons = { heart: Heart, lightbulb: Lightbulb, sprout: Sprout, users: Users, compass: Compass, hammer: Hammer, sparkles: Sparkles, flag: Flag, "book-open": BookOpen, target: Target, globe: Globe, handshake: Handshake };
export const initiativeIconLabels: Record<InitiativeIcon, string> = {
  heart: "Heart", lightbulb: "Light bulb", sprout: "Growth", users: "People",
  compass: "Compass", hammer: "Build", sparkles: "Sparkles", flag: "Flag",
  "book-open": "Book", target: "Target",
  globe: "Globe", handshake: "Handshake",
};
export function InitiativeIconGraphic({ icon }: { icon: InitiativeIcon }) {
  const Icon = icons[icon];
  return <Icon size={20} aria-hidden="true" />;
}
export function InitiativeIdentity({ name, appearance, chip = false }: {
  name: string; appearance?: InitiativeAppearance; chip?: boolean;
}) {
  return <span className={`initiative-identity${chip ? " initiative-chip" : ""}${appearance ? " has-appearance" : ""}`}
    style={appearance ? { "--initiative-color": appearance.color } as CSSProperties : undefined}>
    {appearance && <span className="initiative-mark" aria-hidden="true">
      {appearance.svg ? <img alt="" src={`data:image/svg+xml,${encodeURIComponent(appearance.svg.replaceAll("currentColor", appearance.color))}`} /> :
        appearance.icon && <InitiativeIconGraphic icon={appearance.icon} />}
    </span>}
    <span>{name}</span>
  </span>;
}
