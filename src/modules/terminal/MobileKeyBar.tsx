import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

type Mod = "ctrl" | "alt";

type Props = {
  /** Send a raw byte sequence to the active terminal. */
  onKey: (seq: string) => void;
  /** Arm (or clear, with null) a sticky modifier on the active terminal. */
  onArmModifier: (mod: Mod | null) => void;
};

const KEYS: { label: string; seq: string }[] = [
  { label: "Esc", seq: "\x1b" },
  { label: "Tab", seq: "\t" },
];

const ARROWS: { label: string; seq: string }[] = [
  { label: "←", seq: "\x1b[D" },
  { label: "↑", seq: "\x1b[A" },
  { label: "↓", seq: "\x1b[B" },
  { label: "→", seq: "\x1b[C" },
];

/**
 * Accessory key bar for touch devices: surfaces keys that on-screen keyboards
 * hide (Esc, Tab, arrows) plus sticky Ctrl/Alt modifiers. Floats above the
 * device keyboard using the visualViewport API.
 */
export function MobileKeyBar({ onKey, onArmModifier }: Props) {
  const offset = useKeyboardOffset();
  const [armed, setArmed] = useState<Mod | null>(null);

  // Keep the latest clear callback so the unmount cleanup below (which must run
  // with empty deps) always targets the current terminal session.
  const onArmModifierRef = useRef(onArmModifier);
  onArmModifierRef.current = onArmModifier;

  // Auto-clear so a forgotten arm doesn't linger. Crucially this must also clear
  // the session's pending modifier, or the UI shows nothing armed while the
  // terminal still transforms the next keystroke.
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => {
      setArmed(null);
      onArmModifierRef.current(null);
    }, 4000);
    return () => clearTimeout(id);
  }, [armed]);

  // On unmount (e.g. switching away from a terminal tab) drop any latent
  // modifier so it can't mutate a future keystroke in a different session.
  useEffect(() => {
    return () => onArmModifierRef.current(null);
  }, []);

  const tapKey = (seq: string) => {
    if (armed) {
      onArmModifier(null);
      setArmed(null);
    }
    onKey(seq);
  };

  const tapMod = (mod: Mod) => {
    const next = armed === mod ? null : mod;
    setArmed(next);
    onArmModifier(next);
  };

  return (
    <div
      data-mobile-keybar
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-card/95 backdrop-blur"
      style={{
        transform: `translateY(-${offset}px)`,
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex items-center gap-1 overflow-x-auto px-2 py-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {KEYS.map((k) => (
          <KeyBtn key={k.label} label={k.label} onTap={() => tapKey(k.seq)} />
        ))}
        <KeyBtn
          label="Ctrl"
          active={armed === "ctrl"}
          onTap={() => tapMod("ctrl")}
        />
        <KeyBtn
          label="Alt"
          active={armed === "alt"}
          onTap={() => tapMod("alt")}
        />
        {ARROWS.map((k) => (
          <KeyBtn key={k.label} label={k.label} onTap={() => tapKey(k.seq)} />
        ))}
        <KeyBtn label="^C" onTap={() => tapKey("\x03")} />
      </div>
    </div>
  );
}

function KeyBtn({
  label,
  onTap,
  active,
}: {
  label: string;
  onTap: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      // Prevent the tap from stealing focus from the terminal textarea, which
      // would dismiss the on-screen keyboard.
      onPointerDown={(e) => e.preventDefault()}
      onClick={onTap}
      className={cn(
        "h-9 min-w-9 shrink-0 rounded-md border border-border/60 px-2.5 text-[13px] font-medium",
        "text-foreground/80 transition-colors active:bg-accent",
        active && "border-primary bg-primary/15 text-foreground",
      )}
    >
      {label}
    </button>
  );
}

// Reports how many pixels the on-screen keyboard covers at the bottom, so the
// bar can be lifted above it on iOS (where the keyboard overlays the viewport).
function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const o = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(o > 1 ? o : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}
