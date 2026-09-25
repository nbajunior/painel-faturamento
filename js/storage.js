/**
 * storage.js
 * -----------------------------------------------------------------------
 * Lê e grava os resumos calculados no Firestore, na coleção "ciclos",
 * um documento por referência (ex: "09-2026"). É isso que faz o painel
 * "atualizar para todo mundo": quem faz upload grava aqui, e todo mundo
 * que abre o painel lê o mesmo documento.
 */

import {
  doc,
  setDoc,
  getDoc,
  collection,
  getDocs,
  orderBy,
  query,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { db } from './auth.js';

const COLECAO = 'ciclos';

/** Salva (ou substitui) o resumo de uma referência. */
async function salvarResumo(resumo, usuarioEmail) {
  const ref = doc(db, COLECAO, resumo.referencia);
  await setDoc(ref, {
    ...resumo,
    atualizadoPor: usuarioEmail,
  });
}

/** Busca o resumo mais recente salvo (o que todo mundo deve ver ao abrir o painel). */
async function buscarUltimoResumo() {
  const q = query(collection(db, COLECAO), orderBy('geradoEm', 'desc'));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return snap.docs[0].data();
}

/** Busca o resumo de uma referência específica (usado na Fase 2, para comparação mês a mês). */
async function buscarResumoPorReferencia(referencia) {
  const ref = doc(db, COLECAO, referencia);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export { salvarResumo, buscarUltimoResumo, buscarResumoPorReferencia };
