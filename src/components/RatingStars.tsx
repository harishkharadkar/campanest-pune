import React from 'react';
import { Star } from 'lucide-react';

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

  return (
    <span className={`inline-flex items-center gap-2 ${className}`.trim()}>
      <span className="inline-flex items-center gap-1">
        {[0, 1, 2, 3, 4].map((index) => {
          const fillFraction = Math.min(1, Math.max(0, safeAverage - index));
          return (
            <span key={index} className="relative inline-flex" aria-hidden="true">
              <Star size={size} className="text-border" fill="currentColor" />
              <span className="absolute left-0 top-0 overflow-hidden" style={{ width: `${fillFraction * 100}%` }}>
                <Star size={size} className="text-[#F59E0B]" fill="currentColor" />
              </span>
            </span>
          );
        })}
      </span>
      {showText && (
        safeTotal === 0
          ? <span className="text-sm text-text-muted">No ratings yet</span>
          : <span className="text-sm text-text-muted">{safeAverage.toFixed(1)} ({safeTotal} ratings)</span>
      )}
    </span>
  );
}
