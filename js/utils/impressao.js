// ============================================================
// js/utils/impressao.js
// Preenche o cupom escondido na página e chama a impressão.
//
// O cupom é aquele <div class="recibo"> que fica invisível na
// tela e só aparece no papel (regra em css/forms.css, @media print).
// ============================================================

/**
 * Preenche os campos do cupom e abre a janela de impressão.
 *
 * Recebe um objeto onde a chave é o id do elemento no HTML e o
 * valor é o texto a colocar nele. Campos que não existirem na
 * página são ignorados — a entrada tem menos linhas que a saída.
 *
 * Exemplo:
 *   imprimirCupom({ 'recibo-placa': 'ABC1D23', 'recibo-valor': 'R$ 12,50' });
 */
export function imprimirCupom(campos) {
  Object.entries(campos).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  });

  window.print();
}
