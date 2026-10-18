/// <reference lib="dom" />
import {
  AGENT_SCHEMA_VERSION,
  AgentRequestSchema,
  AgentResponseSchema,
  HTTP_STATUS_BY_CODE,
  LIMITS,
  type AgentError,
  type AgentRequest,
  type AgentResponse,
} from '../../../packages/contracts/src/index.ts';
import { ProviderError, type PlanningProvider, type ProviderResult, type ProviderUsage } from './provider.ts';
import { sha256Hex, type ConsumeRequest } from './usage.ts';

export interface LogRecord {
  requestId: string | null;
  mode: string | null;
  provider: string;
  status: number;
  code: AgentError['code'] | 'ok';
  latencyMs: number;
  repaired: boolean;
  inputTokens: number;
  outputTokens: number;
  detail?: string;
}

export interface HandlerDeps {
  provider: PlanningProvider;
  consume: ConsumeRequest;
  timeoutMs?: number;
  log?: (record: LogRecord) => void;
  now?: () => number;
}

type ErrorCode = Exclude<AgentError['code'], 'network'>;

const MESSAGES: Record<ErrorCode, string> = {
  invalid_request: 'La solicitud no es válida.',
  invalid_token: 'Tu código de participante no es válido o fue desactivado.',
  daily_limit: 'Llegaste al límite de solicitudes de hoy. Mañana se renueva.',
  provider_error: 'El agente no pudo responder. Intenta de nuevo o usa una plantilla.',
  timeout: 'El agente tardó demasiado. Intenta de nuevo.',
};

const RETRYABLE: Record<ErrorCode, boolean> = {
  invalid_request: false,
  invalid_token: false,
  daily_limit: false,
  provider_error: true,
  timeout: true,
};

class Timeout extends Error {}

/** Conserva solo los campos de la variante que eligió el modelo y fija versión y requestId desde el servidor. */
export function normalizeOutput(output: unknown, requestId: string): unknown {
  if (!output || typeof output !== 'object' || Array.isArray(output)) return output;
  const o = output as Record<string, unknown>;
  const base = { schemaVersion: AGENT_SCHEMA_VERSION, requestId };
  if (o.kind === 'needs_clarification') return { ...base, kind: o.kind, questions: o.questions, assumptions: o.assumptions ?? [] };
  if (o.kind === 'proposal') return { ...base, kind: o.kind, assumptions: o.assumptions ?? [], objectives: o.objectives, warnings: o.warnings ?? [] };
  return { ...base, ...o };
}

/** Valida contra el contrato compartido y las reglas del modo. Devuelve la respuesta o la lista de problemas. */
export function checkOutput(req: AgentRequest, output: unknown): { ok: true; value: AgentResponse } | { ok: false; issues: string[] } {
  if (typeof output === 'string') return { ok: false, issues: ['La respuesta no es JSON válido o está incompleta.'] };
  const parsed = AgentResponseSchema.safeParse(normalizeOutput(output, req.requestId));
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.slice(0, 10).map((i) => `${i.path.join('.') || '(raíz)'}: ${i.message}`) };
  }
  if (req.mode === 'split' && parsed.data.kind !== 'proposal') {
    return { ok: false, issues: ['En modo split la respuesta debe ser kind="proposal".'] };
  }
  return { ok: true, value: parsed.data };
}

export function createHandler(deps: HandlerDeps): (req: Request) => Promise<Response> {
  const timeoutMs = deps.timeoutMs ?? 45_000;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? (() => {});

  return async (request) => {
    const started = now();
    let requestId: string | null = null;
    let mode: string | null = null;
    let repaired = false;
    const usage: ProviderUsage = { inputTokens: 0, outputTokens: 0 };

    const finish = (status: number, code: LogRecord['code'], body: unknown, headers: Record<string, string> = {}, detail?: string) => {
      log({ requestId, mode, provider: deps.provider.name, status, code, latencyMs: now() - started, repaired, ...usage, detail });
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
    };
    const fail = (code: ErrorCode, opts: { headers?: Record<string, string>; detail?: string; message?: string } = {}) =>
      finish(HTTP_STATUS_BY_CODE[code], code, { code, message: opts.message ?? MESSAGES[code], requestId, retryable: RETRYABLE[code] } satisfies AgentError, opts.headers, opts.detail);

    if (request.method !== 'POST') return fail('invalid_request', { detail: `method_${request.method}` });

    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('Authorization') ?? '')?.[1];
    if (!token) return fail('invalid_token', { detail: 'missing_token' });

    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > LIMITS.payloadBytesMax) return fail('invalid_request', { detail: 'payload_too_large' });
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return fail('invalid_request', { detail: 'invalid_json' });
    }
    if (json && typeof json === 'object' && typeof (json as { requestId?: unknown }).requestId === 'string') {
      requestId = (json as { requestId: string }).requestId.slice(0, 64);
    }
    const parsed = AgentRequestSchema.safeParse(json);
    if (!parsed.success) return fail('invalid_request', { detail: parsed.error.issues.map((i) => i.path.join('.')).join(',').slice(0, 200) });
    const req = parsed.data;
    mode = req.mode;

    const tokenHash = await sha256Hex(token);
    const charge = async (): Promise<Response | null> => {
      let r;
      try {
        r = await deps.consume(tokenHash);
      } catch (e) {
        return fail('provider_error', { detail: `consume_failed: ${String(e).slice(0, 200)}` });
      }
      if (r.status === 'invalid_token') return fail('invalid_token');
      if (r.status === 'daily_limit') return fail('daily_limit', { headers: { 'Retry-After': String(r.retryAfterSeconds) } });
      return null;
    };
    const denied = await charge();
    if (denied) return denied;

    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        ctrl.abort();
        reject(new Timeout());
      }, timeoutMs);
    });
    deadline.catch(() => {});
    const call = async (repair?: { previousOutput: unknown; issues: string[] }): Promise<ProviderResult> => {
      const result = await Promise.race([deps.provider.propose(req, { signal: ctrl.signal, repair }), deadline]);
      usage.inputTokens += result.usage?.inputTokens ?? 0;
      usage.outputTokens += result.usage?.outputTokens ?? 0;
      return result;
    };

    try {
      const first = await call();
      let checked = checkOutput(req, first.output);
      if (!checked.ok) {
        // Un solo intento de reparación; también cuenta para el límite diario.
        const issues = checked.issues;
        const deniedRepair = await charge();
        if (deniedRepair) return deniedRepair;
        repaired = true;
        const second = await call({ previousOutput: first.output, issues });
        checked = checkOutput(req, second.output);
        if (!checked.ok) return fail('provider_error', { detail: `invalid_output: ${checked.issues.join(' | ').slice(0, 300)}` });
      }
      return finish(200, 'ok', checked.value);
    } catch (e) {
      if (e instanceof Timeout || ctrl.signal.aborted) return fail('timeout');
      return fail('provider_error', { detail: e instanceof ProviderError ? e.detail.slice(0, 300) : `unexpected: ${String(e).slice(0, 200)}` });
    } finally {
      clearTimeout(timer);
    }
  };
}
