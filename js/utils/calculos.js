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

/**
 * Calcula o valor a cobrar.
 * Regra: dentro da tolerância (ex.: 15min) não cobra nada;
 * depois disso, cobra por hora cheia (arredondando pra cima).
 */
export function calcularValor(entrada, saida, tarifa) {
  const minutos = minutosEntre(entrada, saida);
  const tolerancia = tarifa?.tolerancia_minutos ?? 15;

  if (minutos <= tolerancia) return 0;

  const horas = Math.ceil(minutos / 60);
  const valorHora = Number(tarifa?.valor_hora ?? 0);
  return Number((horas * valorHora).toFixed(2));
}