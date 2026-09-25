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
const { classificarRubricaFatura, classificarRubricaIndireta, CATEGORIAS_INDIRETA } = window.Categorization;

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
  };

  CATEGORIAS_INDIRETA.forEach((c) => {
    resultado.porCategoria[c] = 0;
  });

  for (const linha of linhasServico) {
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

/** Monta o resumo consolidado (o que vai ser salvo no Firestore e exibido no painel). */
function calcularResumo(linhasFatura, linhasServico, referencia) {
  const fatura = calcularFatura(linhasFatura);
  const indiretas = calcularIndiretas(linhasServico);

  return {
    referencia,
    geradoEm: new Date().toISOString(),
    fatura,
    indiretas,
    receitaTotal: fatura.faturamentoTotal + fatura.cancelamento + indiretas.totalIndiretas,
  };
}

window.Calculations = { calcularFatura, calcularIndiretas, calcularResumo };
})();
