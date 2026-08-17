// ============================================================
// supabase/functions/cadastro-estacionamento/index.ts
//
// Edge Function PÚBLICA: cria o cadastro de um estacionamento
// novo a partir da tela de assinatura. É chamada por visitante
// não logado, então não exige autenticação.
//
// Cria três coisas, nesta ordem:
//   1. o estacionamento, como "aguardando_pagamento"
//   2. o acesso (e-mail + senha) no Supabase Auth
//   3. o usuário administrador ligando os dois
//
// Se qualquer passo falhar, desfaz os anteriores — melhor não
// existir do que existir pela metade.
//
// O acesso NÃO libera o login: o sistema confere
// assinatura_status = 'ativa' na entrada. Quem acabou de se
// cadastrar só entra depois que o suporte libera.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PLANOS_VALIDOS = ['semestral', 'anual'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const erro = validar(body);
    if (erro) return resposta({ erro }, 400);

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const cnpj = somenteNumeros(body.cnpj);
    const email = String(body.email).trim().toLowerCase();

    // --- 1. estacionamento -----------------------------------
    const { data: estacionamento, error: erroEstacionamento } = await supabase
      .from('estacionamentos')
      .insert({
        nome: body.nome.trim(),
        cnpj,
        responsavel: body.responsavel.trim(),
        contato_responsavel: body.contato.trim(),
        plano: body.plano,
        assinatura_status: 'aguardando_pagamento',
      })
      .select('id')
      .single();

    if (erroEstacionamento) {
      // 23505 = valor duplicado; o único campo único aqui é o CNPJ
      if (erroEstacionamento.code === '23505') {
        return resposta({ erro: 'Já existe um estacionamento cadastrado com este CNPJ.' }, 400);
      }
      return resposta({ erro: 'Não foi possível criar o cadastro. Tente novamente.' }, 400);
    }

    // --- 2. acesso -------------------------------------------
    const { data: auth, error: erroAuth } = await supabase.auth.admin.createUser({
      email,
      password: body.senha,
      email_confirm: true,
    });

    if (erroAuth) {
      await supabase.from('estacionamentos').delete().eq('id', estacionamento.id);
      return resposta({ erro: traduzErroAcesso(erroAuth.message) }, 400);
    }

    // --- 3. usuário administrador ----------------------------
    const { error: erroUsuario } = await supabase.from('usuarios').insert({
      auth_id: auth.user.id,
      estacionamento_id: estacionamento.id,
      nome: body.responsavel.trim(),
      login: email,
      perfil: 'administrador',
      ativo: true,
    });

    if (erroUsuario) {
      await supabase.auth.admin.deleteUser(auth.user.id);
      await supabase.from('estacionamentos').delete().eq('id', estacionamento.id);
      return resposta({ erro: 'Não foi possível concluir o cadastro. Tente novamente.' }, 400);
    }

    return resposta({ ok: true }, 200);
  } catch (erro) {
    console.error('Erro no cadastro:', erro);
    return resposta({ erro: 'Erro inesperado. Tente novamente.' }, 500);
  }
});

// ------------------------------------------------------------
// Validação
// Esta função é pública: tudo que chega precisa ser conferido
// aqui dentro. O que o navegador validou não vale nada, porque
// dá para chamar a função sem passar pela tela.
// ------------------------------------------------------------
function validar(body) {
  const obrigatorios = ['nome', 'cnpj', 'responsavel', 'contato', 'email', 'senha', 'plano'];
  for (const campo of obrigatorios) {
    if (!body?.[campo] || String(body[campo]).trim() === '') {
      return 'Preencha todos os campos.';
    }
  }

  if (somenteNumeros(body.cnpj).length !== 14) return 'O CNPJ precisa ter 14 números.';
  if (String(body.senha).length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (!String(body.email).includes('@')) return 'Informe um e-mail válido.';
  if (!PLANOS_VALIDOS.includes(body.plano)) return 'Plano inválido.';
  if (String(body.nome).trim().length < 3) return 'Informe o nome do estacionamento.';

  return null;
}

function somenteNumeros(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

function traduzErroAcesso(mensagem) {
  const texto = (mensagem ?? '').toLowerCase();
  if (texto.includes('already been registered') || texto.includes('already exists')) {
    return 'Este e-mail já está cadastrado. Use outro ou fale com o suporte.';
  }
  if (texto.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  return 'Não foi possível criar o acesso. Confira o e-mail informado.';
}

function resposta(corpo, status) {
  return new Response(JSON.stringify(corpo), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}
