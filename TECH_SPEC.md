# Doctor Focus — Technical Specification

Versión 1.0 · 18 de octubre de 2026 · Estado: especificación propuesta para implementación.

Este documento define el MVP móvil. No implica que la app, sus diseños o servicios estén implementados. El cronograma y las dependencias de entrega están en [WORK_PLAN.md](WORK_PLAN.md). Destino solicitado del proyecto: `C:\Repos\DrFocus`; los archivos se prepararon en un entorno remoto que no tiene acceso directo a esa ruta.

## 1. Objetivo y alcance

Doctor Focus ayuda a estudiantes de nivel medio-superior y docentes a convertir actividades grandes en objetivos pequeños, con calendario, sesiones y recordatorios. Las plantillas y la organización funcionan localmente; un agente conectado ayuda con «Otra actividad», «Dividir más» y «Estoy bloqueado».

MVP: Android e iOS con código compartido, validación Android primero y una puerta de aceptación independiente para iOS. Sin cuentas escolares, sincronización remota, grupos, publicación automática, lectura de calendarios externos ni colaboración. El cambio de perfil modifica el catálogo y los ejemplos, sin ocultar actividades ya guardadas.

Principios: aceptar propuestas antes de aplicarlas; no modificar fechas finales silenciosamente; explicar falta de tiempo; guardar borradores; mostrar la siguiente acción; evitar culpa y avisos ilimitados.

## 2. Arquitectura y decisiones

| Componente | Decisión propuesta | Motivo |
|---|---|---|
| App | React Native, Expo, TypeScript estricto, Expo Router | Código móvil compartido y navegación por rutas. |
| Datos locales | expo-sqlite; migraciones SQL explícitas | Actividades y calendario disponibles sin conexión. |
| Credenciales locales | expo-secure-store | Guardar únicamente credencial de instalación, no toda la base. |
| Validación | Zod y contratos compartidos | Rechazar datos inválidos de formularios, API y modelo. |
| Planificador | Paquete TypeScript puro | Determinismo y pruebas sin UI ni red. |
| Tiempo | Adaptador de zona IANA con Luxon | Aislar conversiones de disponibilidad local a instantes. |
| Notificaciones | expo-notifications, inicialmente locales | Programar avisos sin servidor push ni llamadas al modelo. |
| API | Node.js LTS compatible, TypeScript, Fastify | Servicio pequeño para controlar acceso, consumo y proveedor. |
| Estado del servicio | SQLite persistente, una instancia en piloto | Cuotas, sesiones e idempotencia durables sin infraestructura distribuida. |
| Modelo | Adaptador de proveedor con salida JSON validada | No acoplar negocio a un modelo ni exponer claves. |
| Pruebas | Vitest en dominio/API y pruebas de UI de flujos críticos | Validar planificación y estados, además del dispositivo real. |

Elegir versiones estables compatibles al iniciar el repositorio, registrar versiones exactas en manifiestos y lockfile y usar el instalador de Expo para módulos nativos. No adoptar versiones experimentales por defecto. No se fijan aquí versiones o precios no verificados.

Separación de responsabilidades:
- App: captura, aceptación, persistencia, calendario y recordatorios.
- Agente: preguntas y propuesta de objetivos; no controla notificaciones ni modifica datos locales.
- Planificador: asignación temporal, dependencias y detección de conflictos.
- API: validación, credencial, cuotas, límite de costo y conexión al proveedor.

### Estructura del repositorio

```text
DrFocus/
  apps/mobile/              # Expo y rutas
  apps/api/                 # API del agente
  packages/domain/          # Entidades y casos de uso
  packages/contracts/       # Esquemas de entrada/salida
  packages/planner/         # Calendario determinista
  packages/templates/       # 14 plantillas versionadas
  packages/design-tokens/   # Colores, espacio y tipografía
  assets/mascot/            # Poses y variantes aprobadas
  docs/                    # QA, diseños y piloto
  TECH_SPEC.md
  WORK_PLAN.md
```

Usar workspaces y un solo lockfile. Scripts esperados: `dev:mobile`, `dev:api`, `typecheck`, `lint`, `test`, `test:api`, `build:android:preview`. Definir equivalentes iOS al configurar firma y distribución.

## 3. Experiencia, rutas y diseño

Navegación principal: Hoy, Actividades, Progreso y Ajustes. Todos los textos en español de México.

| ID | Pantalla/estado | Comportamiento |
|---|---|---|
| S01–04 | Bienvenida, perfil, disponibilidad, preferencias | Guardado progresivo y solicitud contextual de permiso. |
| S05–06 | Hoy y estado vacío | Siguiente objetivo elegible, agenda, atrasos y nueva actividad. |
| S07–09 | Tipo, formulario y preguntas específicas | Campos progresivos y borrador persistente. |
| S10–11 | Otra actividad y generación | Conversación breve; cancelar, reintentar y alternativa manual. |
| S12–13 | Vista previa y conflicto | Editar pasos/fechas; aceptar solo plan viable o guardar borrador. |
| S14–16 | Lista, detalle de actividad y objetivo | Filtros, dependencias y edición con revisión del calendario. |
| S17–18 | Concentración y cierre | Pausar; registrar avance; temporizador no completa por sí solo. |
| S19–20 | Bloqueo y replanificación | Ayuda breve; comparación antes/después y aceptación. |
| S21–22 | Celebración y progreso | Contenido breve y métricas transparentes. |
| S23–24 | Ajustes y centro de avisos | Privacidad, silencio, modo de mascota y estado de permisos. |

Rutas sugeridas: `/onboarding/*`, `/(tabs)/today`, `/activities`, `/progress`, `/settings`, `/activity/new`, `/activity/[id]`, `/objective/[id]`, `/plan/[id]/preview`, `/focus/[id]`, `/notices`.

Deep links: esquema `drfocus`; payload interno con activityId, objectiveId, planRevision y notificationId. Resolver únicamente rutas permitidas. Si el objetivo ya no existe, mostrar mensaje y volver a Hoy.

### Mascota y recursos

Doctor Focus: búho azul petróleo/turquesa, detalles amarillos, lentes, bata corta y libreta; frase «Vamos por un paso». Poses: bienvenida, pensando, señalando, concentrado, reloj, reorganizando, celebrando y descansando. Incluir avatar, icono y variante monocroma para notificaciones Android. Exportar SVG/PNG consistentes; no usar una imagen generativa diferente para cada instancia.

La pose se deriva del contexto, no de inferencias emocionales del usuario. Textos locales versionados y parametrizados; no se llama al modelo para cada aviso. Respetar reducción de movimiento, texto escalable y lectores de pantalla. Controles de al menos 44 pt en iOS y 48 dp en Android; contraste objetivo WCAG AA. El progreso debe entenderse sin ilustración ni color.

Los diseños de Claude son referencia de interacción y estilo: requieren adaptación a componentes nativos, áreas seguras, teclado y notificaciones del sistema. No forman parte de esta entrega como diseños terminados.

## 4. Catálogo y reglas de descomposición

Cada plantilla: `id`, `version`, `role`, preguntas con esquema, condiciones de omisión, generador de pasos, dependencias y parámetros de estimación. Guardar la versión utilizada para no cambiar planes existentes al actualizar plantillas.

| ID | Perfil / tipo | Secuencia base |
|---|---|---|
| student.exercises | Estudiante / ejercicios | Instrucciones → temas → bloques de resolución → comprobación → entrega. |
| student.essay | Ensayo o reporte | Requisitos → tema → fuentes → esquema → secciones → revisión → entrega. |
| student.exam | Estudio para examen | Temas → dificultades → repaso/práctica → autoevaluación → refuerzo. |
| student.presentation | Exposición | Mensaje → investigación → estructura → materiales → ensayo → ajustes. |
| student.project | Proyecto/investigación | Alcance → entregables → desarrollo por etapas → integración → validación → entrega. |
| student.reading | Lectura | Bloques → lectura/notas → síntesis → producto solicitado, si existe. |
| student.teamwork | Trabajo en equipo | Aportación personal → pasos propios → dependencias externas → integración → revisión. |
| teacher.lesson | Preparar clase | Objetivo → contenido → actividades → materiales → evaluación → tiempos. |
| teacher.unit | Planeación de unidad | Calendario → temas → secuencia → evidencias → evaluación → carga. |
| teacher.assessment | Crear evaluación | Aprendizajes → estructura → preguntas → respuestas/rúbrica → revisión → final. |
| teacher.grading | Calificar | Criterios → lotes → evaluación/retroalimentación → verificación → registro. |
| teacher.material | Material didáctico | Propósito → estructura → elaboración → accesibilidad/revisión → final. |
| teacher.admin | Reportes/trámites | Requisitos → datos → apartados → revisión → envío → comprobante. |
| teacher.event | Proyecto/evento | Alcance → actividades/responsables → recursos → preparación → ejecución → documentación. |
| custom | Ambos / Otra actividad | Entrevista breve y propuesta del agente con revisión. |

Preguntas relevantes: cantidad y dificultad de ejercicios; extensión/fuentes/formato del ensayo; temas y dificultades del examen; duración de exposición; entregables del proyecto; páginas de lectura; responsabilidad personal en equipos; duración de clase; sesiones del periodo; cantidad/formato de preguntas; trabajos y minutos por trabajo; requisitos y documentos para reportes; fecha/recursos/responsabilidad en eventos.

Objetivo: verbo + acción + resultado verificable. Proponer 10–30 minutos, permitir 5–120 si se justifica y dividir sesiones largas. Estimaciones editables. No inventar extensión o requisitos cuando falten: preguntar o marcar un supuesto antes de aceptar. Las plantillas no requieren IA para ejecutarse.

Para tareas cuantificables usar bloques: `itemsPerBlock = max(1, floor(preferredBlockMinutes / estimatedMinutesPerItem))`; distribuir el resto sin perder elementos. Mantener conteo al dividir calificaciones/ejercicios/páginas. No tratar «enviar» o una dependencia externa como horas de trabajo continuas.

## 5. Modelo de datos local

UUID locales, instantes ISO UTC y zona IANA original. Activar foreign keys, consultas parametrizadas, transacciones, índices y migraciones secuenciales. No cifrar claves manualmente ni almacenar secretos del proveedor.

| Tabla | Campos principales |
|---|---|
| preferences | singletonId, role, timezone, preferredBlockMinutes, reminderMode, quietStart, quietEnd, dailyCap, pausedUntil, onboardingVersion |
| availability_rules | id, weekday ISO, startLocal, endLocal, timezone |
| availability_exceptions | id, localDate, startLocal, endLocal, kind available/blocked |
| activities | id, role, typeId, templateVersion, title, description, expectedResult, requirementsJson, deadlineAt, deadlineZone, status, revision, createdAt, updatedAt, deletedAt |
| objectives | id, activityId, title, expectedResult, estimatedMinutes, remainingMinutes, dueAt, status, orderIndex, completedAt, source, updatedAt |
| objective_dependencies | objectiveId, dependsOnId; clave compuesta, sin autorreferencia |
| work_sessions | id, objectiveId, startsAt, endsAt, timezone, locked, status |
| focus_sessions | id, objectiveId, startedAt, pausedAt, accumulatedSeconds, endedAt, outcome |
| plan_revisions | id, activityId, baseRevision, proposedJson, assumptionsJson, acceptedAt, state draft/accepted/rejected |
| reminder_intents | id, uniqueKey, activityId, objectiveId nullable, revision, kind, fireAt, payloadJson, nativeId, state, lastError |
| notices | id, reminderIntentId nullable, createdAt, readAt, expiresAt, contentJson |
| agent_drafts | id, activityId nullable, requestId, inputJson, proposedJson, updatedAt |
| local_events | id, eventType, entityId, occurredAt, propertiesJson |

Estados de actividad: draft, active, completed, archived. Estados de objetivo: todo, in_progress, completed, skipped. «Vencido» y «bloqueado» son estados derivados de reloj/dependencias, no estados persistidos independientes. Marcar skipped exige revisar el plan, no equivale a completado. Una actividad solo se completa cuando todos los objetivos obligatorios terminaron; omisiones deben confirmarse.

Progreso: completados / objetivos no omitidos; si cambia el total por replanificación, explicar cambio. Conservar eventos para separar avances reales de modificaciones del plan. Tiempo de concentración se calcula por timestamps y pausas, sin depender de intervalos JS activos en segundo plano.

## 6. Planificador determinista

Entradas: reloj inyectable, zona, disponibilidad, excepciones, actividades activas, objetivos/dependencias, duración restante, sesiones fijadas y fecha final. Salida: sesiones propuestas, fechas de objetivos, conflictos, supuestos, minutos no asignados y versión del algoritmo.

Algoritmo inicial:
1. Normalizar ventanas a instantes para los siguientes 90 días como máximo. Fuera de horizonte: pedir acotar el plan antes de generarlo.
2. Restar excepciones, sesiones existentes y bloques fijados; fusionar ventanas y rechazar superposición inválida.
3. Validar grafo acíclico y referencias. Congelar completados y sesiones fijadas. Respetar dependencias externas marcadas pendientes: no dar por disponibles sus resultados.
4. Ordenar objetivos elegibles por fecha límite y orden estable. Para pasos sin fecha propia, usar la fecha final de su actividad como límite superior.
5. Asignar bloques al primer espacio libre posterior a dependencias. Dividir duración restante en sesiones, mínimo preferido 5 minutos; no dejar residuos imposibles sin señalarlos.
6. Reservar una sesión de revisión si la plantilla la incluye. No agregar margen secreto ni desplazar la entrega.
7. Derivar fechas límite intermedias sugeridas a partir del fin de su última sesión, conservando fechas explícitas del usuario.
8. Validar no superposición, precedencias, duración cubierta y fin antes de límite. Si faltan minutos, devolver conflicto y propuesta parcial como borrador, sin activar el plan.
9. Mostrar diferencias y aceptar en transacción solo si `baseRevision` aún coincide; luego incrementar revisión y reconciliar avisos.

No optimizar globalmente al aceptar una actividad nueva: respetar sesiones existentes. Ofrecer reorganización global explícita con comparación por actividad si el usuario quiere liberar espacio.

Replanificación usa `remainingMinutes` informado por el usuario; un temporizador terminado no implica trabajo completado. «Dividir más» reemplaza el objetivo pendiente por hijos conservando trabajo registrado y redirige dependencias entrantes/salientes; comprobar ciclos y suma de tiempo.

Fechas: entrada sin hora requiere seleccionar hora antes de aceptar. La fecha final representa un instante fijo; cambiar zona modifica presentación, no ese instante. Las reglas semanales flotan en la zona elegida; viajar requiere confirmar la zona de disponibilidad y revisar sesiones futuras. Horas inexistentes o duplicadas por cambios de horario requieren resolución explícita.

## 7. Agente y contrato de API

Un agente acotado, sin navegador, herramientas externas ni ejecución de código. El servidor no conoce el calendario completo: recibe la actividad y contexto mínimo; la asignación temporal final ocurre en la app. Adaptador `PlanningProvider` con implementación real y mock para desarrollo. Modelo configurable por entorno y evaluado antes del piloto; proveedor sugerido OpenAI con Structured Outputs, sin imponer un modelo específico.

Solicitud `POST /v1/planning/proposals`, con `Authorization: Bearer <installation-token>` e `Idempotency-Key`:

```json
{
  "schemaVersion": 1,
  "requestId": "uuid",
  "mode": "decompose",
  "role": "teacher",
  "locale": "es-MX",
  "activity": {
    "title": "Organizar feria de ciencias",
    "expectedResult": "Propuesta de organización",
    "requirements": [],
    "deadlineAt": "2026-11-06T21:00:00Z",
    "timezone": "America/Mexico_City",
    "progressSummary": "Sin iniciar"
  },
  "preferredBlockMinutes": 20,
  "answers": [],
  "targetObjective": null
}
```

Modos: decompose, split, unblock. Conversación sin estado del proveedor; cliente envía últimas preguntas/respuestas limitadas. Dos variantes discriminadas de respuesta:

```json
{
  "schemaVersion": 1,
  "requestId": "uuid",
  "kind": "needs_clarification",
  "questions": [{"id": "responsibility", "text": "¿Qué parte de la feria te corresponde?", "options": []}],
  "assumptions": []
}
```

```json
{
  "schemaVersion": 1,
  "requestId": "uuid",
  "kind": "proposal",
  "assumptions": ["La escuela ya definió la fecha del evento"],
  "objectives": [
    {"localId": "step-1", "title": "Anotar las responsabilidades propias", "expectedResult": "Lista de responsabilidades confirmadas", "estimatedMinutes": 15, "dependsOn": []}
  ],
  "warnings": []
}
```

Restricciones: máximo 3 preguntas por turno y 3 rondas antes de ofrecer edición manual; máximo 30 objetivos por propuesta; título hasta 120 caracteres, descripción hasta 4.000, contexto total hasta 12.000; payload HTTP hasta 64 KiB; minutos enteros 5–120 por objetivo; identificadores únicos, dependencias internas válidas y sin ciclos. Los UUID persistentes los genera el cliente tras validar. El agente no devuelve fechas autoritativas.

Validar JSON y semántica en servidor y app. Manejar rechazo del proveedor, timeout, truncamiento y respuesta inválida con error controlado, sin guardar un plan parcial como aceptado. Un intento de reparación máximo dentro de la cuota; timeout total configurable inicialmente 45 s. Reintentar automáticamente solo errores transitorios y respetar el plazo total, nunca una cadena indefinida.

HTTP: 200 propuesta/preguntas; 400 entrada inválida; 401/403 credencial; 409 clave idempotente con cuerpo diferente; 429 cuota con Retry-After; 502 salida/proveedor inválido; 503 límite global o indisponibilidad; 504 timeout. Error: `{code, message, requestId, retryable}` sin secretos ni texto interno del proveedor.

### Acceso y control de consumo

Piloto cerrado: código de invitación de un solo uso distribuido fuera del repositorio. `POST /v1/installations/redeem` emite token aleatorio revocable, guardado en SecureStore; servidor persiste hash, no token en claro. HTTPS obligatorio fuera de desarrollo. No tratar un identificador de dispositivo como autenticación ni incluir una clave compartida en el bundle.

Cuotas iniciales de producto: 5 solicitudes/minuto, 30/día por instalación; cuentan preguntas y reparaciones; límites de entrada/salida y máximo de concurrencia. Cuotas e idempotencia se guardan en SQLite del API, no solo memoria. Idempotency-Key ligado a instalación, endpoint y hash del cuerpo, con reserva atómica y TTL de 24 h. Una repetición devuelve el resultado previo; duplicados concurrentes reciben estado en proceso sin otro cargo al proveedor. No guardar cuerpos completos en logs.

Tope global de consumo configurable y obligatorio para habilitar IA. Registrar tokens reportados y costo estimado usando tarifas configuradas por el operador; sin tarifa/budget válidos, desactivar proveedor real y permitir mock/plantillas. Reservar presupuesto antes de llamar y reconciliarlo después. Si el proveedor no soporta controlar almacenamiento de entradas, revisar su política antes del piloto y describirla al usuario.

## 8. Notificaciones y consistencia

Avisos locales programados por el sistema operativo; sin promesa de ejecución JS periódica. No requieren llamadas al agente. Tres modos iniciales configurables:

| Modo | Eventos candidatos | Tope diario por app |
|---|---|---|
| Tranquilo | Resumen diario y aviso 1 h antes | 2 |
| Compañero | Resumen, 24 h antes, 1 h antes y atraso +2 h | 4 |
| Insistente | Lo anterior y seguimiento de atraso al día siguiente | 6 |

Son parámetros de diseño sujetos al piloto. No programar eventos que ya estén en pasado ni duplicar resumen y avisos equivalentes. Silencio inicial propuesto 21:00–08:00, editable. Un aviso previo que caiga en silencio se adelanta al último instante permitido si aún es útil; uno de atraso se mueve al siguiente periodo permitido. La fecha límite nunca cambia por silencio. Si la reubicación coincide con otro aviso, agrupar o suprimir por prioridad: vencimiento próximo > atraso > seguimiento > resumen. Respetar consentimiento y configuración de permisos.

Reconciliación:
1. Commit local de revisión/estado y marca durable `remindersDirty` en la misma transacción.
2. Servicio único serializado calcula intenciones deseadas, aplica silencio, agrupación y tope diario global.
3. Clave lógica única: entidad + revisión + tipo + instante. Comparar con avisos nativos pendientes. Cancelar obsoletos, programar faltantes y persistir nativeId.
4. Si falla tras programar y antes de persistir, recuperar por payload uniqueKey consultando pendientes. Reintentar al abrir o volver a foreground. No afirmar atomicidad entre SQLite y el SO.
5. Cancelar pendientes al completar, eliminar, pausar o modificar preferencias; desestimar entregados cuando sea posible. Antes de presentar un aviso en foreground o actuar sobre él, comprobar revisión y estado.

Payload mínimo sin instrucciones completas; opción de contenido genérico en pantalla bloqueada. Al pulsar un aviso viejo, abrir estado actual y explicar si ya terminó. Posponer crea un recordatorio nuevo, no cambia fechas; tope diario incluye los pospuestos.

Ventana: programar los próximos 7 días con un máximo conservador de 48 solicitudes nativas por instalación, agrupando lo necesario. Reponer al abrir/volver a foreground y tras ediciones, sin asumir tareas de fondo fiables. Mostrar «Recordatorios programados hasta…»; si el usuario no vuelve a abrir, no habrá reposición más allá de lo ya programado. Esta limitación del MVP debe aparecer en QA y guía. Push con programación de servidor es una fase futura si se requiere cobertura continua sin reapertura.

No afirmar que un aviso fue visto o entregado solo porque fue programado. Centro de avisos distingue programado, interacción registrada y vencimiento inferido. El atraso puede calcularse al abrir aunque el SO haya suprimido una notificación. Verificar app cerrada, reinicio, ahorro de batería, force-stop y permisos; documentar limitaciones por plataforma. Acciones «Empezar», «En 30 minutos» y «Reorganizar» se exponen como categorías nativas cuando estén soportadas; las tres existen dentro de la app.

## 9. Persistencia, privacidad y operación

Las actividades permanecen en el celular; el servicio conserva credenciales, cuotas y resultados idempotentes con TTL, no un historial académico central. Antes del primer envío al agente explicar qué datos salen y permitir usar plantillas sin IA. No solicitar nombres de alumnos, matrícula ni documentos sensibles.

Borrado total: cancelar pendientes nativos, borrar tablas de contenido/borradores/eventos, credencial y cachés; revocar instalación cuando exista conexión, con aviso si no pudo revocarse. Las cuotas/idempotencia remotas caducan según política documentada. Sin sincronización ni restauración automática: advertir en ajustes que perder o desinstalar la app puede perder datos. No prometer cifrado de SQLite si no se configura expresamente.

API: secretos en entorno, HTTPS, logs con requestId/estado/latencia/consumo sin títulos ni conversaciones, limpieza TTL periódica. SQLite del servidor en volumen persistente, backup del estado operativo y procedimiento de recuperación. Una sola instancia; escalar requerirá base transaccional compartida y rate limiting distribuido.

Variables propuestas: `PLANNING_PROVIDER`, `PLANNING_MODEL`, `PROVIDER_API_KEY`, `DAILY_GLOBAL_BUDGET`, tarifas de entrada/salida, `API_DATABASE_PATH`, `TOKEN_TTL_DAYS`, `LOG_LEVEL`; móvil solo `EXPO_PUBLIC_API_URL`. Cualquier variable EXPO_PUBLIC es pública. Proporcionar .env.example sin secretos.

## 10. Validación y definición de terminado

Pruebas del dominio: ventanas y zonas; horarios que cruzan medianoche; dependencias/ciclos; capacidad insuficiente; reparto exacto de lotes; dos actividades; pasos fijados/completados; progreso parcial; misma entrada produce misma salida con reloj fijo; ninguna sesión se solapa o excede fecha final.

Pruebas API: contrato, token inválido, cuota durable, concurrencia de idempotencia, rechazo del modelo, reparación acotada, timeout y presupuesto agotado. Fixtures sin red en CI; evaluación real del proveedor separada, con presupuesto y casos anonimizados.

Pruebas recordatorios: completar/cancelar, replanificar sin duplicados, fallos intermedios, silencio nocturno, límite global, permisos, payload obsoleto, horizonte, agrupación y cambio de zona. Pruebas reales en Android e iOS antes de declarar compatible cada plataforma. Web o Expo Go no sustituyen validación nativa de release.

Recorridos de aceptación: ensayo; estudiar examen; calificar 40 trabajos conservando conteo; preparar clase; feria con pregunta aclaratoria; plazo imposible; bloqueo y división; regreso tras atraso; sin conexión; notificación que abre un objetivo y se cancela al completarlo.

Objetivos de calidad a medir en un dispositivo de referencia: acciones locales con respuesta visual <200 ms; Hoy utilizable en <2 s tras iniciar en caliente con 500 objetivos; fallos de red sin pérdida de borradores; etiquetas accesibles y texto ampliado sin ocultar acciones. Son objetivos, no resultados comprobados.

Entrega: typecheck/lint/pruebas críticos aprobados; migraciones verificadas; build instalable; sin pérdida de datos conocida; guía de prueba y limitaciones; mock claramente marcado; credenciales ausentes del repositorio; todas las pantallas inventariadas como implementadas, simuladas o pendientes.

## 11. Entrega por incrementos

I1: repositorio + onboarding + SQLite + diseño base + notificación real temprana.
I2: plantillas + planificador + aceptación + Hoy y detalle.
I3: agente protegido + custom/split/unblock + replanificación.
I4: mascota + tres modos + reconciliación + concentración/progreso.
I5: pruebas nativas, piloto y material escolar.

Dependencias externas: diseños finales, acceso al proveedor, presupuesto, certificados y dispositivos iOS, participantes y requisitos escolares. Publicación en tiendas queda fuera del MVP. La propuesta educativa no afirma eficacia clínica ni causalidad a partir de un piloto breve.

## 12. Referencias técnicas primarias

Consultadas el 18 de octubre de 2026. Las decisiones de negocio y arquitectura de este documento son propuestas propias, no requisitos de estos proveedores.

- [Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/): API de programación, acciones y cancelación; validar comportamiento nativo y restricciones de plataforma.
- [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/): persistencia local y acceso SQL.
- [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/): almacenamiento de la credencial; revisar limitaciones de restauración.
- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs/): salida con esquema, más validación semántica propia.
