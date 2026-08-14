// ============================================================
// js/mensalistas.js
// Página: mensalistas.html
// Cadastra novas mensalidades (início/vencimento automáticos),
// lista, edita cadastro e registra pagamento.
// ============================================================

import { exigirLogin, fazerLogout, usuarioAtual } from './auth.js';
import { formatarPlaca, formatarMoeda } from './utils/formatadores.js';
import { placaValida, campoPreenchido } from './utils/validacoes.js';
import { buscarVeiculoPorPlaca, criarClienteEVeiculo, atualizarClienteEVeiculo } from './services/veiculos.js';
import {
  listarMensalidades,
  buscarDiasAvisoVencimento,
  sincronizarStatus,
  criarMensalidade,
  atualizarMensalidade,
} from './services/mensalidades.js';
import { registrarPagamento } from './services/pagamentos.js';

const NOME_PAGINA = 'mensalistas';
let veiculoEncontrado = null;
let diasAviso = 3;
let dataInicioAuto = null;
let vencimentoAuto = null;

// Guarda, enquanto a página estiver aberta, quais mensalidades
// já foram pagas nesta sessão — usado para manter a badge "✔ Pago" visível.
const pagosRecentemente = new Set();

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario);

  diasAviso = await buscarDiasAvisoVencimento();
  await carregarTabela(usuario);

  document.getElementById('form-busca').addEventListener('submit', aoConsultarPlaca);
  document.getElementById('btn-cadastrar-mensalidade').addEventListener('click', aoCadastrarMensalidade);
  document.getElementById('modal-fechar').addEventListener('click', fecharModal);
}

// ------------------------------------------------------------
// Shell (header/sidebar/modal)
// ------------------------------------------------------------
async function montarShell(usuario) {
  const [htmlHeader, htmlSidebar, htmlModal] = await Promise.all([
    fetch('components/header.html').then((r) => r.text()),
    fetch('components/sidebar.html').then((r) => r.text()),
    fetch('components/modal.html').then((r) => r.text()),
  ]);

  document.getElementById('header-container').innerHTML = htmlHeader;
  document.getElementById('sidebar-container').innerHTML = htmlSidebar;
  document.getElementById('modal-container').innerHTML = htmlModal;

  document.getElementById('topo-usuario-nome').textContent = usuario.nome;
  document.getElementById('topo-usuario-perfil').textContent = usuario.perfil;
  document.getElementById('topo-titulo-pagina').textContent = 'Mensalistas';

  document.getElementById('btn-sair').addEventListener('click', fazerLogout);

  document.querySelectorAll('.sidebar-item[data-perfis]').forEach((item) => {
    if (!item.dataset.perfis.split(',').includes(usuario.perfil)) item.remove();
  });

  const itemAtivo = document.querySelector(`.sidebar-item[data-pagina="${NOME_PAGINA}"]`);
  if (itemAtivo) itemAtivo.classList.add('ativo');

  const sidebar = document.getElementById('sidebar');
  document.getElementById('btn-menu-mobile').addEventListener('click', () => sidebar.classList.toggle('aberta'));
}

// ------------------------------------------------------------
// Consultar placa
// ------------------------------------------------------------
async function aoConsultarPlaca(evento) {
  evento.preventDefault();
  esconderAviso();
  document.getElementById('bloco-mensalidade').classList.add('oculto');

  const placa = formatarPlaca(document.getElementById('campo-placa').value);
  document.getElementById('campo-placa').value = placa;

  if (!placaValida(placa)) {
    mostrarAviso('Placa inválida. Use o formato ABC1234 ou ABC1D23.');
    return;
  }

  veiculoEncontrado = await buscarVeiculoPorPlaca(placa);

  document.querySelectorAll('.campo-cliente').forEach((campo) => {
    campo.classList.toggle('oculto', Boolean(veiculoEncontrado));
  });

  const hoje = new Date();
  dataInicioAuto = hoje.toISOString().slice(0, 10);
  const vencimento = new Date(hoje);
  vencimento.setMonth(vencimento.getMonth() + 1);
  vencimentoAuto = vencimento.toISOString().slice(0, 10);

  document.getElementById('texto-vencimento').textContent = vencimento.toLocaleDateString('pt-BR');
  document.getElementById('bloco-mensalidade').classList.remove('oculto');
}

// ------------------------------------------------------------
// Cadastrar mensalidade
// ------------------------------------------------------------
async function aoCadastrarMensalidade() {
  esconderAviso();

  const valor = Number(document.getElementById('campo-valor').value);
  if (!valor) {
    mostrarAviso('Informe o valor mensal.');
    return;
  }

  const placa = formatarPlaca(document.getElementById('campo-placa').value);
  let veiculo = veiculoEncontrado;

  if (!veiculo) {
    const nome = document.getElementById('novo-nome').value.trim();
    if (!campoPreenchido(nome)) {
      mostrarAviso('Informe ao menos o nome do cliente.');
      return;
    }

    const resultado = await criarClienteEVeiculo({
      nome,
      contato: document.getElementById('novo-contato').value.trim(),
      modelo: document.getElementById('novo-modelo').value.trim(),
      cor: document.getElementById('novo-cor').value.trim(),
      placa,
      tipo: 'mensalista',
    });

    if (resultado.erro) {
      mostrarAviso(resultado.erro);
      return;
    }
    veiculo = resultado.veiculo;
  }

  const resultado = await criarMensalidade({
    clienteId: veiculo.cliente_id,
    veiculoId: veiculo.id,
    plano: null,
    valorMensal: valor,
    dataInicio: dataInicioAuto,
    vencimento: vencimentoAuto,
  });

  if (resultado.erro) {
    mostrarAviso(resultado.erro);
    return;
  }

  document.getElementById('form-busca').reset();
  document.getElementById('bloco-mensalidade').classList.add('oculto');
  veiculoEncontrado = null;

  await carregarTabela(usuarioAtual());
}

// ------------------------------------------------------------
// Carregar e renderizar tabela
// ------------------------------------------------------------
async function carregarTabela(usuario) {
  let lista = await listarMensalidades();
  lista = await sincronizarStatus(lista, diasAviso);

  const corpo = document.getElementById('tabela-corpo');
  const mensagemVazio = document.getElementById('mensagem-vazio');

  if (lista.length === 0) {
    corpo.innerHTML = '';
    mensagemVazio.classList.remove('oculto');
    return;
  }
  mensagemVazio.classList.add('oculto');

  const badgePorStatus = {
    em_dia: '<span class="badge badge-sucesso">Em dia</span>',
    vence_em_breve: '<span class="badge badge-alerta">Vence em breve</span>',
    vencido: '<span class="badge badge-perigo">Vencido</span>',
  };

  corpo.innerHTML = lista.map((m) => `
    <tr>
      <td class="tabela-placa">${m.veiculos?.placa ?? '—'}</td>
      <td>${m.clientes?.nome ?? '—'}</td>
      <td>${formatarMoeda(m.valor_mensal)}</td>
      <td>${new Date(`${m.vencimento}T00:00:00`).toLocaleDateString('pt-BR')}</td>
      <td>${badgePorStatus[m.status] ?? m.status}</td>
      <td class="tabela-acoes">
        <button class="btn btn-secundario" data-ver="${m.id}" style="padding:6px 12px; font-size:0.8125rem;">✏️ Editar</button>
        ${pagosRecentemente.has(m.id) ? '<span class="badge badge-sucesso">✔ Pago</span>' : ''}
        <button class="btn btn-secundario" data-pagar="${m.id}" style="padding:6px 12px; font-size:0.8125rem;">Registrar pagamento</button>
      </td>
    </tr>
  `).join('');

  corpo.querySelectorAll('[data-pagar]').forEach((botao) => {
    const mensalidade = lista.find((m) => m.id === botao.dataset.pagar);
    botao.addEventListener('click', () => abrirModalPagamento(mensalidade, usuario));
  });

  corpo.querySelectorAll('[data-ver]').forEach((botao) => {
    const mensalidade = lista.find((m) => m.id === botao.dataset.ver);
    botao.addEventListener('click', () => abrirModalVerEditar(mensalidade, usuario));
  });
}

// ------------------------------------------------------------
// Modal: Ver / editar cadastro (cliente + veículo + mensalidade)
// ------------------------------------------------------------
function abrirModalVerEditar(mensalidade, usuario) {
  const cliente = mensalidade.clientes;
  const veiculo = mensalidade.veiculos;

  document.getElementById('modal-titulo').textContent = `Cadastro — ${veiculo?.placa ?? ''}`;
  document.getElementById('modal-corpo').innerHTML = `
    <form id="form-ver-editar">
      <div class="campo">
        <label for="ver-nome">Nome</label>
        <input type="text" id="ver-nome" value="${escapeAtributo(cliente?.nome ?? '')}" required />
      </div>
      <div class="campo">
        <label for="ver-contato">Telefone</label>
        <input type="text" id="ver-contato" value="${escapeAtributo(cliente?.contato ?? '')}" />
      </div>
      <div class="campo">
        <label for="ver-modelo">Modelo do veículo</label>
        <input type="text" id="ver-modelo" value="${escapeAtributo(veiculo?.modelo ?? '')}" />
      </div>
      <div class="campo">
        <label for="ver-cor">Cor</label>
        <input type="text" id="ver-cor" value="${escapeAtributo(veiculo?.cor ?? '')}" />
      </div>
      <div class="campo">
        <label for="ver-valor">Valor mensal (R$)</label>
        <input type="number" id="ver-valor" step="0.01" min="0" value="${mensalidade.valor_mensal}" required />
      </div>
      <div class="campo">
        <label for="ver-vencimento">Vencimento</label>
        <input type="date" id="ver-vencimento" value="${mensalidade.vencimento}" required />
      </div>
      <div id="modal-erro" class="login-erro oculto"></div>
      <div class="modal-rodape">
        <button type="button" id="btn-cancelar-modal" class="btn btn-secundario">Cancelar</button>
        <button type="submit" class="btn btn-primario">Salvar</button>
      </div>
    </form>
  `;

  document.getElementById('btn-cancelar-modal').addEventListener('click', fecharModal);
  document.getElementById('form-ver-editar').addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const resultadoCliente = await atualizarClienteEVeiculo({
      clienteId: mensalidade.cliente_id,
      veiculoId: mensalidade.veiculo_id,
      nome: document.getElementById('ver-nome').value.trim(),
      contato: document.getElementById('ver-contato').value.trim(),
      tipo: 'mensalista',
      modelo: document.getElementById('ver-modelo').value.trim(),
      cor: document.getElementById('ver-cor').value.trim(),
    });

    if (resultadoCliente.erro) {
      mostrarErroModal(resultadoCliente.erro);
      return;
    }

    const resultadoMensalidade = await atualizarMensalidade(mensalidade.id, {
      valorMensal: Number(document.getElementById('ver-valor').value),
      vencimento: document.getElementById('ver-vencimento').value,
    });

    if (resultadoMensalidade.erro) {
      mostrarErroModal(resultadoMensalidade.erro);
      return;
    }

    fecharModal();
    await carregarTabela(usuario);
  });

  document.getElementById('modal-overlay').classList.remove('oculto');
}

// ------------------------------------------------------------
// Modal de pagamento
// ------------------------------------------------------------
function abrirModalPagamento(mensalidade, usuario) {
  document.getElementById('modal-titulo').textContent = `Pagamento — ${mensalidade.veiculos?.placa ?? ''}`;
  document.getElementById('modal-corpo').innerHTML = `
    <form id="form-pagamento">
      <div class="campo">
        <label for="pag-valor">Valor recebido (R$)</label>
        <input type="number" id="pag-valor" step="0.01" min="0" value="${mensalidade.valor_mensal}" required />
      </div>
      <div class="campo">
        <label for="pag-forma">Forma de pagamento</label>
        <select id="pag-forma">
          <option value="dinheiro">Dinheiro</option>
          <option value="pix">Pix</option>
          <option value="cartao">Cartão</option>
        </select>
      </div>
      <p class="texto-suave">O vencimento será renovado automaticamente em +1 mês.</p>
      <div id="modal-erro" class="login-erro oculto"></div>
      <div class="modal-rodape">
        <button type="button" id="btn-cancelar-modal" class="btn btn-secundario">Cancelar</button>
        <button type="submit" class="btn btn-primario">Confirmar pagamento</button>
      </div>
    </form>
  `;

  document.getElementById('btn-cancelar-modal').addEventListener('click', fecharModal);
  document.getElementById('form-pagamento').addEventListener('submit', async (evento) => {
    evento.preventDefault();

    const resultado = await registrarPagamento({
      mensalidadeId: mensalidade.id,
      usuarioId: usuario.id,
      valor: Number(document.getElementById('pag-valor').value),
      formaPagamento: document.getElementById('pag-forma').value,
      vencimentoAtual: mensalidade.vencimento,
    });

    if (resultado.erro) {
      mostrarErroModal(resultado.erro);
      return;
    }

    fecharModal();
    pagosRecentemente.add(mensalidade.id);
    await carregarTabela(usuario);
  });

  document.getElementById('modal-overlay').classList.remove('oculto');
}

function fecharModal() {
  document.getElementById('modal-overlay').classList.add('oculto');
}

function mostrarErroModal(mensagem) {
  const divErro = document.getElementById('modal-erro');
  divErro.textContent = mensagem;
  divErro.classList.remove('oculto');
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
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