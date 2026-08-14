-- ============================================================
-- SISTEMA DE ESTACIONAMENTO — SCHEMA INICIAL
-- Execute este arquivo inteiro no SQL Editor do Supabase
-- ============================================================

-- Extensão para gerar UUIDs automaticamente
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- USUARIOS (funcionários que acessam o sistema)
-- ------------------------------------------------------------
create table usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid unique references auth.users(id) on delete cascade,
  nome text not null,
  login text unique not null,
  perfil text not null check (perfil in ('administrador', 'gerente', 'operador')),
  ativo boolean default true,
  criado_em timestamptz default now()
);

comment on table usuarios is 'Funcionários vinculados ao login do Supabase Auth';

-- ------------------------------------------------------------
-- CLIENTES (donos de veículo — passagem ou mensalista)
-- ------------------------------------------------------------
create table clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  contato text,
  email text,
  tipo text not null default 'passagem' check (tipo in ('passagem', 'mensalista')),
  criado_em timestamptz default now()
);

-- ------------------------------------------------------------
-- VEICULOS (cada placa é única no sistema)
-- ------------------------------------------------------------
create table veiculos (
  id uuid primary key default gen_random_uuid(),
  placa text unique not null,
  cliente_id uuid references clientes(id) on delete set null,
  modelo text,
  cor text,
  criado_em timestamptz default now()
);

create index idx_veiculos_placa on veiculos (placa);

-- ------------------------------------------------------------
-- TARIFAS (valores cobrados por tipo/hora)
-- ------------------------------------------------------------
create table tarifas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor_hora numeric(10,2) not null,
  valor_fracao numeric(10,2),
  tolerancia_minutos integer default 15,
  ativo boolean default true,
  criado_em timestamptz default now()
);

-- ------------------------------------------------------------
-- MOVIMENTACOES (entrada/saída de veículos)
-- ------------------------------------------------------------
create table movimentacoes (
  id uuid primary key default gen_random_uuid(),
  veiculo_id uuid not null references veiculos(id),
  funcionario_entrada_id uuid references usuarios(id),
  funcionario_saida_id uuid references usuarios(id),
  tarifa_id uuid references tarifas(id),
  tipo text not null check (tipo in ('passagem', 'mensalista')),
  entrada timestamptz not null default now(),
  saida timestamptz,
  valor numeric(10,2),
  status text not null default 'aberta' check (status in ('aberta', 'finalizada', 'cancelada')),
  criado_em timestamptz default now()
);

create index idx_movimentacoes_veiculo on movimentacoes (veiculo_id);
create index idx_movimentacoes_status on movimentacoes (status);

-- ------------------------------------------------------------
-- MENSALIDADES (planos mensais vinculados a um cliente)
-- ------------------------------------------------------------
create table mensalidades (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references clientes(id),
  veiculo_id uuid references veiculos(id),
  plano text,
  valor_mensal numeric(10,2) not null,
  data_inicio date not null default current_date,
  vencimento date not null,
  status text not null default 'em_dia' check (status in ('em_dia', 'vence_em_breve', 'vencido')),
  criado_em timestamptz default now()
);

create index idx_mensalidades_vencimento on mensalidades (vencimento);

-- ------------------------------------------------------------
-- PAGAMENTOS (histórico de pagamentos de mensalidades)
-- ------------------------------------------------------------
create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  mensalidade_id uuid not null references mensalidades(id),
  usuario_id uuid references usuarios(id),
  valor numeric(10,2) not null,
  forma_pagamento text,
  data_pagamento timestamptz default now()
);

-- ------------------------------------------------------------
-- AUDITORIA (registro de quem fez o quê)
-- ------------------------------------------------------------
create table auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references usuarios(id),
  acao text not null,
  entidade text,
  entidade_id uuid,
  detalhes jsonb,
  criado_em timestamptz default now()
);

create index idx_auditoria_criado_em on auditoria (criado_em desc);

-- ------------------------------------------------------------
-- CONFIGURACOES (chave/valor genérico do sistema)
-- ------------------------------------------------------------
create table configuracoes (
  id uuid primary key default gen_random_uuid(),
  chave text unique not null,
  valor text,
  atualizado_em timestamptz default now()
);

-- Configurações padrão iniciais
insert into configuracoes (chave, valor) values
  ('nome_estacionamento', 'Meu Estacionamento'),
  ('dias_aviso_vencimento', '3');
