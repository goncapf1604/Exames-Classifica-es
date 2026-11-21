import React from 'react';

interface SigenLogoProps {
  variant?: 'full' | 'compact' | 'dark' | 'mark';
  subBrand?: 'Gestão de Exames' | 'Classificações';
  className?: string;
}

/**
 * Opção 2 — Institucional e Segura (Azul-marinho #112A4A e Turquesa #087E91)
 * Escudo institucional com "S", livro aberto na base e ramos de louro laterais.
 */
export const SigenShieldMark: React.FC<{ size?: number; dark?: boolean; className?: string }> = ({
  size = 44,
  dark = false,
  className = '',
}) => {
  const navy = dark ? '#FFFFFF' : '#112A4A';
  const shieldFill = dark ? '#1A3A63' : '#112A4A';
  const teal = dark ? '#22B8CF' : '#087E91';
  const innerStroke = dark ? '#22B8CF' : '#087E91';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 88 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left laurel branch */}
      <path
        d="M25 69C16 64 11 54 10 42C9.5 36 10.5 31 12.5 27"
        stroke={navy}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Left leaves */}
      <path d="M12 28C8 27 6 23 7.5 19.5C11 21 13 24.5 12 28Z" fill={teal} />
      <path d="M10.5 36C6 34.5 4.5 30 6.5 27C10 28.5 11.5 32.5 10.5 36Z" fill={navy} />
      <path d="M11 45C6.2 44 4.5 39.5 6.8 36.5C10.5 38 12.2 41.5 11 45Z" fill={teal} />
      <path d="M13 54C8 53.5 6.5 49 9 46C12.5 47.5 14 51 13 54Z" fill={navy} />
      <path d="M17.5 62C12.5 62.5 10.5 58.5 12.8 55.2C16.2 56.2 18.2 59 17.5 62Z" fill={teal} />
      <path d="M23 67.5C18.5 69.2 15.8 66.5 17.5 63.2C20.8 63.2 23 65 23 67.5Z" fill={navy} />

      {/* Right laurel branch */}
      <path
        d="M63 69C72 64 77 54 78 42C78.5 36 77.5 31 75.5 27"
        stroke={navy}
        strokeWidth="2.1"
        strokeLinecap="round"
      />
      {/* Right leaves */}
      <path d="M76 28C80 27 82 23 80.5 19.5C77 21 75 24.5 76 28Z" fill={teal} />
      <path d="M77.5 36C82 34.5 83.5 30 81.5 27C78 28.5 76.5 32.5 77.5 36Z" fill={navy} />
      <path d="M77 45C81.8 44 83.5 39.5 81.2 36.5C77.5 38 75.8 41.5 77 45Z" fill={teal} />
      <path d="M75 54C80 53.5 81.5 49 79 46C75.5 47.5 74 51 75 54Z" fill={navy} />
      <path d="M70.5 62C75.5 62.5 77.5 58.5 75.2 55.2C71.8 56.2 69.8 59 70.5 62Z" fill={teal} />
      <path d="M65 67.5C69.5 69.2 72.2 66.5 70.5 63.2C67.2 63.2 65 65 65 67.5Z" fill={navy} />

      {/* Outer Teal Shield Contour */}
      <path
        d="M44 7L66 15.5V41.5C66 56.2 56.2 67.8 44 74.5C31.8 67.8 22 56.2 22 41.5V15.5L44 7Z"
        fill={teal}
      />
      {/* Inner White Gap + Navy Shield Body */}
      <path
        d="M44 10.6L62.8 18V41.2C62.8 54 54.4 64.2 44 70.3C33.6 64.2 25.2 54 25.2 41.2V18L44 10.6Z"
        fill={shieldFill}
        stroke="#FFFFFF"
        strokeWidth="1.6"
      />
      {/* Subtle Inner Teal Accent Line */}
      <path
        d="M44 13.8L59.8 20V41C59.8 52.1 52.6 61.1 44 66.5C35.4 61.1 28.2 52.1 28.2 41V20L44 13.8Z"
        stroke={innerStroke}
        strokeWidth="1.1"
        strokeOpacity="0.6"
      />

      {/* Bold White "S" */}
      <path
        d="M51.2 27.6C49.6 25.9 47.2 25 44.3 25C40.7 25 38.6 26.6 38.6 28.9C38.6 31.3 40.8 32.3 44.6 33.2L46.4 33.6C51.6 34.8 54.4 37.1 54.4 41.5C54.4 46.7 50 50.1 43.7 50.1C39.2 50.1 35.6 48.4 33.6 45.7L37.1 42.3C38.7 44.3 41 45.5 43.9 45.5C47.1 45.5 49.1 44.1 49.1 41.9C49.1 39.8 47.5 38.8 43.8 37.9L41.8 37.4C36.5 36.1 33.6 33.7 33.6 29.4C33.6 24.1 38.1 20.5 44.3 20.5C48.4 20.5 51.8 21.8 54.1 24.4L51.2 27.6Z"
        fill="#FFFFFF"
      />

      {/* Open White Book at Shield Base */}
      <path
        d="M32.5 52.5C36.8 52.5 41 53.7 43.2 55.8V64.5C40.8 62.6 36.8 61.5 32.5 61.5V52.5Z"
        fill="#FFFFFF"
      />
      <path
        d="M55.5 52.5C51.2 52.5 47 53.7 44.8 55.8V64.5C47.2 62.6 51.2 61.5 55.5 61.5V52.5Z"
        fill="#FFFFFF"
      />
      <path d="M44 55.5V65" stroke={teal} strokeWidth="1.2" />
    </svg>
  );
};

export const SigenClassificacoesIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 24,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect x="4" y="3" width="19" height="24" rx="2.5" stroke="#112A4A" strokeWidth="2.2" fill="#FFFFFF" />
    <line x1="8.5" y1="9.5" x2="18.5" y2="9.5" stroke="#112A4A" strokeWidth="2" strokeLinecap="round" />
    <line x1="8.5" y1="14.5" x2="17" y2="14.5" stroke="#112A4A" strokeWidth="2" strokeLinecap="round" />
    <line x1="8.5" y1="19.5" x2="14" y2="19.5" stroke="#112A4A" strokeWidth="2" strokeLinecap="round" />
    <circle cx="22" cy="22" r="7" fill="#087E91" stroke="#FFFFFF" strokeWidth="1.8" />
    <path
      d="M19.2 22.1L21.1 24L25 19.9"
      stroke="#FFFFFF"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SigenLogo: React.FC<SigenLogoProps> = ({
  variant = 'full',
  subBrand = 'Classificações',
  className = '',
}) => {
  const isDark = variant === 'dark';

  if (variant === 'mark') {
    return <SigenShieldMark size={36} className={className} />;
  }

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-2.5 select-none ${className}`}>
        <SigenShieldMark size={36} />
        <div className="leading-none">
          <div className="font-display font-extrabold text-[17px] tracking-tight text-[#112A4A]">
            SIGEN
          </div>
          <div className="text-[11px] font-semibold text-[#087E91] mt-0.5">
            {subBrand}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      <SigenShieldMark size={variant === 'full' ? 54 : 44} dark={isDark} />
      <div className={`h-11 w-px ${isDark ? 'bg-white/20' : 'bg-slate-300'}`} />
      <div className="flex flex-col leading-none">
        <span
          className={`font-display font-extrabold text-[26px] tracking-tight ${
            isDark ? 'text-white' : 'text-[#112A4A]'
          }`}
        >
          SIGEN
        </span>
        <span
          className={`text-[12.5px] font-medium mt-0.5 ${
            isDark ? 'text-slate-200' : 'text-[#536477]'
          }`}
        >
          {subBrand === 'Classificações' ? 'SIGEN Classificações' : 'Gestão de Exames'}
        </span>
        {/* Graceful curved teal accent bar from Option 2 */}
        <svg className="mt-1.5 w-28 h-1.5" viewBox="0 0 112 6" fill="none">
          <path
            d="M2 4.5C32 1.2 78 1.2 110 4.5"
            stroke={isDark ? '#22B8CF' : '#087E91'}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
