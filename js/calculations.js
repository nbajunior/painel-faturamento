/**
 * calculations.js
 * -----------------------------------------------------------------------
 * Calcula os totais a partir das linhas já parseadas dos 3 arquivos.
 * Reproduz a lógica de negócio das planilhas atuais (Fatura de Ciclo,
 * Cancelamento, Indireta), recalculada do zero.
 */

(function () {
'use strict';

const { parseNumeroBR } = window.Parsers;
const { classificarRubricaFatura, classificarRubricaIndireta, CATEGORIAS_INDIRETA, localidadeValida, normalizeKey } =
  window.Categorization;

const CHAVE_EM_ANALISE = normalizeKey('EM ANALISE'); // normalizado: robusto a "EM ANÁLISE", "Em análise" etc.

/**
 * Processa a base de Fatura de Ciclo: separa Faturamento direto (Água/Esgoto)
 * e Cancelamento, com detalhamento por ciclo (Grupo) e localidade.
 */
function calcularFatura(linhasFatura) {
  const resultado = {
    faturamentoAgua: 0,
    faturamentoEsgoto: 0,
    cancelamento: 0,
    porCiclo: {}, // { grupo: { agua, esgoto, cancelamento, localidade } }
    porLocalidade: {}, // { localidade: { agua, esgoto, cancelamento } }
    linhasIgnoradas: 0,
    totalLinhas: linhasFatura.length,
  };

  for (const linha of linhasFatura) {
    const classe = classificarRubricaFatura(linha['Rubrica']);
    if (!classe) {
      resultado.linhasIgnoradas += 1;
      continue;
    }
    const valor = parseNumeroBR(linha['Valor Parcela']);
    const grupo = (linha['Grupo'] || 'SEM GRUPO').trim();
    const localidade = (linha['Nome da Localidade'] || 'SEM LOCALIDADE').trim();

    if (!resultado.porCiclo[grupo]) {
      resultado.porCiclo[grupo] = { agua: 0, esgoto: 0, cancelamento: 0, localidade };
    }
    if (!resultado.porLocalidade[localidade]) {
      resultado.porLocalidade[localidade] = { agua: 0, esgoto: 0, cancelamento: 0 };
    }

    if (classe === 'AGUA') {
      resultado.faturamentoAgua += valor;
      resultado.porCiclo[grupo].agua += valor;
      resultado.porLocalidade[localidade].agua += valor;
    } else if (classe === 'ESGOTO') {
      resultado.faturamentoEsgoto += valor;
      resultado.porCiclo[grupo].esgoto += valor;
      resultado.porLocalidade[localidade].esgoto += valor;
    } else if (classe === 'CANCELAMENTO') {
      resultado.cancelamento += valor;
      resultado.porCiclo[grupo].cancelamento += valor;
      resultado.porLocalidade[localidade].cancelamento += valor;
    }
  }

  resultado.faturamentoTotal = resultado.faturamentoAgua + resultado.faturamentoEsgoto;
  return resultado;
}

/**
 * Processa a base de Serviço Avulso: soma por categoria de indireta
 * (CORTE, RELIGAÇÃO, LNA, LNE, SANÇÃO, OUTROS), com detalhamento por ciclo.
 */
function calcularIndiretas(linhasServico) {
  const resultado = {
    porCategoria: {}, // { categoria: valor }
    porCiclo: {}, // { grupo: { categoria: valor } }
    naoMapeadas: {}, // { rubrica: {valor, contagem} } - pra revisão manual
    totalIndiretas: 0,
    totalLinhas: linhasServico.length,
    linhasForaDaArea: 0, // linhas descartadas por serem de outra Superintendência
  };

  CATEGORIAS_INDIRETA.forEach((c) => {
    resultado.porCategoria[c] = 0;
  });

  for (const linha of linhasServico) {
    if (!localidadeValida(linha['Nome da Localidade'])) {
      resultado.linhasForaDaArea += 1;
      continue;
    }
    const rubrica = linha['Rubrica'];
    const categoria = classificarRubricaIndireta(rubrica);
    const valor = parseNumeroBR(linha['Valor Parcela']);
    const grupo = (linha['Grupo'] || 'SEM GRUPO').trim();

    if (categoria === null) {
      // Rubrica explicitamente excluída da Indireta (ex: crédito de arrecadação)
      continue;
    }

    if (categoria === 'OUTROS_NAO_MAPEADO') {
      if (!resultado.naoMapeadas[rubrica]) resultado.naoMapeadas[rubrica] = { valor: 0, contagem: 0 };
      resultado.naoMapeadas[rubrica].valor += valor;
      resultado.naoMapeadas[rubrica].contagem += 1;
      // entra em OUTROS por padrão, mas fica sinalizada acima para revisão
      resultado.porCategoria['OUTROS'] += valor;
      resultado.totalIndiretas += valor;
      continue;
    }

    resultado.porCategoria[categoria] = (resultado.porCategoria[categoria] || 0) + valor;
    resultado.totalIndiretas += valor;

    if (!resultado.porCiclo[grupo]) resultado.porCiclo[grupo] = {};
    resultado.porCiclo[grupo][categoria] = (resultado.porCiclo[grupo][categoria] || 0) + valor;
  }

  return resultado;
}

const ECONOMIA_COLS = [
  'Qtd. Economia Residencial',
  'Qtd. Economia Comercial',
  'Qtd. Economia Industrial',
  'Qtd. Economia P?blica',
  'Qtd. Economia Outros',
];

/**
 * Monta candidatos para revisão manual do "Em Análise": matrículas com
 * Rubrica água/esgoto em Situação Conta = EM ANALISE, cruzadas com o Consumo
 * (pra saber categoria, nº de economias e consumo faturado). Sugere o valor
 * mínimo via js/tarifas.js. Ordena por valor faturado decrescente e prioriza
 * (na ordenação, não como filtro) Residencial/Social com 1-2 economias, que é
 * o critério que a equipe usa hoje.
 */
function montarCandidatosEmAnalise(linhasFatura, linhasConsumo) {
  const { calcularValorMinimo, calcularMinimoM3 } = window.Tarifas;

  // indexa o Consumo por N. da Ligacao pra cruzar rápido
  const consumoPorLigacao = {};
  for (const linha of linhasConsumo) {
    const id = linha['N. da Ligacao'];
    if (!id) continue;
    const numEconomias = ECONOMIA_COLS.reduce((soma, col) => soma + (parseNumeroBR(linha[col]) || 0), 0);
    consumoPorLigacao[id] = {
      categoria: (linha['Categoria'] || '').trim(),
      numEconomias,
      consumoFaturado: parseNumeroBR(linha['Consumo Faturado']),
      situacaoLigacao: (linha['Situacao Ligacao'] || '').trim(),
    };
  }

  const candidatos = [];
  for (const linha of linhasFatura) {
    const classe = classificarRubricaFatura(linha['Rubrica']);
    if (classe !== 'AGUA') continue; // o ajuste manual é sobre água
    const situacaoConta = (linha['Situacao Conta'] || '').trim().toUpperCase();
    if (normalizeKey(situacaoConta) !== CHAVE_EM_ANALISE) continue;

    const id = linha['N. da Ligacao'];
    const consumo = consumoPorLigacao[id];
    const valorAtual = parseNumeroBR(linha['Valor Parcela']);
    const grupo = (linha['Grupo'] || 'SEM GRUPO').trim();

    let valorMinimoSugerido = null;
    let minimoM3 = null;
    if (consumo && consumo.numEconomias > 0) {
      valorMinimoSugerido = calcularValorMinimo(consumo.categoria, consumo.numEconomias);
      minimoM3 = calcularMinimoM3(consumo.categoria, consumo.numEconomias);
    }

    candidatos.push({
      ligacao: id,
      nomeCliente: linha['Nome Cliente'],
      grupo,
      categoria: consumo ? consumo.categoria : (linha['Categoria'] || '').trim(),
      numEconomias: consumo ? consumo.numEconomias : null,
      consumoFaturadoM3: consumo ? consumo.consumoFaturado : null,
      minimoM3,
      valorAtual,
      valorMinimoSugerido,
    });
  }

  // maior valor primeiro; dentro do mesmo valor, prioriza Residencial/Social com 1-2 economias
  candidatos.sort((a, b) => b.valorAtual - a.valorAtual);
  return candidatos;
}

/** Soma o valor "Em Análise" (água) por ciclo — usado pra saber se passou dos ~100k. */
function totalEmAnaliseporCiclo(linhasFatura) {
  const totais = {};
  for (const linha of linhasFatura) {
    if (classificarRubricaFatura(linha['Rubrica']) !== 'AGUA') continue;
    if (normalizeKey(linha['Situacao Conta']) !== CHAVE_EM_ANALISE) continue;
    const grupo = (linha['Grupo'] || 'SEM GRUPO').trim();
    totais[grupo] = (totais[grupo] || 0) + parseNumeroBR(linha['Valor Parcela']);
  }
  return totais;
}

/**
 * Indicadores de volume/ticket, cruzando Fatura (quem tem água/esgoto faturado e por quanto)
 * com Consumo (quantas economias e quantos m³ cada ligação tem). Mesma lógica do bloco
 * "Economias / Volume / Tarifa Média / Ticket Médio" do FAT. CICLOS (3).
 */
function calcularIndicadoresConsumo(linhasFatura, linhasConsumo, fatura) {
  const consumoPorLigacao = {};
  for (const linha of linhasConsumo) {
    const id = linha['N. da Ligacao'];
    if (!id) continue;
    const numEconomias = ECONOMIA_COLS.reduce((soma, col) => soma + (parseNumeroBR(linha[col]) || 0), 0);
    consumoPorLigacao[id] = {
      numEconomias,
      consumoFaturado: parseNumeroBR(linha['Consumo Faturado']),
    };
  }

  const ligacoesAgua = new Set();
  const ligacoesEsgoto = new Set();
  for (const linha of linhasFatura) {
    const classe = classificarRubricaFatura(linha['Rubrica']);
    if (classe === 'AGUA') ligacoesAgua.add(linha['N. da Ligacao']);
    if (classe === 'ESGOTO') ligacoesEsgoto.add(linha['N. da Ligacao']);
  }

  function somar(setLigacoes) {
    let economias = 0;
    let volume = 0;
    for (const id of setLigacoes) {
      const c = consumoPorLigacao[id];
      if (!c) continue;
      economias += c.numEconomias;
      volume += c.consumoFaturado;
    }
    return { economias, volume };
  }

  const agua = somar(ligacoesAgua);
  const esgoto = somar(ligacoesEsgoto);

  const divSeguro = (a, b) => (b > 0 ? a / b : 0);

  return {
    economiasAgua: agua.economias,
    economiasEsgoto: esgoto.economias,
    volumeAguaM3: agua.volume,
    volumeEsgotoM3: esgoto.volume,
    volumeMedioAgua: divSeguro(agua.volume, agua.economias),
    volumeMedioEsgoto: divSeguro(esgoto.volume, esgoto.economias),
    tarifaMediaAgua: divSeguro(fatura.faturamentoAgua, agua.volume),
    tarifaMediaEsgoto: divSeguro(fatura.faturamentoEsgoto, esgoto.volume),
    ticketMedioAgua: divSeguro(fatura.faturamentoAgua, agua.economias),
    ticketMedioEsgoto: divSeguro(fatura.faturamentoEsgoto, esgoto.economias),
  };
}

/** Aplica os ajustes manuais de "Em Análise" (override de Valor Parcela) sobre a Fatura. */
function aplicarOverridesFatura(linhasFatura, overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return linhasFatura;
  return linhasFatura.map((linha) => {
    const novoValor = overrides[linha['N. da Ligacao']];
    if (novoValor === undefined || classificarRubricaFatura(linha['Rubrica']) !== 'AGUA') return linha;
    return { ...linha, 'Valor Parcela': String(novoValor).replace('.', ',') };
  });
}

/**
 * Monta o resumo consolidado (o que vai ser salvo no Firestore e exibido no painel).
 * `overrides` é um objeto opcional { [N. da Ligacao]: novoValor } com os ajustes
 * manuais de "Em Análise" já aplicados pelo usuário na tela de revisão.
 */
function calcularResumo(linhasFatura, linhasServico, referencia, overrides, linhasConsumo) {
  const linhasFaturaAjustadas = aplicarOverridesFatura(linhasFatura, overrides);
  const fatura = calcularFatura(linhasFaturaAjustadas);
  const indiretas = calcularIndiretas(linhasServico);
  const indicadores = linhasConsumo ? calcularIndicadoresConsumo(linhasFaturaAjustadas, linhasConsumo, fatura) : null;

  return {
    referencia,
    geradoEm: new Date().toISOString(),
    fatura,
    indiretas,
    indicadores,
    ajustesEmAnaliseAplicados: overrides ? Object.keys(overrides).length : 0,
    receitaTotal: fatura.faturamentoTotal + fatura.cancelamento + indiretas.totalIndiretas,
  };
}

/** Dada uma referência "MM-YYYY" (ex: "09-2026"), devolve a referência do mês anterior ("08-2026"). */
function referenciaAnterior(referencia) {
  const m = /^(\d{2})-(\d{4})$/.exec((referencia || '').trim());
  if (!m) return null;
  let mes = parseInt(m[1], 10);
  let ano = parseInt(m[2], 10);
  mes -= 1;
  if (mes === 0) {
    mes = 12;
    ano -= 1;
  }
  return `${String(mes).padStart(2, '0')}-${ano}`;
}

/**
 * Padroniza o que a pessoa digitou como referência para "MM-YYYY".
 * Aceita "9-2026", "09/2026", "09.2026" etc. Retorna null se não for um mês válido.
 */
function normalizarReferencia(texto) {
  const m = /^\s*(\d{1,2})\s*[-/.]\s*(\d{4})\s*$/.exec(texto || '');
  if (!m) return null;
  const mes = parseInt(m[1], 10);
  if (mes < 1 || mes > 12) return null;
  return `${String(mes).padStart(2, '0')}-${m[2]}`;
}

/** Número ordenável de uma referência "MM-YYYY" (ex: "09-2026" -> 202609). -1 se inválida. */
function ordemReferencia(referencia) {
  const m = /^(\d{2})-(\d{4})$/.exec((referencia || '').trim());
  return m ? parseInt(m[2], 10) * 100 + parseInt(m[1], 10) : -1;
}

/**
 * Resumo "parcial" de um mês anterior, feito só com a Fatura de Ciclo. Serve apenas
 * de base para o comparativo: não tem Indiretas, Indicadores nem Receita Total, e
 * nunca é mostrado como o resumo principal do painel (ver storage.buscarUltimoResumo).
 */
function calcularResumoParcial(linhasFatura, referencia) {
  return {
    referencia,
    geradoEm: new Date().toISOString(),
    fatura: calcularFatura(linhasFatura),
    indiretas: null,
    indicadores: null,
    receitaTotal: null,
    parcial: true,
  };
}

/**
 * Monta a tabela de comparação entre o resumo atual e o resumo do mês anterior.
 * Se uma métrica não existir em um dos lados (ex: mês anterior parcial, sem
 * Indiretas), ela volta com anterior/diferenças = null, para exibir "—".
 */
function compararComMesAnterior(resumoAtual, resumoAnterior) {
  const metricas = [
    ['Faturamento Água', (r) => r?.fatura?.faturamentoAgua],
    ['Faturamento Esgoto', (r) => r?.fatura?.faturamentoEsgoto],
    ['Faturamento Total', (r) => r?.fatura?.faturamentoTotal],
    ['Cancelamento', (r) => r?.fatura?.cancelamento],
    ['Indiretas', (r) => r?.indiretas?.totalIndiretas],
    ['Receita Total', (r) => r?.receitaTotal],
  ];
  const numeroOuNull = (x) => (typeof x === 'number' && !Number.isNaN(x) ? x : null);

  return metricas.map(([nome, extrair]) => {
    const atual = numeroOuNull(extrair(resumoAtual));
    const anterior = numeroOuNull(extrair(resumoAnterior));
    if (atual === null || anterior === null) {
      return { nome, atual, anterior, diffReais: null, diffPercentual: null };
    }
    const diffReais = atual - anterior;
    const diffPercentual = anterior !== 0 ? (diffReais / Math.abs(anterior)) * 100 : null;
    return { nome, atual, anterior, diffReais, diffPercentual };
  });
}

window.Calculations = {
  calcularFatura,
  calcularIndiretas,
  calcularResumo,
  montarCandidatosEmAnalise,
  totalEmAnaliseporCiclo,
  aplicarOverridesFatura,
  calcularIndicadoresConsumo,
  calcularResumoParcial,
  referenciaAnterior,
  normalizarReferencia,
  ordemReferencia,
  compararComMesAnterior,
};
})();
