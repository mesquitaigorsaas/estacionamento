// ============================================================
// js/services/veiculos.js
// Tudo relacionado a buscar/criar clientes e veículos.
// ============================================================

import { supabase } from '../supabase.js';

/** Busca um veículo pela placa, já trazendo os dados do cliente dono. */
export async function buscarVeiculoPorPlaca(placa) {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*, clientes(*)')
    .eq('placa', placa)
    .maybeSingle();

  if (error) {
    console.error('Erro ao buscar veículo:', error.message);
    return null;
  }
  return data;
}

/** Cria um cliente novo e o veículo vinculado a ele. Retorna o veículo criado (com cliente). */
export async function criarClienteEVeiculo({ nome, contato, modelo, cor, placa, tipo = 'passagem' }) {
  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .insert({ nome, contato, tipo })
    .select()
    .single();

  if (erroCliente) {
    return { erro: 'Não foi possível cadastrar o cliente.' };
  }

  const { data: veiculo, error: erroVeiculo } = await supabase
    .from('veiculos')
    .insert({ placa, modelo, cor, cliente_id: cliente.id })
    .select('*, clientes(*)')
    .single();

  if (erroVeiculo) {
    const duplicada = erroVeiculo.message.includes('duplicate');
    return { erro: duplicada ? 'Essa placa já está cadastrada.' : 'Erro ao salvar o veículo.' };
  }

  return { veiculo };
}
/** Atualiza os dados do cliente e do veículo (usado na tela Clientes/veículos). */
export async function atualizarClienteEVeiculo({ clienteId, veiculoId, nome, contato, tipo, modelo, cor }) {
  const { error: erroCliente } = await supabase
    .from('clientes')
    .update({ nome, contato, tipo })
    .eq('id', clienteId);

  if (erroCliente) {
    return { erro: 'Não foi possível atualizar o cliente.' };
  }

  const { error: erroVeiculo } = await supabase
    .from('veiculos')
    .update({ modelo, cor })
    .eq('id', veiculoId);

  if (erroVeiculo) {
    return { erro: 'Não foi possível atualizar o veículo.' };
  }

  return { sucesso: true };
}

/** Lista todos os veículos com os dados do cliente dono, mais recentes primeiro. */
export async function listarVeiculos() {
  const { data, error } = await supabase
    .from('veiculos')
    .select('*, clientes(*)')
    .order('criado_em', { ascending: false });

  if (error) {
    console.error('Erro ao listar veículos:', error.message);
    return [];
  }
  return data;
}