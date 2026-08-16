// ============================================================
// js/utils/parametros.js
// Lê filtros passados pelo endereço da página.
//
// Serve para os cartões do dashboard abrirem a tela de destino
// já filtrada. Exemplo: clicar em "Saídas hoje" abre
// historico.html?status=finalizada&campo=saida&de=hoje&ate=hoje
// ============================================================

import { dataDeHoje } from './datas.js';

/** Devolve o valor de um parâmetro do endereço, ou '' se não houver. */
export function parametro(nome) {
  return new URLSearchParams(window.location.search).get(nome) ?? '';
}

/**
 * Resolve um parâmetro de data.
 * Aceita a palavra 'hoje' (para os links não precisarem saber a
 * data) ou uma data pronta no formato 2026-08-15.
 */
export function resolverData(valor) {
  if (!valor) return '';
  if (valor === 'hoje') return dataDeHoje();
  return valor;
}
