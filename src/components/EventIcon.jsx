// Icono plano por tipo de suceso de la Cronología — parte de la dirección
// visual "Cronología Luminosa" (2026-09-14): un icono por tipo, sin
// relleno pesado, para que la lista se lea de un vistazo por la forma
// antes que por el texto. `tone` fija el color (si no se da, usa el del
// propio tipo) — se usa para que un fallo "fuera" y uno "parado por el
// rival" compartan el mismo icono de fallo pero no necesariamente el
// mismo color si algún día hace falta distinguirlos así también.
const STROKE = { fill: 'none', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' };

export default function EventIcon({ type, size = 18 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', 'aria-hidden': true };
  switch (type) {
    case 'goal':
      return (
        <svg {...props} stroke="var(--text)" {...STROKE}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.8 6.8l2.1 2.1M15.1 15.1l2.1 2.1M6.8 17.2l2.1-2.1M15.1 8.9l2.1-2.1" strokeWidth="1.2" />
        </svg>
      );
    case 'miss-out':
      return (
        <svg {...props} stroke="var(--danger)" {...STROKE}>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      );
    case 'miss-saved':
      return (
        <svg {...props} stroke="var(--accent)" {...STROKE}>
          <path d="M4 12c2-5 5.5-8 8-8s6 3 8 8c-2 5-5.5 8-8 8s-6-3-8-8z" />
          <circle cx="12" cy="12" r="2.1" fill="var(--accent)" stroke="none" />
        </svg>
      );
    case 'save':
      return (
        <svg {...props} stroke="var(--accent)" {...STROKE}>
          <path d="M4 12c2-5 5.5-8 8-8s6 3 8 8c-2 5-5.5 8-8 8s-6-3-8-8z" />
          <circle cx="12" cy="12" r="2.1" fill="var(--accent)" stroke="none" />
        </svg>
      );
    case 'recovery':
      return (
        <svg {...props} stroke="#1d8a5a" {...STROKE}>
          <path d="M4.5 12a7.5 7.5 0 1 1 2.8 5.85" />
          <path d="M4.5 17.5v-5h5" />
        </svg>
      );
    case 'turnover':
      return (
        <svg {...props} stroke="var(--danger)" {...STROKE}>
          <path d="M5 8h10a4 4 0 0 1 0 8H7" />
          <path d="M9 12l-4 4 4 4" />
        </svg>
      );
    case 'passive':
      return (
        <svg {...props} stroke="var(--warning)" {...STROKE}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M10 9v6M14 9v6" />
        </svg>
      );
    case 'assist':
      return (
        <svg {...props} stroke="var(--accent)" {...STROKE}>
          <path d="M4 12h13" />
          <path d="M13 7l5 5-5 5" />
        </svg>
      );
    case 'card-red':
      return (
        <svg {...props}>
          <rect x="6.5" y="3.5" width="11" height="17" rx="2" fill="var(--danger)" />
        </svg>
      );
    case 'card-yellow':
      return (
        <svg {...props}>
          <rect x="6.5" y="3.5" width="11" height="17" rx="2" fill="var(--card-yellow)" />
        </svg>
      );
    // Señal del árbitro de 2 minutos (dos dedos levantados) — antes era una
    // tarjeta ámbar, pero una exclusión de 2' no es ninguna tarjeta de
    // verdad, y ahora sí existe una tarjeta amarilla real (case de arriba)
    // con la que no se puede confundir.
    case 'twoFingers':
      return (
        <svg {...props}>
          <rect x="8" y="8" width="8.5" height="13" rx="4" fill="var(--warning)" />
          <rect x="8.7" y="2" width="2.6" height="12" rx="1.3" fill="var(--warning)" />
          <rect x="12.7" y="2" width="2.6" height="12" rx="1.3" fill="var(--warning)" />
        </svg>
      );
    case 'sevenMeter':
      return (
        <svg {...props} stroke="var(--warning)" {...STROKE}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="3" fill="var(--warning)" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}
