-- Pedidos recebidos, chamadas ao modelo e lançamentos no Bling.
-- O app acessa com a service role (servidor); o RLS fica ligado e sem políticas
-- públicas para que a chave anon não leia nada.

create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  origem text not null check (origem in ('texto', 'pdf', 'exemplo')),
  texto_original text not null,
  provider text not null,
  pedido jsonb,
  confianca numeric(3, 2) not null default 0,
  motivos jsonb not null default '[]'::jsonb,
  status text not null check (status in ('revisao', 'pronto', 'lancado', 'erro')),
  erro text,
  revisado_em timestamptz,
  chave_idempotencia text
);

create index if not exists pedidos_status_idx on pedidos (status, criado_em desc);

create table if not exists chamadas_modelo (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  pedido_id uuid references pedidos (id) on delete set null,
  provider text not null,
  model text not null,
  tentativa smallint not null,
  input_tokens integer not null,
  output_tokens integer not null,
  custo_usd numeric(12, 6) not null,
  latencia_ms numeric(10, 2) not null,
  ok boolean not null,
  simulado boolean not null default false,
  erro text
);

create index if not exists chamadas_modelo_criado_idx on chamadas_modelo (criado_em desc);

-- A chave é primary key: é ela que impede lançar o mesmo pedido duas vezes,
-- inclusive com duas requisições simultâneas.
create table if not exists lancamentos_bling (
  chave text primary key,
  pedido_id uuid not null references pedidos (id) on delete cascade,
  status text not null check (status in ('reservado', 'concluido')),
  modo text check (modo in ('sandbox', 'live')),
  bling_id bigint,
  payload jsonb,
  criado_em timestamptz not null default now()
);

-- O Bling troca o refresh token a cada renovação. O token vigente fica aqui,
-- não em variável de ambiente, senão a próxima instância usaria um token morto.
create table if not exists bling_tokens (
  id smallint primary key default 1 check (id = 1),
  refresh_token text not null,
  atualizado_em timestamptz not null default now()
);

alter table pedidos enable row level security;
alter table bling_tokens enable row level security;
alter table chamadas_modelo enable row level security;
alter table lancamentos_bling enable row level security;

-- Visão usada para conferir o painel direto no SQL.
create or replace view resumo_custo_diario with (security_invoker = true) as
select
  date_trunc('day', criado_em) as dia,
  model,
  count(*) as chamadas,
  sum(input_tokens) as tokens_entrada,
  sum(output_tokens) as tokens_saida,
  sum(custo_usd) as custo_usd,
  percentile_cont(0.95) within group (order by latencia_ms) as p95_ms
from chamadas_modelo
group by 1, 2;
