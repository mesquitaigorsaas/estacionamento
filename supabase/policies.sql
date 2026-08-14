-- ============================================================
-- POLÍTICAS DE SEGURANÇA (RLS)
-- Execute DEPOIS do schema.sql
-- Regra geral: só usuário logado (funcionário) acessa dados.
-- Depois é possível refinar por perfil (admin/gerente/operador).
-- ============================================================

-- Ativa RLS em todas as tabelas
alter table usuarios enable row level security;
alter table clientes enable row level security;
alter table veiculos enable row level security;
alter table tarifas enable row level security;
alter table movimentacoes enable row level security;
alter table mensalidades enable row level security;
alter table pagamentos enable row level security;
alter table auditoria enable row level security;
alter table configuracoes enable row level security;

-- ------------------------------------------------------------
-- Função auxiliar: pega o perfil do usuário autenticado
-- ------------------------------------------------------------
create or replace function perfil_atual()
returns text
language sql
security definer
stable
as $$
  select perfil from usuarios where auth_id = auth.uid();
$$;

-- ------------------------------------------------------------
-- USUARIOS: qualquer funcionário logado pode ler a lista;
-- só administrador pode inserir/editar outros usuários.
-- ------------------------------------------------------------
create policy "usuarios_select" on usuarios
  for select using (auth.role() = 'authenticated');

create policy "usuarios_insert_admin" on usuarios
  for insert with check (perfil_atual() = 'administrador');

create policy "usuarios_update_admin" on usuarios
  for update using (perfil_atual() = 'administrador');

-- ------------------------------------------------------------
-- CLIENTES / VEICULOS / TARIFAS: leitura e escrita para
-- qualquer funcionário autenticado (operação do dia a dia).
-- ------------------------------------------------------------
create policy "clientes_all" on clientes
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "veiculos_all" on veiculos
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "tarifas_select" on tarifas
  for select using (auth.role() = 'authenticated');

create policy "tarifas_write_gerencia" on tarifas
  for all using (perfil_atual() in ('administrador', 'gerente'))
  with check (perfil_atual() in ('administrador', 'gerente'));

-- ------------------------------------------------------------
-- CADASTRO PÚBLICO: a aba "Cadastrar cliente" da tela inicial
-- roda SEM login de funcionário, então precisa de uma política
-- separada permitindo inserir (nunca ler) como visitante anônimo.
-- ------------------------------------------------------------
create policy "clientes_insert_publico" on clientes
  for insert to anon
  with check (true);

create policy "veiculos_insert_publico" on veiculos
  for insert to anon
  with check (true);

-- ------------------------------------------------------------
-- MOVIMENTACOES: qualquer funcionário registra entrada/saída
-- ------------------------------------------------------------
create policy "movimentacoes_all" on movimentacoes
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ------------------------------------------------------------
-- MENSALIDADES / PAGAMENTOS: leitura geral, escrita restrita
-- a administrador/gerente (financeiro sensível)
-- ------------------------------------------------------------
create policy "mensalidades_select" on mensalidades
  for select using (auth.role() = 'authenticated');

create policy "mensalidades_write_gerencia" on mensalidades
  for all using (perfil_atual() in ('administrador', 'gerente'))
  with check (perfil_atual() in ('administrador', 'gerente'));

create policy "pagamentos_select" on pagamentos
  for select using (auth.role() = 'authenticated');

create policy "pagamentos_write_gerencia" on pagamentos
  for all using (perfil_atual() in ('administrador', 'gerente'))
  with check (perfil_atual() in ('administrador', 'gerente'));

-- ------------------------------------------------------------
-- AUDITORIA: todo funcionário pode inserir (o próprio sistema
-- grava), só administrador/gerente podem ler o histórico.
-- ------------------------------------------------------------
create policy "auditoria_insert" on auditoria
  for insert with check (auth.role() = 'authenticated');

create policy "auditoria_select_gerencia" on auditoria
  for select using (perfil_atual() in ('administrador', 'gerente'));

-- ------------------------------------------------------------
-- CONFIGURACOES: leitura geral, escrita só administrador
-- ------------------------------------------------------------
create policy "configuracoes_select" on configuracoes
  for select using (auth.role() = 'authenticated');

create policy "configuracoes_write_admin" on configuracoes
  for all using (perfil_atual() = 'administrador')
  with check (perfil_atual() = 'administrador');
