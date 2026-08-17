// ============================================================
// js/assinantes.js
// Página: assinantes.html — só para a equipe do Achei Vaga.
//
// É a única tela que enxerga TODOS os estacionamentos. Quem faz
// isso funcionar é a marca `suporte` na tabela usuarios, junto
// com as regras de segurança do banco: sem ela, a consulta
// devolve só o próprio estacionamento.
//
// Serve para liberar quem pagou e cortar quem parou de pagar.
// ============================================================

import { exigirLogin } from './auth.js';
import { montarShell } from './utils/layout.js';
import { supabase } from './supabase.js';
import { formatarCnpj, formatarDataHora } from './utils/formatadores.js';
import { linkWhatsapp } from './utils/whatsapp.js';

const NOME_PAGINA = 'assinantes';

// Estacionamento de quem está usando a tela. Guardado para não
// oferecer "Suspender" na própria conta: um clique se trancaria
// fora do sistema, e só daria para voltar por SQL.
let meuEstacionamentoId = null;

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  // Perfil de administrador não basta: todo assinante é
  // administrador do próprio estacionamento. Aqui é a marca de
  // suporte que decide.
  if (!usuario.suporte) {
    window.location.href = 'dashboard.html';
    return;
  }

  meuEstacionamentoId = usuario.estacionamento_id;

  await montarShell(usuario, NOME_PAGINA, 'Assinantes');
  await carregar();
}

async function carregar() {
  const { data, error } = await supabase
    .from('estacionamentos')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    mostrarAviso(`Não foi possível carregar os assinantes: ${error.message}`);
    return;
  }

  const aguardando = data.filter((e) => e.assinatura_status === 'aguardando_pagamento');
  const ativos = data.filter((e) => e.assinatura_status !== 'aguardando_pagamento');

  renderizarAguardando(aguardando);
  renderizarAtivos(ativos);
}

// ------------------------------------------------------------
// Aguardando pagamento
// ------------------------------------------------------------
function renderizarAguardando(lista) {
  const corpo = document.getElementById('corpo-aguardando');
  const vazio = document.getElementById('vazio-aguardando');

  if (lista.length === 0) {
    corpo.innerHTML = '';
    vazio.classList.remove('oculto');
    return;
  }
  vazio.classList.add('oculto');

  corpo.innerHTML = lista.map((e) => `
    <tr>
      <td class="tabela-placa" data-label="Estacionamento">${escapar(e.nome)}</td>
      <td data-label="CNPJ">${formatarCnpj(e.cnpj)}</td>
      <td data-label="Responsável">${escapar(e.responsavel ?? '—')}</td>
      <td data-label="Contato">${linkContato(e.contato_responsavel)}</td>
      <td data-label="Plano">${escapar(e.plano ?? '—')}</td>
      <td data-label="Cadastro">${formatarDataHora(e.criado_em)}</td>
      <td class="tabela-acoes" data-label="Ações">
        <button class="btn btn-primario" data-liberar="${e.id}"
                style="padding:6px 12px; font-size:0.8125rem;">✅ Liberar</button>
      </td>
    </tr>
  `).join('');

  corpo.querySelectorAll('[data-liberar]').forEach((botao) => {
    const assinante = lista.find((e) => e.id === botao.dataset.liberar);
    botao.addEventListener('click', () => liberar(assinante, botao));
  });
}

// ------------------------------------------------------------
// Ativos e suspensos
// ------------------------------------------------------------
function renderizarAtivos(lista) {
  const corpo = document.getElementById('corpo-ativos');
  const vazio = document.getElementById('vazio-ativos');

  if (lista.length === 0) {
    corpo.innerHTML = '';
    vazio.classList.remove('oculto');
    return;
  }
  vazio.classList.add('oculto');

  corpo.innerHTML = lista.map((e) => {
    const ativa = e.assinatura_status === 'ativa';
    const badge = ativa
      ? '<span class="badge badge-sucesso">Ativa</span>'
      : '<span class="badge badge-perigo">Suspensa</span>';

    const ehVoce = e.id === meuEstacionamentoId;

    let acao;
    if (ehVoce) {
      acao = '<span class="texto-suave" style="font-size:0.8125rem;">sua conta</span>';
    } else if (ativa) {
      acao = `<button class="btn btn-secundario" data-suspender="${e.id}" style="padding:6px 12px; font-size:0.8125rem;">Suspender</button>`;
    } else {
      acao = `<button class="btn btn-primario" data-liberar="${e.id}" style="padding:6px 12px; font-size:0.8125rem;">Reativar</button>`;
    }

    return `
      <tr>
        <td class="tabela-placa" data-label="Estacionamento">${escapar(e.nome)}</td>
        <td data-label="CNPJ">${formatarCnpj(e.cnpj)}</td>
        <td data-label="Responsável">${escapar(e.responsavel ?? '—')}</td>
        <td data-label="Contato">${linkContato(e.contato_responsavel)}</td>
        <td data-label="Plano">${escapar(e.plano ?? '—')}</td>
        <td data-label="Situação">${badge}</td>
        <td class="tabela-acoes" data-label="Ações">${acao}</td>
      </tr>
    `;
  }).join('');

  corpo.querySelectorAll('[data-liberar]').forEach((botao) => {
    const assinante = lista.find((e) => e.id === botao.dataset.liberar);
    botao.addEventListener('click', () => liberar(assinante, botao));
  });

  corpo.querySelectorAll('[data-suspender]').forEach((botao) => {
    const assinante = lista.find((e) => e.id === botao.dataset.suspender);
    botao.addEventListener('click', () => suspender(assinante, botao));
  });
}

// ------------------------------------------------------------
// Ações
// ------------------------------------------------------------
async function liberar(assinante, botao) {
  await mudarStatus(assinante, 'ativa', botao, 'Liberando...');
}

async function suspender(assinante, botao) {
  const confirmou = confirm(
    `Suspender "${assinante.nome}"?\n\nTodos os funcionários deste estacionamento perdem o acesso na hora.`
  );
  if (!confirmou) return;

  await mudarStatus(assinante, 'suspensa', botao, 'Suspendendo...');
}

async function mudarStatus(assinante, novoStatus, botao, textoEspera) {
  const textoOriginal = botao.textContent;
  botao.disabled = true;
  botao.textContent = textoEspera;

  const { error } = await supabase
    .from('estacionamentos')
    .update({ assinatura_status: novoStatus })
    .eq('id', assinante.id);

  if (error) {
    botao.disabled = false;
    botao.textContent = textoOriginal;
    mostrarAviso(`Não foi possível alterar: ${error.message}`);
    return;
  }

  await carregar();
}

// ------------------------------------------------------------
// Auxiliares
// ------------------------------------------------------------

/** Contato vira link de WhatsApp quando parece telefone. */
function linkContato(contato) {
  if (!contato) return '—';

  const numeros = contato.replace(/\D/g, '');
  if (numeros.length < 10) return escapar(contato);

  const mensagem = 'Olá! Aqui é do Achei Vaga, sobre o cadastro do seu estacionamento.';
  return `<a href="${linkWhatsapp(numeros, mensagem)}" target="_blank" rel="noopener">${escapar(contato)}</a>`;
}

function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mostrarAviso(mensagem) {
  const div = document.getElementById('aviso');
  div.textContent = mensagem;
  div.classList.remove('oculto');
}

iniciar();
