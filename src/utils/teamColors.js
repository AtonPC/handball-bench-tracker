// Estilo inline para pintar --team-primary/--team-secondary con los colores
// propios del equipo activo (teams.primaryColor/secondaryColor). Si el equipo
// no tiene colores configurados, se omite la propiedad y se hereda el valor
// por defecto definido en :root (evita dejar un custom property vacío).
export function teamColorStyle(team) {
  const style = {};
  if (team?.primaryColor) style['--team-primary'] = team.primaryColor;
  if (team?.secondaryColor) style['--team-secondary'] = team.secondaryColor;
  return style;
}

// Iniciales para el escudo cuando el equipo (propio o rival) no tiene
// crestUrl todavía — 2 letras, de las primeras dos palabras del nombre.
// Antes solo vivía en MatchesAdmin.jsx (escudos de la lista de Partidos);
// se movió aquí al hacer falta también en MatchHeader.jsx (escudos de la
// consola en directo) — no la dupliques, importa esta.
export function teamInitials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// Etiqueta corta del equipo propio o rival, para usar SIEMPRE en vez de un
// literal genérico como "Nos"/"Rival"/"Nuestro equipo" (2026-09-22, a
// petición del usuario): el nombre real del equipo si cabe en `maxLen`
// caracteres, y si no, las iniciales (ver teamInitials) — nunca la palabra
// "Rival" a secas, que solo tiene sentido cuando de verdad no se sabe el
// nombre del equipo (por eso sigue siendo el valor por defecto del propio
// campo `rivalName` en los partidos).
export function shortTeamName(name, maxLen = 16) {
  const n = (name || '').trim();
  if (!n) return '';
  return n.length <= maxLen ? n : teamInitials(n);
}
