// ============================================================
// js/historico.js
// Página: historico.html
// Lista movimentações com filtros de placa, status e período.
// ============================================================

import { supabase } from './supabase.js';
import { exigirLogin } from './auth.js';
import { montarShell } from './utils/layout.js';
import { formatarDataHora, formatarDuracao, formatarMoeda } from './utils/formatadores.js';
import { minutosEntre } from './utils/calculos.js';

const NOME_PAGINA = 'historico';

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario, NOME_PAGINA, 'Histórico');
  await carregarHistorico();

  document.getElementById('btn-filtrar').addEventListener('click', carregarHistorico);
}

// ------------------------------------------------------------
// Carregar histórico com filtros
// ------------------------------------------------------------
async function carregarHistorico() {
  let consulta = supabase
    .from('movimentacoes')
    .select('*, veiculos(*, clientes(*))')
    .order('entrada', { ascending: false })
    .limit(100);

  const placa = document.getElementById('filtro-placa').value.trim().toUpperCase();
  const status = document.getElementById('filtro-status').value;
  const dataInicio = document.getElementById('filtro-data-inicio').value;
  const dataFim = document.getElementById('filtro-data-fim').value;

  if (status) consulta = consulta.eq('status', status);
  if (dataInicio) consulta = consulta.gte('entrada', `${dataInicio}T00:00:00`);
  if (dataFim) consulta = consulta.lte('entrada', `${dataFim}T23:59:59`);
  if (placa) consulta = consulta.eq('veiculos.placa', placa);

  const { data, error } = await consulta;

  if (error) {
    console.error('Erro ao carregar histórico:', error.message);
    renderizarLinhas([]);
    return;
  }

  // Quando filtra por placa via join, o Supabase pode devolver
  // linhas com veiculos = null (quando não bate o filtro do join).
  const filtradas = placa ? data.filter((m) => m.veiculos) : data;
  renderizarLinhas(filtradas);
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

  corpo.innerHTML = lista.map((m) => {
    const duracao = m.saida ? formatarDuracao(minutosEntre(m.entrada, m.saida)) : '—';
    const statusBadge = m.status === 'aberta'
      ? '<span class="badge badge-alerta">Em aberto</span>'
      : m.status === 'finalizada'
        ? '<span class="badge badge-sucesso">Finalizada</span>'
        : '<span class="badge badge-perigo">Cancelada</span>';

    return `
      <tr>
        <td class="tabela-placa" data-label="Placa">${m.veiculos?.placa ?? '—'}</td>
        <td data-label="Nome">${m.veiculos?.clientes?.nome ?? '—'}</td>
        <td data-label="Entrada">${formatarDataHora(m.entrada)}</td>
        <td data-label="Saída">${m.saida ? formatarDataHora(m.saida) : '—'}</td>
        <td data-label="Duração">${duracao}</td>
        <td data-label="Valor">${m.valor ? formatarMoeda(m.valor) : '—'}</td>
        <td data-label="Status">${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

iniciar();
