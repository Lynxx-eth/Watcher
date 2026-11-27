/**
 * Original WATCHER mark: an aperture/eye built from a hexagon,
 * a lens ring and an iris — no agency insignia.
 */
export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg className="w-logo__mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="wlg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00E5FF" />
          <stop offset="1" stopColor="#0077B6" />
        </linearGradient>
      </defs>
      <polygon
        points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5"
        fill="none"
        stroke="url(#wlg)"
        strokeWidth="2"
      />
      <polygon
        points="32,10 51,21 51,43 32,54 13,43 13,21"
        fill="rgba(0,191,255,0.06)"
        stroke="rgba(0,191,255,0.35)"
        strokeWidth="1"
      />
      <path d="M12 32 Q32 14 52 32 Q32 50 12 32 Z" fill="none" stroke="#00E5FF" strokeWidth="2" />
      <circle cx="32" cy="32" r="8" fill="none" stroke="#00BFFF" strokeWidth="2" />
      <circle cx="32" cy="32" r="3.2" fill="#00E5FF" />
      <line x1="32" y1="3" x2="32" y2="10" stroke="#00E5FF" strokeWidth="1.5" />
      <line x1="32" y1="54" x2="32" y2="61" stroke="#00E5FF" strokeWidth="1.5" />
    </svg>
  );
}

export function Logo({ size = 36, sub }: { size?: number; sub?: string }) {
  return (
    <span className="w-logo">
      <LogoMark size={size} />
      <span>
        <span className="w-logo__word" style={{ fontSize: Math.round(size * 0.58) }}>
          WATCHER
        </span>
        {sub && <span className="w-logo__sub">{sub}</span>}
      </span>
    </span>
  );
}
