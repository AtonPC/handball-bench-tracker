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
