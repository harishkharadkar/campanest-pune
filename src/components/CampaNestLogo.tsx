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
      <path d="M50 10 L78 20 V56 C78 71 67 79 50 85 C33 79 22 71 22 56 V20 Z" fill="#FF7A00" />
      <path
        d="M63 35 C58 31 52 29 46 29 C35 29 27 37 27 48 C27 60 35 68 47 68 C53 68 58 66 62 62"
        fill="none"
        stroke="#0A0A0F"
        strokeWidth="12.5"
        strokeLinecap="round"
      />
      <circle cx="75" cy="25" r="13.5" fill="#00BFA5" />
      <text
        x="75"
        y="30"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
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
        <h1 className="mt-4 text-[64px] leading-none font-[800] text-[#FF7A00]">CampaNest</h1>
        <p className="mt-2 text-[22px] leading-none font-[600] uppercase tracking-[0.18em] text-[#00BFA5]">PUNE</p>
        <p className="mt-6 text-[16px] font-[400] text-[#9090AA]">Your campus. Your neighbourhood.</p>
      </div>
    );
  }

  return (
    icon
  );
}
