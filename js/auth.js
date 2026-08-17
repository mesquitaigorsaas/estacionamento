// ============================================================
// js/auth.js
// Autenticação: login, logout, proteção de páginas internas.
// Importado pela index.html (login) e por todas as páginas
// internas (dashboard.html, entrada.html, etc.) para proteção.
//
// A partir da migração multi-tenant, também checa se a
// assinatura do estacionamento do usuário está ativa — se não
// estiver, bloqueia o acesso mesmo com login/senha corretos.
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

  const assinatura = await verificarAssinaturaAtiva(usuario.estacionamento_id);
  if (!assinatura.ativa) {
    await supabase.auth.signOut();
    return { sucesso: false, mensagem: assinatura.mensagem, aguardando: assinatura.aguardando };
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
 * Redireciona para o login se não houver sessão válida, o
 * cadastro do usuário não existir/estiver inativo, ou a
 * assinatura do estacionamento não estiver ativa.
 */
export async function exigirLogin() {
  const { data } = await supabase.auth.getSession();

  if (!data.session) {
    window.location.href = 'index.html';
    return null;
  }

  let usuario = null;
  const usuarioSalvo = localStorage.getItem('usuario_atual');

  if (usuarioSalvo) {
    usuario = JSON.parse(usuarioSalvo);
  } else {
    // Sessão existe no Supabase mas perdemos o cache local
    // (ex.: usuário abriu a aba direto). Recarrega do banco.
    const { data: usuarioBanco } = await supabase
      .from('usuarios')
      .select('*')
      .eq('auth_id', data.session.user.id)
      .single();

    if (!usuarioBanco) {
      window.location.href = 'index.html';
      return null;
    }
    usuario = usuarioBanco;
    localStorage.setItem('usuario_atual', JSON.stringify(usuario));
  }

  // Checa a cada carregamento de página — se a assinatura vencer
  // ou for cancelada, o acesso é cortado mesmo com sessão ainda
  // válida (sem precisar esperar o usuário deslogar/logar de novo).
  const assinatura = await verificarAssinaturaAtiva(usuario.estacionamento_id);
  if (!assinatura.ativa) {
    await supabase.auth.signOut();
    localStorage.removeItem('usuario_atual');
    window.location.href = 'acesso-suspenso.html';
    return null;
  }

  return usuario;
}

/**
 * Tranca a página para quem não tem o perfil certo.
 * Chame logo depois do exigirLogin:
 *
 *   const usuario = await exigirLogin();
 *   if (!usuario) return;
 *   if (!exigirPerfil(usuario, 'administrador')) return;
 *
 * Esconder o item do menu não basta: sem isso, um funcionário
 * digita o endereço da página no navegador e entra do mesmo jeito.
 */
export function exigirPerfil(usuario, ...perfisPermitidos) {
  if (!usuario || !perfisPermitidos.includes(usuario.perfil)) {
    window.location.href = 'dashboard.html';
    return false;
  }
  return true;
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

/** Confirma se o estacionamento do usuário está com assinatura ativa. */
async function verificarAssinaturaAtiva(estacionamentoId) {
  const { data: estacionamento, error } = await supabase
    .from('estacionamentos')
    .select('assinatura_status')
    .eq('id', estacionamentoId)
    .single();

  if (error || !estacionamento) {
    return { ativa: false, mensagem: 'Não foi possível confirmar o acesso do seu estacionamento. Contate o suporte.' };
  }

  // Quem acabou de se cadastrar e ainda não pagou não fez nada de
  // errado — a mensagem precisa dizer isso, e não "suspenso".
  if (estacionamento.assinatura_status === 'aguardando_pagamento') {
    return {
      ativa: false,
      // Não é erro: a tela usa isso para pintar de aviso, não de
      // vermelho. Quem se cadastrou e não pagou ainda não errou nada.
      aguardando: true,
      mensagem: 'Seu cadastro foi recebido! O acesso é liberado assim que o pagamento for confirmado.',
    };
  }

  if (estacionamento.assinatura_status !== 'ativa') {
    return { ativa: false, mensagem: 'O acesso deste estacionamento está suspenso. Contate o suporte para regularizar a assinatura.' };
  }

  return { ativa: true };
}

function traduzErroLogin(error) {
  if (error.message.includes('Invalid login credentials')) {
    return 'Login ou senha incorretos.';
  }
  return 'Não foi possível entrar. Tente novamente.';
}
