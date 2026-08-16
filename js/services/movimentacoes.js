// ============================================================
// js/services/movimentacoes.js
// Abertura/fechamento de movimentações (entrada e saída).
// ============================================================

import { supabase } from '../supabase.js';
import { inicioDoDia, fimDoDia } from '../utils/datas.js';

/** Pega a primeira tarifa ativa cadastrada (usada como padrão). */
export async function buscarTarifaPadrao() {
  const { data, error } = await supabase
    .from('tarifas')
    .select('*')
    .eq('ativo', true)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error('Nenhuma tarifa ativa encontrada:', error?.message);
    return null;
  }
  return data;
}

/** Verifica se já existe uma movimentação em aberto para esse veículo. */
export async function buscarMovimentacaoAberta(veiculoId) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*')
    .eq('veiculo_id', veiculoId)
    .eq('status', 'aberta')
    .maybeSingle();

  if (error) {
    console.error('Erro ao verificar movimentação aberta:', error.message);
    return null;
  }
  return data;
}

/** Busca a movimentação aberta a partir da PLACA (usado na tela de saída). */
export async function buscarMovimentacaoAbertaPorPlaca(placa) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .select('*, veiculos!inner(*, clientes(*))')
    .eq('status', 'aberta')
    .eq('veiculos.placa', placa)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar movimentação por placa:', error.message);
    return null;
  }
  return data;
}

/**
 * Registra a entrada de um veículo.
 * estacionamentoId é obrigatório — vem de usuario.estacionamento_id.
 */
export async function abrirMovimentacao({ veiculoId, funcionarioId, tipo, tarifaId, estacionamentoId }) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .insert({
      veiculo_id: veiculoId,
      funcionario_entrada_id: funcionarioId,
      tipo,
      tarifa_id: tarifaId,
      status: 'aberta',
      estacionamento_id: estacionamentoId,
    })
    .select()
    .single();

  if (error) {
    console.error('Erro ao registrar entrada:', error.message);
    return { erro: 'Não foi possível registrar a entrada.' };
  }
  return { movimentacao: data };
}

/** Finaliza a saída, gravando horário, valor e funcionário responsável. */
export async function fecharMovimentacao({ id, funcionarioId, valor }) {
  const { data, error } = await supabase
    .from('movimentacoes')
    .update({
      saida: new Date().toISOString(),
      funcionario_saida_id: funcionarioId,
      valor,
      status: 'finalizada',
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Erro ao finalizar saída:', error.message);
    return { erro: 'Não foi possível finalizar a saída.' };
  }
  return { movimentacao: data };
}

/** Lista movimentações finalizadas (com valor cobrado) dentro de um período. */
export async function listarMovimentacoesFinalizadas({ dataInicio, dataFim }) {
  let consulta = supabase
    .from('movimentacoes')
    .select('*, veiculos(*, clientes(*))')
    .eq('status', 'finalizada')
    .order('saida', { ascending: false });

  if (dataInicio) consulta = consulta.gte('saida', inicioDoDia(dataInicio));
  if (dataFim) consulta = consulta.lte('saida', fimDoDia(dataFim));

  const { data, error } = await consulta;
  if (error) {
    console.error('Erro ao listar movimentações:', error.message);
    return [];
  }
  return data;
}
