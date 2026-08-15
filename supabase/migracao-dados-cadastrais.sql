-- ============================================================
-- MIGRAÇÃO — DADOS CADASTRAIS DO ESTACIONAMENTO
-- Adiciona CNPJ, responsável e contato do responsável na
-- tabela `estacionamentos`.
--
-- COMO RODAR: Supabase → SQL Editor → colar → Run.
--
-- ATENÇÃO: são TRÊS blocos, na ordem. Rode o BLOCO 1, depois
-- preencha o BLOCO 2 com os dados reais e rode, e só então
-- rode o BLOCO 3. Os blocos 2 e 3 estão comentados de
-- propósito (com "--" na frente) para não rodarem antes da
-- hora — apague os "--" quando chegar neles.
-- ============================================================


-- ------------------------------------------------------------
-- BLOCO 1 — criar as colunas
-- Nesta etapa elas ainda aceitam vazio, porque o estacionamento
-- que já existe no banco não tem esses dados preenchidos.
-- ------------------------------------------------------------
alter table estacionamentos
  add column if not exists cnpj                text,
  add column if not exists responsavel         text,
  add column if not exists contato_responsavel text;

-- Dois estacionamentos não podem assinar com o mesmo CNPJ.
-- Linhas com CNPJ ainda vazio não são bloqueadas por esta regra.
create unique index if not exists idx_estacionamentos_cnpj
  on estacionamentos (cnpj);

comment on column estacionamentos.cnpj                is 'Somente os 14 dígitos, sem pontos, barra ou traço';
comment on column estacionamentos.responsavel         is 'Nome completo do responsável legal pelo estacionamento';
comment on column estacionamentos.contato_responsavel is 'WhatsApp ou e-mail do responsável';


-- ------------------------------------------------------------
-- BLOCO 2 — preencher o estacionamento que já existe
-- Troque os valores pelos dados reais e apague os "--".
-- ------------------------------------------------------------
-- update estacionamentos
--    set cnpj                = '00000000000000',
--        responsavel         = 'Igor Mesquita',
--        contato_responsavel = '35999999999'
--  where nome = 'Achei Vaga (conta de testes)';


-- ------------------------------------------------------------
-- BLOCO 3 — tornar os três campos obrigatórios
-- Só rode depois que TODO estacionamento da tabela já estiver
-- com os três campos preenchidos. Se faltar algum, o comando
-- falha e nada é alterado (o banco desfaz sozinho).
-- ------------------------------------------------------------
-- alter table estacionamentos
--   alter column cnpj                set not null,
--   alter column responsavel         set not null,
--   alter column contato_responsavel set not null;


-- ------------------------------------------------------------
-- CONFERÊNCIA — rode no final para ver como ficou
-- ------------------------------------------------------------
-- select column_name, data_type, is_nullable
--   from information_schema.columns
--  where table_name = 'estacionamentos'
--  order by ordinal_position;
