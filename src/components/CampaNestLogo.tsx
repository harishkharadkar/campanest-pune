import React from 'react';

type CampaNestLogoProps = {
  size?: number;
  variant?: 'icon' | 'full';
};

export default function CampaNestLogo({
  size = 80,
  variant = 'icon'
}: CampaNestLogoProps) {
  const icon = (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="CampaNest logo icon">
      <rect x="0" y="0" width="100" height="100" rx="22" fill="#121212" />
      <path d="M50 8 L88 22 L88 58 Q88 80 50 92 Q12 80 12 58 L12 22 Z" fill="#FF7A00" />
      <path
        d="M67 36 Q50 24 35 34 Q22 44 24 58 Q26 72 40 76 Q54 80 67 70"
        fill="none"
        stroke="#121212"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <circle cx="76" cy="26" r="14" fill="#00C2A8" />
      <text
        x="76"
        y="31"
        textAnchor="middle"
        fontSize="13"
        fontWeight="900"
        fontFamily="Arial Black"
        fill="#000000"
      >
        P
      </text>
    </svg>
  );

  if (variant === 'full') {
    return (
      <div className="flex flex-col items-center text-center">
        {icon}
        <h1 className="text-4xl font-bold text-primary mt-4">CampaNest</h1>
        <p className="text-accent font-medium tracking-widest uppercase text-sm">Pune</p>
        <p className="text-zinc-500 text-xs mt-4">Your campus. Your neighbourhood.</p>
      </div>
    );
  }

  return icon;
}

