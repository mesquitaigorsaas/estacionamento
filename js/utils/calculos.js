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

// Regra padrão: R$2,50 a cada bloco de 30 minutos, sem tolerância
// (do minuto 1 já cobra o 1º bloco) e sem fracionar — 31 minutos
// paga o mesmo que 60 minutos (2 blocos).
const MINUTOS_POR_BLOCO_PADRAO = 30;
const VALOR_POR_BLOCO_PADRAO = 2.5;

/**
 * Calcula o valor a cobrar.
 * Regra: cobrança por blocos fechados (arredondando sempre pra
 * cima), sem tolerância. Ex.: bloco de 30min a R$2,50 → 30min
 * paga R$2,50, 31min já paga R$5,00.
 *
 * Se a tarifa do veículo tiver `valor_bloco` e `minutos_bloco`
 * cadastrados (tabela `tarifas` no Supabase), usa esses valores
 * no lugar do padrão — permite ter tarifas diferentes por tipo
 * de veículo/plano no futuro sem mexer nesse arquivo.
 */
export function calcularValor(entrada, saida, tarifa) {
  const minutos = minutosEntre(entrada, saida);
  if (minutos <= 0) return 0;

  const minutosPorBloco = Number(tarifa?.minutos_bloco) || MINUTOS_POR_BLOCO_PADRAO;
  const valorPorBloco = Number(tarifa?.valor_bloco) || VALOR_POR_BLOCO_PADRAO;

  const blocos = Math.ceil(minutos / minutosPorBloco);
  return Number((blocos * valorPorBloco).toFixed(2));
}
