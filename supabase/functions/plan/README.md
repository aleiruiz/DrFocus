# Función `plan`

Función del agente (TECH_SPEC §7). Cómo crear tokens y desplegarla: [docs/agente.md](../../../docs/agente.md).

| Archivo | Qué hace |
|---|---|
| `index.ts` | Entrada de Deno: lee variables de entorno y arma el handler. |
| `handler.ts` | Flujo completo con dependencias inyectadas: token, límite diario, validación, una reparación, 45 s de tiempo límite, códigos HTTP y logs. |
| `provider.ts` | Interfaz `PlanningProvider` y proveedor mock. |
| `openai.ts` | Adaptador de OpenAI con Structured Outputs. |
| `prompt.ts` | Instrucciones del agente y mensajes. |
| `usage.ts` | Hash del token y llamada a `consume_request` en Postgres. |

Los esquemas se importan de `packages/contracts/src` con rutas relativas `.ts`, así la app y la función validan con el mismo contrato. Las pruebas (`*.test.ts`) corren con Vitest sin red: `npm test`.
