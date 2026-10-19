# Doctor Focus

App Android (React Native + Expo) para que estudiantes de nivel medio-superior y docentes conviertan actividades grandes en pasos pequeños, calendarizados y con recordatorios. Proyecto escolar; ver [TECH_SPEC.md](TECH_SPEC.md) y [WORK_PLAN.md](WORK_PLAN.md).

## Estructura

```text
apps/mobile/              App Expo (SDK 58) con Expo Router en src/app
  src/db/                 Esquema Drizzle, cliente SQLite y repositorio
  src/features/           Planeación, avisos, agente y exportación
  src/components/         UI, mascota (ajolote) e iconos
  drizzle/                Migraciones generadas (no editar a mano)
packages/contracts/       Esquemas Zod compartidos (app y función)
packages/planner/         Planificador determinista (Luxon)
packages/templates/       8 plantillas versionadas
packages/domain/          Progreso, «Hoy», avisos, dividir, exportación, mensajes de la mascota
packages/design-tokens/   Colores, tipografía y espacios
supabase/functions/plan/  Función del agente (pendiente)
```

## Comandos

```bash
npm install                 # una sola vez, en la raíz
npm run dev:mobile          # servidor de desarrollo de Expo
npm --workspace apps/mobile run android   # compila e instala la app en el emulador o teléfono
npm run typecheck           # TypeScript en paquetes y app
npm run lint                # ESLint
npm test                    # Vitest (dominio y contratos)
npm run db:generate         # nueva migración tras cambiar src/db/schema.ts
npm run build:android:preview  # APK de prueba con EAS
```

Los paquetes importan con extensión `.ts` explícita para que la función de Supabase (Deno) pueda usar `packages/contracts` sin compilar.

## Correr en Android

La app no abre en Expo Go porque expo-notifications necesita módulos nativos. Hay que compilar una versión de desarrollo con `npm --workspace apps/mobile run android` (`expo run:android`); después basta `npm run dev:mobile`.

En Windows:

- El Android SDK debe estar en una ruta sin espacios (por ejemplo `C:\Android\Sdk`). Con espacios, como `C:\Users\Nombre Apellido\…`, falla el enlazado C++ de react-native-screens y worklets.
- El ninja 1.10 que trae el SDK no acepta rutas de más de 260 caracteres. Usa ninja 1.12 o más reciente, o acorta la ruta del repositorio (por ejemplo con `subst X: C:\Repos\DrFocus` y compila desde `X:`).

## Variables

- App: `EXPO_PUBLIC_FUNCTION_URL` (pública). Vacía = agente de demostración, marcado en la interfaz. Ver `apps/mobile/.env.example`.
- Función: `PLANNING_PROVIDER`, `PLANNING_MODEL`, `PROVIDER_API_KEY`, `DAILY_REQUEST_LIMIT`, `LOG_LEVEL` como secretos de Supabase. Nunca en el repositorio.

## Estado

Hecho: dominio con pruebas, base de datos y migración, reprogramación de avisos, cliente del agente con modo de demostración, exportación (lógica), mascota con 5 poses, pestañas y pantallas S01–S05, S03, S08. Pendiente: ver [docs/PARALELO.md](docs/PARALELO.md).
