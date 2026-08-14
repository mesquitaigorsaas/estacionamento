// ============================================================
// js/historico.js
// Página: historico.html
// Lista movimentações com filtros de placa, status e período.
// ============================================================

import { supabase } from './supabase.js';
import { exigirLogin, fazerLogout } from './auth.js';
import { formatarDataHora, formatarDuracao, formatarMoeda } from './utils/formatadores.js';
import { minutosEntre } from './utils/calculos.js';

const NOME_PAGINA = 'historico';

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario);
  await carregarHistorico();

  document.getElementById('btn-filtrar').addEventListener('click', carregarHistorico);
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
  document.getElementById('topo-titulo-pagina').textContent = 'Histórico';

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
        <td class="tabela-placa">${m.veiculos?.placa ?? '—'}</td>
        <td>${m.veiculos?.clientes?.nome ?? '—'}</td>
        <td>${formatarDataHora(m.entrada)}</td>
        <td>${m.saida ? formatarDataHora(m.saida) : '—'}</td>
        <td>${duracao}</td>
        <td>${m.valor ? formatarMoeda(m.valor) : '—'}</td>
        <td>${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

iniciar();