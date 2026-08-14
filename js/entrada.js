// ============================================================
// js/entrada.js
// Página: entrada.html
// Busca placa → autopreenche ou cadastra → registra entrada → imprime.
// ============================================================

import { exigirLogin, fazerLogout } from './auth.js';
import { formatarPlaca, formatarHora } from './utils/formatadores.js';
import { placaValida, campoPreenchido } from './utils/validacoes.js';
import { buscarVeiculoPorPlaca, criarClienteEVeiculo } from './services/veiculos.js';
import { buscarMovimentacaoAberta, abrirMovimentacao, buscarTarifaPadrao } from './services/movimentacoes.js';

const NOME_PAGINA = 'entrada';

let veiculoEncontrado = null; // guarda o veículo já existente, se houver
let tarifaPadrao = null;

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario);
  tarifaPadrao = await buscarTarifaPadrao();

  if (!tarifaPadrao) {
    mostrarAviso('Nenhuma tarifa ativa cadastrada. Cadastre uma tarifa em Configurações antes de registrar entradas.');
  }

  document.getElementById('form-busca').addEventListener('submit', aoConsultarPlaca);
  document.getElementById('btn-registrar-entrada').addEventListener('click', () => aoRegistrarEntrada(usuario));
}

// ------------------------------------------------------------
// Shell (header/sidebar) — mesmo padrão do dashboard.js
// ------------------------------------------------------------
async function montarShell(usuario) {
  const [htmlHeader, htmlSidebar] = await Promise.all([
    fetch('components/header.html').then((r) => r.text()),
    fetch('components/sidebar.html').then((r) => r.text()),
  ]);

  document.getElementById('header-container').innerHTML = htmlHeader;
  document.getElementById('sidebar-container').innerHTML = htmlSidebar;

  document.getElementById('topo-usuario-nome').textContent = usuario.nome;
  document.getElementById('topo-usuario-perfil').textContent = usuario.perfil;
  document.getElementById('topo-titulo-pagina').textContent = 'Registrar entrada';

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
  esconderTudo();

  const placa = formatarPlaca(document.getElementById('campo-placa').value);
  document.getElementById('campo-placa').value = placa;

  if (!placaValida(placa)) {
    mostrarAviso('Placa inválida. Use o formato ABC1234 ou ABC1D23.');
    return;
  }

  const veiculo = await buscarVeiculoPorPlaca(placa);

  if (veiculo) {
    // Já existe: impede entrada duplicada
    const abertura = await buscarMovimentacaoAberta(veiculo.id);
    if (abertura) {
      mostrarAviso('Esse veículo já está com uma entrada em aberto no pátio.');
      return;
    }

    veiculoEncontrado = veiculo;
    document.getElementById('info-nome').textContent = veiculo.clientes?.nome ?? '—';
    document.getElementById('info-modelo').textContent = veiculo.modelo ?? '—';
    document.getElementById('info-cor').textContent = veiculo.cor ?? '—';
    document.getElementById('info-tipo').textContent = veiculo.clientes?.tipo === 'mensalista' ? 'Mensalista' : 'De passagem';
    document.getElementById('info-existente').classList.remove('oculto');
  } else {
    veiculoEncontrado = null;
    document.getElementById('form-cadastro').classList.remove('oculto');
  }

  document.getElementById('info-horario-entrada').textContent = formatarHora(new Date().toISOString());
  document.getElementById('bloco-confirmacao').classList.remove('oculto');
}

// ------------------------------------------------------------
// Registrar entrada
// ------------------------------------------------------------
async function aoRegistrarEntrada(usuario) {
  esconderAviso();

  if (!tarifaPadrao) {
    mostrarAviso('Não é possível registrar sem uma tarifa ativa cadastrada.');
    return;
  }

  const placa = formatarPlaca(document.getElementById('campo-placa').value);
  let veiculo = veiculoEncontrado;

  // Se a placa não existia, cadastra cliente + veículo agora
  if (!veiculo) {
    const nome = document.getElementById('novo-nome').value.trim();
    if (!campoPreenchido(nome)) {
      mostrarAviso('Informe ao menos o nome do cliente para cadastrar.');
      return;
    }

    const resultado = await criarClienteEVeiculo({
      nome,
      contato: document.getElementById('novo-contato').value.trim(),
      modelo: document.getElementById('novo-modelo').value.trim(),
      cor: document.getElementById('novo-cor').value.trim(),
      placa,
    });

    if (resultado.erro) {
      mostrarAviso(resultado.erro);
      return;
    }
    veiculo = resultado.veiculo;
  }

  const btn = document.getElementById('btn-registrar-entrada');
  btn.disabled = true;
  btn.textContent = 'Registrando...';

  const tipo = veiculo.clientes?.tipo === 'mensalista' ? 'mensalista' : 'passagem';

  const resultado = await abrirMovimentacao({
    veiculoId: veiculo.id,
    funcionarioId: usuario.id,
    tipo,
    tarifaId: tarifaPadrao.id,
  });

  btn.disabled = false;
  btn.textContent = '🟢 Registrar entrada';

  if (resultado.erro) {
    mostrarAviso(resultado.erro);
    return;
  }

  imprimirCupom({ placa, entrada: resultado.movimentacao.entrada, funcionario: usuario.nome });
  resetarFormulario();
}

// ------------------------------------------------------------
// Cupom / impressão
// ------------------------------------------------------------
function imprimirCupom({ placa, entrada, funcionario }) {
  document.getElementById('recibo-placa').textContent = placa;
  document.getElementById('recibo-entrada').textContent = formatarHora(entrada);
  document.getElementById('recibo-funcionario').textContent = funcionario;
  window.print();
}

// ------------------------------------------------------------
// Helpers de UI
// ------------------------------------------------------------
function esconderTudo() {
  document.getElementById('info-existente').classList.add('oculto');
  document.getElementById('form-cadastro').classList.add('oculto');
  document.getElementById('bloco-confirmacao').classList.add('oculto');
  esconderAviso();
}

function mostrarAviso(mensagem) {
  const div = document.getElementById('aviso-placa');
  div.textContent = mensagem;
  div.classList.remove('oculto');
}

function esconderAviso() {
  document.getElementById('aviso-placa').classList.add('oculto');
}

function resetarFormulario() {
  document.getElementById('form-busca').reset();
  document.getElementById('form-cadastro').reset();
  esconderTudo();
  veiculoEncontrado = null;
  document.getElementById('campo-placa').focus();
}

iniciar();