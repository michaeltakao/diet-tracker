/**
 * Solo Leveling "System" UI chrome — dark glassmorphic panel with a neon
 * cyan border/inset-glow and a scanline sweep overlay. Always-dark by
 * design (see app/globals.css --sys-* tokens); does not hook into
 * prefers-color-scheme.
 */

interface SystemPanelProps {
  children: React.ReactNode;
  className?: string;
}

export default function SystemPanel({ children, className = '' }: SystemPanelProps) {
  return (
    <div className={`system-panel relative overflow-hidden ${className}`}>
      <div className="system-scanline-overlay pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
