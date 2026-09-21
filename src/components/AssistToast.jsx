import { useEffect, useRef } from 'react';

// Aviso que sale tras un gol nuestro (que no sea de 7 metros) para anotar,
// si se quiere, quién dio el pase (2026-09-21). Es OPCIONAL y no bloquea nada:
// se cierra solo a los pocos segundos, o al elegir a alguien / «Sin asistente»
// (el registro del gol ya está hecho). Se puede añadir a posteriori desde el
// editor del partido.
export default function AssistToast({ scorer, candidates, onPick, onDismiss, ms = 9000 }) {
  // La consola se repinta cada segundo (el reloj): el temporizador no puede
  // depender de la identidad de onDismiss o se reiniciaría en cada repintado.
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  useEffect(() => {
    const t = setTimeout(() => dismissRef.current(), ms);
    return () => clearTimeout(t);
  }, [ms]);

  return (
    <div className="assist-toast" role="status">
      <span className="assist-toast-title">Gol registrado</span>
      <b>#{scorer?.number} {scorer?.name}</b>
      <span className="assist-toast-dim">¿Quién dio la asistencia? (opcional)</span>
      <div className="assist-toast-chips">
        {candidates.map((p) => (
          <button key={p.id} type="button" onClick={() => onPick(p.id)} aria-label={`Asistencia de ${p.number} ${p.name}`}>#{p.number}</button>
        ))}
        <button type="button" className="assist-toast-skip" onClick={onDismiss}>Sin asistente</button>
      </div>
    </div>
  );
}
