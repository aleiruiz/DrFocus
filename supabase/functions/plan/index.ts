// Punto de entrada de la Edge Function `plan` (Deno). La lógica vive en handler.ts para probarla con Vitest.
import { createHandler } from './handler.ts';
import { openAIProvider } from './openai.ts';
import { mockProvider, type PlanningProvider } from './provider.ts';
import { supabaseConsume } from './usage.ts';

const env = (name: string) => Deno.env.get(name)?.trim() ?? '';

function provider(): PlanningProvider {
  if (env('PLANNING_PROVIDER') !== 'openai') return mockProvider;
  const apiKey = env('PROVIDER_API_KEY');
  const model = env('PLANNING_MODEL');
  if (!apiKey || !model) throw new Error('PLANNING_PROVIDER=openai requiere PROVIDER_API_KEY y PLANNING_MODEL');
  return openAIProvider({ apiKey, model });
}

const quiet = env('LOG_LEVEL') === 'error';

const handler = createHandler({
  provider: provider(),
  consume: supabaseConsume({
    url: env('SUPABASE_URL'),
    serviceKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    limit: Number(env('DAILY_REQUEST_LIMIT') || 30),
  }),
  timeoutMs: 45_000,
  // Una línea JSON por solicitud: requestId, estado, latencia y tokens. Nunca títulos ni conversaciones.
  log: (r) => {
    if (r.status >= 500) console.error(JSON.stringify(r));
    else if (!quiet) console.log(JSON.stringify(r));
  },
});

Deno.serve(handler);
