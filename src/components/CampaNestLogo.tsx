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
      <path d="M18 24 L50 8 L82 24 L82 62 L58 82 L50 86 L42 82 L18 62 Z" fill="#FF7A00" />
      <path
        d="M67 31 C56 24 43 25 34 34 C25 43 25 57 34 66 C43 75 56 76 67 69"
        fill="none"
        stroke="#0A0A0F"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <circle cx="79" cy="23" r="13" fill="#00BFA5" />
      <text
        x="79"
        y="28"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fontFamily="Inter, sans-serif"
        fill="#FFFFFF"
      >
        P
      </text>
    </svg>
  );

  if (variant === 'full') {
    return (
      <div className="flex flex-col items-center text-center">
        {icon}
        <h1 className="mt-4 text-4xl font-extrabold text-[#FF7A00] leading-none">CampaNest</h1>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#00BFA5]">PUNE</p>
        <p className="mt-3 text-xs font-normal text-[#9090AA]">Your campus. Your neighbourhood.</p>
      </div>
    );
  }

  return (
    icon
  );
}
