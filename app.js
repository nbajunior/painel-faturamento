/**
 * app.js
 * -----------------------------------------------------------------------
 * Orquestra a aplicação: login, leitura do resumo salvo, upload + cálculo
 * + publicação de um novo resumo.
 */

import { auth, fazerLogin, fazerLogout, recuperarSenha, observarLogin } from './auth.js';
import { salvarResumo, buscarUltimoResumo } from './storage.js';

const { lerCSV } = window.Parsers;
const { calcularResumo } = window.Calculations;

// ---------------------------------------------------------------------
// Elementos
// ---------------------------------------------------------------------
const telaLogin = document.getElementById('tela-login');
const telaApp = document.getElementById('tela-app');
const formLogin = document.getElementById('form-login');
const inputEmail = document.getElementById('input-email');
const inputSenha = document.getElementById('input-senha');
const btnEsqueci = document.getElementById('btn-esqueci');
const loginErro = document.getElementById('login-erro');
const usuarioEmailSpan = document.getElementById('usuario-email');
const btnSair = document.getElementById('btn-sair');

const btnProcessar = document.getElementById('btn-processar');
const btnPublicar = document.getElementById('btn-publicar');
const previewPublicar = document.getElementById('preview-publicar');
const processarStatus = document.getElementById('processar-status');
const progresso = document.getElementById('progresso');

let resumoCalculadoPendente = null; // guarda o último resumo calculado, aguardando publicação

// ---------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------
formLogin.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginErro.hidden = true;
  try {
    await fazerLogin(inputEmail.value.trim(), inputSenha.value);
  } catch (err) {
    loginErro.textContent = traduzErroAuth(err.code);
    loginErro.hidden = false;
  }
});

btnEsqueci.addEventListener('click', async () => {
  const email = inputEmail.value.trim();
  if (!email) {
    loginErro.textContent = 'Digite seu e-mail acima primeiro, depois clique em "Esqueci minha senha".';
    loginErro.hidden = false;
    return;
  }
  try {
    await recuperarSenha(email);
    loginErro.textContent = 'Enviamos um e-mail com instruções para redefinir sua senha.';
    loginErro.hidden = false;
  } catch (err) {
    loginErro.textContent = traduzErroAuth(err.code);
    loginErro.hidden = false;
  }
});

btnSair.addEventListener('click', () => fazerLogout());

function traduzErroAuth(codigo) {
  const mapa = {
    'auth/invalid-email': 'E-mail inválido.',
    'auth/user-not-found': 'Usuário não encontrado. Fale com quem administra o painel.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente de novo.',
  };
  return mapa[codigo] || 'Não foi possível entrar. Tente novamente.';
}

observarLogin(async (usuario) => {
  if (usuario) {
    telaLogin.hidden = true;
    telaApp.hidden = false;
    usuarioEmailSpan.textContent = usuario.email;
    await carregarUltimoResumo();
  } else {
    telaLogin.hidden = false;
    telaApp.hidden = true;
  }
});

// ---------------------------------------------------------------------
// Carregar e renderizar o resumo mais recente (visão de todo mundo)
// ---------------------------------------------------------------------
async function carregarUltimoResumo() {
  try {
    const resumo = await buscarUltimoResumo();
    if (resumo) renderResumo(resumo);
  } catch (err) {
    console.error('Erro ao buscar resumo salvo:', err);
  }
}

function formatarMoeda(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function renderResumo(resumo) {
  document.getElementById('status-referencia').textContent = resumo.referencia || '—';
  document.getElementById('status-atualizado-por').textContent = resumo.atualizadoPor || '—';
  document.getElementById('status-atualizado-em').textContent = resumo.geradoEm
    ? new Date(resumo.geradoEm).toLocaleString('pt-BR')
    : '—';

  document.getElementById('card-agua').textContent = formatarMoeda(resumo.fatura.faturamentoAgua);
  document.getElementById('card-esgoto').textContent = formatarMoeda(resumo.fatura.faturamentoEsgoto);
  document.getElementById('card-fat-total').textContent = formatarMoeda(resumo.fatura.faturamentoTotal);
  document.getElementById('card-cancelamento').textContent = formatarMoeda(resumo.fatura.cancelamento);
  document.getElementById('card-indiretas').textContent = formatarMoeda(resumo.indiretas.totalIndiretas);
  document.getElementById('card-receita-total').textContent = formatarMoeda(resumo.receitaTotal);

  // Tabela indiretas por categoria
  const tbodyIndiretas = document.querySelector('#tabela-indiretas tbody');
  tbodyIndiretas.innerHTML = '';
  Object.entries(resumo.indiretas.porCategoria).forEach(([categoria, valor]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${categoria}</td><td>${formatarMoeda(valor)}</td>`;
    tbodyIndiretas.appendChild(tr);
  });

  const naoMapeadas = Object.keys(resumo.indiretas.naoMapeadas || {});
  const avisoNaoMapeadas = document.getElementById('aviso-nao-mapeadas');
  if (naoMapeadas.length > 0) {
    avisoNaoMapeadas.hidden = false;
    avisoNaoMapeadas.textContent =
      `Atenção: ${naoMapeadas.length} rubrica(s) do Serviço Avulso não estavam na tabela de categorização ` +
      `e foram contadas em OUTROS por padrão: ${naoMapeadas.join(', ')}. ` +
      `Adicione-as em js/categorization.js (INDIRETA_RAW_MAP) para classificar corretamente.`;
  } else {
    avisoNaoMapeadas.hidden = true;
  }

  // Tabela por ciclo
  const tbodyCiclos = document.querySelector('#tabela-ciclos tbody');
  tbodyCiclos.innerHTML = '';
  Object.entries(resumo.fatura.porCiclo)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([grupo, dados]) => {
      const total = dados.agua + dados.esgoto + dados.cancelamento;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${grupo}</td>
        <td>${dados.localidade}</td>
        <td>${formatarMoeda(dados.agua)}</td>
        <td>${formatarMoeda(dados.esgoto)}</td>
        <td>${formatarMoeda(dados.cancelamento)}</td>
        <td>${formatarMoeda(total)}</td>
      `;
      tbodyCiclos.appendChild(tr);
    });
}

// ---------------------------------------------------------------------
// Processar (ler + calcular, sem publicar ainda)
// ---------------------------------------------------------------------
btnProcessar.addEventListener('click', async () => {
  const referencia = document.getElementById('input-referencia').value.trim();
  const arquivoFatura = document.getElementById('input-fatura').files[0];
  const arquivoServico = document.getElementById('input-servico').files[0];

  if (!referencia) {
    processarStatus.textContent = 'Preencha a referência (ex: 09-2026).';
    return;
  }
  if (!arquivoFatura || !arquivoServico) {
    processarStatus.textContent = 'Selecione os dois arquivos (Fatura de Ciclo e Serviço Avulso).';
    return;
  }

  btnProcessar.disabled = true;
  previewPublicar.hidden = true;
  progresso.hidden = false;
  progresso.textContent = 'Lendo Fatura de Ciclo...';
  processarStatus.textContent = '';

  try {
    const linhasFatura = await lerCSV(arquivoFatura, (n) => {
      progresso.textContent = `Lendo Fatura de Ciclo... ${n.toLocaleString('pt-BR')} linhas`;
    });
    progresso.textContent = 'Lendo Serviço Avulso...';
    const linhasServico = await lerCSV(arquivoServico, (n) => {
      progresso.textContent = `Lendo Serviço Avulso... ${n.toLocaleString('pt-BR')} linhas`;
    });

    progresso.textContent = 'Calculando...';
    const resumo = calcularResumo(linhasFatura, linhasServico, referencia);

    renderResumo(resumo);
    resumoCalculadoPendente = resumo;
    previewPublicar.hidden = false;
    processarStatus.textContent = 'Cálculo concluído. Confira os números acima antes de publicar.';
  } catch (err) {
    console.error(err);
    processarStatus.textContent = `Erro ao processar: ${err.message}`;
  } finally {
    progresso.hidden = true;
    btnProcessar.disabled = false;
  }
});

// ---------------------------------------------------------------------
// Publicar (grava no Firestore para todo mundo ver)
// ---------------------------------------------------------------------
btnPublicar.addEventListener('click', async () => {
  if (!resumoCalculadoPendente) return;
  btnPublicar.disabled = true;
  processarStatus.textContent = 'Publicando...';
  try {
    await salvarResumo(resumoCalculadoPendente, auth.currentUser.email);
    processarStatus.textContent = 'Publicado! Todo mundo que acessar o painel já vê esse resumo.';
    previewPublicar.hidden = true;
  } catch (err) {
    console.error(err);
    processarStatus.textContent = `Erro ao publicar: ${err.message}`;
  } finally {
    btnPublicar.disabled = false;
  }
});
