-- migrations/004_transaction_levels.sql
--
-- Stop y take profit de cada compra (Portafolio → Seguimiento y Chart).
-- Correr DESPUÉS de 003_transactions.sql. Se puede correr más de una vez.
--   stop    precio de salida por pérdida
--   target  precio objetivo (take profit)
-- Solo aplican a compras; el navegador toma los de la última compra del tramo.

alter table public.transactions add column if not exists stop   numeric check (stop > 0);
alter table public.transactions add column if not exists target numeric check (target > 0);

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

  insert into public.transactions (account, id, date, side, ticker, qty, price, sector, note, stop, target, pos)
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
    (r->>'stop')::numeric,
    (r->>'target')::numeric,
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
