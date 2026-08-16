// ============================================================
// js/financeiro.js
// Página: financeiro.html
// Faturamento avulso + mensalistas dentro de um período.
// ============================================================

import { exigirLogin } from './auth.js';
import { montarShell } from './utils/layout.js';
import { formatarDataHora, formatarMoeda } from './utils/formatadores.js';
import { listarMovimentacoesFinalizadas } from './services/movimentacoes.js';
import { listarPagamentos } from './services/pagamentos.js';
import { parametro, resolverData } from './utils/parametros.js';

const NOME_PAGINA = 'financeiro';

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario, NOME_PAGINA, 'Financeiro');
  definirPeriodoPadrao();
  await carregarDados();

  document.getElementById('btn-filtrar').addEventListener('click', carregarDados);
}

// ------------------------------------------------------------
// Período: o que vier no endereço (vindo do dashboard) ou,
// na falta dele, do dia 1 do mês atual até hoje.
// ------------------------------------------------------------
function definirPeriodoPadrao() {
  const de = resolverData(parametro('de'));
  const ate = resolverData(parametro('ate'));

  if (de || ate) {
    if (de) document.getElementById('filtro-inicio').value = de;
    if (ate) document.getElementById('filtro-fim').value = ate;
    return;
  }

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
      <td class="tabela-placa" data-label="Placa">${m.veiculos?.placa ?? '—'}</td>
      <td data-label="Nome">${m.veiculos?.clientes?.nome ?? '—'}</td>
      <td data-label="Saída">${formatarDataHora(m.saida)}</td>
      <td data-label="Valor">${formatarMoeda(m.valor)}</td>
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
      <td class="tabela-placa" data-label="Placa">${p.mensalidades?.veiculos?.placa ?? '—'}</td>
      <td data-label="Nome">${p.mensalidades?.clientes?.nome ?? '—'}</td>
      <td data-label="Data">${formatarDataHora(p.data_pagamento)}</td>
      <td data-label="Forma">${nomesFormaPagamento[p.forma_pagamento] ?? p.forma_pagamento ?? '—'}</td>
      <td data-label="Valor">${formatarMoeda(p.valor)}</td>
    </tr>
  `).join('');
}

iniciar();
