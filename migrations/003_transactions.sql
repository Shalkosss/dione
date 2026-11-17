-- migrations/003_transactions.sql
-- Libro de órdenes del portafolio ficticio (Fase 2.1 del roadmap).
--
--   ledger_accounts        una fila por cuenta (paper, real): capital inicial y versión.
--   transactions           una fila por movimiento (BUY, SELL, DEPOSIT, WITHDRAW).
--   benchmark_portfolios   carteras de referencia (Claude, Grok…) con sus pesos.
--   ledger_replace()       única vía de escritura del libro: atómica y con
--                          control de versión (si otro navegador escribió en el
--                          medio, falla en vez de pisarlo).
--
-- Aplicar en Supabase → SQL Editor → New query → pegar todo y Run.
-- Es idempotente: se puede correr más de una vez sin romper nada.

create table if not exists public.ledger_accounts (
  id            text primary key,
  initial_cash  numeric not null check (initial_cash > 0),
  version       bigint  not null default 0,   -- sube en 1 con cada escritura
  updated_at    timestamptz not null default now()
);

insert into public.ledger_accounts (id, initial_cash) values
  ('paper', 1000000),
  ('real', 5000)
on conflict (id) do nothing;

create table if not exists public.transactions (
  account     text not null references public.ledger_accounts (id) on delete cascade,
  id          text not null,                  -- id generado en el navegador
  date        date not null,
  side        text not null check (side in ('BUY', 'SELL', 'DEPOSIT', 'WITHDRAW')),
  ticker      text,
  qty         numeric not null check (qty > 0),   -- acciones, o USD si es DEPOSIT/WITHDRAW
  price       numeric,
  sector      text,
  note        text,
  pos         integer not null default 0,     -- orden dentro del libro (desempata el mismo día)
  created_at  timestamptz not null default now(),
  primary key (account, id),
  constraint transactions_trade_chk check (
    side in ('DEPOSIT', 'WITHDRAW')
    or (ticker is not null and price is not null and price > 0)
  )
);

create index if not exists transactions_order_idx on public.transactions (account, pos);

create table if not exists public.benchmark_portfolios (
  id          text primary key,
  name        text not null,
  color       text,
  start_date  date not null,
  weights     jsonb not null default '{}'::jsonb,   -- { "NVDA": 0.25, ... }
  pos         integer not null default 0,
  updated_at  timestamptz not null default now()
);

-- RLS activado y sin policies: solo la service_role (el servidor) entra.
-- El navegador pasa siempre por /api/theses/ledger.
alter table public.ledger_accounts      enable row level security;
alter table public.transactions         enable row level security;
alter table public.benchmark_portfolios enable row level security;

-- Reemplaza el libro de una cuenta de forma atómica. Devuelve la versión nueva.
--   p_expected_version  null = no comprobar; si no coincide, error DN409.
--   p_rows              array JSON de transacciones, en orden.
create or replace function public.ledger_replace(
  p_account           text,
  p_expected_version  bigint,
  p_initial_cash      numeric,
  p_rows              jsonb
) returns bigint
language plpgsql
security invoker
set search_path = public
as $$
declare
  v bigint;
begin
  select version into v from public.ledger_accounts where id = p_account for update;
  if not found then
    raise exception 'cuenta desconocida: %', p_account using errcode = 'DN404';
  end if;
  if p_expected_version is not null and p_expected_version <> v then
    raise exception 'conflicto de version: esperada %, actual %', p_expected_version, v
      using errcode = 'DN409';
  end if;

  delete from public.transactions where account = p_account;

  insert into public.transactions (account, id, date, side, ticker, qty, price, sector, note, pos)
  select
    p_account,
    r->>'id',
    (r->>'date')::date,
    r->>'side',
    nullif(r->>'ticker', ''),
    (r->>'qty')::numeric,
    (r->>'price')::numeric,
    nullif(r->>'sector', ''),
    nullif(r->>'note', ''),
    (ord - 1)::integer
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) with ordinality as t (r, ord);

  update public.ledger_accounts
     set initial_cash = coalesce(p_initial_cash, initial_cash),
         version      = v + 1,
         updated_at   = now()
   where id = p_account;

  return v + 1;
end $$;

revoke all on function public.ledger_replace(text, bigint, numeric, jsonb) from public, anon, authenticated;
grant execute on function public.ledger_replace(text, bigint, numeric, jsonb) to service_role;

-- PostgREST refresca su caché de esquema para ver las tablas nuevas al instante.
notify pgrst, 'reload schema';
