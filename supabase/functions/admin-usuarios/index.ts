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
      .select('perfil, estacionamento_id')
      .eq('auth_id', user.id)
      .single();

    if (erroPerfil || usuarioChamador?.perfil !== 'administrador') {
      return respostaErro('Apenas administradores podem gerenciar usuários.', 403);
    }

    const body = await req.json();

    // O funcionário novo entra SEMPRE no estacionamento de quem
    // está cadastrando. Nunca vem do navegador: senão um admin
    // poderia criar usuário dentro do estacionamento de outro.
    if (body.acao === 'criar') {
      return await criarUsuario(supabaseAdmin, body, usuarioChamador.estacionamento_id);
    }
    if (body.acao === 'resetar_senha') {
      return await resetarSenha(supabaseAdmin, body, usuarioChamador.estacionamento_id);
    }
    if (body.acao === 'deletar') {
      return await deletarUsuario(supabaseAdmin, body, usuarioChamador.estacionamento_id);
    }

    return respostaErro('Ação inválida.', 400);
  } catch (erro) {
    return respostaErro(erro instanceof Error ? erro.message : 'Erro inesperado.', 500);
  }
});

async function criarUsuario(supabaseAdmin, { nome, login, senha, perfil }, estacionamentoId) {
  if (!nome || !login || !senha || !perfil) {
    return respostaErro('Preencha nome, login, senha e perfil.', 400);
  }

  // Sem estacionamento o usuário até é criado, mas nunca consegue
  // entrar: o login confere a assinatura do estacionamento dele.
  // Melhor recusar aqui do que entregar um acesso quebrado.
  if (!estacionamentoId) {
    return respostaErro('Seu usuário não está vinculado a um estacionamento. Contate o suporte.', 400);
  }

  const { data: authData, error: erroAuth } = await supabaseAdmin.auth.admin.createUser({
    email: login,
    password: senha,
    email_confirm: true,
  });

  if (erroAuth) return respostaErro(traduzErroCadastro(erroAuth.message), 400);

  const { error: erroInsercao } = await supabaseAdmin.from('usuarios').insert({
    auth_id: authData.user.id,
    nome,
    login,
    perfil,
    ativo: true,
    estacionamento_id: estacionamentoId,
  });

  if (erroInsercao) {
    // Reverte a criação no Auth se a inserção na tabela falhar,
    // pra não ficar um usuário órfão sem linha em "usuarios".
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    return respostaErro(erroInsercao.message, 400);
  }

  return respostaOk({ ok: true });
}

/**
 * Busca o usuário alvo GARANTINDO que ele é do mesmo
 * estacionamento de quem pediu.
 *
 * Esta função roda com a chave mestra, que ignora as regras de
 * segurança do banco. Sem esta checagem, o administrador de um
 * estacionamento conseguiria resetar a senha ou excluir usuários
 * de outro, só trocando o id enviado pelo navegador.
 */
async function buscarUsuarioDoMesmoEstacionamento(supabaseAdmin, usuarioId, estacionamentoId) {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('auth_id, estacionamento_id')
    .eq('id', usuarioId)
    .single();

  if (error || !data) return null;
  if (!estacionamentoId || data.estacionamento_id !== estacionamentoId) return null;

  return data;
}

async function resetarSenha(supabaseAdmin, { usuarioId, novaSenha }, estacionamentoId) {
  if (!usuarioId || !novaSenha) return respostaErro('Dados incompletos.', 400);

  const usuario = await buscarUsuarioDoMesmoEstacionamento(supabaseAdmin, usuarioId, estacionamentoId);
  if (!usuario) return respostaErro('Usuário não encontrado.', 404);

  const { error } = await supabaseAdmin.auth.admin.updateUserById(usuario.auth_id, {
    password: novaSenha,
  });

  if (error) return respostaErro(error.message, 400);
  return respostaOk({ ok: true });
}

async function deletarUsuario(supabaseAdmin, { usuarioId }, estacionamentoId) {
  if (!usuarioId) return respostaErro('Usuário não informado.', 400);

  const usuario = await buscarUsuarioDoMesmoEstacionamento(supabaseAdmin, usuarioId, estacionamentoId);
  if (!usuario) return respostaErro('Usuário não encontrado.', 404);

  await supabaseAdmin.from('usuarios').delete().eq('id', usuarioId);
  await supabaseAdmin.auth.admin.deleteUser(usuario.auth_id);

  return respostaOk({ ok: true });
}

/**
 * O Supabase responde em inglês e falando de "e-mail", mas na
 * tela o campo se chama "login". Traduz para o que o dono do
 * estacionamento entende, com a saída já indicada.
 */
function traduzErroCadastro(mensagem) {
  const texto = (mensagem ?? '').toLowerCase();

  if (texto.includes('already been registered') || texto.includes('already exists')) {
    return 'Este login já está em uso. Escolha outro — por exemplo, acrescente o sobrenome.';
  }
  if (texto.includes('password')) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
  if (texto.includes('invalid') && texto.includes('email')) {
    return 'Login inválido. Use o formato nome@estacionamento.local, sem espaços nem acentos.';
  }
  return `Não foi possível cadastrar: ${mensagem}`;
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
