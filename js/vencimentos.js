// ============================================================
// js/vencimentos.js
// Página: vencimentos.html
// Mostra só quem está "vence_em_breve" ou "vencido", com
// atalho de aviso via WhatsApp.
// ============================================================

import { exigirLogin } from './auth.js';
import { montarShell } from './utils/layout.js';
import { listarMensalidades, buscarDiasAvisoVencimento, sincronizarStatus } from './services/mensalidades.js';
import { linkWhatsapp, montarAvisoVencimento } from './utils/whatsapp.js';

const NOME_PAGINA = 'vencimentos';

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario, NOME_PAGINA, 'Vencimentos');
  await carregarTabela();
}

// ------------------------------------------------------------
// Carregar e renderizar
// ------------------------------------------------------------
async function carregarTabela() {
  const diasAviso = await buscarDiasAvisoVencimento();
  let lista = await listarMensalidades();
  lista = await sincronizarStatus(lista, diasAviso);

  const relevantes = lista.filter((m) => m.status === 'vence_em_breve' || m.status === 'vencido');

  const corpo = document.getElementById('tabela-corpo');
  const mensagemVazio = document.getElementById('mensagem-vazio');

  if (relevantes.length === 0) {
    corpo.innerHTML = '';
    mensagemVazio.classList.remove('oculto');
    return;
  }
  mensagemVazio.classList.add('oculto');

  const badgePorStatus = {
    vence_em_breve: '<span class="badge badge-alerta">Vence em breve</span>',
    vencido: '<span class="badge badge-perigo">Vencido</span>',
  };

  corpo.innerHTML = relevantes.map((m) => {
    const contato = m.clientes?.contato;
    const link = contato ? linkWhatsapp(contato, montarAvisoVencimento(m.clientes.nome, m.vencimento)) : null;

    return `
      <tr>
        <td class="tabela-placa" data-label="Placa">${m.veiculos?.placa ?? '—'}</td>
        <td data-label="Nome">${m.clientes?.nome ?? '—'}</td>
        <td data-label="Vencimento">${new Date(`${m.vencimento}T00:00:00`).toLocaleDateString('pt-BR')}</td>
        <td data-label="Status">${badgePorStatus[m.status]}</td>
        <td class="tabela-acoes" data-label="Ações">
          ${link
            ? `<a href="${link}" target="_blank" class="btn btn-secundario" style="padding:6px 12px; font-size:0.8125rem;">💬 Avisar</a>`
            : '<span class="texto-suave">Sem contato</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

iniciar();
