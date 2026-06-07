const NERD_FONT_CANDIDATES = [
  "JetBrainsMono Nerd Font",
  "JetBrainsMono Nerd Font Mono",
  "JetBrainsMonoNL Nerd Font",
  "FiraCode Nerd Font",
  "FiraCode Nerd Font Mono",
  "MesloLGS NF",
  "MesloLGM Nerd Font",
  "Hack Nerd Font",
  "Hack Nerd Font Mono",
  "CaskaydiaCove Nerd Font",
  "CaskaydiaMono Nerd Font",
  "Iosevka Nerd Font",
  "Iosevka Term Nerd Font",
  "SauceCodePro Nerd Font",
  "Hasklug Nerd Font",
];

const FALLBACK_CHAIN = '"JetBrains Mono", SFMono-Regular, Menlo, monospace';

/**
 * Selectable terminal font families. "auto" defers to the Nerd Font detection
 * below; the rest are fixed CSS font stacks. "JetBrains Mono" is bundled via
 * @fontsource and always available; others rely on the OS having them and
 * fall back to a generic monospace.
 */
export const TERMINAL_FONTS = [
  { id: "auto", label: "System Mono (auto)" },
  { id: "jetbrains-mono", label: "JetBrains Mono" },
  { id: "fira-code", label: "Fira Code" },
  { id: "cascadia-code", label: "Cascadia Code" },
  { id: "source-code-pro", label: "Source Code Pro" },
  { id: "ibm-plex-mono", label: "IBM Plex Mono" },
  { id: "menlo", label: "Menlo / Monaco" },
  { id: "consolas", label: "Consolas" },
  { id: "ubuntu-mono", label: "Ubuntu Mono" },
  { id: "courier", label: "Courier New" },
] as const;

export type TerminalFontId = (typeof TERMINAL_FONTS)[number]["id"];

export const DEFAULT_TERMINAL_FONT: TerminalFontId = "auto";

const FONT_STACKS: Record<Exclude<TerminalFontId, "auto">, string> = {
  "jetbrains-mono": `"JetBrains Mono", ${FALLBACK_CHAIN}`,
  "fira-code": `"Fira Code", "FiraCode Nerd Font", ${FALLBACK_CHAIN}`,
  "cascadia-code": `"Cascadia Code", "CaskaydiaCove Nerd Font", Consolas, ${FALLBACK_CHAIN}`,
  "source-code-pro": `"Source Code Pro", "SauceCodePro Nerd Font", ${FALLBACK_CHAIN}`,
  "ibm-plex-mono": `"IBM Plex Mono", ${FALLBACK_CHAIN}`,
  menlo: `Menlo, Monaco, ${FALLBACK_CHAIN}`,
  consolas: `Consolas, "Cascadia Code", ${FALLBACK_CHAIN}`,
  "ubuntu-mono": `"Ubuntu Mono", ${FALLBACK_CHAIN}`,
  courier: `"Courier New", Courier, monospace`,
};

/** Resolve a terminal font preference id to a CSS font-family stack. */
export function resolveTerminalFontFamily(id: TerminalFontId): string {
  if (id !== "auto" && FONT_STACKS[id]) return FONT_STACKS[id];
  return detectMonoFontFamily();
}

let detected: string | null = null;

export function detectMonoFontFamily(): string {
  if (detected) return detected;
  if (typeof document === "undefined" || !document.fonts) {
    detected = FALLBACK_CHAIN;
    return detected;
  }
  for (const f of NERD_FONT_CANDIDATES) {
    try {
      if (document.fonts.check(`12px "${f}"`)) {
        detected = `"${f}", ${FALLBACK_CHAIN}`;
        return detected;
      }
    } catch {
      // Some browsers throw on invalid font shorthand; ignore.
    }
  }
  detected = FALLBACK_CHAIN;
  return detected;
}
