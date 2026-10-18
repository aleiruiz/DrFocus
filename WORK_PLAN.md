# Doctor Focus — Plan de trabajo

Versión 2.0 · Actualizado: 18 de octubre de 2026.

Documento técnico complementario: [TECH_SPEC.md](TECH_SPEC.md). Destino solicitado: `C:\Repos\DrFocus`. Este plan conserva el catálogo y la evaluación de la primera versión e incorpora el nombre definitivo, la mascota, los diseños y las decisiones técnicas.

## 1. Propósito

Desarrollar una aplicación móvil para estudiantes de nivel medio-superior y docentes que transforme actividades grandes en objetivos pequeños, calendarizados y editables. Incluir recordatorios antes y después del vencimiento y ayuda de un agente para descomponer actividades que no encajen en las plantillas.

El proyecto escolar evaluará si la propuesta resulta comprensible, útil y viable. Una prueba breve no permitirá demostrar que reduce la procrastinación de forma duradera.

## 2. Alcance de la primera versión

Incluye:

- Selección de perfil: estudiante o docente; posibilidad de cambiarlo.
- Catálogo de siete actividades por perfil y opción «Otra actividad».
- Captura de título, descripción, resultado esperado, requisitos, fecha y hora final, zona horaria, disponibilidad y avances existentes.
- Plantillas para generar pasos y agente para crear o adaptar planes.
- Vista previa obligatoria para editar y aceptar pasos, duración y fechas.
- Lista «Hoy», detalle de actividades y progreso por objetivos terminados.
- Completar, editar, eliminar y volver a dividir objetivos.
- Notificaciones configurables antes del vencimiento, al vencer y después.
- Replanificación con vista previa cuando haya retrasos.
- Mascota Doctor Focus con ocho poses y mensajes contextuales.
- Modos Tranquilo, Compañero e Insistente, con topes de avisos y horario de silencio.
- Sesiones de concentración, registro de avances y centro de avisos.
- Persistencia de los planes y funcionamiento básico sin conexión. El agente necesitará conexión; las plantillas y los planes guardados seguirán disponibles.

Se posponen: grupos escolares, asignación de tareas por docentes a alumnos, chat entre personas, rankings, sincronización entre dispositivos, integración con calendarios externos y publicación en tiendas. El piloto puede utilizar una distribución de prueba; confirmar dispositivos al inicio.

## 3. Organización y calendario

Supuesto: Alei desarrolla y su esposa lidera el contenido educativo y el proyecto escolar. El alcance ahora incluye 24 pantallas/estados, mascota, agente protegido y recordatorios nativos. Se reemplaza la estimación inicial de seis semanas por **ocho semanas orientativas, con 12–18 horas semanales de desarrollo**, más 2–4 de coordinación educativa. No es una fecha comprometida; revisar al completar el primer incremento. La firma y validación iOS pueden mover su entrega de forma independiente.

| Semana | Hito | Trabajo y dependencia | Evidencia para cerrar |
|---|---|---|---|
| 1 | Alcance y prueba técnica | Confirmar fecha escolar/dispositivos; revisar spec; crear repositorio, esquemas, SQLite y build; probar aviso con app cerrada. | App instalada, datos persistidos y prueba documentada de notificación. |
| 2 | Diseño y mascota | Revisar resultado del prompt de Claude; inventariar 24 pantallas, tokens y ocho poses; validar ensayo, calificación y custom. | Prototipo navegable, recursos consistentes y estados de error/sin conexión. |
| 3 | Dominio y plantillas | Implementar catálogo versionado, formularios, edición, estados y planificador determinista. | 14 plantillas y pruebas de tiempo, dependencias, conteos y conflictos. |
| 4 | Flujo personal completo | Hoy, lista/detalle, vista previa, aceptación, concentración y progreso. | Ensayo y calificación de 40 trabajos completos, funcionando sin red. |
| 5 | Agente | Servicio, invitaciones/tokens, cuotas, presupuesto, idempotencia, custom/split/unblock. | Contratos validados, errores controlados y alternativa manual; secretos fuera de app. |
| 6 | Replanificación y recordatorios | Revisión de planes, reconciliación durable, tres modos, silencio, agrupación y deep links. | Sin duplicados en pruebas; avisos cancelados al completar; horizonte visible. |
| 7 | Integración y QA nativa | Mascota, accesibilidad, migraciones, fallos y dispositivos reales; preparar piloto. | Candidato de prueba, lista de compatibilidad por plataforma y limitaciones conocidas. |
| 8 | Piloto y entrega | Cinco días de uso, análisis, correcciones críticas, guía y presentación escolar. | Build demostrable, resultados descriptivos e inventario de pendientes. |

Dependencias críticas: la prueba nativa de la semana 1 precede a la implementación completa de recordatorios; el dominio precede al agente; la vista previa y el versionado preceden a replanificar; el proveedor y su presupuesto deben estar configurados antes de habilitar IA real.

Si la fecha escolar exige seis semanas, priorizar Android, trabajar con tres plantillas completas (ensayo, estudio y calificación), mantener «Otra actividad» y marcar las demás como pendientes. No presentar funciones simuladas como reales. El catálogo de 14 tipos sigue siendo el alcance de la entrega completa.

## 4. Responsables propuestos

| Área | Responsable propuesto | Responsabilidad |
|---|---|---|
| Contenido educativo y proyecto escolar | Esposa de Alei | Requisitos de la materia, lenguaje, plantillas, instrumentos y presentación académica. |
| Desarrollo | Alei | Implementación móvil, servicio del agente, persistencia, recordatorios y pruebas técnicas. |
| Diseño y alcance | Ambos | Revisar experiencia, prioridades y criterios de aceptación. |
| Evaluación | Ambos, con participantes voluntarios | Observar el uso, documentar problemas y resumir resultados. |

## 5. Catálogo y descomposición

Las siguientes secuencias son plantillas iniciales. El sistema omitirá pasos ya completados y permitirá modificar los que no correspondan.

### Estudiantes

| Actividad | Preguntas específicas | Secuencia base |
|---|---|---|
| Tarea o ejercicios | ¿Cuántos ejercicios? ¿Qué temas? ¿Qué material existe? | Revisar instrucciones → separar por tema o dificultad → resolver bloques → comprobar → entregar. |
| Ensayo o reporte | ¿Extensión, fuentes y formato? ¿Tema definido? | Revisar requisitos → delimitar tema → reunir fuentes → esquema → redactar secciones → revisar → entregar. |
| Estudiar para examen | ¿Temas, fecha, formato y dificultades? | Identificar temas → priorizar dificultades → sesiones de repaso y práctica → autoevaluación → reforzar errores. |
| Exposición | ¿Duración, audiencia y formato? | Definir mensaje → investigar → organizar → preparar materiales → ensayar → ajustar. |
| Proyecto o investigación | ¿Entregables, criterios y recursos? | Delimitar alcance → identificar etapas → desarrollar entregables → integrar → validar → entregar. |
| Lectura | ¿Páginas o capítulos? ¿Hay producto de entrega? | Dividir lectura → leer bloques y tomar notas → sintetizar → responder o preparar entrega si corresponde. |
| Trabajo en equipo | ¿Qué le corresponde al usuario? ¿Qué depende de otras personas? | Definir aportación propia → dividir trabajo → registrar dependencias → desarrollar → integrar → revisar. |

### Docentes

| Actividad | Preguntas específicas | Secuencia base |
|---|---|---|
| Preparar clase | ¿Tema, duración, grupo y aprendizaje esperado? | Objetivo → contenido → actividades → materiales → evaluación → revisar tiempos. |
| Planeación de unidad o periodo | ¿Fechas, sesiones y objetivos? | Revisar calendario → distribuir temas → diseñar secuencia → evidencias → evaluación → revisar carga. |
| Crear examen o evaluación | ¿Temas, formato, duración y cantidad de preguntas? | Definir aprendizajes → estructura → redactar bloques → respuestas o rúbrica → revisión → versión final. |
| Calificar trabajos o exámenes | ¿Cuántos? ¿Minutos por trabajo? ¿Existe rúbrica? | Revisar criterios → estimar carga → calificar por lotes → retroalimentar → verificar → registrar. |
| Preparar material didáctico | ¿Formato, propósito y extensión? | Definir objetivo → organizar → elaborar por secciones → revisar claridad y accesibilidad → finalizar. |
| Reportes y trámites | ¿Requisitos, documentos y fecha? | Revisar requisitos → reunir datos → completar apartados → verificar → enviar → conservar comprobante. |
| Proyecto o evento escolar | ¿Alcance, fecha, recursos y responsabilidad personal? | Definir alcance → actividades → responsables y dependencias → preparar recursos → ejecutar → documentar. |

«Otra actividad» estará disponible en ambos perfiles. Las actividades de equipo se gestionarán como planes personales; esta versión no enviará asignaciones a otras personas.

## 6. Reglas del planificador

1. Cada objetivo tendrá una acción concreta y un resultado verificable: «Redactar la introducción de 150 palabras», en vez de «Avanzar».
2. Proponer bloques de 10–30 minutos como punto de partida configurable. Permitir duraciones mayores cuando la naturaleza de la actividad lo requiera y ofrecer dividirlas.
3. Separar duración estimada, sesión programada y fecha límite del objetivo. Guardar la fecha final de la actividad por separado.
4. Distribuir sesiones únicamente dentro de la disponibilidad y descontar el tiempo ocupado por otras actividades de la app. Explicar que no se conocen compromisos externos no registrados.
5. Respetar dependencias: un paso no puede programarse antes del trabajo que necesita. Admitir pasos independientes en paralelo.
6. Procurar margen de revisión antes de la entrega, si existe disponibilidad suficiente.
7. Cuando el tiempo no alcance, mostrar cuánto falta y ofrecer ajustar disponibilidad, alcance o fecha. Cambiar la fecha final solo mediante una decisión explícita del usuario.
8. Aceptar y editar el plan antes de activar notificaciones. Replanificar sin alterar objetivos completados ni registrar avances inexistentes.
9. Validar fechas pasadas, horas ambiguas, dependencias circulares y objetivos sin duración o criterio de finalización.
10. Mostrar en «Hoy» qué objetivo sigue y cuáles están vencidos, sin llenar automáticamente el día con todos los atrasos.

## 7. Agente para crear y adaptar objetivos

### Flujo

Descripción libre → detectar información faltante → preguntar solo lo necesario → proponer objetivos y estimaciones → validar → calcular calendario → mostrar vista previa → aceptar.

El agente propondrá el trabajo; el planificador verificará fechas, disponibilidad y dependencias. Las instrucciones pegadas por el usuario se tratarán como contenido de la actividad, no como órdenes para modificar el funcionamiento del agente.

### Responsabilidades

- Aclarar entregable, requisitos, avances y límites antes de planear cuando haya ambigüedad relevante.
- Devolver una estructura con título, objetivos, resultados esperados, minutos estimados, dependencias, supuestos y preguntas pendientes.
- No inventar requisitos del docente, datos de la escuela ni compromisos de otras personas.
- Explicar estimaciones y permitir corregirlas.
- Ofrecer «Dividir más» y «Estoy bloqueado» para adaptar un objetivo concreto.
- En caso de error o falta de conexión, conservar el borrador y permitir agregar pasos manualmente o usar una plantilla.
- No resolver o entregar automáticamente el trabajo académico: su función en este proyecto será organizarlo.

La integración utilizará un servicio que mantenga las credenciales fuera de la app. Definir límites de solicitudes y presupuesto antes del piloto, medir consumo y evitar llamadas repetidas por cada recordatorio.

## 8. Recordatorios

Configuración inicial según TECH_SPEC.md: Tranquilo (máximo 2 avisos/día), Compañero (4) e Insistente (6). Silencio propuesto 21:00–08:00, editable. Los eventos previos y posteriores dependen del modo y se agrupan globalmente. Son valores de diseño que deberán probarse con usuarios.

Se usarán avisos locales: programar los próximos siete días y reponer al abrir la app, hasta un máximo conservador de 48 solicitudes nativas pendientes. Mostrar hasta cuándo hay cobertura. Si se requiere continuidad sin reapertura, planificar una fase posterior con servidor push; no asumir ejecución de fondo permanente.

- Pedir permiso al activar recordatorios y explicar su propósito.
- Ofrecer horario de silencio, pausa general y ajustes por actividad.
- Agrupar avisos coincidentes para evitar saturación.
- Permitir abrir el objetivo y elegir completar, recordar más tarde o reorganizar. Si la plataforma de prueba no permite acciones directas, mostrarlas dentro de la app.
- Cancelar avisos futuros al completar o eliminar un objetivo.
- Al editar o aceptar una replanificación, cancelar los avisos anteriores y crear los nuevos sin duplicados.
- No desplazar automáticamente una fecha límite porque una notificación caiga en horario de silencio; ajustar el aviso y mostrar la fecha real.
- Si faltan permisos, mostrar los pendientes dentro de la app y permitir volver a la configuración.
- Comprobar cambios de zona horaria, reinicio del dispositivo y app cerrada. Documentar las restricciones observadas del sistema; no prometer entrega exacta de cada aviso.

## 9. Pantallas y datos mínimos

Pantallas: bienvenida y perfil; «Hoy»; nueva actividad y selección de tipo; preguntas o conversación breve; vista previa del plan; detalle y edición de objetivos; progreso y ajustes.

Datos principales:

| Entidad | Campos esenciales |
|---|---|
| Preferencias | Perfil, zona horaria, disponibilidad, horario de silencio y recordatorios. |
| Actividad | Identificador, tipo, título, requisitos, resultado esperado, fecha final, estado y origen del plan. |
| Objetivo | Identificador, actividad, acción, resultado, duración estimada, sesión, fecha límite, dependencias, estado y fecha real de finalización. |
| Recordatorio | Objetivo, momento, identificador del sistema, estado y versión del plan. |
| Revisión del plan | Fecha, cambios propuestos y aceptación del usuario. |

Minimizar datos personales. No pedir matrículas ni nombres de alumnos para planificar. Enviar al agente únicamente la información necesaria y explicar ese envío. Mantener las reflexiones privadas y permitir borrar actividades y datos. Definir con la escuela las condiciones de participación del piloto, especialmente si incluye menores.

## 10. Pruebas y criterios de aceptación

| Caso | Resultado esperado |
|---|---|
| Ensayo con una semana disponible | Pasos editables, orden coherente y fechas dentro de la disponibilidad. |
| Calificar 40 trabajos | Lotes basados en tiempo por trabajo y sesiones disponibles. |
| «Otra actividad» ambigua | Preguntas pertinentes antes de cerrar el plan. |
| Actividad con plazo imposible | Conflicto visible; no presentar un calendario imposible como viable. |
| Completar o eliminar un objetivo | Progreso actualizado y avisos futuros cancelados. |
| Replanificar un atraso | Vista previa, aceptación, objetivos completados conservados y ausencia de avisos duplicados. |
| Sin conexión o fallo del agente | Datos preservados y alternativa manual o plantilla. |
| Permiso de notificaciones denegado | App utilizable y pendientes visibles. |
| Reinicio y cambio de zona horaria | Verificar consistencia de fechas y comportamiento documentado de avisos. |

Antes del piloto: todos los flujos esenciales deben funcionar en dispositivos reales y no deben quedar errores que causen pérdida de datos, fechas finales modificadas sin consentimiento o duplicación sistemática de recordatorios.

## 11. Piloto escolar y evaluación

Propuesta: 5–10 estudiantes y 2–3 docentes voluntarios durante cinco días; ajustar al acceso real y requisitos de la escuela. Usar actividades reales de bajo riesgo y evitar recopilar contenido sensible.

Inicio: registrar cómo organizan hoy sus pendientes y elegir una actividad. Durante el piloto: observar creación del plan, cambios y obstáculos. Cierre: encuesta breve y conversación sobre claridad, esfuerzo y utilidad.

Medir:

- Si pueden crear y aceptar un plan sin ayuda, y cuánto tardan.
- Cuántos objetivos propuestos necesitan editar, dividir o eliminar.
- Objetivos completados a tiempo sobre objetivos que vencieron durante la prueba.
- Diferencia entre la primera sesión programada y el primer avance registrado. Esto no equivale necesariamente al momento real en que comenzaron.
- Claridad del siguiente paso y utilidad percibida de recordatorios, en escala de 1 a 5.
- Errores del agente, conflictos de calendario y problemas de notificación.

Los resultados serán descriptivos y exploratorios. Registrar tamaño de muestra, fechas, abandonos y limitaciones; no atribuir causalidad a la app sin un diseño de evaluación adecuado.

## 12. Entregables finales y primer hito

Entregables: app de prueba; catálogo de plantillas; reglas del planificador y del agente; guía breve de uso; evidencia de pruebas; informe del piloto y presentación con problema, propuesta, demostración, resultados y siguientes pasos.

Primer hito: cerrar requisitos escolares y dispositivos, diseñar el flujo completo de un ensayo, otro de calificación y uno de «Otra actividad», y comprobar una notificación real. Con esos tres casos se valida la base antes de completar el catálogo.

Decisiones tomadas: nombre Doctor Focus; mascota búho con bata, lentes y libreta; identidad azul petróleo/turquesa y amarillo; app React Native/Expo con TypeScript, SQLite local, planificador determinista y API del agente separada.

Decisiones pendientes: fecha escolar, dispositivos reales del piloto, versiones del stack al inicializar, diseños finales y recursos, tiempo semanal, modelo/proveedor habilitado y presupuesto, acceso iOS, condiciones de participación y eventual distribución pública.


## 13. Backlog ejecutable

Todos los puntos siguientes están pendientes de implementación. Los documentos y el prompt de diseño ya existen; no se han generado aquí las pantallas ni la mascota final.

| ID | Trabajo | Prioridad | Depende de | Criterio de cierre |
|---|---|---|---|---|
| F01 | Estructura del repositorio, lockfile y scripts | P0 | — | Desarrollo, typecheck, lint y pruebas ejecutables. |
| F02 | SQLite, migraciones y repositorios | P0 | F01 | Reinicio sin perder planes; relaciones consistentes. |
| F03 | Build móvil y prueba nativa de aviso | P0 | F01 | Evidencia en celular, incluidos permiso denegado y app cerrada. |
| D01 | Sistema visual e inventario S01–S24 | P0 | — | Recorridos y errores visibles, coherencia entre perfiles. |
| D02 | Hoja de Doctor Focus y exports | P1 | D01 | Ocho poses, avatar e iconos, proporciones constantes. |
| P01 | Esquemas y 14 plantillas | P0 | F01 | Preguntas por tipo y objetivos verificables sin red. |
| P02 | Planificador y zonas horarias | P0 | P01 | No solapar; respetar dependencias y detectar falta de capacidad. |
| U01 | Onboarding, Hoy y actividades | P0 | F02, D01 | Crear y recuperar borrador, cambiar perfil sin perder actividades. |
| U02 | Vista previa y aceptación transaccional | P0 | P02, U01 | Solo aplicar revisión vigente y aceptada. |
| U03 | Objetivos, concentración y progreso | P1 | U02 | Timer no completa; avance parcial y omisiones coherentes. |
| A01 | API segura y adaptador mock/real | P0 | F01 | Token, cuotas y presupuesto; sin secretos en bundle. |
| A02 | Otra actividad, dividir y desbloquear | P0 | A01, U02 | Preguntas acotadas y validación semántica; fallback manual. |
| R01 | Replanificación y conservación de avances | P0 | U03, A02 | Comparación antes/después; fechas finales no cambian solas. |
| N01 | Reconciliación de notificaciones | P0 | F03, U02 | Cancelación y recuperación de fallos sin duplicación. |
| N02 | Modos, silencio y centro de avisos | P0 | N01 | Tope global, ventana visible y navegación al estado actual. |
| M01 | Integrar poses y mensajes locales | P1 | D02, U03, N02 | Personalidad consistente; reducción de movimiento. |
| Q01 | Matriz QA y builds por plataforma | P0 | A02, R01, N02 | Flujos críticos aprobados y limitaciones registradas. |
| E01 | Piloto e informe escolar | P0 | Q01 | Consentimientos aplicables, resultados y límites del estudio. |

P0 significa necesario para el flujo esencial; P1 añade una experiencia completa y deberá estar terminado para declarar finalizada la versión de ocho semanas. No confundir prioridad con trabajo ya realizado.

## 14. Aceptación de diseño y mascota

- Navegación Hoy / Actividades / Progreso / Ajustes.
- Todas las pantallas S01–S24 de TECH_SPEC.md identificadas como implementadas, simuladas o pendientes.
- Perfil docente con ejemplos propios; nunca solo reemplazar la palabra estudiante.
- Fechas de entrega, límites de objetivos y sesiones diferenciadas.
- Galería de avisos iOS y Android que respete el formato del sistema.
- Mascota: bienvenida, pensando, señalando, concentrado, reloj, reorganizando, celebrando y descansando.
- No generar culpa ni castigar ausencias; avisos con acciones útiles y pausa.
- Textos legibles, controles accesibles, teclado y tamaños de letra ampliados.

## 15. Riesgos y recortes acordados como propuesta

| Riesgo | Respuesta de trabajo |
|---|---|
| Diseños de Claude difíciles de llevar a móvil | Adaptarlos a componentes nativos en semana 2 y mantener inventario. |
| Firma o dispositivo iOS no disponible | Entrega Android verificable; iOS queda pendiente de QA explícita. |
| Agente costoso o proveedor no disponible | Cuotas y tope global; plantillas/manual y mock claramente marcado. |
| Usuario no abre durante más de siete días | Explicar cobertura local limitada; considerar push en otra fase. |
| IA devuelve un plan incoherente | Esquema + validación semántica + calendario determinista + aceptación. |
| Scope supera horas disponibles | Recortar plataforma/plantillas como se indica en sección 3, sin ocultar pendientes. |

## 16. Lista de entrega

- [ ] TECH_SPEC.md y WORK_PLAN.md incluidos en el repositorio de implementación.
- [ ] Diseño, recursos de mascota y guía de estilo disponibles.
- [ ] Build instalable y guía de acceso al piloto.
- [ ] Comandos y variables de entorno documentados, sin secretos.
- [ ] Pruebas de dominio/API y QA de recordatorios verificadas.
- [ ] Guía de uso con funcionamiento sin red y cobertura de avisos.
- [ ] Resultados del piloto y presentación escolar.
- [ ] Compatibilidad y pendientes descritos con precisión.
