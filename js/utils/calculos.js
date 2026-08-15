// ============================================================
// js/utils/calculos.js
// Regras de cálculo de valor e tempo estacionado.
// ============================================================

/** Diferença em minutos entre duas datas ISO (ou objetos Date). */
export function minutosEntre(inicio, fim) {
  const dtInicio = new Date(inicio);
  const dtFim = new Date(fim);
  return Math.max(0, Math.round((dtFim - dtInicio) / 60000));
}

// Usado só se, por algum motivo, o estacionamento não tiver
// esses valores preenchidos (nunca deveria acontecer — é
// preenchido automaticamente na criação do estacionamento —
// mas evita quebrar ou cobrar "grátis" se faltar dado).
const MINUTOS_POR_BLOCO_PADRAO = 30;
const VALOR_POR_BLOCO_PADRAO = 2.5;

/**
 * Calcula o valor a cobrar.
 * Regra: cobrança por blocos fechados (arredondando sempre pra
 * cima), sem tolerância — 31 minutos paga o mesmo que 60 (2
 * blocos). Os valores (minutos por bloco, valor por bloco) vêm
 * do PRÓPRIO estacionamento (tabela `estacionamentos`, colunas
 * `minutos_bloco`/`valor_bloco`) — não são mais fixos no código,
 * porque cada estacionamento define o próprio preço.
 */
export function calcularValor(entrada, saida, estacionamento) {
  const minutos = minutosEntre(entrada, saida);
  if (minutos <= 0) return 0;

  const minutosPorBloco = Number(estacionamento?.minutos_bloco) || MINUTOS_POR_BLOCO_PADRAO;
  const valorPorBloco = Number(estacionamento?.valor_bloco) || VALOR_POR_BLOCO_PADRAO;

  const blocos = Math.ceil(minutos / minutosPorBloco);
  return Number((blocos * valorPorBloco).toFixed(2));
}
