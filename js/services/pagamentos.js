// ============================================================
// js/services/pagamentos.js
// Registro de pagamento de mensalidade + renovação automática.
// ============================================================

import { supabase } from '../supabase.js';
import { renovarMensalidade } from './mensalidades.js';
import { inicioDoDia, fimDoDia, somarMeses, diaDoMes } from '../utils/datas.js';

/**
 * Registra o pagamento e empurra o vencimento em +1 mês.
 * vencimentoAtual e dataInicio precisam vir como 'AAAA-MM-DD'.
 *
 * dataInicio é o dia em que a mensalidade começou, e serve de
 * âncora: quem assinou dia 31 continua vencendo dia 31, mesmo
 * depois de passar por fevereiro. Sem ela, o vencimento desce
 * para 28 e nunca mais sobe.
 */
export async function registrarPagamento({ mensalidadeId, usuarioId, valor, formaPagamento, vencimentoAtual, dataInicio }) {
  const { error: erroPagamento } = await supabase.from('pagamentos').insert({
    mensalidade_id: mensalidadeId,
    usuario_id: usuarioId,
    valor,
    forma_pagamento: formaPagamento,
  });

  if (erroPagamento) {
    return { erro: 'Não foi possível registrar o pagamento.' };
  }

  const novaData = somarMeses(vencimentoAtual, 1, diaDoMes(dataInicio ?? vencimentoAtual));

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