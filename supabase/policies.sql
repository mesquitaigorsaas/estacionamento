-- ============================================================
-- REGRAS DE SEGURANÇA (RLS) — ISOLAMENTO ENTRE ESTACIONAMENTOS
--
-- Este arquivo SUBSTITUI as regras antigas, que só perguntavam
-- "você está logado?". Como todo assinante está logado, qualquer
-- um conseguia ler os dados de qualquer outro indo direto na API,
-- sem passar pela tela.
--
-- Agora cada regra pergunta também "este dado é do SEU
-- estacionamento?". A barreira passa a ser do banco, não da
-- interface — quem tentar buscar dado alheio recebe lista vazia.
--
-- COMO RODAR: Supabase → SQL Editor → colar tudo → Run.
-- É seguro repetir: o arquivo apaga as regras antigas antes de
-- criar as novas, então rodar duas vezes dá o mesmo resultado.
-- ============================================================


-- ------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES
--
-- security definer: rodam com o poder de quem as criou, então
-- conseguem ler a tabela `usuarios` sem cair na própria regra de
-- segurança (o que criaria uma consulta infinita).
-- ------------------------------------------------------------

/** Estacionamento do usuário logado. */
create or replace function meu_estacionamento()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select estacionamento_id from usuarios where auth_id = auth.uid()
$$;

/** Perfil do usuário logado: administrador, gerente ou operador. */
create or replace function perfil_atual()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select perfil from usuarios where auth_id = auth.uid()
$$;


-- ------------------------------------------------------------
-- 2. LIMPEZA
-- Apaga todas as regras atuais das tabelas que vamos proteger.
-- ------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in (
         'estacionamentos', 'usuarios', 'clientes', 'veiculos', 'tarifas',
         'movimentacoes', 'mensalidades', 'pagamentos', 'auditoria', 'configuracoes'
       )
  loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;


-- ------------------------------------------------------------
-- 3. RLS LIGADO EM TUDO
-- ------------------------------------------------------------
alter table estacionamentos enable row level security;
alter table usuarios        enable row level security;
alter table clientes        enable row level security;
alter table veiculos        enable row level security;
alter table tarifas         enable row level security;
alter table movimentacoes   enable row level security;
alter table mensalidades    enable row level security;
alter table pagamentos      enable row level security;
alter table auditoria       enable row level security;
alter table configuracoes   enable row level security;


-- ------------------------------------------------------------
-- 4. ESTACIONAMENTOS
-- Cada assinante enxerga e edita só a própria linha. Ninguém
-- cria nem apaga estacionamento pelo navegador: isso é do
-- suporte, que age pelo painel do Supabase.
-- ------------------------------------------------------------
create policy "estacionamento_proprio_select" on estacionamentos
  for select using (id = meu_estacionamento());

create policy "estacionamento_proprio_update" on estacionamentos
  for update
  using (id = meu_estacionamento() and perfil_atual() = 'administrador')
  with check (id = meu_estacionamento());


-- ------------------------------------------------------------
-- 5. USUARIOS
-- A equipe enxerga os colegas do próprio estacionamento.
-- Criar, editar e excluir é só do administrador — e só dentro
-- do estacionamento dele.
-- ------------------------------------------------------------
create policy "usuarios_do_estacionamento_select" on usuarios
  for select using (estacionamento_id = meu_estacionamento());

create policy "usuarios_do_estacionamento_insert" on usuarios
  for insert
  with check (estacionamento_id = meu_estacionamento() and perfil_atual() = 'administrador');

create policy "usuarios_do_estacionamento_update" on usuarios
  for update
  using (estacionamento_id = meu_estacionamento() and perfil_atual() = 'administrador')
  with check (estacionamento_id = meu_estacionamento());

create policy "usuarios_do_estacionamento_delete" on usuarios
  for delete
  using (estacionamento_id = meu_estacionamento() and perfil_atual() = 'administrador');


-- ------------------------------------------------------------
-- 6. OPERAÇÃO DO DIA A DIA
-- Clientes, veículos e movimentações: qualquer funcionário do
-- estacionamento mexe, porque é o trabalho dele. O que muda é
-- que agora só alcança o que é do próprio estacionamento.
-- ------------------------------------------------------------
create policy "clientes_do_estacionamento" on clientes
  for all
  using (estacionamento_id = meu_estacionamento())
  with check (estacionamento_id = meu_estacionamento());

create policy "veiculos_do_estacionamento" on veiculos
  for all
  using (estacionamento_id = meu_estacionamento())
  with check (estacionamento_id = meu_estacionamento());

create policy "movimentacoes_do_estacionamento" on movimentacoes
  for all
  using (estacionamento_id = meu_estacionamento())
  with check (estacionamento_id = meu_estacionamento());


-- ------------------------------------------------------------
-- 7. TARIFAS
-- Leitura para a equipe; alteração só para quem manda.
-- (Tabela herdada: o preço hoje vem de `estacionamentos`.)
-- ------------------------------------------------------------
create policy "tarifas_do_estacionamento_select" on tarifas
  for select using (estacionamento_id = meu_estacionamento());

create policy "tarifas_do_estacionamento_write" on tarifas
  for all
  using (estacionamento_id = meu_estacionamento() and perfil_atual() in ('administrador', 'gerente'))
  with check (estacionamento_id = meu_estacionamento());


-- ------------------------------------------------------------
-- 8. MENSALIDADES E PAGAMENTOS
-- A equipe consulta (a tela de Mensalistas precisa disso), mas
-- só administrador e gerente registram pagamento ou mexem em
-- valor — é dinheiro entrando.
-- ------------------------------------------------------------
create policy "mensalidades_do_estacionamento_select" on mensalidades
  for select using (estacionamento_id = meu_estacionamento());

create policy "mensalidades_do_estacionamento_write" on mensalidades
  for all
  using (estacionamento_id = meu_estacionamento() and perfil_atual() in ('administrador', 'gerente'))
  with check (estacionamento_id = meu_estacionamento());

create policy "pagamentos_do_estacionamento_select" on pagamentos
  for select using (estacionamento_id = meu_estacionamento());

create policy "pagamentos_do_estacionamento_write" on pagamentos
  for all
  using (estacionamento_id = meu_estacionamento() and perfil_atual() in ('administrador', 'gerente'))
  with check (estacionamento_id = meu_estacionamento());


-- ------------------------------------------------------------
-- 9. AUDITORIA
-- Todo funcionário grava (é o sistema que registra as ações),
-- mas só a gerência lê o histórico.
-- ------------------------------------------------------------
create policy "auditoria_do_estacionamento_insert" on auditoria
  for insert with check (estacionamento_id = meu_estacionamento());

create policy "auditoria_do_estacionamento_select" on auditoria
  for select
  using (estacionamento_id = meu_estacionamento() and perfil_atual() in ('administrador', 'gerente'));


-- ------------------------------------------------------------
-- 10. CONFIGURACOES
-- Leitura para a equipe (o sistema consulta ao abrir telas),
-- escrita só do administrador.
-- ------------------------------------------------------------
create policy "configuracoes_do_estacionamento_select" on configuracoes
  for select using (estacionamento_id = meu_estacionamento());

create policy "configuracoes_do_estacionamento_write" on configuracoes
  for all
  using (estacionamento_id = meu_estacionamento() and perfil_atual() = 'administrador')
  with check (estacionamento_id = meu_estacionamento());


-- ------------------------------------------------------------
-- CONFERÊNCIA — rode depois para ver como ficou
-- ------------------------------------------------------------
-- select tablename, policyname, cmd
--   from pg_policies where schemaname = 'public'
--  order by tablename, policyname;
