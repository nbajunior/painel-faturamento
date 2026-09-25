/**
 * auth.js
 * -----------------------------------------------------------------------
 * Login por e-mail/senha (Firebase Authentication). Não existe tela de
 * cadastro público de propósito: quem tem acesso ao painel é definido por
 * você, criando cada usuário manualmente no Console do Firebase
 * (Authentication > Users > Add user). Veja o README para o passo a passo.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

function fazerLogin(email, senha) {
  return signInWithEmailAndPassword(auth, email, senha);
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

export { auth, db, fazerLogin, fazerLogout, recuperarSenha, observarLogin };
