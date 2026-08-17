-- ============================================================
-- ACHEI VAGA — ESTRUTURA DO BANCO
--
-- Reescrito em 17/08/2026 lendo o banco de produção coluna por
-- coluna. A versão anterior descrevia o sistema antigo, de um
-- estacionamento só, e recriaria uma estrutura quebrada.
--
-- PARA QUE SERVE: montar o banco do zero num projeto Supabase
-- novo. Não rode no banco que já existe.
--
-- ORDEM: este arquivo primeiro, depois policies.sql.
-- ============================================================

create extension if not exists "pgcrypto";


-- ------------------------------------------------------------
-- ESTACIONAMENTOS — os assinantes do SaaS
-- Toda linha das outras tabelas aponta para uma daqui. É o que
-- separa um cliente do outro.
-- ------------------------------------------------------------
create table estacionamentos (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null,
  cnpj                  text not null,
  responsavel           text not null,
  contato_responsavel   text not null,
  logo_url              text,

  -- Preço praticado por este estacionamento
  minutos_bloco         integer not null default 30,
  valor_bloco           numeric(10,2) not null default 2.50,
  valor_diaria          numeric(10,2),          -- teto do dia; vazio = sem diária
  valor_mensal_padrao   numeric(10,2),          -- sugestão ao cadastrar mensalista
  tolerancia_minutos    integer not null default 0,

  -- Assinatura: 'ativa' libera o login, qualquer outra coisa bloqueia
  assinatura_status     text not null default 'ativa',
  assinatura_vencimento date,

  criado_em             timestamptz not null default now()
);

create unique index idx_estacionamentos_cnpj on estacionamentos (cnpj);

comment on column estacionamentos.tolerancia_minutos is 'Minutos de cortesia. 0 = cobra desde o primeiro minuto';
comment on column estacionamentos.valor_diaria      is 'Teto por dia. Vazio = sem diária, cobra só por blocos';


-- ------------------------------------------------------------
-- USUARIOS — quem acessa o sistema
--
-- `login` é único no sistema inteiro, não por estacionamento.
-- É de propósito: o login vira e-mail interno no Supabase Auth
-- (joao -> joao@estacionamento.local), e e-mail é único global.
-- Na prática funciona como nome de usuário de e-mail: quem
-- chegar depois escolhe outro.
-- ------------------------------------------------------------
create table usuarios (
  id                uuid primary key default gen_random_uuid(),
  auth_id           uuid unique references auth.users(id) on delete cascade,
  estacionamento_id uuid not null references estacionamentos(id),
  nome              text not null,
  login             text unique not null,
  perfil            text not null check (perfil in ('administrador', 'gerente', 'operador')),
  ativo             boolean default true,
  criado_em         timestamptz default now()
);

create index idx_usuarios_estacionamento on usuarios (estacionamento_id);

comment on table usuarios is 'Funcionários. O vínculo com o estacionamento é o que o login usa para checar a assinatura.';


-- ------------------------------------------------------------
-- CLIENTES — donos de veículo
-- ------------------------------------------------------------
create table clientes (
  id                uuid primary key default gen_random_uuid(),
  estacionamento_id uuid not null references estacionamentos(id),
  nome              text not null,
  contato           text,
  email             text,
  tipo              text not null default 'passagem' check (tipo in ('passagem', 'mensalista')),
  criado_em         timestamptz default now()
);

create index idx_clientes_estacionamento on clientes (estacionamento_id);


-- ------------------------------------------------------------
-- VEICULOS
-- A placa é única DENTRO de cada estacionamento — dois
-- assinantes diferentes podem atender o mesmo carro.
-- ------------------------------------------------------------
create table veiculos (
  id                uuid primary key default gen_random_uuid(),
  estacionamento_id uuid not null references estacionamentos(id),
  cliente_id        uuid references clientes(id) on delete set null,
  placa             text not null,
  modelo            text,
  cor               text,
  criado_em         timestamptz default now(),

  unique (estacionamento_id, placa)
);

create index idx_veiculos_placa on veiculos (placa);


-- ------------------------------------------------------------
-- TARIFAS — herdada, hoje sem uso
-- O preço passou a vir de `estacionamentos`. A tabela continua
-- porque `movimentacoes` ainda guarda a referência histórica.
-- ------------------------------------------------------------
create table tarifas (
  id                 uuid primary key default gen_random_uuid(),
  estacionamento_id  uuid not null references estacionamentos(id),
  nome               text not null,
  valor_hora         numeric(10,2) not null,
  valor_fracao       numeric(10,2),
  tolerancia_minutos integer default 15,
  ativo              boolean default true,
  criado_em          timestamptz default now()
);


-- ------------------------------------------------------------
-- MOVIMENTACOES — entrada e saída de cada veículo
-- ------------------------------------------------------------
create table movimentacoes (
  id                     uuid primary key default gen_random_uuid(),
  estacionamento_id      uuid not null references estacionamentos(id),
  veiculo_id             uuid not null references veiculos(id),
  funcionario_entrada_id uuid references usuarios(id),
  funcionario_saida_id   uuid references usuarios(id),
  tarifa_id              uuid references tarifas(id),
  tipo                   text not null check (tipo in ('passagem', 'mensalista')),
  entrada                timestamptz not null default now(),
  saida                  timestamptz,
  valor                  numeric(10,2),
  status                 text not null default 'aberta' check (status in ('aberta', 'finalizada', 'cancelada')),
  criado_em              timestamptz default now()
);

create index idx_movimentacoes_veiculo       on movimentacoes (veiculo_id);
create index idx_movimentacoes_status        on movimentacoes (status);
create index idx_movimentacoes_estacionamento on movimentacoes (estacionamento_id);
create index idx_movimentacoes_saida         on movimentacoes (saida);


-- ------------------------------------------------------------
-- MENSALIDADES
-- `data_inicio` é o dia da assinatura e serve de âncora: quem
-- assinou dia 31 continua vencendo dia 31 mesmo depois de
-- passar por fevereiro.
-- ------------------------------------------------------------
create table mensalidades (
  id                uuid primary key default gen_random_uuid(),
  estacionamento_id uuid not null references estacionamentos(id),
  cliente_id        uuid not null references clientes(id),
  veiculo_id        uuid references veiculos(id),
  plano             text,
  valor_mensal      numeric(10,2) not null,
  data_inicio       date not null default current_date,
  vencimento        date not null,
  status            text not null default 'em_dia' check (status in ('em_dia', 'vence_em_breve', 'vencido')),
  criado_em         timestamptz default now()
);

create index idx_mensalidades_vencimento on mensalidades (vencimento);


-- ------------------------------------------------------------
-- PAGAMENTOS — histórico de mensalidades pagas
-- ------------------------------------------------------------
create table pagamentos (
  id                uuid primary key default gen_random_uuid(),
  estacionamento_id uuid not null references estacionamentos(id),
  mensalidade_id    uuid not null references mensalidades(id),
  usuario_id        uuid references usuarios(id),
  valor             numeric(10,2) not null,
  forma_pagamento   text,
  data_pagamento    timestamptz default now()
);

create index idx_pagamentos_data on pagamentos (data_pagamento);


-- ------------------------------------------------------------
-- AUDITORIA — registro de quem fez o quê
-- ------------------------------------------------------------
create table auditoria (
  id                uuid primary key default gen_random_uuid(),
  estacionamento_id uuid not null references estacionamentos(id),
  usuario_id        uuid references usuarios(id),
  acao              text not null,
  entidade          text,
  entidade_id       uuid,
  detalhes          jsonb,
  criado_em         timestamptz default now()
);

create index idx_auditoria_criado_em on auditoria (criado_em desc);


-- ------------------------------------------------------------
-- CONFIGURACOES — chave/valor por estacionamento
-- ------------------------------------------------------------
create table configuracoes (
  id                uuid primary key default gen_random_uuid(),
  estacionamento_id uuid not null references estacionamentos(id),
  chave             text not null,
  valor             text,
  atualizado_em     timestamptz default now(),

  unique (chave, estacionamento_id)
);


-- ============================================================
-- PRÓXIMO PASSO: rode supabase/policies.sql, que liga as regras
-- de segurança. Sem elas as tabelas ficam inacessíveis.
-- ============================================================
