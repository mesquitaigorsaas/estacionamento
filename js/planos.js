// ============================================================
// js/planos.js
// Os planos de assinatura do Achei Vaga, num lugar só.
//
// Usado pela tela de cadastro (para mandar ao pagamento) e pela
// tela de login (para quem se cadastrou e ainda não pagou poder
// voltar e pagar).
//
// PARA TROCAR DE PLANO OU DE VALOR: mude aqui e no texto dos
// cartões em index.html. Os links vêm de
// Mercado Pago → Planos de assinatura.
// ============================================================

export const PLANOS = {
  semestral: {
    nome: 'Plano Semestral',
    valor: 'R$ 119,00 a cada 6 meses',
    link: 'https://mpago.la/2BGHhME',
  },
  anual: {
    nome: 'Plano Anual',
    valor: 'R$ 214,90 por ano',
    link: 'https://mpago.la/2r3cbwr',
  },
};

/** Devolve o plano pedido; cai no anual, que é o do cartão em destaque. */
export function planoOu(nome) {
  return PLANOS[nome] ?? PLANOS.anual;
}
