-- Participantes del piloto y conteo diario de solicitudes al agente (TECH_SPEC §7).
-- Solo la función `plan` (rol service_role) lee y escribe estas tablas.

create extension if not exists pgcrypto with schema extensions;

create table public.participants (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,          -- SHA-256 en hexadecimal; el token en claro nunca se guarda
  alias text not null unique,               -- alias anónimo, por ejemplo «p01»
  active boolean not null default true,     -- revocar = poner en false
  created_at timestamptz not null default now()
);

create table public.daily_usage (
  participant_id uuid not null references public.participants (id) on delete cascade,
  day date not null,                        -- día en America/Mexico_City
  count integer not null default 0 check (count >= 0),
  primary key (participant_id, day)
);

-- RLS activo y sin políticas: anon y authenticated no ven nada; service_role lo omite.
alter table public.participants enable row level security;
alter table public.daily_usage enable row level security;

-- Cuenta una solicitud de forma atómica. Devuelve:
--   ok             la solicitud se contó; used = solicitudes de hoy
--   invalid_token  el hash no existe o el participante está desactivado
--   daily_limit    ya se usaron p_limit solicitudes hoy; retry_after = segundos hasta la medianoche
create or replace function public.consume_request(p_token_hash text, p_limit integer)
returns table (status text, used integer, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant uuid;
  v_local timestamp := now() at time zone 'America/Mexico_City';
  v_day date := v_local::date;
  v_wait integer := ceil(extract(epoch from (v_day + 1)::timestamp - v_local))::integer;
  v_count integer;
begin
  select p.id into v_participant from participants p where p.token_hash = p_token_hash and p.active;
  if v_participant is null then
    return query select 'invalid_token'::text, 0, 0;
    return;
  end if;

  -- El insert y el update condicionado toman el candado de la fila: dos solicitudes simultáneas no pasan del límite.
  insert into daily_usage as u (participant_id, day, count)
  values (v_participant, v_day, 1)
  on conflict (participant_id, day) do update set count = u.count + 1 where u.count < p_limit
  returning u.count into v_count;

  if v_count is null or v_count > p_limit then
    if v_count is not null then
      update daily_usage set count = count - 1 where participant_id = v_participant and day = v_day;
    end if;
    return query select 'daily_limit'::text, p_limit, v_wait;
    return;
  end if;
  return query select 'ok'::text, v_count, 0;
end;
$$;

-- Crea un participante y devuelve su token una sola vez. Uso: select * from create_participant('p01');
create or replace function public.create_participant(p_alias text)
returns table (alias text, token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := 'df_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  insert into participants (token_hash, alias) values (encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_alias);
  return query select p_alias, v_token;
end;
$$;

revoke all on function public.consume_request(text, integer) from public, anon, authenticated;
revoke all on function public.create_participant(text) from public, anon, authenticated;
grant execute on function public.consume_request(text, integer) to service_role;
