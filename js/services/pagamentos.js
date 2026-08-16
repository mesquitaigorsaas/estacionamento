// ============================================================
// js/services/pagamentos.js
// Registro de pagamento de mensalidade + renovação automática.
// ============================================================

import { supabase } from '../supabase.js';
import { renovarMensalidade } from './mensalidades.js';
import { inicioDoDia, fimDoDia, dataLocal } from '../utils/datas.js';

/**
 * Registra o pagamento e empurra o vencimento em +1 mês.
 * vencimentoAtual precisa vir no formato 'AAAA-MM-DD'.
 */
export async function registrarPagamento({ mensalidadeId, usuarioId, valor, formaPagamento, vencimentoAtual }) {
  const { error: erroPagamento } = await supabase.from('pagamentos').insert({
    mensalidade_id: mensalidadeId,
    usuario_id: usuarioId,
    valor,
    forma_pagamento: formaPagamento,
  });

  if (erroPagamento) {
    return { erro: 'Não foi possível registrar o pagamento.' };
  }

  const proximoVencimento = new Date(`${vencimentoAtual}T00:00:00`);
  proximoVencimento.setMonth(proximoVencimento.getMonth() + 1);
  // dataLocal em vez de toISOString: o toISOString converte para
  // UTC e pode devolver o dia anterior dependendo do fuso.
  const novaData = dataLocal(proximoVencimento);

  const resultado = await renovarMensalidade(mensalidadeId, novaData);
  if (resultado.erro) return { erro: resultado.erro };

  return { sucesso: true, novoVencimento: novaData };
}
/** Lista pagamentos de mensalidades dentro de um período. */
export async function listarPagamentos({ dataInicio, dataFim }) {
  let consulta = supabase
    .from('pagamentos')
    .select('*, mensalidades(*, clientes(*), veiculos(*))')
    .order('data_pagamento', { ascending: false });

  if (dataInicio) consulta = consulta.gte('data_pagamento', inicioDoDia(dataInicio));
  if (dataFim) consulta = consulta.lte('data_pagamento', fimDoDia(dataFim));

  const { data, error } = await consulta;
  if (error) {
    console.error('Erro ao listar pagamentos:', error.message);
    return [];
  }
  return data;
}