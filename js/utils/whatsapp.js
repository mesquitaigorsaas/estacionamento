// ============================================================
// js/utils/whatsapp.js
// Monta links de WhatsApp: avisos de vencimento (mensalistas)
// e comprovante de pagamento (saída do pátio).
//
// Link wa.me só carrega TEXTO — não dá para anexar PDF ou
// imagem. Por isso o comprovante vai escrito na mensagem, com
// os dados completos do estabelecimento para servir de
// documento de reembolso.
// ============================================================

export function linkWhatsapp(telefone, mensagem) {
  let numero = (telefone || '').replace(/\D/g, '');

  // Número brasileiro tem 10 ou 11 dígitos (DDD + 8 ou 9).
  // Se vier com mais que isso começando em 55, o código do país
  // já está lá e não pode ser repetido. O teste de tamanho evita
  // confundir com o DDD 55 (Rio Grande do Sul).
  if (!numero.startsWith('55') || numero.length <= 11) {
    numero = `55${numero}`;
  }

  const texto = encodeURIComponent(mensagem);
  return `https://wa.me/${numero}?text=${texto}`;
}

export function montarAvisoVencimento(nomeCliente, dataVencimento) {
  const dataFormatada = new Date(`${dataVencimento}T00:00:00`).toLocaleDateString('pt-BR');
  return `Olá ${nomeCliente}! Passando para lembrar que sua mensalidade do estacionamento vence em ${dataFormatada}. Qualquer dúvida, estamos à disposição!`;
}

/**
 * Monta o comprovante de pagamento enviado na saída.
 * Os asteriscos viram negrito dentro do WhatsApp.
 *
 * `estacionamento` traz nome, cnpj e contato_responsavel — sem
 * esses dados o comprovante não serve para reembolso.
 */
export function montarComprovanteSaida({
  estacionamento,
  placa,
  entrada,
  saida,
  tempo,
  valor,
  funcionario,
}) {
  const linhas = [
    `🅿️ *${estacionamento?.nome ?? 'Estacionamento'}*`,
  ];

  if (estacionamento?.cnpj) linhas.push(`CNPJ: ${estacionamento.cnpj}`);
  if (estacionamento?.contato_responsavel) linhas.push(`Contato: ${estacionamento.contato_responsavel}`);

  linhas.push(
    '',
    '*COMPROVANTE DE PAGAMENTO*',
    '',
    `Placa: ${placa}`,
    `Entrada: ${entrada}`,
    `Saída: ${saida}`,
    `Permanência: ${tempo}`,
    `*Valor pago: ${valor}*`,
    '',
    `Atendente: ${funcionario}`,
    '',
    'Obrigado pela preferência!',
  );

  return linhas.join('\n');
}
