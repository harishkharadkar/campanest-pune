import React from 'react';

type RatingStarsProps = {
  avgRating: number;
  totalRatings: number;
  size?: number;
  showText?: boolean;
  className?: string;
};

const clampRating = (value: number) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(5, Math.max(0, value));
};

export default function RatingStars({
  avgRating,
  totalRatings,
  size = 16,
  showText = true,
  className = ''
}: RatingStarsProps) {
  const safeAverage = clampRating(avgRating);
  const safeTotal = Math.max(0, Math.floor(Number(totalRatings) || 0));
  const roundedAverage = Math.round(safeAverage);
  const starSize = Math.max(14, size + 2);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-xl border border-[#2A2A3D] bg-gradient-to-br from-[#12121A] to-[#1A1A28] px-3 py-2 ${className}`.trim()}
      style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)' }}
    >
      <span className="inline-flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            aria-hidden="true"
            style={{
              fontSize: `${starSize}px`,
              lineHeight: 1,
              color: star <= roundedAverage ? '#F59E0B' : '#2A2A3D',
              filter: star <= roundedAverage ? 'drop-shadow(0 0 4px rgba(245,158,11,0.5))' : 'none',
              display: 'inline-block'
            }}
          >
            {'\u2605'}
          </span>
        ))}
      </span>
      {showText && (
        safeTotal === 0
          ? <span className="text-sm text-text-muted">No ratings yet</span>
          : <span className="text-sm text-text-muted">{'\u2605'} {safeAverage.toFixed(1)} ({safeTotal} ratings)</span>
      )}
    </span>
  );
}
