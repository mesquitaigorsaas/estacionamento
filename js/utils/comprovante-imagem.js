// ============================================================
// js/utils/comprovante-imagem.js
// Desenha o comprovante de saída como imagem PNG e compartilha
// pela bandeja nativa do celular (WhatsApp, e-mail, etc).
//
// Desenhado direto no <canvas>, sem biblioteca externa: o
// comprovante é só texto em linhas, então não compensa carregar
// um megabyte de dependência para isso.
// ============================================================

const LARGURA = 640;
const MARGEM = 44;
const COR_FUNDO = '#FFFFFF';
const COR_TEXTO = '#111827';
const COR_SUAVE = '#6B7280';
const COR_LINHA = '#D1D5DB';

// Alturas de cada tipo de linha, usadas para calcular o tamanho
// total antes de desenhar.
const ALTURAS = {
  titulo: 46,
  subtitulo: 30,
  secao: 44,
  par: 40,
  destaque: 58,
  divisor: 26,
  espaco: 18,
  rodape: 34,
};

/**
 * Monta a lista de linhas do comprovante a partir dos dados.
 * Separado do desenho para o cálculo de altura ficar simples.
 */
function montarLinhas({ estacionamento, placa, entrada, saida, tempo, valor, funcionario }) {
  const linhas = [
    { tipo: 'titulo', texto: estacionamento?.nome ?? 'Estacionamento' },
  ];

  if (estacionamento?.cnpj) linhas.push({ tipo: 'subtitulo', texto: `CNPJ: ${estacionamento.cnpj}` });
  if (estacionamento?.contato_responsavel) linhas.push({ tipo: 'subtitulo', texto: estacionamento.contato_responsavel });

  linhas.push(
    { tipo: 'divisor' },
    { tipo: 'secao', texto: 'COMPROVANTE DE PAGAMENTO' },
    { tipo: 'divisor' },
    { tipo: 'par', rotulo: 'Placa', valor: placa },
    { tipo: 'par', rotulo: 'Entrada', valor: entrada },
    { tipo: 'par', rotulo: 'Saída', valor: saida },
    { tipo: 'par', rotulo: 'Permanência', valor: tempo },
    { tipo: 'espaco' },
    { tipo: 'destaque', rotulo: 'Valor pago', valor },
    { tipo: 'divisor' },
    { tipo: 'par', rotulo: 'Atendente', valor: funcionario },
    { tipo: 'espaco' },
    { tipo: 'rodape', texto: 'Obrigado pela preferência!' },
  );

  return linhas;
}

/**
 * Desenha o comprovante e devolve { canvas, blob }.
 * O blob já vem pronto para ser compartilhado ou baixado.
 */
export async function gerarImagemComprovante(dados) {
  const linhas = montarLinhas(dados);
  const alturaConteudo = linhas.reduce((total, l) => total + ALTURAS[l.tipo], 0);
  const altura = alturaConteudo + MARGEM * 2;

  // escala 2x para a imagem não sair borrada em tela de celular
  const escala = 2;
  const canvas = document.createElement('canvas');
  canvas.width = LARGURA * escala;
  canvas.height = altura * escala;

  const ctx = canvas.getContext('2d');
  ctx.scale(escala, escala);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = COR_FUNDO;
  ctx.fillRect(0, 0, LARGURA, altura);

  const meio = LARGURA / 2;
  const direita = LARGURA - MARGEM;
  let y = MARGEM;

  linhas.forEach((linha) => {
    const h = ALTURAS[linha.tipo];
    const centroY = y + h / 2;

    switch (linha.tipo) {
      case 'titulo':
        ctx.fillStyle = COR_TEXTO;
        ctx.font = 'bold 30px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(linha.texto, meio, centroY, LARGURA - MARGEM * 2);
        break;

      case 'subtitulo':
        ctx.fillStyle = COR_SUAVE;
        ctx.font = '18px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(linha.texto, meio, centroY, LARGURA - MARGEM * 2);
        break;

      case 'secao':
        ctx.fillStyle = COR_TEXTO;
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(linha.texto, meio, centroY);
        break;

      case 'par':
        ctx.fillStyle = COR_SUAVE;
        ctx.font = '19px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(linha.rotulo, MARGEM, centroY);

        ctx.fillStyle = COR_TEXTO;
        ctx.font = 'bold 19px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(linha.valor, direita, centroY);
        break;

      case 'destaque':
        ctx.fillStyle = COR_TEXTO;
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(linha.rotulo, MARGEM, centroY);

        ctx.font = 'bold 34px Arial, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(linha.valor, direita, centroY);
        break;

      case 'divisor':
        ctx.strokeStyle = COR_LINHA;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(MARGEM, Math.round(centroY) + 0.5);
        ctx.lineTo(direita, Math.round(centroY) + 0.5);
        ctx.stroke();
        break;

      case 'rodape':
        ctx.fillStyle = COR_SUAVE;
        ctx.font = '18px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(linha.texto, meio, centroY);
        break;

      default: // espaco
        break;
    }

    y += h;
  });

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return { canvas, blob };
}

/**
 * Abre a bandeja de compartilhamento do aparelho com a imagem.
 * Devolve o que aconteceu para a tela decidir o que dizer:
 *   'enviado'      — bandeja abriu e o usuário concluiu
 *   'cancelado'    — bandeja abriu e o usuário desistiu
 *   'sem-suporte'  — aparelho não compartilha arquivo (PC, em geral)
 */
export async function compartilharImagem(blob, nomeArquivo) {
  const arquivo = new File([blob], nomeArquivo, { type: 'image/png' });

  if (!navigator.canShare || !navigator.canShare({ files: [arquivo] })) {
    return 'sem-suporte';
  }

  try {
    await navigator.share({ files: [arquivo], title: 'Comprovante de pagamento' });
    return 'enviado';
  } catch (erro) {
    // O navegador dispara AbortError quando o usuário fecha a bandeja.
    if (erro.name === 'AbortError') return 'cancelado';
    return 'sem-suporte';
  }
}

/** Salva a imagem no aparelho — usado quando não há compartilhamento. */
export function baixarImagem(blob, nomeArquivo) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}
