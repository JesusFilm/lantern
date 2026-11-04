// Runs before the app bundle so the browser's initial canvas uses the right mode.
(() => {
  let appearance = "system";
  try {
    const stored = localStorage.getItem("lantern-appearance");
    if (stored === "light" || stored === "dark") appearance = stored;
  } catch { /* Use the device setting when storage is unavailable. */ }
  const theme = appearance === "system"
    ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : appearance;
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
})();
