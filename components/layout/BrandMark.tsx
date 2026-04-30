export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-600) 100%)' }}
      >
        <svg width="17" height="17" viewBox="0 0 17 17" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Compass rose — outer ring */}
          <circle cx="8.5" cy="8.5" r="7" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="none" />
          {/* North needle (accent — pointing up-right) */}
          <path d="M8.5 8.5 L10.8 3.2 L8.5 5.8 Z" fill="white" />
          {/* South needle (dimmed) */}
          <path d="M8.5 8.5 L6.2 13.8 L8.5 11.2 Z" fill="rgba(255,255,255,0.45)" />
          {/* East needle */}
          <path d="M8.5 8.5 L13.8 6.2 L11.2 8.5 Z" fill="rgba(255,255,255,0.6)" />
          {/* West needle */}
          <path d="M8.5 8.5 L3.2 10.8 L5.8 8.5 Z" fill="rgba(255,255,255,0.45)" />
          {/* Center dot */}
          <circle cx="8.5" cy="8.5" r="1.1" fill="white" />
          {/* Tiny graduation cap above north needle */}
          <rect x="7.2" y="1.4" width="2.6" height="1" rx="0.2" fill="white" opacity="0.9" />
          <path d="M7.5 2.4 L8.5 3.1 L9.5 2.4" stroke="white" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9" />
        </svg>
      </div>
      <span className="font-semibold text-[14px] text-[var(--ink)]">CollegePilot</span>
    </div>
  );
}
