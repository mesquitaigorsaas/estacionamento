// ============================================================
// supabase/functions/admin-usuarios/index.ts
// Edge Function: cria, reseta senha e exclui usuários.
// Roda no servidor do Supabase — é o único lugar autorizado a
// usar a service role key (nunca deixar essa chave no navegador).
//
// Quem chama precisa estar logado E ser perfil "administrador"
// (checado aqui dentro, na tabela "usuarios").
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');

    // Cliente "do chamador" — só pra descobrir quem está fazendo a requisição.
    const supabaseChamador = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: erroAuth } = await supabaseChamador.auth.getUser(token);
    if (erroAuth || !user) {
      return respostaErro('Não autenticado.', 401);
    }

    // Cliente com service role — bypassa RLS. Só é usado DEPOIS de
    // confirmar que quem chamou é administrador.
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: usuarioChamador, error: erroPerfil } = await supabaseAdmin
      .from('usuarios')
      .select('perfil')
      .eq('auth_id', user.id)
      .single();

    if (erroPerfil || usuarioChamador?.perfil !== 'administrador') {
      return respostaErro('Apenas administradores podem gerenciar usuários.', 403);
    }

    const body = await req.json();

    if (body.acao === 'criar') return await criarUsuario(supabaseAdmin, body);
    if (body.acao === 'resetar_senha') return await resetarSenha(supabaseAdmin, body);
    if (body.acao === 'deletar') return await deletarUsuario(supabaseAdmin, body);

    return respostaErro('Ação inválida.', 400);
  } catch (erro) {
    return respostaErro(erro instanceof Error ? erro.message : 'Erro inesperado.', 500);
  }
});

async function criarUsuario(supabaseAdmin, { nome, login, senha, perfil }) {
  if (!nome || !login || !senha || !perfil) {
    return respostaErro('Preencha nome, login, senha e perfil.', 400);
  }

  const { data: authData, error: erroAuth } = await supabaseAdmin.auth.admin.createUser({
    email: login,
    password: senha,
    email_confirm: true,
  });

  if (erroAuth) return respostaErro(erroAuth.message, 400);

  const { error: erroInsercao } = await supabaseAdmin.from('usuarios').insert({
    auth_id: authData.user.id,
    nome,
    login,
    perfil,
    ativo: true,
  });

  if (erroInsercao) {
    // Reverte a criação no Auth se a inserção na tabela falhar,
    // pra não ficar um usuário órfão sem linha em "usuarios".
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return respostaErro(erroInsercao.message, 400);
  }

  return respostaOk({ ok: true });
}

async function resetarSenha(supabaseAdmin, { usuarioId, novaSenha }) {
  if (!usuarioId || !novaSenha) return respostaErro('Dados incompletos.', 400);

  const { data: usuario, error: erroBusca } = await supabaseAdmin
    .from('usuarios')
    .select('auth_id')
    .eq('id', usuarioId)
    .single();

  if (erroBusca || !usuario) return respostaErro('Usuário não encontrado.', 404);

  const { error } = await supabaseAdmin.auth.admin.updateUserById(usuario.auth_id, {
    password: novaSenha,
  });

  if (error) return respostaErro(error.message, 400);
  return respostaOk({ ok: true });
}

async function deletarUsuario(supabaseAdmin, { usuarioId }) {
  if (!usuarioId) return respostaErro('Usuário não informado.', 400);

  const { data: usuario, error: erroBusca } = await supabaseAdmin
    .from('usuarios')
    .select('auth_id')
    .eq('id', usuarioId)
    .single();

  if (erroBusca || !usuario) return respostaErro('Usuário não encontrado.', 404);

  await supabaseAdmin.from('usuarios').delete().eq('id', usuarioId);
  await supabaseAdmin.auth.admin.deleteUser(usuario.auth_id);

  return respostaOk({ ok: true });
}

function respostaOk(corpo) {
  return new Response(JSON.stringify(corpo), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

function respostaErro(mensagem, status) {
  return new Response(JSON.stringify({ erro: mensagem }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
