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

const MINUTOS_POR_DIA = 24 * 60;

/**
 * Calcula o valor a cobrar.
 *
 * Regra: cobrança por blocos fechados (arredondando sempre pra
 * cima), sem tolerância — 31 minutos paga o mesmo que 60 (2
 * blocos). Os valores vêm do PRÓPRIO estacionamento (tabela
 * `estacionamentos`), porque cada um define o próprio preço.
 *
 * Se o estacionamento tiver `valor_diaria` preenchido, ela vira
 * um TETO: a soma dos blocos nunca passa dela dentro de um mesmo
 * dia. Carro que fica mais de 24h paga uma diária por dia cheio
 * mais o resto (também limitado ao teto).
 *
 * Diária vazia = sem teto, cobra só por blocos.
 */
export function calcularValor(entrada, saida, estacionamento) {
  const minutos = minutosEntre(entrada, saida);
  if (minutos <= 0) return 0;

  // Cortesia: quem entra e sai dentro da tolerância não paga nada.
  // Zero (o padrão) significa cobrar desde o primeiro minuto.
  const tolerancia = Number(estacionamento?.tolerancia_minutos) || 0;
  if (minutos <= tolerancia) return 0;

  const minutosPorBloco = Number(estacionamento?.minutos_bloco) || MINUTOS_POR_BLOCO_PADRAO;
  const valorPorBloco = Number(estacionamento?.valor_bloco) || VALOR_POR_BLOCO_PADRAO;
  const valorDiaria = Number(estacionamento?.valor_diaria) || 0;

  const porBlocos = (mins) => Math.ceil(mins / minutosPorBloco) * valorPorBloco;

  if (!(valorDiaria > 0)) {
    return arredondar(porBlocos(minutos));
  }

  const diasCheios = Math.floor(minutos / MINUTOS_POR_DIA);
  const restoMinutos = minutos % MINUTOS_POR_DIA;
  const valorResto = restoMinutos > 0 ? Math.min(porBlocos(restoMinutos), valorDiaria) : 0;

  return arredondar(diasCheios * valorDiaria + valorResto);
}

function arredondar(valor) {
  return Number(valor.toFixed(2));
}
