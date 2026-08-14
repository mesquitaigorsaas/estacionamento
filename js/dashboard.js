// ============================================================
// js/dashboard.js
// Página: dashboard.html
// 1) Protege a página (exige login)
// 2) Injeta header/sidebar via módulo compartilhado (js/utils/layout.js)
// 3) Busca os indicadores no Supabase e renderiza os cards
// ============================================================

import { supabase } from './supabase.js';
import { exigirLogin } from './auth.js';
import { montarShell } from './utils/layout.js';

const NOME_PAGINA = 'dashboard';

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return; // exigirLogin já redireciona para o login

  await montarShell(usuario, NOME_PAGINA, 'Dashboard');
  await carregarIndicadores();
}

// ------------------------------------------------------------
// Indicadores do dashboard
// ------------------------------------------------------------
async function carregarIndicadores() {
  const inicioHoje = new Date();
  inicioHoje.setHours(0, 0, 0, 0);
  const inicioHojeISO = inicioHoje.toISOString();

  const [
    estacionados,
    entradasHoje,
    saidasHoje,
    faturamentoHoje,
    mensalistasAtivos,
    vencemEmBreve,
    vencidas,
  ] = await Promise.all([
    contar('movimentacoes', (q) => q.eq('status', 'aberta')),
    contar('movimentacoes', (q) => q.gte('entrada', inicioHojeISO)),
    contar('movimentacoes', (q) => q.eq('status', 'finalizada').gte('saida', inicioHojeISO)),
    somarFaturamentoHoje(inicioHojeISO),
    contar('mensalidades', (q) => q.in('status', ['em_dia', 'vence_em_breve'])),
    contar('mensalidades', (q) => q.eq('status', 'vence_em_breve')),
    contar('mensalidades', (q) => q.eq('status', 'vencido')),
  ]);

  definirTexto('ind-estacionados', estacionados);
  definirTexto('ind-entradas-hoje', entradasHoje);
  definirTexto('ind-saidas-hoje', saidasHoje);
  definirTexto('ind-faturamento-hoje', formatarMoeda(faturamentoHoje));
  definirTexto('ind-mensalistas-ativos', mensalistasAtivos);
  definirTexto('ind-vencem-em-breve', vencemEmBreve);
  definirTexto('ind-vencidas', vencidas);
}

/** Conta linhas de uma tabela aplicando filtros extras via callback. */
async function contar(tabela, aplicarFiltros) {
  let consulta = supabase.from(tabela).select('*', { count: 'exact', head: true });
  consulta = aplicarFiltros(consulta);
  const { count, error } = await consulta;
  if (error) {
    console.error(`Erro ao contar ${tabela}:`, error.message);
    return 0;
  }
  return count ?? 0;
}

/** Soma o valor das movimentações finalizadas hoje. */
async function somarFaturamentoHoje(inicioHojeISO) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('valor')
    .eq('status', 'finalizada')
    .gte('saida', inicioHojeISO);

  if (error) {
    console.error('Erro ao somar faturamento:', error.message);
    return 0;
  }

  return data.reduce((total, linha) => total + (Number(linha.valor) || 0), 0);
}

function definirTexto(id, valor) {
  document.getElementById(id).textContent = valor;
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

iniciar();
