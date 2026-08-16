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

/** Só o número do dia de uma data 'AAAA-MM-DD'. */
export function diaDoMes(dataISO) {
  return Number(dataISO.split('-')[2]);
}

/**
 * Quantos dias tem o mês (mes vai de 0 a 11, como no JavaScript).
 * O dia 0 do mês seguinte é o último dia deste mês — e o próprio
 * JavaScript já sabe que fevereiro tem 29 dias em ano bissexto,
 * inclusive nas exceções de século (2100 não é, 2000 é).
 */
export function ultimoDiaDoMes(ano, mes) {
  return new Date(ano, mes + 1, 0).getDate();
}

/**
 * Avança meses numa data, sem estourar para o mês seguinte.
 *
 * O `setMonth` do JavaScript faz 31/jan + 1 mês virar 3/mar,
 * pulando fevereiro inteiro. Aqui o dia é limitado ao último
 * dia do mês de destino: 31/jan + 1 mês = 28/fev (ou 29 em ano
 * bissexto).
 *
 * `diaAncora` é o dia original da assinatura. Sem ele o
 * vencimento "desce" e nunca mais volta: 31/jan → 28/fev →
 * 28/mar → 28/abr. Com ele, volta ao dia certo assim que o mês
 * comporta: 31/jan → 28/fev → 31/mar → 30/abr → 31/mai.
 */
export function somarMeses(dataISO, meses, diaAncora = null) {
  const [ano, mes, dia] = dataISO.split('-').map(Number);
  const diaDesejado = diaAncora ?? dia;

  const mesAlvo = (mes - 1) + meses;
  const anoAlvo = ano + Math.floor(mesAlvo / 12);
  const mesNormalizado = ((mesAlvo % 12) + 12) % 12;

  const limite = ultimoDiaDoMes(anoAlvo, mesNormalizado);
  return dataLocal(new Date(anoAlvo, mesNormalizado, Math.min(diaDesejado, limite)));
}
