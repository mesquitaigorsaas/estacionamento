// ============================================================
// js/saida.js
// Página: saida.html
// Busca placa → calcula valor → finaliza → imprime recibo.
// ============================================================

import { exigirLogin, fazerLogout, usuarioAtual } from './auth.js';
import { formatarPlaca, formatarHora, formatarDuracao, formatarMoeda } from './utils/formatadores.js';
import { placaValida } from './utils/validacoes.js';
import { minutosEntre, calcularValor } from './utils/calculos.js';
import { buscarMovimentacaoAbertaPorPlaca, fecharMovimentacao } from './services/movimentacoes.js';
import { supabase } from './supabase.js';

const NOME_PAGINA = 'saida';

let movimentacaoAtual = null;
let valorCalculado = 0;

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario);

  document.getElementById('form-busca').addEventListener('submit', aoConsultarPlaca);
  document.getElementById('btn-finalizar-saida').addEventListener('click', () => aoFinalizarSaida(usuario));
}

// ------------------------------------------------------------
// Shell (header/sidebar)
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
  document.getElementById('topo-titulo-pagina').textContent = 'Registrar saída';

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
  esconderResultado();

  const placa = formatarPlaca(document.getElementById('campo-placa').value);
  document.getElementById('campo-placa').value = placa;

  if (!placaValida(placa)) {
    mostrarAviso('Placa inválida. Use o formato ABC1234 ou ABC1D23.');
    return;
  }

  const movimentacao = await buscarMovimentacaoAbertaPorPlaca(placa);

  if (!movimentacao) {
    mostrarAviso('Nenhuma entrada em aberto encontrada para essa placa.');
    return;
  }

  movimentacaoAtual = movimentacao;
  const veiculo = movimentacao.veiculos;
  const agora = new Date().toISOString();

  // Pega o valor por bloco / minutos por bloco do PRÓPRIO
  // estacionamento (cada um tem o seu, cadastrado em
  // estacionamentos.valor_bloco / minutos_bloco).
  const usuario = usuarioAtual();
  const { data: estacionamento } = await supabase
    .from('estacionamentos')
    .select('valor_bloco, minutos_bloco')
    .eq('id', usuario.estacionamento_id)
    .single();

  valorCalculado = calcularValor(movimentacao.entrada, agora, estacionamento);
  const minutos = minutosEntre(movimentacao.entrada, agora);

  document.getElementById('info-nome').textContent = veiculo.clientes?.nome ?? '—';
  document.getElementById('info-modelo').textContent = veiculo.modelo ?? '—';
  document.getElementById('info-cor').textContent = veiculo.cor ?? '—';
  document.getElementById('info-entrada').textContent = formatarHora(movimentacao.entrada);
  document.getElementById('info-tempo').textContent = formatarDuracao(minutos);
  document.getElementById('info-valor').textContent = formatarMoeda(valorCalculado);

  document.getElementById('bloco-resultado').classList.remove('oculto');
}

// ------------------------------------------------------------
// Finalizar saída
// ------------------------------------------------------------
async function aoFinalizarSaida(usuario) {
  const btn = document.getElementById('btn-finalizar-saida');
  btn.disabled = true;
  btn.textContent = 'Finalizando...';

  const resultado = await fecharMovimentacao({
    id: movimentacaoAtual.id,
    funcionarioId: usuario.id,
    valor: valorCalculado,
  });

  btn.disabled = false;
  btn.textContent = '🟢 Finalizar saída';

  if (resultado.erro) {
    mostrarAviso(resultado.erro);
    return;
  }

  const veiculo = movimentacaoAtual.veiculos;
  imprimirRecibo({
    placa: veiculo.placa,
    entrada: movimentacaoAtual.entrada,
    saida: resultado.movimentacao.saida,
    valor: valorCalculado,
    funcionario: usuario.nome,
  });

  resetarFormulario();
}

// ------------------------------------------------------------
// Recibo / impressão
// ------------------------------------------------------------
function imprimirRecibo({ placa, entrada, saida, valor, funcionario }) {
  document.getElementById('recibo-placa').textContent = placa;
  document.getElementById('recibo-entrada').textContent = formatarHora(entrada);
  document.getElementById('recibo-saida').textContent = formatarHora(saida);
  document.getElementById('recibo-valor').textContent = formatarMoeda(valor);
  document.getElementById('recibo-funcionario').textContent = funcionario;
  window.print();
}

// ------------------------------------------------------------
// Helpers de UI
// ------------------------------------------------------------
function mostrarAviso(mensagem) {
  const div = document.getElementById('aviso-placa');
  div.textContent = mensagem;
  div.classList.remove('oculto');
}

function esconderResultado() {
  document.getElementById('bloco-resultado').classList.add('oculto');
  document.getElementById('aviso-placa').classList.add('oculto');
}

function resetarFormulario() {
  document.getElementById('form-busca').reset();
  esconderResultado();
  movimentacaoAtual = null;
  document.getElementById('campo-placa').focus();
}

iniciar();
