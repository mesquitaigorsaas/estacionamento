// ============================================================
// js/utils/layout.js
// Monta o header + sidebar compartilhados por TODAS as páginas
// ============================================================

import { fazerLogout } from '../auth.js';

/**
 * @param {object} usuario - usuário logado (retornado por exigirLogin)
 * @param {string} nomePagina - valor de data-pagina do item do menu atual
 * @param {string} tituloPagina - texto exibido no topo
 */
export async function montarShell(usuario, nomePagina, tituloPagina) {
  const [htmlHeader, htmlSidebar] = await Promise.all([
    fetch('components/header.html').then((r) => r.text()),
    fetch('components/sidebar.html').then((r) => r.text()),
  ]);

  document.getElementById('header-container').innerHTML = htmlHeader;
  document.getElementById('sidebar-container').innerHTML = htmlSidebar;

  const elNome = document.getElementById('topo-usuario-nome');
  if (elNome) elNome.textContent = usuario.nome;

  const elPerfil = document.getElementById('topo-usuario-perfil');
  if (elPerfil) elPerfil.textContent = usuario.perfil;

  const elTitulo = document.getElementById('topo-titulo-pagina');
  if (elTitulo) elTitulo.textContent = tituloPagina;

  const btnSair = document.getElementById('btn-sair');
  if (btnSair) {
    btnSair.addEventListener('click', fazerLogout);
  }

  document.querySelectorAll('.sidebar-item[data-perfis]').forEach((item) => {
    const perfisPermitidos = item.dataset.perfis.split(',');
    if (!perfisPermitidos.includes(usuario.perfil)) {
      item.remove();
    }
  });

  // Itens da equipe do Achei Vaga. Não basta ser administrador:
  // todo assinante é administrador do próprio estacionamento.
  document.querySelectorAll('.sidebar-item[data-suporte]').forEach((item) => {
    if (!usuario.suporte) item.remove();
  });

  const itemAtivo = document.querySelector(`.sidebar-item[data-pagina="${nomePagina}"]`);
  if (itemAtivo) itemAtivo.classList.add('ativo');

  configurarMenuMobile();
}

/** Abre/fecha a sidebar no mobile e fecha ao clicar em qualquer ponto fora dela. */
function configurarMenuMobile() {
  const sidebar = document.getElementById('sidebar');
  const btnMenu = document.getElementById('btn-menu-mobile');

  if (btnMenu && sidebar) {
    btnMenu.addEventListener('click', (evento) => {
      evento.stopPropagation();
      sidebar.classList.toggle('aberta');
    });

    document.addEventListener('click', (evento) => {
      if (!sidebar.classList.contains('aberta')) return;

      const cliqueDentroDaSidebar = sidebar.contains(evento.target);
      const cliqueNoBotaoMenu = btnMenu.contains(evento.target);

      if (!cliqueDentroDaSidebar && !cliqueNoBotaoMenu) {
        sidebar.classList.remove('aberta');
      }
    });
  }
}