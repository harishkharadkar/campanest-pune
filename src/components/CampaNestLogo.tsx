import React from 'react';

type CampaNestLogoProps = {
  size?: number;
  variant?: 'icon' | 'full';
};

export default function CampaNestLogo({
  size = 80,
  variant = 'icon'
}: CampaNestLogoProps) {
  const shieldPath = 'M22 18 H78 V55 C78 69 66.5 79.5 52 87 C50.8 87.6 49.2 87.6 48 87 C33.5 79.5 22 69 22 55 Z';
  const cArcPath = 'M62 36 A20 20 0 1 1 62 58';

  const icon = (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="CampaNest logo icon">
      <path d={shieldPath} fill="#FF7A00" />
      <path
        d={cArcPath}
        fill="none"
        stroke="#1C1C1C"
        strokeWidth="13.5"
        strokeLinecap="round"
      />
      <circle cx="78" cy="18" r="12" fill="#00BFA5" />
      <text
        x="78"
        y="18"
        textAnchor="middle"
        dominantBaseline="middle"
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
