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

  await montarShell(usuario, NOME_PAGINA, 'Início');
  removerCartoesRestritos(usuario);
  await carregarIndicadores();
}

/**
 * Tira da tela os cartões marcados com data-perfis que o usuário
 * não tem. Hoje é só o de faturamento: funcionário não vê dinheiro
 * nem no Financeiro nem aqui.
 *
 * Remove o cartão do HTML em vez de escondê-lo, e roda ANTES de
 * carregar os indicadores — assim o valor nunca chega a ser
 * buscado nem escrito na tela.
 */
function removerCartoesRestritos(usuario) {
  document.querySelectorAll('.indicador[data-perfis]').forEach((cartao) => {
    if (!cartao.dataset.perfis.split(',').includes(usuario.perfil)) {
      cartao.remove();
    }
  });
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
    // Só busca o faturamento se o cartão existir. Sem isso, o valor
    // viajaria até o navegador do funcionário mesmo sem aparecer.
    document.getElementById('ind-faturamento-hoje') ? somarFaturamentoHoje(inicioHojeISO) : 0,
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

/** Escreve no elemento, se ele existir — cartões restritos são removidos antes. */
function definirTexto(id, valor) {
  const elemento = document.getElementById(id);
  if (elemento) elemento.textContent = valor;
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

iniciar();
