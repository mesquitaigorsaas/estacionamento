// ============================================================
// js/vencimentos.js
// Página: vencimentos.html
// Mostra só quem está "vence_em_breve" ou "vencido", com
// atalho de aviso via WhatsApp.
// ============================================================

import { exigirLogin, fazerLogout } from './auth.js';
import { listarMensalidades, buscarDiasAvisoVencimento, sincronizarStatus } from './services/mensalidades.js';
import { linkWhatsapp, montarAvisoVencimento } from './utils/whatsapp.js';

const NOME_PAGINA = 'vencimentos';

async function iniciar() {
  const usuario = await exigirLogin();
  if (!usuario) return;

  await montarShell(usuario);
  await carregarTabela();
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
  document.getElementById('topo-titulo-pagina').textContent = 'Vencimentos';

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
        <td class="tabela-placa">${m.veiculos?.placa ?? '—'}</td>
        <td>${m.clientes?.nome ?? '—'}</td>
        <td>${new Date(`${m.vencimento}T00:00:00`).toLocaleDateString('pt-BR')}</td>
        <td>${badgePorStatus[m.status]}</td>
        <td>
          ${link
            ? `<a href="${link}" target="_blank" class="btn btn-secundario" style="padding:6px 12px; font-size:0.8125rem;">💬 Avisar</a>`
            : '<span class="texto-suave">Sem contato</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

iniciar();