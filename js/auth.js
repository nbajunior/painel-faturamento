/**
 * auth.js
 * -----------------------------------------------------------------------
 * Login por e-mail/senha (Firebase Authentication).
 *
 * Quem pode ver os dados é definido pela LISTA DE E-MAILS nas regras do
 * Firestore (firestore.rules). Qualquer pessoa da lista faz o "Primeiro
 * acesso" sozinha, criando a própria senha. Para provar que o e-mail é
 * mesmo dela, a conta só funciona depois que ela clica no link de
 * confirmação enviado por e-mail (as regras exigem e-mail verificado).
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'pt'; // e-mails de confirmação e de senha em português
const db = getFirestore(app);

function fazerLogin(email, senha) {
  return signInWithEmailAndPassword(auth, email, senha);
}

/** Primeiro acesso: cria a conta e já envia o e-mail de confirmação. */
async function criarConta(email, senha) {
  const cred = await createUserWithEmailAndPassword(auth, email, senha);
  await sendEmailVerification(cred.user);
  return cred;
}

function enviarVerificacao(usuario) {
  return sendEmailVerification(usuario);
}

function fazerLogout() {
  return signOut(auth);
}

function recuperarSenha(email) {
  return sendPasswordResetEmail(auth, email);
}

/** Registra um callback chamado sempre que o estado de login mudar. */
function observarLogin(callback) {
  return onAuthStateChanged(auth, callback);
}

export { auth, db, fazerLogin, criarConta, enviarVerificacao, fazerLogout, recuperarSenha, observarLogin };
