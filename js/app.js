// ============================================================
// js/app.js
// Script da index.html: login de funcionário.
// ============================================================

import { supabase } from './supabase.js';
import { fazerLogin } from './auth.js';

const formLogin = document.getElementById('form-login');

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
