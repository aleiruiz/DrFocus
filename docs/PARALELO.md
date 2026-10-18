# Trabajo en paralelo

Cada parte abre su propio PR contra `main` y solo toca los archivos que le pertenecen. CI (`.github/workflows/ci.yml`) corre typecheck, lint y Vitest.

**Archivos compartidos (no editar sin acordarlo):** `packages/**`, `apps/mobile/src/db/schema.ts`, `apps/mobile/src/db/repo.ts`, `apps/mobile/src/app/_layout.tsx`, `apps/mobile/src/components/ui.tsx`, `package.json` y `package-lock.json`. Si una parte necesita una consulta nueva, la agrega en un archivo propio (por ejemplo `src/db/repo-settings.ts`). Si necesita cambiar el esquema, lo pide en el hilo en lugar de generar una migración por su cuenta.

## A · Crear y aceptar el plan (S06, S07)

- `apps/mobile/src/app/activity/custom.tsx` — «Otra actividad»: conversación breve con `callAgent` (modo `decompose`), estado de carga, cancelar, reintentar, máximo 3 rondas y alternativa manual. Guarda el borrador con `saveAgentDraft`. Explica qué datos salen del teléfono antes del primer envío.
- `apps/mobile/src/app/plan/[id]/preview.tsx` — vista previa: editar, agregar, quitar y reordenar pasos, recalcular con `proposeInitialPlan`, mostrar conflicto de tiempo en la misma pantalla con opciones (disponibilidad, alcance o fecha, esta última solo con decisión explícita), aceptar con `acceptRevision` y pedir permiso de avisos en el primer plan (`requestPermission`, luego `rescheduleReminders`).
- Nuevos componentes en `apps/mobile/src/components/plan/`.

## B · Seguimiento y replanificación (S09, S10)

- `apps/mobile/src/app/activity/[id].tsx` — detalle: progreso, objetivos con dependencias y sesiones, abre `ObjectiveSheet` (ya existe) y lo abre directo si llega `?objective=` desde un aviso; si el objetivo ya no existe, mensaje y volver a Hoy. Botones «Reorganizar» y «Borrar actividad» (`deleteActivity` + `rescheduleReminders`).
- `apps/mobile/src/app/plan/[id]/replan.tsx` — si no hay borrador, crearlo con `proposeReplan(id, currentPlanDrafts(id), 'replan')`; comparar antes/después con `diffPlans`; aceptar con `acceptRevision`; conservar completados.
- Nuevos componentes en `apps/mobile/src/components/activity/`.

## C · Ajustes y exportación del piloto (S11)

- `apps/mobile/src/app/(tabs)/settings.tsx` — perfil (cambiar sin perder actividades), disponibilidad (abre `/onboarding/availability?from=settings`), bloque preferido, silencio, recordatorios activados, estado de permisos con enlace a la configuración del sistema, «Recordatorios programados hasta…», código de participante (`setToken`), privacidad, exportar JSON y CSV con casilla de consentimiento para incluir títulos (`writePilotExport`, `shareFile`) y borrar todo (cancelar avisos, `wipeAll`, `clearToken`, volver al onboarding).
- `apps/mobile/src/features/export.ts` (ya existe; esta parte es su dueña).
- Nuevos componentes en `apps/mobile/src/components/settings/`.

## D · Función del agente en Supabase

- Todo `supabase/**`: `functions/plan/index.ts` (Deno), lógica testeable en `functions/plan/handler.ts` con dependencias inyectadas, adaptador `PlanningProvider` (OpenAI con Structured Outputs y un mock), validación con `packages/contracts/src/agent.ts`, un intento de reparación, tiempo límite de 45 s, códigos HTTP de TECH_SPEC §7, logs sin títulos.
- `supabase/migrations/*.sql`: tablas `participants` (hash del token, alias, activo) y `daily_usage` con incremento atómico; límite de 30 por día.
- Pruebas Vitest en `supabase/functions/plan/*.test.ts` (ya incluidas en `vitest.config.ts`) sin red: contrato, token inválido o revocado, límite diario, rechazo del proveedor, reparación y timeout.
- Guía corta para crear tokens y desplegar en `docs/agente.md`.

## Después de las cuatro partes

APK con EAS, prueba de aviso con la app cerrada, iconos definitivos de la mascota (los PNG actuales son los de la plantilla de Expo) y flujos de Maestro en `apps/mobile/.maestro/`. Eso necesita un teléfono real.
