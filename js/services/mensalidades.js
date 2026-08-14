// ============================================================
// js/services/mensalidades.js
// Consulta, criação e cálculo de status das mensalidades.
// ============================================================

import { supabase } from '../supabase.js';

/** Lê a configuração de dias de antecedência do aviso (padrão: 3). */
export async function buscarDiasAvisoVencimento() {
  const { data } = await supabase
    .from('configuracoes')
    .select('valor')
    .eq('chave', 'dias_aviso_vencimento')
    .maybeSingle();

  return data ? Number(data.valor) : 3;
}

/** Lista todas as mensalidades com dados do cliente e veículo, por vencimento mais próximo primeiro. */
export async function listarMensalidades() {
  const { data, error } = await supabase
    .from('mensalidades')
    .select('*, clientes(*), veiculos(*)')
    .order('vencimento', { ascending: true });

  if (error) {
    console.error('Erro ao listar mensalidades:', error.message);
    return [];
  }
  return data;
}

/** Calcula qual DEVERIA ser o status, comparando a data de vencimento com hoje. */
export function calcularStatus(vencimentoISO, diasAviso) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(`${vencimentoISO}T00:00:00`);
  const diffDias = Math.round((vencimento - hoje) / 86400000);

  if (diffDias < 0) return 'vencido';
  if (diffDias <= diasAviso) return 'vence_em_breve';
  return 'em_dia';
}

/**
 * Recalcula o status de cada mensalidade e grava no banco as que mudaram.
 * Roda toda vez que a tela de mensalistas/vencimentos é aberta.
 */
export async function sincronizarStatus(lista, diasAviso) {
  const atualizadas = [];

  for (const mensalidade of lista) {
    const statusCorreto = calcularStatus(mensalidade.vencimento, diasAviso);
    if (statusCorreto !== mensalidade.status) {
      await supabase.from('mensalidades').update({ status: statusCorreto }).eq('id', mensalidade.id);
      atualizadas.push({ ...mensalidade, status: statusCorreto });
    } else {
      atualizadas.push(mensalidade);
    }
  }

  return atualizadas;
}

/** Cria uma nova mensalidade para um cliente/veículo já existente. */
export async function criarMensalidade({ clienteId, veiculoId, plano, valorMensal, dataInicio, vencimento }) {
  const { data, error } = await supabase
    .from('mensalidades')
    .insert({
      cliente_id: clienteId,
      veiculo_id: veiculoId,
      plano,
      valor_mensal: valorMensal,
      data_inicio: dataInicio,
      vencimento,
      status: 'em_dia',
    })
    .select()
    .single();

  if (error) {
    return { erro: 'Não foi possível cadastrar a mensalidade.' };
  }
  return { mensalidade: data };
}

/** Empurra o vencimento pra frente (usado depois de um pagamento). */
export async function renovarMensalidade(id, novoVencimento) {
  const { error } = await supabase
    .from('mensalidades')
    .update({ vencimento: novoVencimento, status: 'em_dia' })
    .eq('id', id);

  if (error) {
    return { erro: 'Não foi possível renovar a mensalidade.' };
  }
  return { sucesso: true };
}

/** Atualiza valor mensal e/ou vencimento de uma mensalidade existente (edição manual). */
export async function atualizarMensalidade(id, { valorMensal, vencimento }) {
  const { error } = await supabase
    .from('mensalidades')
    .update({ valor_mensal: valorMensal, vencimento })
    .eq('id', id);

  if (error) {
    return { erro: 'Não foi possível atualizar a mensalidade.' };
  }
  return { sucesso: true };
}