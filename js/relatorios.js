// ============================================================
// js/relatorios.js
// Página: relatorios.html
// Gráfico de faturamento diário (Chart.js) + placas mais frequentes.
// ============================================================

import { exigirLogin } from './auth.js';
import { montarShell } from './utils/layout.js';
import { formatarMoeda } from './utils/formatadores.js';
import { listarMovimentacoesFinalizadas } from './services/movimentacoes.js';
import { listarPagamentos } from './services/pagamentos.js';

const NOME_PAGINA = 'relatorios';
let grafico = null;

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario, NOME_PAGINA, 'Relatórios');
  definirPeriodoPadrao();
  await carregarDados();

  document.getElementById('btn-filtrar').addEventListener('click', carregarDados);
}

// ------------------------------------------------------------
// Período padrão: últimos 30 dias
// ------------------------------------------------------------
function definirPeriodoPadrao() {
  const hoje = new Date();
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(hoje.getDate() - 30);

  document.getElementById('filtro-inicio').valueAsDate = trintaDiasAtras;
  document.getElementById('filtro-fim').valueAsDate = hoje;
}

// ------------------------------------------------------------
// Carregar dados e desenhar gráfico + tabela
// ------------------------------------------------------------
async function carregarDados() {
  const dataInicio = document.getElementById('filtro-inicio').value;
  const dataFim = document.getElementById('filtro-fim').value;

  const [movimentacoes, pagamentos] = await Promise.all([
    listarMovimentacoesFinalizadas({ dataInicio, dataFim }),
    listarPagamentos({ dataInicio, dataFim }),
  ]);

  desenharGrafico(montarFaturamentoPorDia(movimentacoes, pagamentos, dataInicio, dataFim));
  renderizarPlacasFrequentes(movimentacoes);
}

/** Agrupa o valor de movimentações + pagamentos por dia (AAAA-MM-DD), preenchendo dias sem faturamento com 0. */
function montarFaturamentoPorDia(movimentacoes, pagamentos, dataInicio, dataFim) {
  const porDia = {};

  let cursor = new Date(`${dataInicio}T00:00:00`);
  const fim = new Date(`${dataFim}T00:00:00`);
  while (cursor <= fim) {
    porDia[cursor.toISOString().slice(0, 10)] = 0;
    cursor.setDate(cursor.getDate() + 1);
  }

  movimentacoes.forEach((m) => {
    const dia = m.saida.slice(0, 10);
    porDia[dia] = (porDia[dia] || 0) + (Number(m.valor) || 0);
  });

  pagamentos.forEach((p) => {
    const dia = p.data_pagamento.slice(0, 10);
    porDia[dia] = (porDia[dia] || 0) + (Number(p.valor) || 0);
  });

  const dias = Object.keys(porDia).sort();
  return {
    rotulos: dias.map((d) => new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })),
    valores: dias.map((d) => porDia[d]),
  };
}

function desenharGrafico({ rotulos, valores }) {
  const ctx = document.getElementById('grafico-faturamento');

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: rotulos,
      datasets: [{
        label: 'Faturamento (R$)',
        data: valores,
        backgroundColor: '#2A9D8F',
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (valor) => formatarMoeda(valor) },
        },
      },
    },
  });
}

/** Conta quantas vezes cada placa aparece no período e mostra as 5 mais frequentes. */
function renderizarPlacasFrequentes(movimentacoes) {
  const contagem = {};

  movimentacoes.forEach((m) => {
    const placa = m.veiculos?.placa;
    if (!placa) return;
    if (!contagem[placa]) {
      contagem[placa] = { placa, nome: m.veiculos?.clientes?.nome ?? '—', vezes: 0 };
    }
    contagem[placa].vezes += 1;
  });

  const top5 = Object.values(contagem).sort((a, b) => b.vezes - a.vezes).slice(0, 5);

  const corpo = document.getElementById('tabela-frequentes');
  const vazio = document.getElementById('vazio-frequentes');

  if (top5.length === 0) {
    corpo.innerHTML = '';
    vazio.classList.remove('oculto');
    return;
  }
  vazio.classList.add('oculto');

  corpo.innerHTML = top5.map((item) => `
    <tr>
      <td class="tabela-placa" data-label="Placa">${item.placa}</td>
      <td data-label="Nome">${item.nome}</td>
      <td data-label="Nº de visitas">${item.vezes}</td>
    </tr>
  `).join('');
}

iniciar();
