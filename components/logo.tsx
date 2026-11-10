// CoFuture logo: open ring (shared space) with a dot (the contribution).
// Wordmark is text in Manrope 800, "Co" in primary, "Future" in ink.

type MarkProps = {
  size?: number;
  className?: string;
  /** "color" follows the theme tokens; "mono" uses currentColor. */
  variant?: "color" | "mono";
  title?: string;
};

export function LogoMark({ size = 32, className, variant = "color", title }: MarkProps) {
  const ring = variant === "color" ? "var(--primary)" : "currentColor";
  const dot = variant === "color" ? "var(--accent)" : "currentColor";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path d="M48.85 17.86A22 22 0 1 0 48.85 46.14" fill="none" stroke={ring} strokeWidth="8" strokeLinecap="round" />
      <circle cx="52" cy="32" r="5.5" fill={dot} />
    </svg>
  );
}

/** Horizontal lockup. Mark height = 1.3 × font size, gap = 0.4 × font size. */
export function Logo({ fontSize = 22, className }: { fontSize?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center ${className ?? ""}`} style={{ gap: fontSize * 0.4 }}>
      <LogoMark size={Math.round(fontSize * 1.3)} />
      <span
        className="font-display font-extrabold leading-none tracking-[-0.02em] text-ink"
        style={{ fontSize }}
      >
        <span className="text-primary">Co</span>Future
      </span>
    </span>
  );
}
