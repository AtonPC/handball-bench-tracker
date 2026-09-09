# Handball Bench Tracker — Estado del proyecto

Documento de continuidad: si retomas este proyecto (humano o IA), esto te da el contexto completo sin tener que releer todo el historial de commits o de conversación. Última actualización: 2026-09-09.

## 1. Qué es esto

App web para llevar la "consola de banquillo" de un equipo de balonmano durante un partido: cronómetro, marcador, estadísticas por jugador (goles, fallos, paradas, recuperaciones, exclusiones), sustituciones, y estadísticas acumuladas de temporada. Pensada para usarse en directo, desde el banquillo, en móvil o tablet.

El plan de producto completo (roles, modelo de datos, privacidad, precios, hoja de ruta en 8 piezas) vive en un documento aparte llamado **"Cuaderno de Juego"** (un artifact de Claude, no un fichero de este repo — si necesitas releerlo pide al usuario el enlace). Este documento (`PROJECT_STATUS.md`) es el complemento técnico: qué de ese plan está construido, cómo, y qué falta.

## 2. Stack técnico

- **Frontend**: React 19 + Vite 8, sin TypeScript, sin librería de estado (todo con hooks propios + `onSnapshot` de Firestore). Linter: `oxlint`.
- **Backend**: Firebase — Auth (Google), Firestore (base de datos), Hosting (estático). Plan Spark (gratuito) — nada de Cloud Functions todavía, por diseño (ver sección 7).
- **Sin backend propio**: toda la lógica vive en el cliente; la seguridad la imponen las reglas de Firestore (`firestore.rules`), no un servidor intermedio.
- Comandos: `npm run dev` (servidor local), `npm run build`, `npm run lint`. Despliegue: `npx firebase deploy --only hosting` (frontend) y `npx firebase deploy --only firestore:rules,firestore:indexes` (reglas/índices) — son independientes entre sí y de git (ver sección 8).
- Variables de entorno en `.env.local` (ver `.env.example` para las claves necesarias — son la config pública de Firebase, no secretos).

## 3. Estado de git — IMPORTANTE antes de tocar nada

- Repo: `AtonPC/handball-bench-tracker` en GitHub (privado).
- Rama `main`: tiene solo el commit inicial (MVP de un solo club, ya obsoleto).
- **Todo el trabajo real está en `feature/fase-0-refactor`**, todavía sin fusionar a `main`. No fusionar sin que el usuario lo pida explícitamente.
- La app en producción (`https://handball-bench-tracker.web.app`) se despliega directamente desde esta rama con `firebase deploy`, sin pasar por `main` ni por una PR. Es decir: **git y Hosting son independientes** — el estado de producción no refleja el estado de `main`, refleja el último `firebase deploy` hecho, sea desde la rama que sea.
- Cadencia de commits ya acordada con el usuario: commit automático (sin pedir permiso) al terminar y verificar cada pieza (build limpio + lint limpio como mínimo; sin navegador headless con sesión real, así que no hay tests end-to-end automatizados — la verificación real la hace el usuario probando en directo).

## 4. Modelo de datos (Firestore)

Todas las colecciones de nivel superior. `clubId`/`teamId` se denormalizan en casi todo para que las reglas de seguridad puedan comprobar permisos sin joins.

| Colección | Campos clave | Notas |
|---|---|---|
| `users/{uid}` | `displayName`, `email`, `systemRole` (`'admin'` o ausente) | El único rol global. Todo lo demás (club, equipo) es por membresía, no por este documento. `aperlesc@gmail.com` se autopromociona a `admin` al iniciar sesión (bootstrap, ver `useAuth.js`). |
| `leagues/{id}` | `name`, `category`, `season`, `pointsWin/Draw/Loss` | Las crea el Administrador de Sistema. Sin clasificación real todavía (Fase 1). |
| `clubs/{id}` | `name`, `managerUids: []` | `managerUids` es la lista de quién gestiona el club — así lo comprueban las reglas (`isClubManager`). |
| `teams/{id}` | `name`, `category`, `clubId`, `leagueId` (opcional), `crestUrl`, `primaryColor`, `secondaryColor`, `goalPhrase` | Ya **no** existen "equipos rivales" como documentos — un rival es solo texto libre (`rivalName`) en el partido. `crestUrl` es una URL pegada, no una subida de archivo (decisión explícita, ver sección 7). |
| `players/{id}` | `teamId`, `clubId`, `firstName`, `lastName`, `displayName`, `number`, `photoUrl`, `position`, `isGK` (posición **habitual**, no la del partido — ver más abajo), `imageAuthorized`, `active` | La plantilla del equipo. `isGK` aquí es solo informativo/roster — el portero real de un partido concreto se decide aparte (ver `matches/{id}/players/{pid}.isGK`). |
| `staffMemberships/{teamId}_{uid}` | `personUid`, `teamId`, `clubId`, `label`, `capabilities: {manageRoster, manageStaff, coachPanel, benchConsole}`, `active` | ID compuesto determinista (una membresía por persona y equipo) — así las reglas de Firestore pueden comprobar pertenencia con `exists()`/`get()` directo, sin queries. |
| `follows/{teamId}_{uid}` | `personUid`, `teamId`, `status` (`pending`/`approved`/`rejected`) | Solicitud de seguir un equipo. **Colección y reglas existen, no hay UI de aprobación todavía** (pieza 3). |
| `guardianships/{playerId}_{uid}` | `personUid`, `playerId`, `teamId`, `status` | Solicitud de tutela de un jugador. Mismo estado que `follows`: reglas listas, sin UI. |
| `matches/{id}` | ver tabla siguiente | El documento más grande y con más subcolecciones. |

### `matches/{id}` — campos propios

`clubId`, `teamId`, `rivalName`, `isHome`, `venue`, `scheduledAt`, `ownTeamName`, `callUpPlayerIds: []` (convocatoria completa), `startingLineupIds: []` (opcional, hasta 7 ids — si está vacío, `startMatch` usa los 7 primeros de `callUpPlayerIds`), `startingGoalkeeperId` (opcional, uno de los `startingLineupIds` — **el portero es una designación del partido, no de la ficha del jugador**, ver sección 7), `periodDurationMs` (por defecto 20 min), `lifecycle` (`scheduled`/`live`/`finished`), `status` (cronómetro: `idle`/`running`/`paused`), `period` (1/2), `accumulatedMs`, `periodStartAccumulatedMs` (acumulado total al empezar la 2ª parte, para poder aislar la cuenta atrás de esa parte), `runningSinceMs`, `score: {own, rival}`, `rivalShots`, `timeouts: {own:{1,2}, rival:{1,2}}`, `courtSlots: []`, `bench: []`.

### Subcolecciones de `matches/{id}`

| Subcolección | Doc = | Campos |
|---|---|---|
| `players/{playerId}` (mismo id que la plantilla) | Un convocado | `number`, `name`, `isGK` (**dinámico**: quién juega de portero ahora mismo, se transfiere al hacer un cambio), `photoUrl`, `goals`, `shots` (fallos), `saves`, `recoveries`, `exclusionsCount`, `disqualified`, `accumulatedMs`, `onCourtSinceMs`, `excluded`, `exclusionEndsAtMs`. **No existe `losses`** — se quitó por completo, no reintroducirlo. |
| `events/{autoId}` | Un evento del log de deshacer | `label`, `createdAt`, `period`, `snapshot` (foto de match+players antes del evento), `createdRefPath` (opcional: ruta de un documento extra creado por el evento, p. ej. un gol rival — el deshacer también lo borra). |
| `rivalGoals/{autoId}` | Un gol del rival | `number` (dorsal), `minute`, `period`, `shotZone`, `goalZone` (ambas opcionales) |
| `shotEvents/{autoId}` | Un gol o fallo propio | `playerId`, `type` (`goal`/`miss`), `minute`, `period`, `shotZone`, `goalZone` |
| `saveEvents/{autoId}` | Una parada propia | `playerId`, `minute`, `period`, `goalZone` |

Al borrar un partido (`removeMatch` en `useMatches.js`), se borran también estas 5 subcolecciones a mano — Firestore no lo hace solo al borrar el documento padre.

## 5. Modelo de permisos

No hay roles fijos por persona — hay **capacidades** activables por membresía de equipo. Ver `src/permissions.js`:

- `manageRoster`: gestionar plantilla, crear/editar partidos programados.
- `manageStaff`: gestionar el staff del equipo (quién más puede hacer qué).
- `coachPanel`: ver el panel del entrenador (no construido todavía).
- `benchConsole`: usar la consola en directo (marcar goles, iniciar el partido, editar un partido finalizado...).

Valores por defecto según etiqueta (`DEFAULT_CAPABILITIES_BY_LABEL`): Entrenador y Delegado tienen las 4 activas; 2º Entrenador tiene todas menos `manageStaff`; Apoyo solo tiene `benchConsole`.

Por encima de las capacidades hay dos roles especiales:
- **Gestor de Club** (`clubs/{id}.managerUids`): tiene todas las capacidades sobre cualquier equipo de su club, sin necesidad de una `staffMembership` explícita.
- **Administrador de Sistema** (`users/{uid}.systemRole == 'admin'`): tiene todo, en todos los clubes.

`firestore.rules` implementa exactamente esta misma lógica en el servidor (`canManageTeamCapability`) — el cliente (`permissions.js`) es solo para no mostrar botones que luego el servidor rechazaría.

## 6. Recorrido por la app (componentes principales)

- **`App.jsx`**: shell con barra superior (todavía no es el sidebar lateral de la pieza 3), selector de club activo y de equipo activo (filtrado por el club activo), pestañas condicionadas por capacidad.
- **Sistema** (`SystemAdmin.jsx`, solo admin): ligas y clubes, asignar gestor de club.
- **Club** (`ClubAdmin.jsx`, gestor): equipos del club.
- **Staff y Permisos** (`StaffAdmin.jsx`, gestor): altas de `staffMemberships` por equipo.
- **Plantilla** (`PlayersAdmin.jsx`, `manageRoster`): CRUD de jugadores, carga masiva (pegar varias líneas), edición en lote de posición.
- **Partidos** (`MatchesAdmin.jsx`): crear/editar/borrar partidos (individual y en lote), elegir convocatoria/titulares/portero, filtros (rival/lugar/fecha), iniciar partido.
- **Consola de banquillo** (`BenchConsole.jsx` + `PlayerRow.jsx` + varios modales): la pantalla en directo. Botones distintos por posición dinámica (portero vs jugador de campo — ver sección 7). Modales: `ShotDetailModal` (gol/fallo con zona), `SaveDetailModal` (parada con zona), `RivalGoalModal` (gol rival con teclado numérico de dorsal + zonas), `SubstitutionModal` (cambio, con estadísticas de cada candidato y expulsados visibles pero no seleccionables), `MatchQuickStats` (consulta rápida de titulares/suplentes sin salir del partido).
- **Estadísticas** (`StatsView.jsx`, de un partido): tabla ordenable por columna, filas coloreadas por exclusión/expulsión, detalle desplegable al tocar Goles/Fallos/Tiros/Paradas, secciones filtrables de Goles rivales / Lanzamientos propios / Paradas.
- **Estadísticas de equipo** (`TeamStats.jsx`, acumulado): igual que arriba pero sumado sobre todos los partidos finalizados del equipo (calculado al leer, no guardado aparte — ver sección 7), más "Máximos goleadores"/"Máximos recuperadores".
- **Editar partido finalizado** (`FinishedMatchEditor.jsx`): corrección completa a posteriori (metadatos, marcador, cualquier estadística por jugador, goles rivales), con aviso de que toca datos ya acumulados. Pensado para errores de anotación en directo o para adaptar el resultado al acta oficial de la federación.
- **`FamilyView.jsx`**: existe pero **no está enganchado a `App.jsx`** — es la vista de seguidor de antes del refactor multi-club, pendiente de rehacer según la especificación de la pieza 3 (ver memoria del usuario / sección 9).

## 7. Decisiones de diseño no obvias (leer antes de "corregir" esto)

- **El portero es del partido, no de la ficha.** `players.isGK` (roster) es solo una pista; `matches/{id}/players/{pid}.isGK` es la verdad para ESE partido, elegido al armar los titulares (`startingGoalkeeperId`) y transferido automáticamente al sustituto en cualquier cambio (`substitute`/`substituteDisqualified` en `useMatchStore.js`).
- **No se contabilizan "Pérdidas".** Se quitó a petición explícita del usuario — no reintroducir el campo ni el botón.
- **Contadores no atómicos todavía.** Cada `+1`/`-1` se calcula en el cliente (`valor actual + delta`) y se escribe, no con `increment()` de Firestore. Si dos personas tocan el mismo contador del mismo jugador en el mismo instante, uno de los dos toques puede perderse. Es un hueco conocido y ya comunicado al usuario — la solución (contadores atómicos en servidor) es justo la pieza 4 del Cuaderno de Juego, formalmente pendiente aunque el resto de la pieza 4 (botones por posición) ya esté hecho.
- **Fotos y escudos son URL pegada, no subida de archivo.** Decisión explícita del Cuaderno de Juego para Fase 0; subida real de imagen llega cuando se monte Firebase Storage de verdad.
- **`TeamStats` no guarda un acumulado — lo calcula leyendo todos los partidos finalizados cada vez.** Funciona bien con pocos partidos; cuando haya muchos, la Fase 1 introduce `seasonStats` (escrito una vez al cerrar cada partido) para no releer todo el historial. No lo adelantes sin que haga falta.
- **"Partidos jugados" ≠ "partidos convocados".** Jugados exige `accumulatedMs > 0` en ese partido (pisó la pista, aunque sea un minuto); convocados solo exige tener documento en `matches/{id}/players` (estaba en la lista, jugara o no). Son números distintos a propósito, no los colapses.
- **Zonas de tiro son rejillas de botones, no un diagrama visual de cancha/portería.** Decisión explícita: el diagrama bonito es una pieza de diseño aparte, todavía sin fecha. `src/shotZones.js`: `SHOT_ZONES` (3: Izq/Centro/Der, de dónde viene el lanzamiento), `GOAL_ZONES` (9, rejilla 3×3 de la portería — sirve tanto para "por dónde entró" como para "dónde paró el portero"), `OUT_ZONES` (3, "Fuera" — solo aplica a un Fallo que ni siquiera fue parada, nunca a un Gol ni a una Parada).
- **La tarjeta roja (🟥) es solo para la expulsión definitiva** (3ª exclusión), nunca para una exclusión normal de 2 minutos (que usa otro icono/color). Al llegar a la 3ª exclusión se abre automáticamente el diálogo de cambio en modo forzado — nunca se saca a nadie de la pista sin preguntar quién entra.
- **Los eventos "detalle" (`shotEvents`, `saveEvents`, `rivalGoals`) se crean vía el mismo mecanismo que el log de deshacer** (`recordEvent`'s `extra.create` + `createdRefPath` en el propio evento), para que deshacer un gol también borre su documento de detalle. Si añades un nuevo tipo de evento con detalle, sigue este mismo patrón en vez de inventar uno nuevo.
- **`FinishedMatchEditor` escribe directo, sin pasar por el log de deshacer** (`useMatchEditor.js`) — es corrección de datos, no una jugada que deshacer. No lo confundas con `useMatchStore.js`.

## 8. Cómo se despliega / verifica cada cambio

Rutina seguida en toda la sesión, repetirla para cualquier cambio nuevo:

1. `npm run build` (debe compilar sin errores) y `npm run lint` (sin errores; los warnings `react(set-state-in-effect)` ya existían antes de este trabajo, no son un problema nuevo).
2. Si tocaste `firestore.rules` o `firestore.indexes.json`: `npx firebase deploy --only firestore:rules,firestore:indexes` (o `firestore:rules,hosting` junto con el paso 3).
3. `npx firebase deploy --only hosting` para subir el frontend nuevo a producción.
4. `git add` + `git commit` (con el pie `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` si lo hace Claude Code) — commitear siempre en `feature/fase-0-refactor`, nunca directo en `main`.

No hay entorno de staging ni emuladores de Firestore configurados — todo esto apunta al proyecto real (`handball-bench-tracker`). No hay datos reales de producción todavía (confirmado por el usuario), así que el riesgo de romper algo real es bajo, pero **desplegar reglas afecta a quien esté usando la app en ese momento**, avisar antes si el usuario está en mitad de una prueba.

## 9. Qué queda pendiente (por prioridad tal como lo dejó el usuario)

1. **Pieza 3 — Navegación**: sidebar lateral por grupos plegables (sustituye la barra de arriba actual), escaparate "solicitar acceso" para paneles sin permiso, y la UI de aprobar/rechazar `follows`/`guardianships` (las colecciones y reglas ya existen, falta la pantalla). Incluye rehacer `FamilyView.jsx` según la especificación exacta que el usuario dio para lo que un Seguidor debe ver — pregúntale por ella o búscala en su memoria de proyecto si tienes acceso (resumen: en directo ve recuperaciones/goles propios con animación, goles rivales, minuto, exclusiones propias y rivales, goleadores por nombre (propios) o dorsal (rivales); en acumulado ve partidos jugados/convocados y máximos goleadores/recuperadores — todo esto ya calculable con lo que hay, solo falta la pantalla y el permiso).
2. **Pieza 4, resto**: contadores atómicos en servidor (`increment()` de Firestore) — el resto de la pieza (botones por posición) ya está.
3. **URL pública para compartir partidos en directo, sin login**: pedida por el usuario, **aparcada explícitamente** hasta diseñarla con cuidado (implica abrir una rendija de lectura sin autenticación en un sistema con datos de menores). Restricción ya decidida y bloqueante: si se construye, solo puede mostrarse el **dorsal** de cualquier jugador propio, nunca el nombre. No tocar `firestore.rules` para esto sin retomar la conversación de diseño con el usuario.
4. **Diseño visual**: toda la interfaz actual es funcional/CRUD sin más, a propósito — hay una pieza de diseño (estilo FIFA/e-sports, diagramas reales de cancha/portería) explícitamente aparcada para después.
5. **Piezas 6, 7, 8 del Cuaderno de Juego**: panel del entrenador, PDF/"Validar y compartir", En Directo con animación de gol, PWA instalable — ninguna empezada.
6. **`storage.rules`** existe en el repo pero no se usa (no hay subida de archivos todavía).

## 10. Si eres una IA continuando esto

- Lee primero el Cuaderno de Juego completo (pide el enlace si no lo tienes) — este documento no lo sustituye, lo complementa.
- No asumas que puedes deducir el modelo de datos de un vistazo rápido al código: los nombres de campo cambiaron varias veces durante esta sesión (p. ej. `losses` se eliminó, `isGK` cambió de significado). Esta tabla (sección 4) es la versión correcta a día de hoy.
- Antes de "arreglar" algo que te parezca raro, repasa la sección 7 — varias cosas que parecen bugs a primera vista son decisiones deliberadas.
- El usuario prueba en un pabellón real con conexión intermitente y con gente sin experiencia técnica anotando datos en directo — prioriza que nada se pierda silenciosamente (de ahí el deshacer, los avisos antes de borrar, y el editor de partido finalizado) por encima de la elegancia del código.
