import { useState } from 'react';
import { LINEUP_FIELD_ZONES } from '../utils/lineups';
import { BOARD_H, BOARD_W, boardPoint, zoneOutline } from '../utils/shotBoard';

// Recorte de una zona en PORCENTAJE (no en px como zoneClipPath, pensado para
// el panel de tiro a tamaño fijo) — así la cancha de este tablero puede ser
// fluida (width:100%, aspect-ratio) sin desalinear el recorte con el tamaño
// real ya renderizado.
function zoneClipPathPct(def) {
  const pts = zoneOutline(def).map(([x, y]) => `${((x / BOARD_W) * 100).toFixed(2)}% ${((y / BOARD_H) * 100).toFixed(2)}%`);
  return `polygon(${pts.join(',')})`;
}

// Punto (en %) donde va el contenido (etiqueta/jugador) de una zona. El propio
// div de la zona ocupa TODA la cancha (solo el clip-path lo recorta visual y
// también a efectos de qué zona responde al toque en cada punto) — su
// contenido no puede ir centrado con flexbox porque las 6 zonas comparten la
// misma caja y todo el texto quedaría amontonado en el centro; se posiciona
// aparte, en el punto de etiqueta propio de cada zona (mismo `lu`/`lk` que ya
// usa el panel de tiro para lo mismo, ver zoneLabelPoint en utils/shotBoard.js).
function zoneContentPointPct(def) {
  const [x, y] = boardPoint(def.lu, def.lk);
  return [(x / BOARD_W) * 100, (y / BOARD_H) * 100];
}

// Cancha arrastrable para elegir el equipo titular (2026-09-26, a petición
// del usuario): "una plantilla como la de tiro, sin portería, arrastrando a
// cada puesto el jugador que quiero poner". `ids` es SIEMPRE un array de 7
// (el índice 0 el portero, el resto en el orden fijo de LINEUP_FIELD_ZONES —
// ver utils/lineups.js), igual que ya usaban MatchesAdmin/LineupModal, así
// que no hace falta ningún cambio de esquema en Firestore.
//  - `prevIds` (opcional, mismo formato): equipo del periodo anterior — se
//    usa para el aviso "antes #N" en cada puesto que haya cambiado, y quien
//    llama a este componente puede pasar `ids` ya precargado con `prevIds`
//    para que se vea "quién empezó" y baste con arrastrar al que sustituye.
//  - Interacción doble: arrastrar de verdad (puntero, con jugador "fantasma"
//    siguiendo el dedo/cursor) O tocar un puesto y luego a quien lo ocupa
//    (igual que el LineupModal de antes) — lo segundo sigue funcionando por
//    si arrastrar resulta incómodo en algún dispositivo.
export default function LineupBoard({ ids, onChange, roster, prevIds }) {
  const [active, setActive] = useState(null); // puesto tocado, a la espera de jugador
  const [ghost, setGhost] = useState(null); // { x, y, id } — jugador siendo arrastrado
  const [overSlot, setOverSlot] = useState(null);

  const byId = Object.fromEntries(roster.map((p) => [p.id, p]));
  const numberOf = (id) => byId[id]?.number ?? '?';
  const nameOf = (id) => (byId[id]?.displayName || byId[id]?.name || '').split(' ')[0];
  const freeRoster = roster.filter((p) => !ids.includes(p.id));

  function clear(slot) {
    const next = [...ids];
    next[slot] = '';
    onChange(next);
  }

  // Arrastrar de un puesto a otro (o del roster a un puesto) intercambia; si
  // el destino se libera porque venía del roster (fromSlot null), el
  // desplazado simplemente vuelve a la lista de convocados libres.
  function moveTo(slot, id, fromSlot) {
    if (fromSlot === slot) return;
    const next = ids.map((x) => (x === id ? '' : x));
    const displaced = next[slot];
    next[slot] = id;
    if (displaced && fromSlot != null) next[fromSlot] = displaced;
    onChange(next);
  }

  function handleSlotTap(i) {
    if (ids[i]) {
      clear(i);
      setActive(i);
      return;
    }
    setActive((prev) => (prev === i ? null : i));
  }

  function handleRosterTap(id) {
    if (active == null) return;
    moveTo(active, id, null);
    setActive(null);
  }

  function startDrag(id, fromSlot, e) {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    function move(ev) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 6) moved = true;
      if (!moved) return;
      setGhost({ x: ev.clientX, y: ev.clientY, id });
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const slotEl = el?.closest('[data-lnb-slot]');
      setOverSlot(slotEl ? Number(slotEl.dataset.lnbSlot) : null);
    }
    function up(ev) {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (moved) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const slotEl = el?.closest('[data-lnb-slot]');
        if (slotEl) moveTo(Number(slotEl.dataset.lnbSlot), id, fromSlot);
        else if (fromSlot != null) clear(fromSlot);
      }
      setGhost(null);
      setOverSlot(null);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function prevHint(i) {
    const prev = prevIds?.[i];
    if (!prev || prev === ids[i]) return null;
    return `antes #${numberOf(prev)}`;
  }

  return (
    <div className="lnb">
      <div
        data-lnb-slot={0}
        className={`lnb-gk${ids[0] ? ' lnb-gk--filled' : ''}${active === 0 ? ' lnb-slot--act' : ''}${overSlot === 0 ? ' lnb-slot--over' : ''}`}
        onClick={() => handleSlotTap(0)}
        onPointerDown={ids[0] ? (e) => startDrag(ids[0], 0, e) : undefined}
        role="button"
        tabIndex={0}
        aria-label={`Portero: ${ids[0] ? `#${numberOf(ids[0])} ${nameOf(ids[0])}` : 'vacío'}`}
      >
        <i>P</i>
        {ids[0] ? <span>#{numberOf(ids[0])} {nameOf(ids[0])}</span> : <span className="lnb-empty">Portero</span>}
        {prevHint(0) && <small className="lnb-prev">{prevHint(0)}</small>}
      </div>

      <div className="lnb-court">
        <div className="lnb-six" />
        {LINEUP_FIELD_ZONES.map((z, idx) => {
          const i = idx + 1;
          const id = ids[i];
          return (
            <div
              key={z.key}
              data-lnb-slot={i}
              className={`lnb-zone lnb-zone--${z.key === 'EI' || z.key === 'ED' ? 'w' : 'n'}${id ? ' lnb-zone--filled' : ''}${active === i ? ' lnb-slot--act' : ''}${overSlot === i ? ' lnb-slot--over' : ''}`}
              style={{ clipPath: zoneClipPathPct(z.def) }}
              onClick={() => handleSlotTap(i)}
              onPointerDown={id ? (e) => startDrag(id, i, e) : undefined}
              role="button"
              tabIndex={0}
              aria-label={`${z.name}: ${id ? `#${numberOf(id)} ${nameOf(id)}` : 'vacío'}`}
            />
          );
        })}
        {LINEUP_FIELD_ZONES.map((z, idx) => {
          const i = idx + 1;
          const id = ids[i];
          const [x, y] = zoneContentPointPct(z.def);
          return (
            <div key={`c-${z.key}`} className="lnb-zone-content" style={{ left: `${x}%`, top: `${y}%` }}>
              <span className="lnb-zone-label">{z.label}</span>
              {id ? <span className="lnb-zone-player">#{numberOf(id)} {nameOf(id)}</span> : <span className="lnb-empty">{z.name}</span>}
              {prevHint(i) && <small className="lnb-prev">{prevHint(i)}</small>}
            </div>
          );
        })}
      </div>

      <div className="lnb-roster">
        {freeRoster.map((p) => (
          <button
            key={p.id}
            type="button"
            className="lnb-rp"
            onPointerDown={(e) => startDrag(p.id, null, e)}
            onClick={() => handleRosterTap(p.id)}
          >
            <b>{p.number}</b>{(p.displayName || p.name || '').split(' ')[0]}
          </button>
        ))}
        {freeRoster.length === 0 && <p className="modal-hint" style={{ margin: 0 }}>Todos los convocados están ya colocados.</p>}
      </div>

      {ghost && (
        <div className="lnb-ghost" style={{ left: ghost.x, top: ghost.y }}>
          #{numberOf(ghost.id)} {nameOf(ghost.id)}
        </div>
      )}
    </div>
  );
}
