const TIER_STYLES = {
  Reach:  'bg-[var(--red-50)] text-[var(--red-600)]',
  Match:  'bg-[var(--amber-50)] text-[var(--amber-600)]',
  Safety: 'bg-[var(--green-50)] text-[var(--green-600)]',
};

export function TierBadge({ tier }: { tier: 'Reach' | 'Match' | 'Safety' }) {
  return (
    <span className={`inline-flex items-center px-[10px] py-[3px] rounded-pill text-[11.5px] font-semibold ${TIER_STYLES[tier]}`}>
      {tier}
    </span>
  );
}
