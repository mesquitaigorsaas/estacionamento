// ============================================================
// js/utils/validacoes.js
// Validações simples de formulário.
// ============================================================

/** Aceita placa no padrão antigo (ABC1234) e Mercosul (ABC1D23). */
export function placaValida(placa) {
  const limpa = (placa || '').trim().toUpperCase();
  const padraoAntigo = /^[A-Z]{3}[0-9]{4}$/;
  const padraoMercosul = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
  return padraoAntigo.test(limpa) || padraoMercosul.test(limpa);
}

export function campoPreenchido(valor) {
  return Boolean(valor && valor.trim().length > 0);
}