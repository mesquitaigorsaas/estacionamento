-- ============================================================
-- MIGRAÇÃO — DONO OBRIGATÓRIO EM TODAS AS TABELAS
--
-- Hoje `estacionamento_id` aceita vazio. Com as regras de
-- segurança novas, uma linha sem dono fica invisível para TODO
-- MUNDO: não aparece para ninguém e não dá erro. O dado entra no
-- banco e simplesmente some do sistema.
--
-- Este arquivo torna a coluna obrigatória, para que esse tipo de
-- linha não possa mais nascer.
--
-- SÃO DOIS BLOCOS. Rode o 1 primeiro e leia o resultado.
-- ============================================================


-- ------------------------------------------------------------
-- BLOCO 1 — Existe alguma linha órfã?
-- Rode e olhe a coluna "orfas". Se vier tudo zero, pode seguir
-- direto para o bloco 2.
-- ------------------------------------------------------------
select 'auditoria'     as tabela, count(*) as orfas from auditoria     where estacionamento_id is null
union all select 'clientes',      count(*) from clientes      where estacionamento_id is null
union all select 'configuracoes', count(*) from configuracoes where estacionamento_id is null
union all select 'mensalidades',  count(*) from mensalidades  where estacionamento_id is null
union all select 'movimentacoes', count(*) from movimentacoes where estacionamento_id is null
union all select 'pagamentos',    count(*) from pagamentos    where estacionamento_id is null
union all select 'tarifas',       count(*) from tarifas       where estacionamento_id is null
union all select 'usuarios',      count(*) from usuarios      where estacionamento_id is null
union all select 'veiculos',      count(*) from veiculos      where estacionamento_id is null
order by tabela;


-- ------------------------------------------------------------
-- BLOCO 2 — Tornar obrigatório
-- Só rode se o bloco 1 mostrou zero em tudo. Se alguma tabela
-- tiver órfãs, me avise antes: apagar ou adotar essas linhas é
-- decisão sua, não do comando.
--
-- Apague os "--" para rodar.
-- ------------------------------------------------------------
-- alter table auditoria     alter column estacionamento_id set not null;
-- alter table clientes      alter column estacionamento_id set not null;
-- alter table configuracoes alter column estacionamento_id set not null;
-- alter table mensalidades  alter column estacionamento_id set not null;
-- alter table movimentacoes alter column estacionamento_id set not null;
-- alter table pagamentos    alter column estacionamento_id set not null;
-- alter table tarifas       alter column estacionamento_id set not null;
-- alter table usuarios      alter column estacionamento_id set not null;
-- alter table veiculos      alter column estacionamento_id set not null;
