// ============================================================
// js/cadastro.js
// Página: cadastro.html
//
// O visitante preenche os dados ANTES de pagar. Assim, se ele
// desistir no meio do pagamento, o contato dele não se perde —
// era o problema de mandar direto para o Mercado Pago.
//
// O cadastro entra como "aguardando_pagamento" e não libera
// login. Quem libera é o suporte, depois de confirmar o dinheiro.
// ============================================================

import { supabase } from './supabase.js';
import { parametro } from './utils/parametros.js';
import { formatarCnpj } from './utils/formatadores.js';
import { PLANOS } from './planos.js';
import { mensagemDaFuncao } from './utils/erros.js';

// Anual é o padrão: é o plano em destaque na tela inicial.
const plano = PLANOS[parametro('plano')] ? parametro('plano') : 'anual';

function iniciar() {
  document.getElementById('plano-nome').textContent = PLANOS[plano].nome;
  document.getElementById('plano-valor').textContent = PLANOS[plano].valor;

  document.getElementById('form-cadastro').addEventListener('submit', aoCadastrar);
  document.getElementById('cnpj').addEventListener('blur', formatarCampoCnpj);

  const campoSenha = document.getElementById('senha');
  document.getElementById('btn-mostrar-senha').addEventListener('click', (evento) => {
    const visivel = campoSenha.type === 'text';
    campoSenha.type = visivel ? 'password' : 'text';
    evento.target.textContent = visivel ? 'Mostrar' : 'Ocultar';
  });
}

function formatarCampoCnpj() {
  const campo = document.getElementById('cnpj');
  const numeros = campo.value.replace(/\D/g, '');
  if (numeros.length === 14) campo.value = formatarCnpj(numeros);
}

async function aoCadastrar(evento) {
  evento.preventDefault();
  esconderErro();

  const dados = {
    nome: document.getElementById('nome').value.trim(),
    cnpj: document.getElementById('cnpj').value.replace(/\D/g, ''),
    responsavel: document.getElementById('responsavel').value.trim(),
    contato: document.getElementById('contato').value.trim(),
    email: document.getElementById('email').value.trim().toLowerCase(),
    senha: document.getElementById('senha').value,
    plano,
  };

  if (dados.cnpj.length !== 14) {
    mostrarErro('O CNPJ precisa ter 14 números.');
    return;
  }
  if (dados.senha.length < 6) {
    mostrarErro('A senha precisa ter pelo menos 6 caracteres.');
    return;
  }

  const botao = document.getElementById('btn-cadastrar');
  botao.disabled = true;
  botao.textContent = 'Salvando...';

  const { data, error } = await supabase.functions.invoke('cadastro-estacionamento', {
    body: dados,
  });

  botao.disabled = false;
  botao.textContent = 'Continuar para o pagamento';

  if (error || data?.erro) {
    mostrarErro(await mensagemDaFuncao(error, data, 'Não foi possível salvar o cadastro. Tente novamente.'));
    return;
  }

  mostrarPronto(dados);
}

/**
 * Troca o formulário pela tela de pagamento.
 * O link só aparece aqui, depois do cadastro salvo — assim
 * ninguém paga sem que os dados dele estejam guardados.
 */
function mostrarPronto(dados) {
  document.getElementById('form-cadastro').classList.add('oculto');
  document.getElementById('plano-escolhido').classList.add('oculto');

  document.getElementById('resumo-cadastro').textContent =
    `${dados.nome} · ${PLANOS[plano].nome}`;
  document.getElementById('link-pagamento').href = PLANOS[plano].link;

  document.getElementById('bloco-pronto').classList.remove('oculto');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function mostrarErro(mensagem) {
  const div = document.getElementById('cadastro-erro');
  div.textContent = mensagem;
  div.classList.remove('oculto');
  div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function esconderErro() {
  document.getElementById('cadastro-erro').classList.add('oculto');
}

iniciar();
