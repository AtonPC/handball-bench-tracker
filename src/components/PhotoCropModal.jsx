import { useRef, useState } from 'react';

const VIEWPORT = 280;
const OUTPUT = 400;

// Recorte simple de foto en el propio navegador (arrastrar + zoom), sin
// subir nada a ningún sitio: el resultado se exporta como imagen JPEG en
// base64 (data URL) y se guarda tal cual en el campo photoUrl — no hace
// falta Firebase Storage (el proyecto está en el plan gratuito Spark) y
// cabe de sobra en un documento de Firestore.
export default function PhotoCropModal({ imageSrc, onConfirm, onCancel }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [natural, setNatural] = useState(null);
  const [baseScale, setBaseScale] = useState(1);
  const imgRef = useRef(null);
  const draggingRef = useRef(null);

  function clampOffset(o, s, nat, bs) {
    if (!nat) return o;
    const dispW = nat.w * bs * s;
    const dispH = nat.h * bs * s;
    const minX = VIEWPORT - dispW;
    const minY = VIEWPORT - dispH;
    return {
      x: Math.min(0, Math.max(minX, o.x)),
      y: Math.min(0, Math.max(minY, o.y)),
    };
  }

  function handleImgLoad(e) {
    const w = e.target.naturalWidth;
    const h = e.target.naturalHeight;
    const bs = Math.max(VIEWPORT / w, VIEWPORT / h);
    setNatural({ w, h });
    setBaseScale(bs);
    setScale(1);
    setOffset({ x: (VIEWPORT - w * bs) / 2, y: (VIEWPORT - h * bs) / 2 });
  }

  function handlePointerDown(e) {
    draggingRef.current = { startX: e.clientX, startY: e.clientY, origin: offset };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    const dx = e.clientX - draggingRef.current.startX;
    const dy = e.clientY - draggingRef.current.startY;
    const next = { x: draggingRef.current.origin.x + dx, y: draggingRef.current.origin.y + dy };
    setOffset(clampOffset(next, scale, natural, baseScale));
  }
  function handlePointerUp() {
    draggingRef.current = null;
  }

  function handleZoomChange(e) {
    const nextScale = Number(e.target.value);
    setScale(nextScale);
    setOffset((o) => clampOffset(o, nextScale, natural, baseScale));
  }

  function handleConfirm() {
    if (!natural) return;
    const s = baseScale * scale;
    const sx = -offset.x / s;
    const sy = -offset.y / s;
    const sw = VIEWPORT / s;
    const sh = VIEWPORT / s;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imgRef.current, sx, sy, sw, sh, 0, 0, OUTPUT, OUTPUT);
    onConfirm(canvas.toDataURL('image/jpeg', 0.85));
  }

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal photo-crop-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Recortar foto</h2>
        <p className="modal-hint">Arrastra para mover la foto y usa el control para hacer zoom.</p>
        <div
          className="photo-crop-viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            onLoad={handleImgLoad}
            className="photo-crop-image"
            style={{
              width: natural ? natural.w * baseScale * scale : 'auto',
              height: natural ? natural.h * baseScale * scale : 'auto',
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
            draggable={false}
          />
          <div className="photo-crop-guide" />
        </div>
        <input
          type="range"
          min="1"
          max="3"
          step="0.05"
          value={scale}
          onChange={handleZoomChange}
          className="photo-crop-zoom"
          disabled={!natural}
        />
        <div className="player-form-actions">
          <button className="btn btn-clock btn-start" onClick={handleConfirm} disabled={!natural}>
            Guardar recorte
          </button>
          <button className="modal-cancel" onClick={onCancel}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
