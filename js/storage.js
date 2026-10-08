/**
 * storage.js
 * -----------------------------------------------------------------------
 * Lê e grava os resumos calculados no Firestore, na coleção "ciclos",
 * um documento por referência (ex: "09-2026"). É isso que faz o painel
 * "atualizar para todo mundo": quem faz upload grava aqui, e todo mundo
 * que abre o painel lê o mesmo documento.
 */

import { doc, setDoc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './auth.js';

const COLECAO_ORCADO = 'orcados';

/** Salva o Orçado (RF/Sup por linha do DRE) de uma referência. */
async function salvarOrcado(referencia, orcado, usuarioEmail) {
  const ref = doc(db, COLECAO_ORCADO, referencia);
  await setDoc(ref, { referencia, orcado, atualizadoPor: usuarioEmail, atualizadoEm: new Date().toISOString() });
}

/** Busca o Orçado salvo de uma referência. Retorna {} se não existir ainda. */
async function buscarOrcado(referencia) {
  const ref = doc(db, COLECAO_ORCADO, referencia);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().orcado || {} : {};
}

const COLECAO = 'ciclos';

/** Salva (ou substitui) o resumo completo de uma referência. */
async function salvarResumo(resumo, usuarioEmail) {
  const ref = doc(db, COLECAO, resumo.referencia);
  await setDoc(ref, {
    ...resumo,
    atualizadoPor: usuarioEmail,
  });
}

/**
 * Salva o resumo PARCIAL de um mês anterior (só Fatura de Ciclo), usado só no
 * comparativo. Nunca substitui um resumo completo que já exista para a referência.
 */
async function salvarResumoAnteriorParcial(resumo, usuarioEmail) {
  const ref = doc(db, COLECAO, resumo.referencia);
  const snap = await getDoc(ref);
  if (snap.exists() && !snap.data().parcial) {
    throw new Error(`Já existe um resumo completo de ${resumo.referencia}; ele não foi substituído.`);
  }
  await setDoc(ref, { ...resumo, atualizadoPor: usuarioEmail });
}

/**
 * Busca o resumo que todo mundo deve ver ao abrir o painel: o da referência
 * MAIS RECENTE (pelo mês/ano), e não o último salvo. Assim, salvar um mês
 * anterior para o comparativo não "rouba" o lugar do mês atual. Resumos
 * parciais (só para comparativo) nunca são exibidos como principal.
 * A coleção tem um documento por mês, então ler todos é barato.
 */
async function buscarUltimoResumo() {
  const { ordemReferencia } = window.Calculations;
  const snap = await getDocs(collection(db, COLECAO));
  const resumos = snap.docs.map((d) => d.data()).filter((r) => !r.parcial);
  if (resumos.length === 0) return null;
  resumos.sort(
    (a, b) =>
      ordemReferencia(b.referencia) - ordemReferencia(a.referencia) ||
      String(b.geradoEm || '').localeCompare(String(a.geradoEm || ''))
  );
  return resumos[0];
}

/** Busca o resumo de uma referência específica (completo ou parcial). */
async function buscarResumoPorReferencia(referencia) {
  const ref = doc(db, COLECAO, referencia);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export {
  salvarResumo,
  salvarResumoAnteriorParcial,
  buscarUltimoResumo,
  buscarResumoPorReferencia,
  salvarOrcado,
  buscarOrcado,
};
