import { LIMITS } from '../../../packages/contracts/src/index.ts';
import { ProviderError, type PlanningProvider } from './provider.ts';
import { SYSTEM_PROMPT, repairMessage, userMessage } from './prompt.ts';

/**
 * Esquema para Structured Outputs en modo estricto: un solo objeto con todos los campos requeridos,
 * porque el modo estricto no admite una unión en la raíz. La función luego conserva solo los campos de cada variante.
 */
export const OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'questions', 'assumptions', 'objectives', 'warnings'],
  properties: {
    kind: { type: 'string', enum: ['needs_clarification', 'proposal'] },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'text', 'options'],
        properties: { id: { type: 'string' }, text: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
      },
    },
    assumptions: { type: 'array', items: { type: 'string' } },
    objectives: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['localId', 'title', 'expectedResult', 'estimatedMinutes', 'dependsOn'],
        properties: {
          localId: { type: 'string' },
          title: { type: 'string' },
          expectedResult: { type: 'string' },
          estimatedMinutes: { type: 'integer' },
          dependsOn: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
} as const;

interface ChatCompletion {
  choices?: { finish_reason?: string; message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export function openAIProvider(opts: { apiKey: string; model: string; fetch?: typeof fetch; baseUrl?: string }): PlanningProvider {
  const doFetch = opts.fetch ?? fetch;
  const url = `${opts.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;
  return {
    name: 'openai',
    async propose(req, { signal, repair }) {
      const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage(req) },
        ...(repair ? [{ role: 'user', content: repairMessage(repair) }] : []),
      ];
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({
          model: opts.model,
          messages,
          response_format: { type: 'json_schema', json_schema: { name: 'plan_response', strict: true, schema: OUTPUT_JSON_SCHEMA } },
          max_completion_tokens: 4000,
          store: false,
        }),
        signal,
      });
      if (!res.ok) {
        // 429 por cuota o tope de gasto, 5xx, clave inválida: todo es 502 para la app.
        const body = await res.text().catch(() => '');
        throw new ProviderError(`openai_http_${res.status}: ${body.slice(0, 200)}`);
      }
      const json = (await res.json()) as ChatCompletion;
      const choice = json.choices?.[0];
      const usage = { inputTokens: json.usage?.prompt_tokens ?? 0, outputTokens: json.usage?.completion_tokens ?? 0 };
      if (choice?.message?.refusal) throw new ProviderError('openai_refusal');
      const content = choice?.message?.content ?? '';
      // Una salida truncada (finish_reason = length) no es JSON válido y pasa a la reparación.
      try {
        return { output: JSON.parse(content), usage };
      } catch {
        return { output: content.slice(0, LIMITS.contextMax), usage };
      }
    },
  };
}
