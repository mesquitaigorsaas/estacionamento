// ============================================================
// js/utils/whatsapp.js
// Monta links de WhatsApp para avisos de vencimento.
// ============================================================

export function linkWhatsapp(telefone, mensagem) {
  const numero = (telefone || '').replace(/\D/g, '');
  const texto = encodeURIComponent(mensagem);
  return `https://wa.me/55${numero}?text=${texto}`;
}

export function montarAvisoVencimento(nomeCliente, dataVencimento) {
  const dataFormatada = new Date(`${dataVencimento}T00:00:00`).toLocaleDateString('pt-BR');
  return `Olá ${nomeCliente}! Passando para lembrar que sua mensalidade do estacionamento vence em ${dataFormatada}. Qualquer dúvida, estamos à disposição!`;
}