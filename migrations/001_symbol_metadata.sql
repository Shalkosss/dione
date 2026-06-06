-- migrations/001_symbol_metadata.sql
-- Cache de metadata estática por símbolo (sector/industry/name desde Finnhub).
-- TTL lógico: 30 días, gestionado en código (lib/finnhub.js).
--
-- Aplicar desde Supabase → SQL editor → New query → pegar y Run.

create table if not exists public.symbol_metadata (
  symbol text primary key,
  sector text,
  industry text,
  name text,
  updated_at timestamptz not null default now()
);

create index if not exists symbol_metadata_updated_at_idx
  on public.symbol_metadata (updated_at desc);

-- RLS: solo service_role lo lee/escribe desde el cron.
alter table public.symbol_metadata enable row level security;
