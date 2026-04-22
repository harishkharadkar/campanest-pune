import React from 'react';

type CampaNestLogoProps = {
  size?: number;
  variant?: 'icon' | 'full';
};

export default function CampaNestLogo({
  size = 80,
  variant = 'icon'
}: CampaNestLogoProps) {
  const shieldPath = 'M24 19 Q50 14 76 19 L72 58 Q68 74 50 84 Q32 74 28 58 Z';
  const cArcPath = 'M61.5 35 A18 18 0 1 1 61.5 58';

  const icon = (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="CampaNest logo icon">
      <path d={shieldPath} fill="#FF7A00" />
      <path
        d={cArcPath}
        fill="none"
        stroke="#000000"
        strokeWidth="15"
        strokeLinecap="round"
      />
      <circle cx="72.5" cy="25.5" r="12.5" fill="#1ABC9C" />
      <text
        x="72.5"
        y="25.5"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="600"
        fontFamily="Poppins, Nunito, sans-serif"
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
        <h1
          className="mt-5 leading-none text-[#FF7A00]"
          style={{
            fontFamily: 'Poppins, Montserrat, Inter, Nunito, sans-serif',
            fontSize: '64px',
            fontWeight: 800,
            letterSpacing: '-0.02em'
          }}
        >
          CampaNest
        </h1>
        <p
          className="mt-2 uppercase leading-none text-[#1ABC9C]"
          style={{
            fontFamily: 'Poppins, Montserrat, Inter, Nunito, sans-serif',
            fontSize: '15px',
            fontWeight: 500,
            letterSpacing: '0.18em'
          }}
        >
          PUNE
        </p>
        <p
          className="mt-4 text-[#9CA3AF]"
          style={{
            fontFamily: 'Poppins, Montserrat, Inter, Nunito, sans-serif',
            fontSize: '11px',
            fontWeight: 400,
            letterSpacing: 0
          }}
        >
          Your campus. Your neighbourhood.
        </p>
      </div>
    );
  }

  return (
    icon
  );
}
