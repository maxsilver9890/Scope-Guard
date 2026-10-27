type BrandMarkProps = {
  className?: string;
  size?: number;
};

/**
 * Scope Guard mark: a rounded violet tile holding a shield and check, which
 * echoes the product promise — commitments defended by evidence.
 */
export function BrandMark({ className = "", size = 38 }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect width="40" height="40" rx="12" fill="#7057F5" />
      <rect
        x="0.5"
        y="0.5"
        width="39"
        height="39"
        rx="11.5"
        stroke="#FFFFFF"
        strokeOpacity="0.18"
      />
      <path
        d="M20 9.75 29 13.3v7.1c0 5.05-3.58 8.45-9 10.1-5.42-1.65-9-5.05-9-10.1v-7.1l9-3.55Z"
        stroke="#FFFFFF"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="m16.1 20.2 2.6 2.5 5.3-5.7"
        stroke="#FFFFFF"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
