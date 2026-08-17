// ============================================================
// js/configuracoes.js
// Página: configuracoes.html (só administrador acessa)
//
// Edita o que é do PRÓPRIO estacionamento: dados cadastrais e
// valor cobrado. Tudo grava na linha do estacionamento do
// usuário logado — um assinante nunca mexe no de outro.
//
// A situação da assinatura aparece só para leitura: quem muda
// isso é o suporte, não o cliente.
// ============================================================

import { exigirLogin, exigirPerfil } from './auth.js';
import { montarShell } from './utils/layout.js';
import { supabase } from './supabase.js';
import { formatarMoeda, formatarCnpj, formatarDuracao } from './utils/formatadores.js';
import { campoPreenchido } from './utils/validacoes.js';
import { calcularValor } from './utils/calculos.js';

const NOME_PAGINA = 'configuracoes';

let usuarioLogado = null;

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  // O menu já esconde o item para quem não é administrador, mas
  // alguém pode chegar aqui digitando o endereço direto.
  if (!exigirPerfil(usuario, 'administrador')) return;

  usuarioLogado = usuario;
  await montarShell(usuario, NOME_PAGINA, 'Configurações');
  await carregarDados();

  document.getElementById('btn-salvar').addEventListener('click', aoSalvar);

  // A prévia acompanha o que está sendo digitado, antes de salvar.
  // Os três campos entram na conta — esquecer um deixa a tabela
  // mostrando um preço que não é o que vai ser cobrado.
  document.getElementById('valor-bloco').addEventListener('input', montarPrevia);
  document.getElementById('minutos-bloco').addEventListener('change', montarPrevia);
  document.getElementById('valor-diaria').addEventListener('input', montarPrevia);
  document.getElementById('tolerancia').addEventListener('change', montarPrevia);
}

// ------------------------------------------------------------
// Carregar
// ------------------------------------------------------------
async function carregarDados() {
  const { data, error } = await supabase
    .from('estacionamentos')
    .select('*')
    .eq('id', usuarioLogado.estacionamento_id)
    .single();

  if (error || !data) {
    mostrarAviso('Não foi possível carregar as configurações. Recarregue a página.');
    return;
  }

  document.getElementById('nome').value = data.nome ?? '';
  document.getElementById('cnpj').value = formatarCnpj(data.cnpj);
  document.getElementById('responsavel').value = data.responsavel ?? '';
  document.getElementById('contato-responsavel').value = data.contato_responsavel ?? '';
  document.getElementById('valor-bloco').value = Number(data.valor_bloco ?? 0).toFixed(2);
  document.getElementById('minutos-bloco').value = String(data.minutos_bloco ?? 30);

  // Diária e mensalidade são opcionais: campo vazio significa
  // "não tem", e não "vale zero".
  document.getElementById('valor-diaria').value = data.valor_diaria ?? '';
  document.getElementById('valor-mensal').value = data.valor_mensal_padrao ?? '';
  document.getElementById('tolerancia').value = String(data.tolerancia_minutos ?? 0);

  document.getElementById('info-assinatura').textContent =
    data.assinatura_status === 'ativa' ? 'Ativa' : 'Suspensa';

  document.getElementById('info-vencimento').textContent = data.assinatura_vencimento
    ? new Date(`${data.assinatura_vencimento}T00:00:00`).toLocaleDateString('pt-BR')
    : '—';

  montarPrevia();
}

// ------------------------------------------------------------
// Prévia da cobrança
// ------------------------------------------------------------

/**
 * Mostra quanto sai em alguns tempos comuns, usando a MESMA
 * função que a tela de saída usa para cobrar de verdade. Assim
 * a prévia nunca diverge da conta real.
 */
function montarPrevia() {
  const estacionamento = {
    valor_bloco: Number(document.getElementById('valor-bloco').value) || 0,
    minutos_bloco: Number(document.getElementById('minutos-bloco').value) || 30,
    valor_diaria: Number(document.getElementById('valor-diaria').value) || 0,
    tolerancia_minutos: Number(document.getElementById('tolerancia').value) || 0,
  };

  const tempos = [5, 15, 30, 60, 120, 480, 1440];
  const entrada = new Date(2026, 0, 1, 8, 0, 0);

  const linhas = tempos.map((minutos) => {
    const saida = new Date(entrada.getTime() + minutos * 60000);
    const valor = calcularValor(entrada.toISOString(), saida.toISOString(), estacionamento);

    // Marca por que o valor ficou diferente do simples soma-blocos,
    // pra ficar visível o efeito de cada regra.
    const semTeto = calcularValor(entrada.toISOString(), saida.toISOString(), {
      ...estacionamento,
      valor_diaria: 0,
    });

    let nota = '';
    if (minutos <= estacionamento.tolerancia_minutos) nota = 'cortesia';
    else if (valor < semTeto) nota = 'diária';

    return `
      <tr>
        <td>${rotuloTempo(minutos)}</td>
        <td class="previa-valor">${formatarMoeda(valor)}</td>
        <td class="previa-nota">${nota}</td>
      </tr>
    `;
  });

  document.querySelector('#previa-preco tbody').innerHTML = linhas.join('');
}

/** "1h" em vez de "1h 0min" — a prévia é lida de relance. */
function rotuloTempo(minutos) {
  if (minutos === 1440) return '24h';
  if (minutos % 60 === 0) return `${minutos / 60}h`;
  return formatarDuracao(minutos);
}

// ------------------------------------------------------------
// Salvar
// ------------------------------------------------------------
async function aoSalvar() {
  esconderMensagens();

  const nome = document.getElementById('nome').value.trim();
  const cnpj = document.getElementById('cnpj').value.replace(/\D/g, '');
  const responsavel = document.getElementById('responsavel').value.trim();
  const contato = document.getElementById('contato-responsavel').value.trim();
  const valorBloco = Number(document.getElementById('valor-bloco').value);
  const minutosBloco = Number(document.getElementById('minutos-bloco').value);

  // Campo vazio grava null (= "não tem"), e não zero.
  const textoDiaria = document.getElementById('valor-diaria').value.trim();
  const textoMensal = document.getElementById('valor-mensal').value.trim();
  const valorDiaria = textoDiaria === '' ? null : Number(textoDiaria);
  const valorMensal = textoMensal === '' ? null : Number(textoMensal);

  if (!campoPreenchido(nome) || !campoPreenchido(responsavel) || !campoPreenchido(contato)) {
    mostrarAviso('Preencha nome, responsável e contato.');
    return;
  }

  if (cnpj.length !== 14) {
    mostrarAviso('O CNPJ precisa ter 14 números.');
    return;
  }

  if (!(valorBloco > 0)) {
    mostrarAviso('O valor cobrado precisa ser maior que zero.');
    return;
  }

  // Diária menor que um bloco tornaria o teto menor que a menor
  // cobrança possível — o cliente pagaria a diária sempre.
  if (valorDiaria !== null && valorDiaria > 0 && valorDiaria < valorBloco) {
    mostrarAviso(`A diária não pode ser menor que ${formatarMoeda(valorBloco)}, que é o valor do período mínimo.`);
    return;
  }

  const botao = document.getElementById('btn-salvar');
  botao.disabled = true;
  botao.textContent = 'Salvando...';

  const { error } = await supabase
    .from('estacionamentos')
    .update({
      nome,
      cnpj,
      responsavel,
      contato_responsavel: contato,
      valor_bloco: valorBloco,
      minutos_bloco: minutosBloco,
      valor_diaria: valorDiaria,
      valor_mensal_padrao: valorMensal,
      tolerancia_minutos: Number(document.getElementById('tolerancia').value) || 0,
    })
    .eq('id', usuarioLogado.estacionamento_id);

  botao.disabled = false;
  botao.textContent = 'Salvar alterações';

  if (error) {
    // 23505 = valor duplicado. O único campo único aqui é o CNPJ.
    mostrarAviso(
      error.code === '23505'
        ? 'Este CNPJ já está cadastrado em outro estacionamento.'
        : `Não foi possível salvar: ${error.message}`
    );
    return;
  }

  document.getElementById('cnpj').value = formatarCnpj(cnpj);
  mostrarSucesso();
}

// ------------------------------------------------------------
// Mensagens
// ------------------------------------------------------------
function mostrarAviso(mensagem) {
  const div = document.getElementById('aviso');
  div.textContent = mensagem;
  div.classList.remove('oculto');
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function mostrarSucesso() {
  const div = document.getElementById('sucesso');
  div.classList.remove('oculto');
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  setTimeout(() => div.classList.add('oculto'), 4000);
}

function esconderMensagens() {
  document.getElementById('aviso').classList.add('oculto');
  document.getElementById('sucesso').classList.add('oculto');
}

iniciar();
