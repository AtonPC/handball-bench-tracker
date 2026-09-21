// Balón de balonmano (como el de la ASOBAL 2026-27) para marcar la POSESIÓN sobre
// el escudo del equipo que tiene la pelota: consola de tablet y móvil y vista del
// Seguidor.
export default function BallIcon({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#fff" stroke="#16213e" strokeWidth="1.3" />
      <path d="M12 7.4 16.4 10.6 14.7 15.8 9.3 15.8 7.6 10.6Z" fill="#16213e" />
      <path d="M12 7.4V1M16.4 10.6 22.5 8.6M14.7 15.8 18.5 20.9M9.3 15.8 5.5 20.9M7.6 10.6 1.5 8.6" fill="none" stroke="#16213e" strokeWidth="1.1" strokeLinecap="round" />
      <path fill="#16213e" d="M16.12 1.8 16.47 5.85 20.43 4.93A11 11 0 0 0 16.12 1.8ZM22.97 12.77 19.23 14.35 21.33 17.83A11 11 0 0 0 22.97 12.77ZM14.66 22.67 12 19.6 9.34 22.67A11 11 0 0 0 14.66 22.67ZM2.67 17.83 4.77 14.35 1.03 12.77A11 11 0 0 0 2.67 17.83ZM3.57 4.93 7.53 5.85 7.88 1.8A11 11 0 0 0 3.57 4.93Z" />
    </svg>
  );
}
