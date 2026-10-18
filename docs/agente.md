# Agente: despliegue y tokens del piloto

La función `plan` vive en Supabase Edge Functions. Recibe la actividad, revisa el token del participante, cuenta la solicitud (30 por día) y pide la propuesta al modelo. La clave del proveedor solo existe en los secretos de la función.

```
App ──POST /functions/v1/plan──▶ plan (Deno)
     Authorization: Bearer df_…     ├─ consume_request(hash, 30)  → participants, daily_usage
                                    └─ PlanningProvider (openai o mock)
```

## Respuestas

| HTTP | `code` | Cuándo |
|---|---|---|
| 200 | — | Preguntas (`needs_clarification`) o propuesta (`proposal`). |
| 400 | `invalid_request` | JSON inválido, fuera del contrato o mayor a 64 KiB. No cuenta para el límite. |
| 401 | `invalid_token` | Sin token, token desconocido o participante desactivado. |
| 429 | `daily_limit` | Ya se usaron las 30 de hoy. `Retry-After` dice los segundos que faltan para la medianoche de Ciudad de México. |
| 502 | `provider_error` | El proveedor falló o se negó, se agotó el tope de gasto, o la salida siguió inválida después de la reparación. |
| 504 | `timeout` | Pasaron 45 s. |

Cada respuesta del modelo se valida con `AgentResponseSchema` (el mismo de la app). Si no pasa, se intenta una reparación, que también cuenta para el límite. En modo `split` la respuesta tiene que ser una propuesta. El cuerpo de error es `{code, message, requestId, retryable}`, sin texto del proveedor.

Los logs llevan una línea JSON por solicitud con `requestId`, modo, estado, latencia y tokens. Nunca títulos, descripciones ni respuestas.

## Desplegar

Necesitas una cuenta de Supabase, un proyecto creado y la [CLI de Supabase](https://supabase.com/docs/guides/cli).

```sh
supabase login
supabase link --project-ref <ref-del-proyecto>

# 1. Tablas participants y daily_usage, y las funciones SQL
supabase db push

# 2. Secretos de la función (empieza con mock para probar sin gastar)
supabase secrets set PLANNING_PROVIDER=mock DAILY_REQUEST_LIMIT=30

# 3. Desplegar. --no-verify-jwt porque la app manda el token del participante, no un JWT de Supabase.
supabase functions deploy plan --no-verify-jwt --use-api
```

La función importa los esquemas de `packages/contracts/src`, fuera de `supabase/`. Despliega desde la raíz del repositorio. Esto no se ha probado contra un proyecto real de Supabase: si la CLI no encuentra esos archivos, copia `packages/contracts/src` a `supabase/functions/_shared/contracts/` y cambia las rutas de importación en la función.

Para usar el modelo real, configura primero el **tope de gasto mensual** en la consola de OpenAI y luego:

```sh
supabase secrets set PLANNING_PROVIDER=openai PLANNING_MODEL=<modelo-rápido-y-económico> PROVIDER_API_KEY=sk-...
```

No hace falta volver a desplegar: los secretos se leen al arrancar la función. Si el proveedor rechaza por presupuesto, la app recibe 502 y sugiere usar una plantilla.

En la app, pon la URL en `apps/mobile/.env`:

```
EXPO_PUBLIC_FUNCTION_URL=https://<ref-del-proyecto>.supabase.co/functions/v1/plan
```

Sin esa variable la app usa su agente de demostración, que no sale del teléfono.

## Tokens de participantes

En el **SQL Editor** del proyecto:

```sql
-- Crear: devuelve el token una sola vez; en la base solo queda su hash.
select * from create_participant('p01');

-- Revocar
update participants set active = false where alias = 'p01';

-- Uso por día
select p.alias, u.day, u.count
from daily_usage u join participants p on p.id = u.participant_id
order by u.day desc, p.alias;
```

El alias debe ser anónimo (`p01`, `p02`…); guarda la relación alias–persona fuera de Supabase y fuera del repositorio. Entrega el token por un canal privado, por ejemplo un código QR impreso (`npx qrcode "df_…"` lo muestra en la terminal). El participante lo pega en Ajustes → Código de participante. Si un token se filtra, revócalo y crea otro con un alias nuevo.

## Probar en local

```sh
cp supabase/.env.example supabase/.env
supabase start                 # Postgres local con Docker; aplica las migraciones
npm run dev:function           # sirve la función en http://127.0.0.1:54321/functions/v1/plan
```

Crea un token con `select * from create_participant('dev');` en el SQL Editor de Studio local (http://127.0.0.1:54323) y llama:

```sh
curl -i http://127.0.0.1:54321/functions/v1/plan \
  -H "Authorization: Bearer df_..." -H "Content-Type: application/json" \
  -d '{"schemaVersion":1,"requestId":"6f1f1a52-6a0e-4a43-9f53-0f3c7d7b8a11","mode":"decompose","role":"student","locale":"es-MX","activity":{"title":"Ensayo","deadlineAt":"2026-11-06T21:00:00Z","timezone":"America/Mexico_City"},"preferredBlockMinutes":20}'
```

Las pruebas automáticas no necesitan nada de esto: `npm test` corre `supabase/functions/plan/*.test.ts` sin red.

## Privacidad

Al modelo solo se manda la actividad (título, descripción, resultado esperado, requisitos, fecha límite, zona horaria, avance), el rol, el bloque preferido, las respuestas a las preguntas y, en «Dividir más», el objetivo a dividir. Nunca el calendario ni otras actividades. La solicitud a OpenAI va con `store: false`. Antes del piloto revisa la política de retención de datos de OpenAI y descríbela en la pantalla que explica qué datos salen del teléfono. Supabase solo guarda el hash del token, el alias, si está activo y el conteo diario.
