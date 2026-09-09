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
