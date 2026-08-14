// ============================================================
// js/clientes.js
// Página: clientes.html
// Lista, filtra e edita clientes/veículos.
// ============================================================

import { exigirLogin } from './auth.js';
import { montarShell } from './utils/layout.js';
import { listarVeiculos, atualizarClienteEVeiculo } from './services/veiculos.js';

const NOME_PAGINA = 'clientes';
let listaCompleta = [];

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario, NOME_PAGINA, 'Clientes / Veículos');
  document.getElementById('modal-container').innerHTML = await fetch('components/modal.html').then((r) => r.text());

  await carregarTabela();

  document.getElementById('campo-busca').addEventListener('input', aplicarFiltro);
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
}

// ------------------------------------------------------------
// Carregar e renderizar tabela
// ------------------------------------------------------------
async function carregarTabela() {
  listaCompleta = await listarVeiculos();
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

  corpo.innerHTML = lista.map((v) => `
    <tr>
      <td class="tabela-placa" data-label="Placa">${v.placa}</td>
      <td data-label="Nome">${v.clientes?.nome ?? '—'}</td>
      <td data-label="Contato">${v.clientes?.contato ?? '—'}</td>
      <td data-label="Modelo/Cor">${[v.modelo, v.cor].filter(Boolean).join(' — ') || '—'}</td>
      <td data-label="Tipo">
        <span class="badge ${v.clientes?.tipo === 'mensalista' ? 'badge-sucesso' : 'badge-alerta'}">
          ${v.clientes?.tipo === 'mensalista' ? 'Mensalista' : 'Passagem'}
        </span>
      </td>
      <td class="tabela-acoes" data-label="Ações">
        <button class="btn-icone" data-editar="${v.id}" title="Editar">✏️</button>
      </td>
    </tr>
  `).join('');

  corpo.querySelectorAll('[data-editar]').forEach((botao) => {
    botao.addEventListener('click', () => abrirModalEdicao(botao.dataset.editar));
  });
}

// ------------------------------------------------------------
// Filtro de busca (client-side, a lista já foi carregada)
// ------------------------------------------------------------
function aplicarFiltro(evento) {
  const termo = evento.target.value.trim().toLowerCase();
  if (!termo) {
    renderizarLinhas(listaCompleta);
    return;
  }
  const filtrada = listaCompleta.filter((v) =>
    v.placa.toLowerCase().includes(termo) ||
    (v.clientes?.nome ?? '').toLowerCase().includes(termo)
  );
  renderizarLinhas(filtrada);
}

// ------------------------------------------------------------
// Modal de edição
// ------------------------------------------------------------
function abrirModalEdicao(veiculoId) {
  const veiculo = listaCompleta.find((v) => v.id === veiculoId);
  if (!veiculo) return;

  document.getElementById('modal-titulo').textContent = `Editar — ${veiculo.placa}`;
  document.getElementById('modal-corpo').innerHTML = `
    <form id="form-editar">
      <div class="campo">
        <label for="edit-nome">Nome</label>
        <input type="text" id="edit-nome" value="${escapeAtributo(veiculo.clientes?.nome ?? '')}" required />
      </div>
      <div class="campo">
        <label for="edit-contato">Contato</label>
        <input type="text" id="edit-contato" value="${escapeAtributo(veiculo.clientes?.contato ?? '')}" />
      </div>
      <div class="campo">
        <label for="edit-tipo">Tipo de cliente</label>
        <select id="edit-tipo">
          <option value="passagem" ${veiculo.clientes?.tipo === 'passagem' ? 'selected' : ''}>Passagem</option>
          <option value="mensalista" ${veiculo.clientes?.tipo === 'mensalista' ? 'selected' : ''}>Mensalista</option>
        </select>
      </div>
      <div class="campo">
        <label for="edit-modelo">Modelo do veículo</label>
        <input type="text" id="edit-modelo" value="${escapeAtributo(veiculo.modelo ?? '')}" />
      </div>
      <div class="campo">
        <label for="edit-cor">Cor</label>
        <input type="text" id="edit-cor" value="${escapeAtributo(veiculo.cor ?? '')}" />
      </div>
      <div id="modal-erro" class="login-erro oculto"></div>
      <div class="modal-rodape">
        <button type="button" id="btn-cancelar-modal" class="btn btn-secundario">Cancelar</button>
        <button type="submit" class="btn btn-primario">Salvar</button>
      </div>
    </form>
  `;

  document.getElementById('btn-cancelar-modal').addEventListener('click', fecharModal);
  document.getElementById('form-editar').addEventListener('submit', (evento) => salvarEdicao(evento, veiculo));

  document.getElementById('modal-overlay').classList.remove('oculto');
}

async function salvarEdicao(evento, veiculo) {
  evento.preventDefault();

  const resultado = await atualizarClienteEVeiculo({
    clienteId: veiculo.cliente_id,
    veiculoId: veiculo.id,
    nome: document.getElementById('edit-nome').value.trim(),
    contato: document.getElementById('edit-contato').value.trim(),
    tipo: document.getElementById('edit-tipo').value,
    modelo: document.getElementById('edit-modelo').value.trim(),
    cor: document.getElementById('edit-cor').value.trim(),
  });

  if (resultado.erro) {
    const divErro = document.getElementById('modal-erro');
    divErro.textContent = resultado.erro;
    divErro.classList.remove('oculto');
    return;
  }

  fecharModal();
  await carregarTabela();
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.add('oculto');
}

function escapeAtributo(texto) {
  return String(texto).replace(/"/g, '&quot;');
}

iniciar();
