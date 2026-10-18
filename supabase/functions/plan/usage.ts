export type ConsumeResult = { status: 'ok'; used: number } | { status: 'invalid_token' } | { status: 'daily_limit'; retryAfterSeconds: number };

/** Cuenta una solicitud del participante. La implementación real es atómica en Postgres (`consume_request`). */
export type ConsumeRequest = (tokenHash: string) => Promise<ConsumeResult>;

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Llama a la función SQL por PostgREST con la clave de servicio, sin depender de supabase-js. */
export function supabaseConsume(opts: { url: string; serviceKey: string; limit: number; fetch?: typeof fetch }): ConsumeRequest {
  const doFetch = opts.fetch ?? fetch;
  return async (tokenHash) => {
    const res = await doFetch(`${opts.url}/rest/v1/rpc/consume_request`, {
      method: 'POST',
      // Las claves nuevas (sb_secret_…) van solo en `apikey`; la clave service_role clásica es un JWT y va en ambos.
      headers: { 'Content-Type': 'application/json', apikey: opts.serviceKey, ...(opts.serviceKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${opts.serviceKey}` }) },
      body: JSON.stringify({ p_token_hash: tokenHash, p_limit: opts.limit }),
    });
    if (!res.ok) throw new Error(`consume_request_http_${res.status}`);
    const rows = (await res.json()) as { status: string; used: number; retry_after: number }[];
    const row = rows[0];
    if (row?.status === 'ok') return { status: 'ok', used: row.used };
    if (row?.status === 'daily_limit') return { status: 'daily_limit', retryAfterSeconds: row.retry_after };
    return { status: 'invalid_token' };
  };
}
