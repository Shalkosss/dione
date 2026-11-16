-- migrations/002_theses.sql
-- Tracker de tesis (Fase 1 del roadmap). Spec: project-docs/THESIS_LOG.md.
--
--   theses        una fila por /deep o /quick con rating (bloque dione-thesis-v2
--                 más las columnas que mantiene el cron refresh-theses).
--   thesis_marks  una fila por tesis y día: precio, SPY, ETF sectorial y estado.
--
-- Aplicar desde Supabase → SQL editor → New query → pegar y Run.
-- Es idempotente: se puede correr más de una vez.

create table if not exists public.theses (
  -- bloque dione-thesis-v2
  id              text primary key,
  schema_version  text not null default 'dione-thesis-v2',
  ticker          text not null,
  entry_date      date not null,
  account         text not null default 'paper',
  rating          text not null check (rating in ('BUY', 'WATCH', 'AVOID')),
  conviction      integer,
  thesis_mode     text,
  sector          text,
  sector_etf      text,
  cap             text,
  ref_price       numeric,
  spy_ref         numeric,
  order_type      text not null default 'SIN_ORDEN' check (order_type in ('LIMIT', 'MARKET', 'SIN_ORDEN')),
  entry           numeric,
  valid_until     date,
  stop            numeric,
  tp1             numeric,
  target_3m       numeric,
  target_12m      numeric,
  size_pct        numeric,
  time_stop       date,
  trend_label     text,
  regime          text,
  sector_view     text,
  next_earnings   date,
  er_bear numeric, er_base numeric, er_bull numeric,
  p_bear  numeric, p_base  numeric, p_bull  numeric,
  invalidation    text,
  thesis_text     text,
  post_mortem     text,
  reviewed_at     date,
  manual_close    jsonb,          -- { date, price, reason: 'TESIS' | 'TIEMPO' }
  raw_json        jsonb,          -- bloque original tal como llegó

  -- columnas que mantiene el tracker (lib/thesisTracker.js)
  status          text not null default 'SIN_ORDEN' check (status in (
                    'SIN_ORDEN', 'ARMADA', 'ABIERTA', 'CERRADA_TP', 'CERRADA_STOP',
                    'CERRADA_TIEMPO', 'CERRADA_TESIS', 'EXPIRADA', 'INVALIDADA')),
  filled_at       date,
  fill_price      numeric,
  closed_at       date,
  close_price     numeric,
  close_reason    text,
  r_multiple      numeric,
  tp1_hit_at      date,
  sessions_to_fill integer,
  sessions_tracked integer not null default 0,
  tracking_done   boolean not null default false,
  flags           jsonb not null default '[]'::jsonb,
  perf            jsonb,          -- retorno y alfa a 20/60/120 sesiones desde ref_price
  last_checked    date,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists theses_status_idx on public.theses (status);
create index if not exists theses_entry_date_idx on public.theses (entry_date desc);
create index if not exists theses_tracking_idx on public.theses (tracking_done) where tracking_done = false;

create table if not exists public.thesis_marks (
  thesis_id         text not null references public.theses (id) on delete cascade,
  date              date not null,
  close             numeric not null,
  high              numeric,
  low               numeric,
  spy_close         numeric,
  sector_etf_close  numeric,
  status            text not null,
  primary key (thesis_id, date)
);

-- RLS activado y sin policies: solo la service_role (endpoints y cron en
-- Vercel) lee y escribe. El navegador pasa siempre por /api/theses.
alter table public.theses enable row level security;
alter table public.thesis_marks enable row level security;

-- Migración de lo que exista en la tabla anterior `thesis_log` (v1).
-- Las tesis viejas entran como BUY a mercado en su fecha de entrada; el cron
-- reconstruye su estado desde los precios. Un cierre manual previo se respeta
-- vía manual_close. Si `thesis_log` no existe o su forma es distinta, avisa
-- con un NOTICE y sigue: las tablas nuevas quedan creadas igual.
do $$
begin
  if to_regclass('public.thesis_log') is null then
    raise notice 'thesis_log no existe: nada que migrar';
    return;
  end if;
  begin
    execute $m$
      insert into public.theses (
        id, schema_version, ticker, entry_date, rating, order_type, conviction,
        thesis_mode, sector, cap, ref_price, entry, stop, target_3m, target_12m,
        er_bear, er_base, er_bull, invalidation, thesis_text, raw_json,
        status, filled_at, fill_price, manual_close
      )
      select
        upper(l.ticker) || '-' || (l.entry_date::date)::text,
        'thesis_log-v1',
        upper(l.ticker),
        l.entry_date::date,
        'BUY',
        'MARKET',
        case lower(l.conviction::text)
          when 'low' then 2 when 'medium' then 3 when 'high' then 4
          else nullif(substring(l.conviction::text from '^[1-5]$'), '')::integer
        end,
        l.thesis_mode, l.sector, l.cap,
        l.entry::numeric, l.entry::numeric, l.stop::numeric,
        l.target_3m::numeric, l.target_12m::numeric,
        l.er_bear::numeric, l.er_base::numeric, l.er_bull::numeric,
        l.invalidation, l.thesis_text, l.raw_json,
        'ABIERTA', l.entry_date::date, l.entry::numeric,
        case
          when l.status in ('closed', 'expired') and l.close_date is not null
          then jsonb_build_object('date', (l.close_date::date)::text, 'price', l.close_price::numeric, 'reason', 'TESIS')
        end
      from public.thesis_log l
      where l.ticker is not null
        and l.entry_date is not null
        and l.entry::numeric > 0
        and l.stop::numeric > 0
        and l.stop::numeric < l.entry::numeric
      on conflict (id) do nothing
    $m$;
  exception when others then
    raise notice 'thesis_log no se migró (%). Revisar columnas y migrar a mano.', sqlerrm;
  end;
end $$;
