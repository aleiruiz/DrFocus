import { describe, expect, it, vi } from 'vitest';
import { AgentErrorSchema, AgentResponseSchema } from '../../../packages/contracts/src/index.ts';
import { createHandler, type LogRecord } from './handler.ts';
import { ProviderError, mockProvider, type PlanningProvider, type ProviderResult } from './provider.ts';
import { sha256Hex, type ConsumeRequest, type ConsumeResult } from './usage.ts';

const RID = '6f1f1a52-6a0e-4a43-9f53-0f3c7d7b8a11';
const TOKEN = 'df_token-de-prueba';
const SECRET_TITLE = 'Ensayo sobre la Revolución Mexicana';

const body = (over: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  requestId: RID,
  mode: 'decompose',
  role: 'student',
  locale: 'es-MX',
  activity: { title: SECRET_TITLE, deadlineAt: '2026-11-06T21:00:00Z', timezone: 'America/Mexico_City' },
  preferredBlockMinutes: 20,
  answers: [],
  targetObjective: null,
  ...over,
});

const post = (payload: unknown, token: string | null = TOKEN) =>
  new Request('http://localhost/functions/v1/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });

const proposal = {
  kind: 'proposal',
  questions: [],
  assumptions: [],
  warnings: [],
  objectives: [
    { localId: 'step-1', title: 'Leer la consigna', expectedResult: 'Consigna subrayada', estimatedMinutes: 15, dependsOn: [] },
    { localId: 'step-2', title: 'Escribir el borrador', expectedResult: 'Borrador terminado', estimatedMinutes: 30, dependsOn: ['step-1'] },
  ],
};

/** Simula `consume_request`: tabla de tokens activos y conteo por token. */
function fakeUsage(opts: { limit?: number; revoked?: string[] } = {}) {
  const limit = opts.limit ?? 30;
  const counts = new Map<string, number>();
  const known = sha256Hex(TOKEN);
  const consume = vi.fn<ConsumeRequest>(async (hash): Promise<ConsumeResult> => {
    if (hash !== (await known) || (opts.revoked ?? []).includes(TOKEN)) return { status: 'invalid_token' };
    const n = counts.get(hash) ?? 0;
    if (n >= limit) return { status: 'daily_limit', retryAfterSeconds: 3600 };
    counts.set(hash, n + 1);
    return { status: 'ok', used: n + 1 };
  });
  return { consume, used: async () => counts.get(await known) ?? 0 };
}

const scripted = (...outputs: (unknown | Error)[]): PlanningProvider & { calls: number } => {
  const p = {
    name: 'test',
    calls: 0,
    async propose(): Promise<ProviderResult> {
      const out = outputs[p.calls++];
      if (out instanceof Error) throw out;
      return { output: out, usage: { inputTokens: 100, outputTokens: 50 } };
    },
  };
  return p;
};

const setup = (provider: PlanningProvider, usageOpts?: Parameters<typeof fakeUsage>[0], timeoutMs?: number) => {
  const usage = fakeUsage(usageOpts);
  const logs: LogRecord[] = [];
  const handler = createHandler({ provider, consume: usage.consume, timeoutMs, log: (r) => logs.push(r) });
  return { handler, usage, logs };
};

const expectError = async (res: Response, status: number, code: string) => {
  expect(res.status).toBe(status);
  const json = AgentErrorSchema.parse(await res.json());
  expect(json.code).toBe(code);
  return json;
};

describe('función plan: contrato', () => {
  it('devuelve una propuesta válida con el requestId de la solicitud', async () => {
    const { handler, logs } = setup(scripted(proposal));
    const res = await handler(post(body()));
    expect(res.status).toBe(200);
    const json = AgentResponseSchema.parse(await res.json());
    expect(json.requestId).toBe(RID);
    expect(json.kind).toBe('proposal');
    expect(json).not.toHaveProperty('questions');
    expect(logs[0]).toMatchObject({ requestId: RID, status: 200, code: 'ok', inputTokens: 100, outputTokens: 50, repaired: false });
  });

  it('devuelve preguntas sin los campos de la propuesta', async () => {
    const out = { kind: 'needs_clarification', questions: [{ id: 'q1', text: '¿Cuántas cuartillas?', options: ['2', '3'] }], assumptions: [], objectives: [], warnings: [] };
    const res = await setup(scripted(out)).handler(post(body()));
    expect(res.status).toBe(200);
    const json = AgentResponseSchema.parse(await res.json());
    expect(json.kind).toBe('needs_clarification');
    expect(json).not.toHaveProperty('objectives');
  });

  it('el proveedor mock cumple el contrato en decompose y split', async () => {
    const { handler } = setup(mockProvider);
    const first = AgentResponseSchema.parse(await (await handler(post(body()))).json());
    expect(first.kind).toBe('needs_clarification');
    const answered = AgentResponseSchema.parse(await (await handler(post(body({ answers: [{ questionId: 'q', question: '¿?', answer: 'Nada' }] })))).json());
    expect(answered.kind).toBe('proposal');
    const split = await handler(post(body({ mode: 'split', targetObjective: { title: 'Escribir el borrador', expectedResult: 'Borrador', remainingMinutes: 60 } })));
    expect(AgentResponseSchema.parse(await split.json()).kind).toBe('proposal');
  });

  it('rechaza entrada inválida con 400 sin contar la solicitud', async () => {
    const { handler, usage } = setup(scripted(proposal));
    await expectError(await handler(post(body({ mode: 'unblock' }))), 400, 'invalid_request');
    await expectError(await handler(post('{no es json')), 400, 'invalid_request');
    await expectError(await handler(post(body({ activity: { title: 'x'.repeat(70_000), deadlineAt: '2026-11-06T21:00:00Z', timezone: 'UTC' } }))), 400, 'invalid_request');
    await expectError(await handler(new Request('http://localhost/', { method: 'GET', headers: { Authorization: `Bearer ${TOKEN}` } })), 400, 'invalid_request');
    expect(await usage.used()).toBe(0);
  });

  it('los logs no incluyen el título ni las respuestas', async () => {
    const { handler, logs } = setup(scripted({ kind: 'proposal', objectives: [] }, new ProviderError('openai_http_500')));
    await handler(post(body({ answers: [{ questionId: 'q', question: '¿Tema?', answer: 'respuesta-privada' }] })));
    const text = JSON.stringify(logs);
    expect(text).not.toContain(SECRET_TITLE);
    expect(text).not.toContain('respuesta-privada');
  });
});

describe('función plan: token y límite diario', () => {
  it('responde 401 sin token, con token desconocido o revocado', async () => {
    const provider = scripted(proposal, proposal, proposal);
    await expectError(await setup(provider).handler(post(body(), null)), 401, 'invalid_token');
    await expectError(await setup(provider).handler(post(body(), 'df_otro')), 401, 'invalid_token');
    await expectError(await setup(provider, { revoked: [TOKEN] }).handler(post(body())), 401, 'invalid_token');
    expect(provider.calls).toBe(0);
  });

  it('responde 429 con Retry-After después de 30 solicitudes', async () => {
    const provider = scripted(...Array.from({ length: 31 }, () => proposal));
    const { handler } = setup(provider);
    for (let i = 0; i < 30; i++) expect((await handler(post(body()))).status).toBe(200);
    const res = await handler(post(body()));
    const err = await expectError(res, 429, 'daily_limit');
    expect(err.retryable).toBe(false);
    expect(res.headers.get('Retry-After')).toBe('3600');
    expect(provider.calls).toBe(30);
  });
});

describe('función plan: proveedor', () => {
  it('convierte el rechazo del proveedor en 502 sin texto interno', async () => {
    const { handler, logs } = setup(scripted(new ProviderError('openai_http_429: insufficient_quota sk-secreto')));
    const err = await expectError(await handler(post(body())), 502, 'provider_error');
    expect(err.retryable).toBe(true);
    expect(err.message).not.toContain('openai');
    expect(err.message).not.toContain('sk-');
    expect(logs[0]?.detail).toContain('openai_http_429');
  });

  it('repara una salida inválida una vez y cuenta la reparación', async () => {
    const bad = { ...proposal, objectives: [{ ...proposal.objectives[0], estimatedMinutes: 500 }] };
    const provider = scripted(bad, proposal);
    const { handler, usage, logs } = setup(provider);
    const res = await handler(post(body()));
    expect(res.status).toBe(200);
    expect(provider.calls).toBe(2);
    expect(await usage.used()).toBe(2);
    expect(logs[0]?.repaired).toBe(true);
  });

  it('pasa los problemas de la primera salida al intento de reparación', async () => {
    const seen: unknown[] = [];
    const provider: PlanningProvider = {
      name: 'test',
      async propose(_req, { repair }) {
        seen.push(repair);
        return { output: repair ? proposal : 'texto truncado {"kind":"prop' };
      },
    };
    expect((await setup(provider).handler(post(body()))).status).toBe(200);
    expect(seen[0]).toBeUndefined();
    expect(seen[1]).toMatchObject({ previousOutput: 'texto truncado {"kind":"prop', issues: [expect.stringContaining('JSON')] });
  });

  it('responde 502 si la reparación también falla y no hace un tercer intento', async () => {
    const cyclic = { ...proposal, objectives: proposal.objectives.map((o) => ({ ...o, dependsOn: [o.localId === 'step-1' ? 'step-2' : 'step-1'] })) };
    const provider = scripted(cyclic, cyclic, proposal);
    await expectError(await setup(provider).handler(post(body())), 502, 'provider_error');
    expect(provider.calls).toBe(2);
  });

  it('en split exige una propuesta', async () => {
    const question = { kind: 'needs_clarification', questions: [{ id: 'q', text: '¿?', options: [] }], assumptions: [], objectives: [], warnings: [] };
    const provider = scripted(question, question);
    const split = body({ mode: 'split', targetObjective: { title: 'Escribir', expectedResult: 'Borrador', remainingMinutes: 40 } });
    await expectError(await setup(provider).handler(post(split)), 502, 'provider_error');
    expect(provider.calls).toBe(2);
  });

  it('no repara si la reparación excede el límite diario', async () => {
    const provider = scripted({ kind: 'proposal' }, proposal);
    await expectError(await setup(provider, { limit: 1 }).handler(post(body())), 429, 'daily_limit');
    expect(provider.calls).toBe(1);
  });

  it('responde 504 cuando el proveedor tarda más que el tiempo límite y cancela la llamada', async () => {
    let aborted = false;
    const slow: PlanningProvider = {
      name: 'slow',
      propose: (_req, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          });
        }),
    };
    const err = await expectError(await setup(slow, {}, 20).handler(post(body())), 504, 'timeout');
    expect(err.retryable).toBe(true);
    expect(aborted).toBe(true);
  });

  it('responde 504 aunque el proveedor ignore la cancelación', async () => {
    const stuck: PlanningProvider = { name: 'stuck', propose: () => new Promise(() => {}) };
    await expectError(await setup(stuck, {}, 20).handler(post(body())), 504, 'timeout');
  });

  it('responde 502 si la base de datos no responde', async () => {
    const handler = createHandler({ provider: scripted(proposal), consume: async () => { throw new Error('db down'); } });
    await expectError(await handler(post(body())), 502, 'provider_error');
  });
});
