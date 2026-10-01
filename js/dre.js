/**
 * dre.js
 * -----------------------------------------------------------------------
 * Monta as linhas do DRE no mesmo layout do FAT. CICLOS (3): Faturamento
 * Bruto -> Diretas (Água/Esgoto) -> Indiretas (Água/Esgoto, com o detalhe
 * de Cortes/Religações/Ligações-Água/Fiscalização/Outros) -> Cancelamento.
 *
 * O Orçado é editado manualmente (por enquanto) e persistido junto do
 * resumo no Firestore. O Realizado vem direto do resumo já calculado.
 */

(function () {
'use strict';

// Estrutura das linhas do DRE: id (usado pra Orçado e pra renderizar),
// nome exibido, nível de indentação (0 = linha-mãe, 1 = sub-linha), e como
// extrair o Realizado a partir do `resumo` (saída de calcularResumo).
const LINHAS_DRE = [
  { id: 'faturamentoBruto', nome: 'Faturamento Bruto', nivel: 0, negrito: true, realizado: (r) => r.fatura.faturamentoTotal },
  { id: 'diretasTotais', nome: 'Diretas Totais', nivel: 0, negrito: true, realizado: (r) => r.fatura.faturamentoTotal },
  { id: 'diretasAgua', nome: 'Diretas Água', nivel: 1, realizado: (r) => r.fatura.faturamentoAgua },
  { id: 'diretasEsgoto', nome: 'Diretas Esgoto', nivel: 1, realizado: (r) => r.fatura.faturamentoEsgoto },
  {
    id: 'indiretasEsgoto',
    nome: 'Fat. de Esgoto - Indireto',
    nivel: 0,
    negrito: true,
    realizado: (r) => r.indiretas.porCategoria['LNE'] || 0,
  },
  {
    id: 'indiretasAgua',
    nome: 'Fat. de Água - Indireto',
    nivel: 0,
    negrito: true,
    realizado: (r) =>
      (r.indiretas.porCategoria['CORTE'] || 0) +
      (r.indiretas.porCategoria['RELIGAÇÃO'] || 0) +
      (r.indiretas.porCategoria['LNA'] || 0) +
      (r.indiretas.porCategoria['SANÇÃO'] || 0) +
      (r.indiretas.porCategoria['OUTROS'] || 0),
  },
  { id: 'riCortes', nome: 'RI Cortes/Recorte', nivel: 1, realizado: (r) => r.indiretas.porCategoria['CORTE'] || 0 },
  { id: 'riReligacoes', nome: 'RI Religações', nivel: 1, realizado: (r) => r.indiretas.porCategoria['RELIGAÇÃO'] || 0 },
  { id: 'riLigacoesAgua', nome: 'RI Ligações - Água', nivel: 1, realizado: (r) => r.indiretas.porCategoria['LNA'] || 0 },
  { id: 'riFiscalizacao', nome: 'RI Fiscalização', nivel: 1, realizado: (r) => r.indiretas.porCategoria['SANÇÃO'] || 0 },
  { id: 'riOutrosAgua', nome: 'RI Outros - Água', nivel: 1, realizado: (r) => r.indiretas.porCategoria['OUTROS'] || 0 },
  { id: 'cancelamento', nome: 'Cancelamento', nivel: 0, negrito: true, realizado: (r) => r.fatura.cancelamento },
];

/**
 * Monta as linhas prontas pra exibir: Realizado (do resumo), Orçado (do
 * objeto `orcado`, editável: { [id]: { rf: number, sup: number } }), e os
 * deltas de Realizado contra o Orçado-Sup.
 */
function montarLinhasDRE(resumo, orcado) {
  const o = orcado || {};
  return LINHAS_DRE.map((linha) => {
    const realizado = linha.realizado(resumo);
    const orcadoLinha = o[linha.id] || {};
    const orcadoRF = orcadoLinha.rf ?? null;
    const orcadoSup = orcadoLinha.sup ?? null;
    const deltaReais = orcadoSup !== null ? realizado - orcadoSup : null;
    const deltaPercentual = orcadoSup ? (deltaReais / Math.abs(orcadoSup)) * 100 : null;
    return {
      id: linha.id,
      nome: linha.nome,
      nivel: linha.nivel,
      negrito: !!linha.negrito,
      realizado,
      orcadoRF,
      orcadoSup,
      deltaReais,
      deltaPercentual,
    };
  });
}

window.Dre = { LINHAS_DRE, montarLinhasDRE };
})();
