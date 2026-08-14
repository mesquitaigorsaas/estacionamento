// ============================================================
// js/auth.js
// Autenticação: login, logout, proteção de páginas internas.
// Importado pela index.html (login) e por todas as páginas
// internas (dashboard.html, entrada.html, etc.) para proteção.
// ============================================================

import { supabase } from './supabase.js';

/**
 * Faz login com login (convertido em email interno) e senha.
 * O Supabase Auth exige e-mail; como o sistema usa "login",
 * convertimos para um formato de e-mail interno fixo.
 */
export async function fazerLogin(login, senha) {
  const email = loginParaEmail(login);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    return { sucesso: false, mensagem: traduzErroLogin(error) };
  }

  // Busca o registro do funcionário na tabela usuarios
  const { data: usuario, error: erroUsuario } = await supabase
    .from('usuarios')
    .select('*')
    .eq('auth_id', data.user.id)
    .single();

  if (erroUsuario || !usuario) {
    await supabase.auth.signOut();
    return { sucesso: false, mensagem: 'Usuário autenticado, mas sem cadastro em "usuarios". Contate o administrador.' };
  }

  if (!usuario.ativo) {
    await supabase.auth.signOut();
    return { sucesso: false, mensagem: 'Este usuário está desativado.' };
  }

  // Guarda o perfil localmente para controle de UI (menus, botões)
  localStorage.setItem('usuario_atual', JSON.stringify(usuario));

  return { sucesso: true, usuario };
}

/** Encerra a sessão e volta para a tela de login. */
export async function fazerLogout() {
  await supabase.auth.signOut();
  localStorage.removeItem('usuario_atual');
  window.location.href = 'index.html';
}

/**
 * Protege páginas internas: chame no topo de cada página
 * (dashboard.html, entrada.html, etc.) logo após o import.
 * Redireciona para o login se não houver sessão válida.
 */
export async function exigirLogin() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    window.location.href = 'index.html';
    return null;
  }

  const usuarioSalvo = localStorage.getItem('usuario_atual');
  if (!usuarioSalvo) {
    // Sessão existe no Supabase mas perdemos o cache local
    // (ex.: usuário abriu a aba direto). Recarrega do banco.
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_id', data.session.user.id)
      .single();

    if (!usuario) {
      window.location.href = 'index.html';
      return null;
    }
    localStorage.setItem('usuario_atual', JSON.stringify(usuario));
    return usuario;
  }

  return JSON.parse(usuarioSalvo);
}

/** Retorna o usuário logado a partir do cache local (sem consultar o banco). */
export function usuarioAtual() {
  const usuarioSalvo = localStorage.getItem('usuario_atual');
  return usuarioSalvo ? JSON.parse(usuarioSalvo) : null;
}

/** Verifica se o usuário logado tem um dos perfis informados. */
export function temPerfil(...perfis) {
  const usuario = usuarioAtual();
  return usuario ? perfis.includes(usuario.perfil) : false;
}

// --- helpers internos ---------------------------------------

function loginParaEmail(login) {
  // Se já digitaram um e-mail, usa direto; senão, monta um
  // e-mail interno a partir do login (ex.: "carlos" -> carlos@estacionamento.local)
  return login.includes('@') ? login : `${login}@estacionamento.local`;
}

function traduzErroLogin(error) {
  if (error.message.includes('Invalid login credentials')) {
    return 'Login ou senha incorretos.';
  }
  return 'Não foi possível entrar. Tente novamente.';
}
