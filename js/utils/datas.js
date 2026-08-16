// ============================================================
// js/utils/datas.js
// Converte datas de tela (2026-08-15) em instantes completos
// para consultar o banco.
//
// POR QUE ISSO EXISTE:
// As colunas de horário no Supabase são timestamptz — guardam o
// instante em UTC. Se a consulta mandar só "2026-08-15T23:59:59",
// sem dizer o fuso, o banco entende como 23:59 em UTC, que no
// Brasil é 20:59. Tudo que acontecer depois das 21h fica de fora
// do filtro "hoje".
//
// As funções abaixo montam o instante no fuso de quem está
// usando o sistema e entregam já convertido para UTC, que é o
// que o banco espera.
// ============================================================

/**
 * Uma data qualquer no formato 'AAAA-MM-DD', usando o dia do
 * calendário local. Não use toISOString() para isso: ele
 * converte para UTC e pode devolver o dia anterior.
 */
export function dataLocal(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

/** Data de hoje no formato que o <input type="date"> entende. */
export function dataDeHoje() {
  return dataLocal(new Date());
}

/** '2026-08-15' → instante da meia-noite local, em UTC. */
export function inicioDoDia(data) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0).toISOString();
}

/** '2026-08-15' → instante do último milissegundo local do dia, em UTC. */
export function fimDoDia(data) {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(ano, mes - 1, dia, 23, 59, 59, 999).toISOString();
}
