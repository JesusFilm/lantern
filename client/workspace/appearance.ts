import { useEffect, useLayoutEffect, useState } from "react";

export type Appearance = "system" | "light" | "dark";
const key = "lantern-appearance";
function read(): Appearance {
  try {
    const value = localStorage.getItem(key);
    return value === "light" || value === "dark" ? value : "system";
  } catch { return "system"; }
}
export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(read);
  useLayoutEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = appearance === "system" ? (system.matches ? "dark" : "light") : appearance; };
    apply();
    system.addEventListener("change", apply);
    return () => system.removeEventListener("change", apply);
  }, [appearance]);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === key || event.key === null) setAppearance(read()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  function choose(value: Appearance) {
    setAppearance(value);
    try { localStorage.setItem(key, value); } catch { /* Appearance still works for this session. */ }
  }
  return { appearance, choose };
}
