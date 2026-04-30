export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <RadarIcon size={22} />
      <span className="font-semibold text-[14px] text-[var(--ink)]">CollegePilot</span>
    </div>
  );
}

export function RadarIcon({ size = 22 }: { size?: number }) {
  const cx = size / 2, cy = size / 2;
  const r1 = size * 0.432, r2 = size * 0.282, r3 = size * 0.136;
  const sweep = { x: cx + r1 * Math.sin(Math.PI / 4), y: cy - r1 * Math.cos(Math.PI / 4) };
  const top  = { x: cx, y: cy - r1 };
  const blip = { x: cx + r1 * 0.65 * Math.sin(Math.PI / 4), y: cy - r1 * 0.65 * Math.cos(Math.PI / 4) };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={cy} r={r1} stroke="#7c3aed" strokeWidth={size * 0.059} fill="none" />
      <circle cx={cx} cy={cy} r={r2} stroke="#7c3aed" strokeWidth={size * 0.041} fill="none" opacity="0.55" />
      <circle cx={cx} cy={cy} r={r3} stroke="#7c3aed" strokeWidth={size * 0.036} fill="none" opacity="0.35" />
      <path
        d={`M${cx} ${cy} L${sweep.x.toFixed(2)} ${sweep.y.toFixed(2)} A${r1} ${r1} 0 0 0 ${top.x} ${top.y} Z`}
        fill="#7c3aed" fillOpacity="0.12"
      />
      <line x1={cx} y1={cy} x2={sweep.x.toFixed(2)} y2={sweep.y.toFixed(2)}
        stroke="#7c3aed" strokeWidth={size * 0.059} strokeLinecap="round" />
      <circle cx={blip.x.toFixed(2)} cy={blip.y.toFixed(2)} r={size * 0.068} fill="#7c3aed" />
      <circle cx={cx} cy={cy} r={size * 0.059} fill="#7c3aed" />
    </svg>
  );
}
