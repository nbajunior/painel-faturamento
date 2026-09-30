/**
 * tarifas.js
 * -----------------------------------------------------------------------
 * Motor de cálculo de tarifa progressiva de água, extraído da planilha de
 * apoio (Apoio.xlsx: tblTarifas + tblMinimo) e validado contra 400 contas
 * reais da Fatura de Ciclo (99% de acerto com diferença < 1 centavo).
 *
 * Regras:
 *  - O consumo total da matrícula é dividido igualmente pelo nº de economias
 *    antes de aplicar a tarifa (cada economia é cobrada como uma conta própria).
 *  - As faixas são cumulativas: cada faixa cobra só a quantidade de m³ que cai
 *    dentro dela (ex: 22m³ na Residencial = 15m³ na faixa 1 + 7m³ na faixa 2).
 *  - Só a categoria RESIDENCIAL tem a particularidade: se o consumo por
 *    economia ultrapassa o mínimo (15m³), a 1ª faixa também passa a usar a
 *    Tarifa Progressiva (em vez da Tarifa Normal). As demais categorias usam
 *    sempre o mesmo valor na 1ª faixa, ultrapasse ou não o mínimo.
 */

(function () {
'use strict';

// Mínimo de consumo (m³) por economia, por categoria.
const MINIMOS_M3 = {
  'RESIDENCIAL': 15,
  'SOCIAL': 15,
  'SOCIAL ESPECIAL': 15,
  'PUBLICA': 15,
  'PUB. ESTADUAL': 15,
  'PEQ. COMERCIO': 10,
  'COMERCIAL': 20,
  'INDUSTRIAL': 20,
};

// Faixas de tarifa por categoria: [limiteFim (m³), tarifaNormal, tarifaProgressiva]
// (limiteFim = 9e18 representa "sem limite", última faixa)
const BANDAS = {
  'RESIDENCIAL': [[15, 5.6941, 6.5231], [30, 14.3508, 14.3508], [45, 19.5692, 19.5692], [60, 39.1384, 39.1384], [9e18, 52.1845, 52.1845]],
  'SOCIAL': [[15, 2.0083, 2.0083], [30, 14.3508, 14.3508], [45, 19.5692, 19.5692], [60, 39.1384, 39.1384], [9e18, 52.1845, 52.1845]],
  'SOCIAL ESPECIAL': [[15, 2.0083, 2.0083], [30, 14.3508, 14.3508], [45, 19.5692, 19.5692], [60, 39.1384, 39.1384], [9e18, 52.1845, 52.1845]],
  'COMERCIAL': [[20, 22.1784, 22.1784], [30, 39.0731, 39.0731], [9e18, 41.7476, 41.7476]],
  'PEQ. COMERCIO': [[20, 22.1784, 22.1784], [30, 39.0731, 39.0731], [9e18, 41.7476, 41.7476]],
  'INDUSTRIAL': [[30, 30.6584, 30.6584], [130, 35.2245, 35.2245], [9e18, 37.1814, 37.1814]],
  'PUBLICA': [[15, 8.6105, 8.6105], [9e18, 19.0474, 19.0474]],
  'PUB. ESTADUAL': [[15, 7.5161, 7.5161], [9e18, 16.6265, 16.6265]],
};

/** Valor (R$) de UMA economia consumindo `consumoPorEconomia` m³, na categoria dada. */
function valorPorEconomia(categoriaNormalizada, consumoPorEconomiaOriginal) {
  const bandas = BANDAS[categoriaNormalizada];
  if (!bandas) return null;
  const minimo = MINIMOS_M3[categoriaNormalizada];

  // SOCIAL ESPECIAL não paga excedente: consumo acima do mínimo não é cobrado,
  // então a conta é calculada como se o consumo fosse, no máximo, o mínimo.
  const consumoPorEconomia =
    categoriaNormalizada === 'SOCIAL ESPECIAL' ? Math.min(consumoPorEconomiaOriginal, minimo) : consumoPorEconomiaOriginal;

  const ultrapassaMinimo = consumoPorEconomia > minimo;

  let restante = consumoPorEconomia;
  let anteriorFim = 0;
  let total = 0;

  for (let i = 0; i < bandas.length; i++) {
    const [fim, normal, progressiva] = bandas[i];
    const largura = fim - anteriorFim;
    const usado = Math.max(0, Math.min(restante, largura));
    if (usado > 0) {
      const usaProgressiva = i === 0 && categoriaNormalizada === 'RESIDENCIAL' && ultrapassaMinimo;
      total += usado * (usaProgressiva ? progressiva : normal);
    }
    restante -= usado;
    anteriorFim = fim;
    if (restante <= 0) break;
  }
  return total;
}

/**
 * Valor total (R$) faturado para uma matrícula, dado o consumo total (m³) e o
 * número de economias. Retorna null se a categoria não for reconhecida.
 */
function calcularValorFaturamento(categoria, consumoTotalM3, numeroEconomias) {
  const cat = String(categoria || '').toUpperCase().trim();
  if (!BANDAS[cat] || !numeroEconomias || numeroEconomias <= 0) return null;
  const consumoPorEconomia = consumoTotalM3 / numeroEconomias;
  const valorUnitario = valorPorEconomia(cat, consumoPorEconomia);
  if (valorUnitario === null) return null;
  return valorUnitario * numeroEconomias;
}

/** Mínimo total (m³) de uma matrícula: mínimo por economia da categoria x nº de economias. */
function calcularMinimoM3(categoria, numeroEconomias) {
  const cat = String(categoria || '').toUpperCase().trim();
  const minimo = MINIMOS_M3[cat];
  if (minimo === undefined || !numeroEconomias) return null;
  return minimo * numeroEconomias;
}

/** Valor (R$) mínimo faturável de uma matrícula: aplica a tarifa ao próprio mínimo de m³. */
function calcularValorMinimo(categoria, numeroEconomias) {
  const minimoM3 = calcularMinimoM3(categoria, numeroEconomias);
  if (minimoM3 === null) return null;
  return calcularValorFaturamento(categoria, minimoM3, numeroEconomias);
}

window.Tarifas = {
  MINIMOS_M3,
  BANDAS,
  calcularValorFaturamento,
  calcularMinimoM3,
  calcularValorMinimo,
};
})();
