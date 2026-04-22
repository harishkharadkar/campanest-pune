import React from 'react';

type CampaNestLogoProps = {
  size?: number;
  variant?: 'icon' | 'full';
};

export default function CampaNestLogo({
  size = 80,
  variant = 'icon'
}: CampaNestLogoProps) {
  const shieldPath = 'M22 18 H78 V54 C78 67 67 77 52.5 84 C51 84.8 49 84.8 47.5 84 C33 77 22 67 22 54 Z';
  const cArcPath = 'M63.1 37 A18 18 0 1 1 63.1 55';

  const icon = (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="CampaNest logo icon">
      <path d={shieldPath} fill="#FF7A00" />
      <path
        d={cArcPath}
        fill="none"
        stroke="#1C1C1C"
        strokeWidth="22"
        strokeLinecap="round"
      />
      <circle cx="78" cy="18" r="12" fill="#00BFA5" />
      <text
        x="78"
        y="23"
        textAnchor="middle"
        fontSize="13"
        fontWeight="800"
        fontFamily="Poppins, Nunito, sans-serif"
        fill="#1A1A1A"
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
            fontFamily: 'Poppins, Nunito, sans-serif',
            fontSize: '64px',
            fontWeight: 800,
            letterSpacing: 0
          }}
        >
          CampaNest
        </h1>
        <p
          className="mt-1 uppercase leading-none text-[#00BFA5]"
          style={{
            fontFamily: 'Poppins, Nunito, sans-serif',
            fontSize: '18px',
            fontWeight: 700,
            letterSpacing: '0.18em'
          }}
        >
          PUNE
        </p>
        <p
          className="mt-3 text-[#7A7A8C]"
          style={{
            fontFamily: 'Poppins, Nunito, sans-serif',
            fontSize: '20px',
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
