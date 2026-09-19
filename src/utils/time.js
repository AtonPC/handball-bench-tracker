export function formatClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Lo que se ve en el cronometro de un periodo. Va hacia atras hasta 0; al pasar
// del tiempo configurado (10:00, 20:00...) sigue contando hacia arriba desde ese
// valor (11:20) y aparte se da el tiempo anadido en pequeno ("+01:20").
export function periodClockDisplay(remainingMs, durationMs) {
  if (remainingMs >= 0) return { main: formatClock(remainingMs), extra: null };
  return { main: formatClock(durationMs - remainingMs), extra: `+${formatClock(-remainingMs)}` };
}
