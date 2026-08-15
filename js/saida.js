// ============================================================
// js/saida.js
// Página: saida.html
// Busca placa → calcula valor → finaliza → imprime recibo.
// ============================================================

import { exigirLogin, fazerLogout } from './auth.js';
import {
  formatarPlaca,
  formatarHora,
  formatarDuracao,
  formatarMoeda,
  formatarDataHoraCompleta,
  formatarCnpj,
} from './utils/formatadores.js';
import { placaValida } from './utils/validacoes.js';
import { minutosEntre, calcularValor } from './utils/calculos.js';
import { buscarMovimentacaoAbertaPorPlaca, fecharMovimentacao } from './services/movimentacoes.js';
import { imprimirCupom } from './utils/impressao.js';
import { linkWhatsapp, montarComprovanteSaida } from './utils/whatsapp.js';
import { gerarImagemComprovante, compartilharImagem, baixarImagem } from './utils/comprovante-imagem.js';
import { supabase } from './supabase.js';

const NOME_PAGINA = 'saida';

let movimentacaoAtual = null;
let valorCalculado = 0;
let estacionamentoAtual = null;  // nome, cnpj, contato, preços
let comprovante = null;          // dados da última saída finalizada
let imagemComprovante = null;    // blob PNG, gerado sob demanda

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario);
  estacionamentoAtual = await carregarEstacionamento(usuario);

  document.getElementById('form-busca').addEventListener('submit', aoConsultarPlaca);
  document.getElementById('btn-finalizar-saida').addEventListener('click', () => aoFinalizarSaida(usuario));

  document.getElementById('btn-imprimir-saida').addEventListener('click', aoImprimir);
  document.getElementById('btn-zap-saida').addEventListener('click', aoAbrirCampoZap);
  document.getElementById('btn-abrir-zap').addEventListener('click', aoEnviarZap);
  document.getElementById('btn-imagem-saida').addEventListener('click', aoGerarImagem);
  document.getElementById('btn-compartilhar').addEventListener('click', aoCompartilhar);
  document.getElementById('btn-baixar-imagem').addEventListener('click', aoBaixarImagem);
}

/**
 * Dados do estacionamento do usuário logado. Carregado uma vez
 * por página: alimenta o cálculo do valor e também o cabeçalho
 * do comprovante (nome, CNPJ, contato).
 */
async function carregarEstacionamento(usuario) {
  const { data } = await supabase
    .from('estacionamentos')
    .select('nome, cnpj, contato_responsavel, valor_bloco, minutos_bloco')
    .eq('id', usuario.estacionamento_id)
    .single();

  return data;
}

// ------------------------------------------------------------
// Shell (header/sidebar)
// ------------------------------------------------------------
async function montarShell(usuario) {
  const [htmlHeader, htmlSidebar] = await Promise.all([
    fetch('components/header.html').then((r) => r.text()),
    fetch('components/sidebar.html').then((r) => r.text()),
  ]);

  document.getElementById('header-container').innerHTML = htmlHeader;
  document.getElementById('sidebar-container').innerHTML = htmlSidebar;

  document.getElementById('topo-usuario-nome').textContent = usuario.nome;
  document.getElementById('topo-usuario-perfil').textContent = usuario.perfil;
  document.getElementById('topo-titulo-pagina').textContent = 'Registrar saída';

  document.getElementById('btn-sair').addEventListener('click', fazerLogout);

  document.querySelectorAll('.sidebar-item[data-perfis]').forEach((item) => {
    if (!item.dataset.perfis.split(',').includes(usuario.perfil)) item.remove();
  });

  const itemAtivo = document.querySelector(`.sidebar-item[data-pagina="${NOME_PAGINA}"]`);
  if (itemAtivo) itemAtivo.classList.add('ativo');

  const sidebar = document.getElementById('sidebar');
  document.getElementById('btn-menu-mobile').addEventListener('click', () => sidebar.classList.toggle('aberta'));
}

// ------------------------------------------------------------
// Consultar placa
// ------------------------------------------------------------
async function aoConsultarPlaca(evento) {
  evento.preventDefault();
  esconderResultado();

  const placa = formatarPlaca(document.getElementById('campo-placa').value);
  document.getElementById('campo-placa').value = placa;

  if (!placaValida(placa)) {
    mostrarAviso('Placa inválida. Use o formato ABC1234 ou ABC1D23.');
    return;
  }

  const movimentacao = await buscarMovimentacaoAbertaPorPlaca(placa);

  if (!movimentacao) {
    mostrarAviso('Nenhuma entrada em aberto encontrada para essa placa.');
    return;
  }

  movimentacaoAtual = movimentacao;
  const veiculo = movimentacao.veiculos;
  const agora = new Date().toISOString();

  // O valor por bloco / minutos por bloco vem do PRÓPRIO
  // estacionamento, carregado uma vez no início da página.
  valorCalculado = calcularValor(movimentacao.entrada, agora, estacionamentoAtual);
  const minutos = minutosEntre(movimentacao.entrada, agora);

  document.getElementById('info-nome').textContent = veiculo.clientes?.nome ?? '—';
  document.getElementById('info-modelo').textContent = veiculo.modelo ?? '—';
  document.getElementById('info-cor').textContent = veiculo.cor ?? '—';
  document.getElementById('info-entrada').textContent = formatarHora(movimentacao.entrada);
  document.getElementById('info-tempo').textContent = formatarDuracao(minutos);
  document.getElementById('info-valor').textContent = formatarMoeda(valorCalculado);

  document.getElementById('bloco-resultado').classList.remove('oculto');
}

// ------------------------------------------------------------
// Finalizar saída
// ------------------------------------------------------------
async function aoFinalizarSaida(usuario) {
  const btn = document.getElementById('btn-finalizar-saida');
  btn.disabled = true;
  btn.textContent = 'Finalizando...';

  const resultado = await fecharMovimentacao({
    id: movimentacaoAtual.id,
    funcionarioId: usuario.id,
    valor: valorCalculado,
  });

  btn.disabled = false;
  btn.textContent = '🟢 Finalizar saída';

  if (resultado.erro) {
    mostrarAviso(resultado.erro);
    return;
  }

  const veiculo = movimentacaoAtual.veiculos;
  const saida = resultado.movimentacao.saida;
  const minutos = minutosEntre(movimentacaoAtual.entrada, saida);

  // Guarda tudo que o comprovante precisa, em texto já formatado.
  // Serve tanto para o papel quanto para o WhatsApp.
  comprovante = {
    estacionamento: estacionamentoAtual,
    placa: veiculo.placa,
    entrada: formatarDataHoraCompleta(movimentacaoAtual.entrada),
    saida: formatarDataHoraCompleta(saida),
    tempo: formatarDuracao(minutos),
    valor: formatarMoeda(valorCalculado),
    funcionario: usuario.nome,
    // Telefone do cliente, se ele já estiver cadastrado
    contatoCliente: veiculo.clientes?.contato ?? '',
  };

  mostrarSucesso();
}

// ------------------------------------------------------------
// Comprovante: imprimir ou enviar no WhatsApp
// ------------------------------------------------------------
function mostrarSucesso() {
  document.getElementById('bloco-resultado').classList.add('oculto');
  document.getElementById('bloco-zap').classList.add('oculto');
  document.getElementById('bloco-imagem').classList.add('oculto');
  document.getElementById('aviso-zap').classList.add('oculto');
  document.getElementById('aviso-imagem').classList.add('oculto');
  imagemComprovante = null;

  document.getElementById('resumo-saida').textContent =
    `${comprovante.placa} · ${comprovante.tempo} · ${comprovante.valor}`;

  document.getElementById('campo-zap').value = comprovante.contatoCliente;
  document.getElementById('bloco-sucesso').classList.remove('oculto');

  // Já limpa o campo e devolve o cursor para a placa: o atendente
  // digita a próxima direto. O valor cobrado e os botões de
  // comprovante continuam na tela até a nova consulta.
  document.getElementById('form-busca').reset();
  movimentacaoAtual = null;
  document.getElementById('campo-placa').focus();
}

function aoImprimir() {
  imprimirCupom({
    'recibo-nome-estacionamento': comprovante.estacionamento?.nome ?? 'Estacionamento',
    'recibo-cnpj': comprovante.estacionamento?.cnpj ? `CNPJ: ${formatarCnpj(comprovante.estacionamento.cnpj)}` : '',
    'recibo-contato': comprovante.estacionamento?.contato_responsavel ?? '',
    'recibo-placa': comprovante.placa,
    'recibo-entrada': comprovante.entrada,
    'recibo-saida': comprovante.saida,
    'recibo-tempo': comprovante.tempo,
    'recibo-valor': comprovante.valor,
    'recibo-funcionario': comprovante.funcionario,
  });
}

function aoAbrirCampoZap() {
  document.getElementById('bloco-zap').classList.remove('oculto');
  document.getElementById('campo-zap').focus();
}

// ------------------------------------------------------------
// Comprovante em imagem
// ------------------------------------------------------------

/** Nome do arquivo: comprovante-ABC1D23.png */
function nomeArquivoImagem() {
  return `comprovante-${comprovante.placa}.png`;
}

/**
 * Desenha o comprovante e mostra na tela do atendente.
 * A imagem é gerada aqui (e não na hora de enviar) porque o
 * compartilhamento nativo só funciona se o arquivo já estiver
 * pronto quando o dedo toca no botão.
 */
async function aoGerarImagem() {
  const botao = document.getElementById('btn-imagem-saida');
  botao.disabled = true;
  botao.textContent = 'Gerando...';

  const { canvas, blob } = await gerarImagemComprovante({
    estacionamento: {
      ...comprovante.estacionamento,
      cnpj: formatarCnpj(comprovante.estacionamento?.cnpj),
    },
    placa: comprovante.placa,
    entrada: comprovante.entrada,
    saida: comprovante.saida,
    tempo: comprovante.tempo,
    valor: comprovante.valor,
    funcionario: comprovante.funcionario,
  });

  imagemComprovante = blob;

  const previa = document.getElementById('previa-comprovante');
  previa.innerHTML = '';
  canvas.removeAttribute('style');
  previa.appendChild(canvas);

  document.getElementById('aviso-imagem').classList.add('oculto');
  document.getElementById('bloco-imagem').classList.remove('oculto');

  botao.disabled = false;
  botao.textContent = '🖼️ Gerar comprovante';
}

async function aoCompartilhar() {
  if (!imagemComprovante) return;

  const aviso = document.getElementById('aviso-imagem');
  const resultado = await compartilharImagem(imagemComprovante, nomeArquivoImagem());

  if (resultado === 'sem-suporte') {
    aviso.textContent = 'Este aparelho não abre a tela de compartilhamento. Use "Salvar no aparelho" e anexe no WhatsApp.';
    aviso.classList.remove('oculto');
    return;
  }

  // 'enviado' e 'cancelado' não precisam de aviso: o próprio
  // celular já mostrou o que aconteceu.
  aviso.classList.add('oculto');
}

function aoBaixarImagem() {
  if (!imagemComprovante) return;
  baixarImagem(imagemComprovante, nomeArquivoImagem());
}

function aoEnviarZap() {
  const telefone = document.getElementById('campo-zap').value.replace(/\D/g, '');
  const aviso = document.getElementById('aviso-zap');

  // 10 dígitos (DDD + 8) ou 11 (DDD + 9). Mais que isso só se
  // já vier com o código do país.
  if (telefone.length < 10) {
    aviso.textContent = 'Digite o número com DDD. Exemplo: 35999999999';
    aviso.classList.remove('oculto');
    document.getElementById('campo-zap').focus();
    return;
  }

  aviso.classList.add('oculto');

  const mensagem = montarComprovanteSaida({
    estacionamento: {
      ...comprovante.estacionamento,
      cnpj: formatarCnpj(comprovante.estacionamento?.cnpj),
    },
    placa: comprovante.placa,
    entrada: comprovante.entrada,
    saida: comprovante.saida,
    tempo: comprovante.tempo,
    valor: comprovante.valor,
    funcionario: comprovante.funcionario,
  });

  window.open(linkWhatsapp(telefone, mensagem), '_blank', 'noopener');
}

// ------------------------------------------------------------
// Helpers de UI
// ------------------------------------------------------------
function mostrarAviso(mensagem) {
  const div = document.getElementById('aviso-placa');
  div.textContent = mensagem;
  div.classList.remove('oculto');
}

function esconderResultado() {
  document.getElementById('bloco-resultado').classList.add('oculto');
  document.getElementById('bloco-sucesso').classList.add('oculto');
  document.getElementById('bloco-zap').classList.add('oculto');
  document.getElementById('bloco-imagem').classList.add('oculto');
  document.getElementById('aviso-placa').classList.add('oculto');
  document.getElementById('aviso-zap').classList.add('oculto');
  document.getElementById('aviso-imagem').classList.add('oculto');
  imagemComprovante = null;
}


iniciar();
