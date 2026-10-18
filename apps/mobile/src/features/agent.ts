import * as SecureStore from 'expo-secure-store';
import {
  AGENT_SCHEMA_VERSION,
  AgentErrorSchema,
  AgentRequestSchema,
  AgentResponseSchema,
  type AgentError,
  type AgentRequestInput,
  type AgentResponse,
} from '@drfocus/contracts';
import { uuid } from '@/lib/ids';
import * as repo from '@/db/repo';

const TOKEN_KEY = 'participant_token';
const TIMEOUT_MS = 45_000;
const FUNCTION_URL = process.env.EXPO_PUBLIC_FUNCTION_URL ?? '';

/** Sin URL configurada se usa el agente de demostración, marcado en la interfaz. */
export const isMockAgent = () => !FUNCTION_URL;

export const getToken = () => SecureStore.getItemAsync(TOKEN_KEY);
export const setToken = (t: string) => SecureStore.setItemAsync(TOKEN_KEY, t.trim());
export const clearToken = () => SecureStore.deleteItemAsync(TOKEN_KEY);

export class AgentFailure extends Error {
  constructor(public readonly error: AgentError) {
    super(error.message);
  }
}

const fail = (code: AgentError['code'], message: string, requestId: string | null, retryable: boolean): never => {
  throw new AgentFailure({ code, message, requestId, retryable });
};

export type AgentCall = Omit<AgentRequestInput, 'schemaVersion' | 'requestId' | 'locale'>;

/** Llama a la función del agente y valida la respuesta con los mismos esquemas que el servidor. */
export async function callAgent(input: AgentCall): Promise<AgentResponse> {
  const requestId = uuid();
  const parsed = AgentRequestSchema.safeParse({ ...input, schemaVersion: AGENT_SCHEMA_VERSION, requestId, locale: 'es-MX' });
  if (!parsed.success) fail('invalid_request', 'La descripción es demasiado larga o le faltan datos.', requestId, false);
  const body = parsed.data!;
  repo.logEvent('agent_request', null, { mode: body.mode, answers: body.answers.length, mock: isMockAgent() });
  try {
    const res = isMockAgent() ? await mockAgent(body) : await remote(body);
    const checked = AgentResponseSchema.safeParse(res);
    if (!checked.success || checked.data.requestId !== requestId) fail('provider_error', 'La respuesta del agente no fue válida. Intenta de nuevo o usa una plantilla.', requestId, true);
    return checked.data!;
  } catch (e) {
    const err = e instanceof AgentFailure ? e.error : { code: 'network' as const, message: 'No hay conexión. Tu borrador se guardó.', requestId, retryable: true };
    repo.logEvent('agent_error', null, { code: err.code, mode: body.mode });
    throw e instanceof AgentFailure ? e : new AgentFailure(err);
  }
}

async function remote(body: unknown): Promise<unknown> {
  const token = await getToken();
  const requestId = (body as { requestId: string }).requestId;
  if (!token) fail('invalid_token', 'Falta tu código de participante. Agrégalo en Ajustes.', requestId, false);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } catch {
    return fail(ctrl.signal.aborted ? 'timeout' : 'network', ctrl.signal.aborted ? 'El agente tardó demasiado. Intenta de nuevo.' : 'No hay conexión. Tu borrador se guardó.', requestId, true);
  } finally {
    clearTimeout(timer);
  }
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const e = AgentErrorSchema.safeParse(json);
    const messages: Record<number, string> = {
      401: 'Tu código de participante no es válido o fue desactivado.',
      429: 'Llegaste al límite de 30 solicitudes de hoy. Mañana se renueva; mientras, usa una plantilla o agrega pasos a mano.',
    };
    fail(e.success ? e.data.code : 'provider_error', messages[res.status] ?? (e.success ? e.data.message : 'El agente no respondió bien.'), requestId, e.success ? e.data.retryable : true);
  }
  return json;
}

// ---------- Agente de demostración (sin red) ----------
async function mockAgent(req: ReturnType<typeof AgentRequestSchema.parse>): Promise<AgentResponse> {
  await new Promise((r) => setTimeout(r, 900));
  const base = { schemaVersion: AGENT_SCHEMA_VERSION, requestId: req.requestId } as const;
  if (req.mode === 'split' && req.targetObjective) {
    const total = Math.max(15, req.targetObjective.remainingMinutes);
    const third = Math.max(5, Math.round(total / 3 / 5) * 5);
    const last = Math.max(5, total - third * 2);
    const t = req.targetObjective.title;
    return {
      ...base,
      kind: 'proposal',
      assumptions: ['Propuesta de demostración: no se usó un modelo real.'],
      warnings: [],
      objectives: [
        { localId: 'a', title: `Preparar lo necesario para: ${t}`.slice(0, 120), expectedResult: 'Material y notas a la mano', estimatedMinutes: third, dependsOn: [] },
        { localId: 'b', title: `Hacer la parte principal de: ${t}`.slice(0, 120), expectedResult: 'Parte principal terminada', estimatedMinutes: third, dependsOn: ['a'] },
        { localId: 'c', title: `Revisar y cerrar: ${t}`.slice(0, 120), expectedResult: req.targetObjective.expectedResult || 'Paso terminado y revisado', estimatedMinutes: last, dependsOn: ['b'] },
      ],
    };
  }
  if (req.answers.length === 0) {
    return {
      ...base,
      kind: 'needs_clarification',
      assumptions: [],
      questions: [
        { id: 'responsibility', text: req.role === 'teacher' ? '¿Qué parte de esto te corresponde a ti?' : '¿Qué tienes que entregar exactamente?', options: [] },
        { id: 'progress', text: '¿Ya tienes algo avanzado?', options: ['Nada todavía', 'Ya empecé', 'Me falta poco'] },
      ],
    };
  }
  const title = req.activity.title;
  return {
    ...base,
    kind: 'proposal',
    assumptions: ['Propuesta de demostración: no se usó un modelo real.'],
    warnings: [],
    objectives: [
      { localId: 'step-1', title: 'Anotar qué se pide y para cuándo', expectedResult: 'Lista de requisitos confirmados', estimatedMinutes: 10, dependsOn: [] },
      { localId: 'step-2', title: 'Reunir información y materiales', expectedResult: 'Notas y materiales en un solo lugar', estimatedMinutes: 25, dependsOn: ['step-1'] },
      { localId: 'step-3', title: `Hacer la primera parte de ${title}`.slice(0, 120), expectedResult: 'Primera parte terminada', estimatedMinutes: 30, dependsOn: ['step-2'] },
      { localId: 'step-4', title: `Hacer la segunda parte de ${title}`.slice(0, 120), expectedResult: 'Segunda parte terminada', estimatedMinutes: 30, dependsOn: ['step-3'] },
      { localId: 'step-5', title: 'Revisar contra lo que se pide', expectedResult: 'Pendientes corregidos', estimatedMinutes: 15, dependsOn: ['step-4'] },
    ],
  };
}
