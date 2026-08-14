// ============================================================
// js/app.js
// Script da index.html: alterna abas, cuida do login e do
// cadastro público de cliente.
// ============================================================

import { supabase } from './supabase.js';
import { fazerLogin } from './auth.js';

// ------------------------------------------------------------
// Alternar entre as abas "Sou funcionário" / "Cadastrar cliente"
// ------------------------------------------------------------
const abas = document.querySelectorAll('.login-aba');
const formLogin = document.getElementById('form-login');
const formCadastro = document.getElementById('form-cadastro-cliente');

abas.forEach((aba) => {
  aba.addEventListener('click', () => {
    abas.forEach((a) => a.classList.remove('ativa'));
    aba.classList.add('ativa');

    const alvo = aba.dataset.aba;
    formLogin.classList.toggle('oculto', alvo !== 'funcionario');
    formCadastro.classList.toggle('oculto', alvo !== 'cliente');
  });
});

// ------------------------------------------------------------
// Mostrar/ocultar senha
// ------------------------------------------------------------
const btnMostrarSenha = document.getElementById('btn-mostrar-senha');
const campoSenha = document.getElementById('login-senha');

btnMostrarSenha.addEventListener('click', () => {
  const visivel = campoSenha.type === 'text';
  campoSenha.type = visivel ? 'password' : 'text';
  btnMostrarSenha.textContent = visivel ? 'Mostrar' : 'Ocultar';
});

// ------------------------------------------------------------
// Login de funcionário
// ------------------------------------------------------------
const divErroLogin = document.getElementById('login-erro');
const btnEntrar = document.getElementById('btn-entrar');

formLogin.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  divErroLogin.classList.add('oculto');

  const usuario = document.getElementById('login-usuario').value.trim();
  const senha = campoSenha.value;

  btnEntrar.disabled = true;
  btnEntrar.textContent = 'Entrando...';

  const resultado = await fazerLogin(usuario, senha);

  if (!resultado.sucesso) {
    divErroLogin.textContent = resultado.mensagem;
    divErroLogin.classList.remove('oculto');
    btnEntrar.disabled = false;
    btnEntrar.textContent = 'Entrar';
    return;
  }

  window.location.href = 'dashboard.html';
});

// ------------------------------------------------------------
// "Esqueci minha senha" — envia e-mail de recuperação via Supabase
// ------------------------------------------------------------
document.getElementById('link-esqueci-senha').addEventListener('click', async (evento) => {
  evento.preventDefault();
  const usuario = document.getElementById('login-usuario').value.trim();

  if (!usuario) {
    divErroLogin.textContent = 'Digite seu usuário no campo acima primeiro.';
    divErroLogin.classList.remove('oculto');
    return;
  }

  const email = usuario.includes('@') ? usuario : `${usuario}@estacionamento.local`;
  const { error } = await supabase.auth.resetPasswordForEmail(email);

  divErroLogin.classList.remove('oculto');
  divErroLogin.textContent = error
    ? 'Não foi possível enviar a recuperação. Contate o administrador.'
    : 'Se o usuário existir, um e-mail de recuperação foi enviado.';
});

// ------------------------------------------------------------
// Cadastro público de cliente (sem login — visitante na tela inicial)
// ------------------------------------------------------------
const divErroCadastro = document.getElementById('cadastro-erro');
const divSucessoCadastro = document.getElementById('cadastro-sucesso');

formCadastro.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  divErroCadastro.classList.add('oculto');
  divSucessoCadastro.classList.add('oculto');

  const nome = document.getElementById('cliente-nome').value.trim();
  const contato = document.getElementById('cliente-contato').value.trim();
  const placa = document.getElementById('cliente-placa').value.trim().toUpperCase();
  const modelo = document.getElementById('cliente-modelo').value.trim();

  // 1) cria o cliente
  const { data: cliente, error: erroCliente } = await supabase
    .from('clientes')
    .insert({ nome, contato, tipo: 'passagem' })
    .select()
    .single();

  if (erroCliente) {
    divErroCadastro.textContent = 'Não foi possível cadastrar. Tente novamente.';
    divErroCadastro.classList.remove('oculto');
    return;
  }

  // 2) vincula o veículo ao cliente recém-criado
  const { error: erroVeiculo } = await supabase
    .from('veiculos')
    .insert({ placa, modelo, cliente_id: cliente.id });

  if (erroVeiculo) {
    divErroCadastro.textContent = erroVeiculo.message.includes('duplicate')
      ? 'Essa placa já está cadastrada.'
      : 'Cliente criado, mas houve erro ao salvar o veículo.';
    divErroCadastro.classList.remove('oculto');
    return;
  }

  divSucessoCadastro.textContent = 'Cadastro realizado com sucesso!';
  divSucessoCadastro.classList.remove('oculto');
  formCadastro.reset();
});
