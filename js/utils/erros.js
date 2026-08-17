// ============================================================
// js/utils/erros.js
// Lê a mensagem de erro devolvida por uma Edge Function.
//
// POR QUE ISSO EXISTE:
// Quando a função responde com erro (400, 403...), a biblioteca
// do Supabase NÃO coloca o corpo da resposta em `data` — ela
// devolve `data: null` e guarda a resposta dentro de
// `error.context`. Ler só o `data.erro` faz a mensagem escrita
// com cuidado no servidor se perder, e o usuário recebe um
// "tente novamente" que não explica nada.
// ============================================================

/**
 * Devolve a melhor mensagem disponível para o usuário.
 *
 * @param {object|null} error - erro devolvido pelo functions.invoke
 * @param {object|null} data  - corpo devolvido quando deu certo
 * @param {string} padrao     - texto usado se nada mais servir
 */
export async function mensagemDaFuncao(error, data, padrao) {
  // Função respondeu 200 mas com erro no corpo
  if (data?.erro) return data.erro;

  // Função respondeu 4xx/5xx: o corpo está dentro do erro
  try {
    const corpo = await error?.context?.json?.();
    if (corpo?.erro) return corpo.erro;
  } catch {
    // Resposta sem corpo JSON — segue para o texto padrão
  }

  return padrao;
}
