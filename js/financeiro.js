// ============================================================
// js/financeiro.js
// Página: financeiro.html
// Faturamento avulso + mensalistas dentro de um período.
// ============================================================

import { exigirLogin, fazerLogout } from './auth.js';
import { formatarDataHora, formatarMoeda } from './utils/formatadores.js';
import { listarMovimentacoesFinalizadas } from './services/movimentacoes.js';
import { listarPagamentos } from './services/pagamentos.js';

const NOME_PAGINA = 'financeiro';

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario);
  definirPeriodoPadrao();
  await carregarDados();

  document.getElementById('btn-filtrar').addEventListener('click', carregarDados);
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
  document.getElementById('topo-titulo-pagina').textContent = 'Financeiro';

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
// Período padrão: do dia 1 do mês atual até hoje
// ------------------------------------------------------------
function definirPeriodoPadrao() {
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  document.getElementById('filtro-inicio').valueAsDate = inicioMes;
  document.getElementById('filtro-fim').valueAsDate = hoje;
}

// ------------------------------------------------------------
// Carregar dados do período e renderizar tudo
// ------------------------------------------------------------
async function carregarDados() {
  const dataInicio = document.getElementById('filtro-inicio').value;
  const dataFim = document.getElementById('filtro-fim').value;

  const [movimentacoes, pagamentos] = await Promise.all([
    listarMovimentacoesFinalizadas({ dataInicio, dataFim }),
    listarPagamentos({ dataInicio, dataFim }),
  ]);

  const totalAvulso = movimentacoes.reduce((soma, m) => soma + (Number(m.valor) || 0), 0);
  const totalMensalistas = pagamentos.reduce((soma, p) => soma + (Number(p.valor) || 0), 0);

  document.getElementById('ind-total').textContent = formatarMoeda(totalAvulso + totalMensalistas);
  document.getElementById('ind-avulso').textContent = formatarMoeda(totalAvulso);
  document.getElementById('ind-mensalistas').textContent = formatarMoeda(totalMensalistas);
  document.getElementById('ind-qtd-movimentacoes').textContent = movimentacoes.length;
  document.getElementById('ind-qtd-pagamentos').textContent = pagamentos.length;

  renderizarMovimentacoes(movimentacoes);
  renderizarPagamentos(pagamentos);
}

function renderizarMovimentacoes(lista) {
  const corpo = document.getElementById('tabela-movimentacoes');
  const vazio = document.getElementById('vazio-movimentacoes');

  if (lista.length === 0) {
    corpo.innerHTML = '';
    vazio.classList.remove('oculto');
    return;
  }
  vazio.classList.add('oculto');

  corpo.innerHTML = lista.map((m) => `
    <tr>
      <td class="tabela-placa">${m.veiculos?.placa ?? '—'}</td>
      <td>${m.veiculos?.clientes?.nome ?? '—'}</td>
      <td>${formatarDataHora(m.saida)}</td>
      <td>${formatarMoeda(m.valor)}</td>
    </tr>
  `).join('');
}

function renderizarPagamentos(lista) {
  const corpo = document.getElementById('tabela-pagamentos');
  const vazio = document.getElementById('vazio-pagamentos');

  if (lista.length === 0) {
    corpo.innerHTML = '';
    vazio.classList.remove('oculto');
    return;
  }
  vazio.classList.add('oculto');

  const nomesFormaPagamento = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão' };

  corpo.innerHTML = lista.map((p) => `
    <tr>
      <td class="tabela-placa">${p.mensalidades?.veiculos?.placa ?? '—'}</td>
      <td>${p.mensalidades?.clientes?.nome ?? '—'}</td>
      <td>${formatarDataHora(p.data_pagamento)}</td>
      <td>${nomesFormaPagamento[p.forma_pagamento] ?? p.forma_pagamento ?? '—'}</td>
      <td>${formatarMoeda(p.valor)}</td>
    </tr>
  `).join('');
}

iniciar();