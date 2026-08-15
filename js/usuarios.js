// ============================================================
// js/usuarios.js
// Página: usuarios.html (só administrador acessa)
// Cadastra, edita, reseta senha e exclui usuários do sistema.
// As operações que mexem em autenticação (criar/resetar senha/
// excluir) passam pela Edge Function "admin-usuarios", que roda
// no servidor com a service role key — nunca é feito na mão
// direto no navegador.
// ============================================================

import { exigirLogin } from './auth.js';
import { montarShell } from './utils/layout.js';
import { supabase } from './supabase.js';
import { campoPreenchido } from './utils/validacoes.js';

const NOME_PAGINA = 'usuarios';
let listaCompleta = [];
let usuarioLogado = null;

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;
  usuarioLogado = usuario;

  await montarShell(usuario, NOME_PAGINA, 'Usuários');
  document.getElementById('modal-container').innerHTML = await fetch('components/modal.html').then((r) => r.text());

  await carregarTabela();

  document.getElementById('form-novo-usuario').addEventListener('submit', aoCadastrarUsuario);
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
}

// ------------------------------------------------------------
// Carregar e renderizar tabela
// ------------------------------------------------------------
async function carregarTabela() {
  const { data, error } = await supabase.from('usuarios').select('*').order('nome');

  if (error) {
    console.error('Erro ao carregar usuários:', error.message);
    listaCompleta = [];
  } else {
    listaCompleta = data;
  }

  renderizarLinhas(listaCompleta);
}

function renderizarLinhas(lista) {
  const corpo = document.getElementById('tabela-corpo');
  const mensagemVazio = document.getElementById('mensagem-vazio');

  if (lista.length === 0) {
    corpo.innerHTML = '';
    mensagemVazio.classList.remove('oculto');
    return;
  }
  mensagemVazio.classList.add('oculto');

  const nomesPerfil = { administrador: 'Administrador', gerente: 'Gerente', operador: 'Operador' };

  corpo.innerHTML = lista.map((u) => `
    <tr>
      <td class="tabela-placa" data-label="Nome">${u.nome}</td>
      <td data-label="Login">${u.login}</td>
      <td data-label="Perfil">${nomesPerfil[u.perfil] ?? u.perfil}</td>
      <td data-label="Status">
        <span class="badge ${u.ativo ? 'badge-sucesso' : 'badge-perigo'}">${u.ativo ? 'Ativo' : 'Inativo'}</span>
      </td>
      <td class="tabela-acoes" data-label="Ações">
        <button class="btn btn-secundario" data-editar="${u.id}" style="padding:6px 12px; font-size:0.8125rem;">✏️ Editar</button>
        <button class="btn btn-secundario" data-resetar="${u.id}" style="padding:6px 12px; font-size:0.8125rem;">🔑 Resetar senha</button>
        ${u.id !== usuarioLogado.id ? `<button class="btn btn-perigo" data-excluir="${u.id}" style="padding:6px 12px; font-size:0.8125rem;">🗑️ Excluir</button>` : ''}
      </td>
    </tr>
  `).join('');

  corpo.querySelectorAll('[data-editar]').forEach((botao) => {
    const usuario = lista.find((u) => u.id === botao.dataset.editar);
    botao.addEventListener('click', () => abrirModalEditar(usuario));
  });

  corpo.querySelectorAll('[data-resetar]').forEach((botao) => {
    const usuario = lista.find((u) => u.id === botao.dataset.resetar);
    botao.addEventListener('click', () => abrirModalResetarSenha(usuario));
  });

  corpo.querySelectorAll('[data-excluir]').forEach((botao) => {
    const usuario = lista.find((u) => u.id === botao.dataset.excluir);
    botao.addEventListener('click', () => confirmarExclusao(usuario));
  });
}

// ------------------------------------------------------------
// Cadastrar novo usuário
// ------------------------------------------------------------
async function aoCadastrarUsuario(evento) {
  evento.preventDefault();
  esconderAviso();

  const nome = document.getElementById('novo-usuario-nome').value.trim();
  const login = document.getElementById('novo-usuario-login').value.trim();
  const senha = document.getElementById('novo-usuario-senha').value;
  const perfil = document.getElementById('novo-usuario-perfil').value;

  if (!campoPreenchido(nome) || !campoPreenchido(login) || !senha || !perfil) {
    mostrarAviso('Preencha todos os campos.');
    return;
  }
  if (senha.length < 6) {
    mostrarAviso('A senha precisa ter pelo menos 6 caracteres.');
    return;
  }

  const btn = document.getElementById('btn-cadastrar-usuario');
  btn.disabled = true;
  btn.textContent = 'Cadastrando...';

  const { data, error } = await supabase.functions.invoke('admin-usuarios', {
    body: { acao: 'criar', nome, login, senha, perfil },
  });

  btn.disabled = false;
  btn.textContent = 'Cadastrar usuário';

  if (error || data?.erro) {
    mostrarAviso(data?.erro ?? error.message ?? 'Erro ao cadastrar usuário.');
    return;
  }

  document.getElementById('form-novo-usuario').reset();
  await carregarTabela();
}

// ------------------------------------------------------------
// Modal: editar (nome, perfil, status — login/senha não mudam aqui)
// ------------------------------------------------------------
function abrirModalEditar(usuario) {
  const ehVoceMesmo = usuario.id === usuarioLogado.id;

  document.getElementById('modal-titulo').textContent = `Editar — ${usuario.nome}`;
  document.getElementById('modal-corpo').innerHTML = `
    <form id="form-editar-usuario">
      <div class="campo">
        <label for="edit-nome">Nome</label>
        <input type="text" id="edit-nome" value="${escapeAtributo(usuario.nome)}" required />
      </div>
      <div class="campo">
        <label for="edit-perfil">Perfil</label>
        <select id="edit-perfil">
          <option value="operador" ${usuario.perfil === 'operador' ? 'selected' : ''}>Operador</option>
          <option value="gerente" ${usuario.perfil === 'gerente' ? 'selected' : ''}>Gerente</option>
          <option value="administrador" ${usuario.perfil === 'administrador' ? 'selected' : ''}>Administrador</option>
        </select>
      </div>
      <div class="campo">
        <label for="edit-ativo">Status</label>
        <select id="edit-ativo" ${ehVoceMesmo ? 'disabled' : ''}>
          <option value="true" ${usuario.ativo ? 'selected' : ''}>Ativo</option>
          <option value="false" ${!usuario.ativo ? 'selected' : ''}>Inativo</option>
        </select>
        ${ehVoceMesmo ? '<p class="texto-suave" style="margin-top:6px;">Você não pode desativar seu próprio usuário.</p>' : ''}
      </div>
      <div id="modal-erro" class="login-erro oculto"></div>
      <div class="modal-rodape">
        <button type="button" id="btn-cancelar-modal" class="btn btn-secundario">Cancelar</button>
        <button type="submit" class="btn btn-primario">Salvar</button>
      </div>
    </form>
  `;

  document.getElementById('btn-cancelar-modal').addEventListener('click', fecharModal);
  document.getElementById('form-editar-usuario').addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const { error } = await supabase
      .from('usuarios')
      .update({
        nome: document.getElementById('edit-nome').value.trim(),
        perfil: document.getElementById('edit-perfil').value,
        ativo: ehVoceMesmo ? true : document.getElementById('edit-ativo').value === 'true',
      })
      .eq('id', usuario.id);

    if (error) {
      mostrarErroModal(error.message);
      return;
    }

    fecharModal();
    await carregarTabela();
  });

  document.getElementById('modal-overlay').classList.remove('oculto');
}

// ------------------------------------------------------------
// Modal: resetar senha
// ------------------------------------------------------------
function abrirModalResetarSenha(usuario) {
  document.getElementById('modal-titulo').textContent = `Resetar senha — ${usuario.nome}`;
  document.getElementById('modal-corpo').innerHTML = `
    <form id="form-resetar-senha">
      <div class="campo">
        <label for="nova-senha">Nova senha temporária</label>
        <input type="text" id="nova-senha" minlength="6" required />
      </div>
      <div id="modal-erro" class="login-erro oculto"></div>
      <div class="modal-rodape">
        <button type="button" id="btn-cancelar-modal" class="btn btn-secundario">Cancelar</button>
        <button type="submit" class="btn btn-primario">Confirmar</button>
      </div>
    </form>
  `;

  document.getElementById('btn-cancelar-modal').addEventListener('click', fecharModal);
  document.getElementById('form-resetar-senha').addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const novaSenha = document.getElementById('nova-senha').value;
    const { data, error } = await supabase.functions.invoke('admin-usuarios', {
      body: { acao: 'resetar_senha', usuarioId: usuario.id, novaSenha },
    });

    if (error || data?.erro) {
      mostrarErroModal(data?.erro ?? error.message ?? 'Erro ao resetar senha.');
      return;
    }

    fecharModal();
  });

  document.getElementById('modal-overlay').classList.remove('oculto');
}

// ------------------------------------------------------------
// Excluir
// ------------------------------------------------------------
async function confirmarExclusao(usuario) {
  const confirmou = confirm(`Excluir o usuário "${usuario.nome}"? Essa ação não pode ser desfeita.`);
  if (!confirmou) return;

  const { data, error } = await supabase.functions.invoke('admin-usuarios', {
    body: { acao: 'deletar', usuarioId: usuario.id },
  });

  if (error || data?.erro) {
    alert(data?.erro ?? error.message ?? 'Erro ao excluir usuário.');
    return;
  }

  await carregarTabela();
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.add('oculto');
}

function mostrarErroModal(mensagem) {
  const divErro = document.getElementById('modal-erro');
  divErro.textContent = mensagem;
  divErro.classList.remove('oculto');
}

function mostrarAviso(mensagem) {
  const div = document.getElementById('aviso');
  div.textContent = mensagem;
  div.classList.remove('oculto');
}

function esconderAviso() {
  document.getElementById('aviso').classList.add('oculto');
}

function escapeAtributo(texto) {
  return String(texto).replace(/"/g, '&quot;');
}

iniciar();
