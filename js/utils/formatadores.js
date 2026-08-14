// ============================================================
// js/utils/formatadores.js
// Funções puras de formatação de texto/número/data para exibição.
// ============================================================

export function formatarPlaca(placa) {
  return placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function formatarDataHora(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatarHora(isoString) {
  if (!isoString) return '—';
  return new Date(isoString).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Recebe minutos e devolve algo como "1h 20min". */
export function formatarDuracao(totalMinutos) {
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) return `${minutos}min`;
  return `${horas}h ${minutos}min`;
}