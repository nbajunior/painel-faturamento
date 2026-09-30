/**
 * app.js
 * -----------------------------------------------------------------------
 * Orquestra a aplicação: login, leitura do resumo salvo, upload + cálculo
 * + publicação de um novo resumo.
 */

import { auth, fazerLogin, fazerLogout, recuperarSenha, observarLogin } from './auth.js';
import { salvarResumo, buscarUltimoResumo } from './storage.js';

const { lerCSV } = window.Parsers;
const { calcularResumo, montarCandidatosEmAnalise, totalEmAnaliseporCiclo, aplicarOverridesFatura } = window.Calculations;

const LIMITE_EM_ANALISE = 100000;

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
const btnAplicarAjustes = document.getElementById('btn-aplicar-ajustes');
const previewPublicar = document.getElementById('preview-publicar');
const processarStatus = document.getElementById('processar-status');
const progresso = document.getElementById('progresso');
const blocoEmAnalise = document.getElementById('bloco-em-analise');

let resumoCalculadoPendente = null; // guarda o último resumo calculado, aguardando publicação
let referenciaAtual = null;
let linhasFaturaAtual = null; // guarda os dados já lidos, pra poder recalcular ao aplicar ajustes
let linhasServicoAtual = null;
let linhasConsumoAtual = null;
let overridesAtuais = {}; // { [N. da Ligacao]: novoValor } — ajustes de "Em Análise" já aplicados

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

  const infoForaDaArea = document.getElementById('info-fora-da-area');
  const foraDaArea = resumo.indiretas.linhasForaDaArea || 0;
  infoForaDaArea.textContent =
    foraDaArea > 0
      ? `${foraDaArea.toLocaleString('pt-BR')} linha(s) do Serviço Avulso descartadas por serem de outra Superintendência.`
      : '';

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
  const arquivoConsumo = document.getElementById('input-consumo').files[0];

  if (!referencia) {
    processarStatus.textContent = 'Preencha a referência (ex: 09-2026).';
    return;
  }
  if (!arquivoFatura || !arquivoServico || !arquivoConsumo) {
    processarStatus.textContent = 'Selecione os três arquivos (Fatura de Ciclo, Serviço Avulso e Consumo).';
    return;
  }

  btnProcessar.disabled = true;
  previewPublicar.hidden = true;
  blocoEmAnalise.hidden = true;
  progresso.hidden = false;
  progresso.textContent = 'Lendo Fatura de Ciclo...';
  processarStatus.textContent = '';
  overridesAtuais = {};

  try {
    const linhasFatura = await lerCSV(arquivoFatura, (n) => {
      progresso.textContent = `Lendo Fatura de Ciclo... ${n.toLocaleString('pt-BR')} linhas`;
    });
    progresso.textContent = 'Lendo Serviço Avulso...';
    const linhasServico = await lerCSV(arquivoServico, (n) => {
      progresso.textContent = `Lendo Serviço Avulso... ${n.toLocaleString('pt-BR')} linhas`;
    });
    progresso.textContent = 'Lendo Consumo...';
    const linhasConsumo = await lerCSV(arquivoConsumo, (n) => {
      progresso.textContent = `Lendo Consumo... ${n.toLocaleString('pt-BR')} linhas`;
    });

    progresso.textContent = 'Calculando...';
    referenciaAtual = referencia;
    linhasFaturaAtual = linhasFatura;
    linhasServicoAtual = linhasServico;
    linhasConsumoAtual = linhasConsumo;

    const resumo = calcularResumo(linhasFatura, linhasServico, referencia);
    renderResumo(resumo);
    resumoCalculadoPendente = resumo;

    renderEmAnalise();

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
// Revisão de "Em Análise"
// ---------------------------------------------------------------------
function renderEmAnalise() {
  // usa a fatura já com os ajustes aplicados até agora, pra mostrar o total real "faltando revisar"
  const linhasFaturaComAjustes = aplicarOverridesFatura(linhasFaturaAtual, overridesAtuais);
  const candidatosBrutos = montarCandidatosEmAnalise(linhasFaturaAtual, linhasConsumoAtual);
  const candidatos = candidatosBrutos.filter((c) => !(c.ligacao in overridesAtuais)); // já ajustadas somem da lista
  const totaisPorCiclo = totalEmAnaliseporCiclo(linhasFaturaComAjustes);

  const resumoDiv = document.getElementById('resumo-em-analise-ciclos');
  resumoDiv.innerHTML = '';
  Object.entries(totaisPorCiclo)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([grupo, total]) => {
      const acimaDoLimite = total > LIMITE_EM_ANALISE;
      const span = document.createElement('span');
      span.className = 'chip-ciclo' + (acimaDoLimite ? ' chip-alerta' : '');
      span.textContent = `Ciclo ${grupo}: ${formatarMoeda(total)}`;
      resumoDiv.appendChild(span);
    });

  const tbody = document.querySelector('#tabela-em-analise tbody');
  tbody.innerHTML = '';

  // mostra a lista inteira, sempre — os chips acima já destacam qual ciclo estourou o limite
  blocoEmAnalise.hidden = false;
  if (candidatos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10">Nenhuma matrícula de água em "Em Análise" neste ciclo.</td></tr>';
    return;
  }

  candidatos.forEach((c) => {
    const tr = document.createElement('tr');
    const semSugestao = c.valorMinimoSugerido === null;
    tr.innerHTML = `
      <td><input type="checkbox" class="chk-ajuste" data-ligacao="${c.ligacao}" data-valor="${c.valorMinimoSugerido || ''}" ${semSugestao ? 'disabled' : ''} /></td>
      <td>${c.ligacao}</td>
      <td>${c.nomeCliente || ''}</td>
      <td>${c.grupo}</td>
      <td>${c.categoria || '—'}</td>
      <td>${c.numEconomias ?? '—'}</td>
      <td>${c.consumoFaturadoM3 ?? '—'}</td>
      <td>${c.minimoM3 ?? '—'}</td>
      <td>${formatarMoeda(c.valorAtual)}</td>
      <td>${semSugestao ? 'sem categoria reconhecida' : formatarMoeda(c.valorMinimoSugerido)}</td>
    `;
    tbody.appendChild(tr);
  });
}

btnAplicarAjustes.addEventListener('click', () => {
  const marcados = document.querySelectorAll('.chk-ajuste:checked');
  marcados.forEach((chk) => {
    const ligacao = chk.dataset.ligacao;
    const valor = parseFloat(chk.dataset.valor);
    if (ligacao && !Number.isNaN(valor)) overridesAtuais[ligacao] = valor;
  });

  if (Object.keys(overridesAtuais).length === 0) {
    processarStatus.textContent = 'Marque pelo menos uma matrícula antes de aplicar.';
    return;
  }

  const resumo = calcularResumo(linhasFaturaAtual, linhasServicoAtual, referenciaAtual, overridesAtuais);
  renderResumo(resumo);
  resumoCalculadoPendente = resumo;
  renderEmAnalise();
  processarStatus.textContent = `${Object.keys(overridesAtuais).length} matrícula(s) ajustada(s) para o mínimo. Totais recalculados — confira antes de publicar.`;
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
