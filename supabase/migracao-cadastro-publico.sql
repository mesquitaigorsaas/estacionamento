-- ============================================================
-- MIGRAÇÃO — CADASTRO PÚBLICO DE ASSINANTES
--
-- Prepara o banco para o novo fluxo:
--   visitante preenche o cadastro -> paga -> você libera
--
-- COMO RODAR: Supabase → SQL Editor → colar tudo → Run.
-- Pode repetir sem problema.
-- ============================================================


-- ------------------------------------------------------------
-- 1. COLUNAS NOVAS EM ESTACIONAMENTOS
-- ------------------------------------------------------------
alter table estacionamentos
  add column if not exists plano text;

comment on column estacionamentos.plano is 'semestral ou anual — qual plano o assinante escolheu';

-- `assinatura_status` passa a ter um estado a mais:
--   aguardando_pagamento -> acabou de se cadastrar, ainda não pagou
--   ativa                -> liberado, entra no sistema
--   suspensa             -> cortado
comment on column estacionamentos.assinatura_status is 'aguardando_pagamento | ativa | suspensa';


-- ------------------------------------------------------------
-- 2. QUEM É O SUPORTE
--
-- Com o isolamento ligado, cada assinante só enxerga a própria
-- linha — inclusive você. Para aprovar cadastros novos é preciso
-- uma marca que diga "esta pessoa é do suporte do SaaS, não de um
-- estacionamento".
-- ------------------------------------------------------------
alter table usuarios
  add column if not exists suporte boolean not null default false;

comment on column usuarios.suporte is 'true = equipe do Achei Vaga; enxerga e libera todos os estacionamentos';

/** O usuário logado é do suporte? */
create or replace function eh_suporte()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select suporte from usuarios where auth_id = auth.uid()), false)
$$;


-- ------------------------------------------------------------
-- 3. REGRAS PARA O SUPORTE
-- Somam-se às que já existem: o assinante continua vendo só a
-- própria linha, e o suporte enxerga todas.
-- ------------------------------------------------------------
drop policy if exists "suporte_ve_estacionamentos" on estacionamentos;
create policy "suporte_ve_estacionamentos" on estacionamentos
  for select using (eh_suporte());

drop policy if exists "suporte_edita_estacionamentos" on estacionamentos;
create policy "suporte_edita_estacionamentos" on estacionamentos
  for update using (eh_suporte()) with check (eh_suporte());


-- ------------------------------------------------------------
-- 4. MARQUE O SEU USUÁRIO COMO SUPORTE
-- Troque o login se o seu for outro.
-- ------------------------------------------------------------
update usuarios
   set suporte = true
 where login = 'igorvmesquita@gmail.com';


-- ------------------------------------------------------------
-- CONFERÊNCIA
-- ------------------------------------------------------------
-- select nome, login, perfil, suporte from usuarios order by suporte desc, nome;
