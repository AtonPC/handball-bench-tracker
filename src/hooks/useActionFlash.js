import { useEffect, useRef, useState } from 'react';

// Mensaje «Registrado» de la consola (tablet y móvil, 2026-09-21): tras cada
// acción anotada se enseña qué se ha registrado, cómo queda la posesión y un
// «Deshacer»; tras un gol nuestro (que no sea de 7 m) además se ofrece elegir
// asistente. Se va solo a los pocos segundos (más despacio si hay asistente).
// La consola se repinta cada segundo (reloj): el temporizador solo depende del
// mensaje, nunca de la identidad de las funciones.
export const opp = (t) => (t === 'own' ? 'rival' : 'own');
export const teamWord = (t) => (t === 'own' ? 'Nos' : 'Rival');

export function useActionFlash({ store, actions, courtPlayers = [], assistFor, onAssist }) {
  const { state } = store;
  const [done, setDone] = useState(null); // { text, detail, poss, assistable }

  const dismissRef = useRef(null);
  dismissRef.current = () => {
    setDone(null);
    if (assistFor) onAssist(null);
  };
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => dismissRef.current(), done.assistable ? 9000 : 3500);
    return () => clearTimeout(t);
  }, [done]);

  function flash(text, detail, poss, assistable = false) {
    if (assistFor) onAssist(null); // un asistente pendiente de antes ya no tiene aviso
    setDone({ text, detail, poss, assistable });
  }
  const possLabel = (to) => (state.possession === to ? 'Posesión igual' : `Posesión → ${teamWord(to)}`);
  const ownWho = (p) => (p ? `#${p.number} ${p.name}` : 'Nos (sin jugador)');
  const whoText = (side, id, dorsal) => (side === 'own' ? ownWho(id ? state.players[id] : null) : dorsal ? `Rival #${dorsal}` : 'Rival (sin dorsal)');

  // Texto del mensaje de un lanzamiento (resultado del ShotPanel).
  function shotMessage(r) {
    const own = r.side === 'own';
    const who = whoText(r.side, own ? r.shooter : null, own ? null : r.shooter);
    const text = r.kind === 'goal' ? `Gol · ${who}` : r.kind === 'save' ? (own ? `Fallo parado · ${who}` : `Parada · tiro de ${who}`) : `Fallo · ${who}`;
    const bits = [`${r.shotZone || 'sin zona'} → ${r.goalZone || 'sin destino'}`];
    if (r.foul) bits.push(own ? `falta del rival #${r.foul}` : `falta de #${state.players[r.foul]?.number ?? '?'}`);
    if (r.counter) bits.push('contraataque');
    return { text, detail: bits.join(' · '), poss: `Posesión → ${own ? 'Rival' : 'Nos'}`, assistable: own && r.kind === 'goal' && r.shotZone !== '7 metros' };
  }

  // ROBO / PÉRDIDA de un equipo, con o sin jugador (id nuestro o dorsal rival).
  // Devuelve el equipo que se queda con la pelota.
  function teamAction(kind, side, who) {
    const to = kind === 'steal' ? side : opp(side);
    actions[kind](side, who);
    flash(`${kind === 'steal' ? 'Robo' : 'Pérdida'} · ${whoText(side, side === 'own' ? who : null, side === 'rival' ? who : null)}`, '', possLabel(to));
    return to;
  }
  // Exclusión, amarilla o roja. Devuelve false si no se ha registrado nada (ya tenía
  // amarilla), el id de quien hay que SUSTITUIR si queda expulsado estando en pista
  // (3ª exclusión o roja) o true si todo queda ahí.
  function sanction(kind, side, who) {
    const label = { exclusion: 'Exclusión', yellow: 'Amarilla', red: 'Roja' }[kind];
    const text = `${label} · ${whoText(side, side === 'own' ? who : null, side === 'rival' ? who : null)}`;
    let mustSwap = false;
    if (side === 'own') {
      mustSwap = !!actions[kind](who) && courtPlayers.some((p) => p.id === who);
    } else {
      const ok = actions[{ exclusion: 'rivalExclusion', yellow: 'rivalYellow', red: 'rivalRed' }[kind]](who);
      if (ok === false) return false;
    }
    flash(text, mustSwap ? 'expulsado: elige quién entra por él' : 'consta en la lista de sancionados', 'Posesión igual');
    return mustSwap ? who : true;
  }
  // Pasivo: pérdida del equipo entero. Devuelve quién se queda la pelota.
  function passive(team) {
    actions.passive(team);
    flash(`Pasivo · ${teamWord(team)}`, 'pérdida del equipo entero', possLabel(opp(team)));
    return opp(team);
  }
  // Cambio múltiple ya confirmado: [{ outId, inId }].
  function substitution(pairs) {
    const num = (id) => `#${state.players[id]?.number ?? '?'}`;
    actions.substituteMany(pairs);
    flash(`Cambio${pairs.length > 1 ? ` (${pairs.length})` : ''}`, `salen ${pairs.map((p) => num(p.outId)).join(' ')} · entran ${pairs.map((p) => num(p.inId)).join(' ')}`, 'Posesión igual');
  }

  async function undoLast() {
    const r = await store.undo();
    if (r && !r.ok && r.reason === 'clock') {
      alert('No se puede deshacer esta acción porque el reloj ha cambiado desde entonces. Corrígela a mano.');
      return;
    }
    if (assistFor) onAssist(null);
    setDone(null);
  }

  return { done, setDone, flash, possLabel, whoText, shotMessage, teamAction, sanction, passive, substitution, undoLast };
}
