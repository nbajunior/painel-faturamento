/**
 * categorization.js
 * -----------------------------------------------------------------------
 * Regras de categorização das rubricas, extraídas das planilhas atuais:
 *   - Fatura de Ciclo: Faturamento direto x Cancelamento
 *   - Serviço Avulso (Indireta_previa): Rubrica -> Categoria (CORTE, RELIGAÇÃO, LNA, LNE, SANÇÃO, OUTROS)
 *
 * IMPORTANTE sobre acentuação:
 * As bases de origem trazem rubricas com acentuação corrompida (mojibake),
 * por exemplo "CORREÇÃO MONETÁRIA" às vezes chega como "CORREÃ‡ÃƒO MONETÃRIA".
 * Em vez de manter uma lista de variantes corrompidas (como a planilha atual faz),
 * normalizamos todo texto removendo acentos/símbolos e deixando só A-Z0-9 e espaço.
 * Isso faz a versão correta e a versão corrompida caírem na mesma chave,
 * então o comparativo funciona não importa qual chegou no dia.
 */

(function () {
'use strict';

/**
 * Duas formas de normalizar texto pra comparação robusta:
 *  - normalizeKey (estrita): usa NFD pra separar acento de letra (ex: "Á"->"A"+acento) e descarta
 *    o acento, então "ANÁLISE" e "ANALISE" caem na mesma chave. É a forma correta pra acentuação
 *    de verdade, mas mojibake (acento corrompido em vários símbolos, ex: "COBRANÃA") pode virar
 *    uma letra ASCII errada no meio (o "Ã" sobra como "A"), gerando uma chave diferente do original.
 *  - normalizeKeyLoose: não usa NFD, só descarta tudo que não for A-Z0-9/espaço direto do texto
 *    original. Não trata acento de verdade corretamente, mas por coincidência de como o mojibake
 *    se forma, costuma fazer a versão corrompida cair na mesma chave da versão certa.
 * Usamos as duas (ver buildLookup) pra cobrir acentuação normal E mojibake ao mesmo tempo, sem
 * precisar manter uma lista de variantes corrompidas na mão.
 */
function normalizeKey(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKeyLoose(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Constrói um mapa que aceita tanto a chave estrita quanto a "loose" apontando pro mesmo valor. */
function buildLookup(rawMap) {
  const lookup = {};
  Object.keys(rawMap).forEach((chave) => {
    lookup[normalizeKey(chave)] = rawMap[chave];
    lookup[normalizeKeyLoose(chave)] = rawMap[chave];
  });
  return lookup;
}

/** Busca um valor no lookup tentando a chave estrita e depois a "loose". */
function lookupComFallback(lookup, texto) {
  const estrita = normalizeKey(texto);
  if (estrita in lookup) return lookup[estrita];
  const loose = normalizeKeyLoose(texto);
  if (loose in lookup) return lookup[loose];
  return undefined;
}

// ---------------------------------------------------------------------
// Fatura de Ciclo: rubricas de faturamento direto
// ---------------------------------------------------------------------
const RUBRICA_AGUA = normalizeKey('VALOR DE AGUA');
const RUBRICA_ESGOTO = normalizeKey('VALOR DE ESGOTO');

// ---------------------------------------------------------------------
// Fatura de Ciclo: rubricas usadas no cancelamento
// ---------------------------------------------------------------------
const RUBRICAS_CANCELAMENTO = [
  'ABATIMENTO',
  'ABATIMENTO - M3',
  'CREDITO/DEBITO DE ARRECADACAO - VAN',
  'DESCONTO JUDICIAL PROVISORIO',
  'DESCONTO',
  'CREDITO AJUSTE CONTA',
].map(normalizeKey);

// ---------------------------------------------------------------------
// Serviço Avulso: mapeamento Rubrica -> Categoria (extraído da aba "Apoio"
// do arquivo Indireta_previa_v1_ref_09.xlsx). Categoria null = não entra
// no total de Indiretas (mesma regra da planilha original, onde a coluna
// vinha com "0").
// ---------------------------------------------------------------------
const INDIRETA_RAW_MAP = {
  'CORTE NO CAVALETE': 'CORTE',
  'CORTE NO REGISTRO': 'CORTE',
  'CORTE NO REGISTRO DE DERIVACAO - SEM PAVIMENTO': 'CORTE',
  'LIG. AGUA 1" - VAZAO 7M³/H - ASFALTO': 'LNA',
  'LIG. AGUA 1,5" - VAZAO 20M³/H - ASFALTO': 'LNA',
  'LIG. AGUA 1,5" - VAZAO 20M³/H - PARALELO': 'LNA',
  'LIG. AGUA 1/2" - VAZAO 3M³/H - ASFALTO': 'LNA',
  'LIG. AGUA 2" - VAZAO 300M³/H - ASFALTO': 'LNA',
  'LIG. AGUA 3" - VAZAO 1.100M³/H - TERRA': 'LNA',
  'LIG. AGUA 3/4" - VAZAO 3M³/H - ASFALTO': 'LNA',
  'LIG. AGUA 3/4" - VAZAO 3M³/H - CONCRETO': 'LNA',
  'LIG. AGUA 3/4" - VAZAO 3M³/H - NO PASSEIO': 'LNA',
  'LIG. AGUA 3/4" - VAZAO 3M³/H - PARALELO': 'LNA',
  'LIG. AGUA 3/4" - VAZAO 3M³/H - TERRA': 'LNA',
  'LIG. AGUA 3/4" - VAZAO 5M³/H - ASFALTO': 'LNA',
  'LIG. AGUA 3/4" - VAZAO 5M³/H - NO PASSEIO': 'LNA',
  'LIG. AGUA 3/4" - VAZAO 5M³/H - TERRA': 'LNA',
  'LIG. AGUA POPOULAR - PARALELO': 'LNA',
  'ABASTECIMENTO POR PIPA': 'OUTROS',
  'ABATIMENTO - M3': 'OUTROS',
  'ACRÉSCIMOS MANDADO JUDICIAL': 'SANÇÃO',
  'ACRESCIMOS POR REINCIDENCIA': 'SANÇÃO',
  'RELIGACAO A PEDIDO': 'RELIGAÇÃO',
  'RELIGACAO NO REGISTRO': 'RELIGAÇÃO',
  'RELIGACAO NO REGISTRO DE DERIVACAO - COM PAVIMENTO': 'RELIGAÇÃO',
  'RELIGACAO COM LEVANTAMENTO TOTAL DO RAMAL': 'RELIGAÇÃO',
  'RELIGACAO NO CAVALETE': 'RELIGAÇÃO',
  'RELIGACAO NO REGISTRO DE DERIVACAO - SEM PAVIMENTO': 'RELIGAÇÃO',
  'BY-PASS NO RAMAL 1/2" CIP': 'SANÇÃO',
  'BY-PASS NO RAMAL 1/2" RES': 'SANÇÃO',
  'BY-PASS NO RAMAL 3/4" CIP': 'SANÇÃO',
  'BY-PASS NO RAMAL 3/4" RES': 'SANÇÃO',
  'BY-PASS NO RAMAL 1" CIP': 'SANÇÃO',
  'VIOLACAO DO CORTE - 1/2" CIP': 'SANÇÃO',
  'VIOLACAO DO CORTE - 1/2" RES': 'SANÇÃO',
  'VIOLACAO DO CORTE - 3/4" CIP': 'SANÇÃO',
  'VIOLACAO DO CORTE - 3/4" RES': 'SANÇÃO',
  'VIOLACAO DO LACRE CIP': 'SANÇÃO',
  'VIOLACAO DO LACRE RES': 'SANÇÃO',
  'VIOLACAO OU RETIRADA DE HD 1/2" CIP': 'SANÇÃO',
  'VIOLACAO OU RETIRADA DE HD 1/2" RES': 'SANÇÃO',
  'VIOLACAO OU RETIRADA DE HD 3/4" RES': 'SANÇÃO',
  'COBRANCA RETROATIVA AGUA E/OU ESGOTO': 'SANÇÃO',
  'COBRANÇA RETROATIVA DE AGUA E ESGOTO - IRREG.': 'SANÇÃO',
  'LIG. AS REDES PUB. DE AGUA E INTERV. 3/4" RES': 'SANÇÃO',
  'LIG. AS REDES PUB. DE AGUA E INTERV. 1/2" RES': 'LNA',
  'INTERCONEXAO DE SISTEMAS CIP': 'SANÇÃO',
  'INTERCONEXAO DE SISTEMAS RES': 'SANÇÃO',
  'COBRANÇA DE PARCELAS': null,
  'CRÉDITO DE ARRECADAÇÃO': null,
  'DERIVACAO DE INSTALACAO PREDIAL CIP': 'SANÇÃO',
  'DERIVACAO DE INSTALACAO PREDIAL RES': 'SANÇÃO',
  'LIG. ESGOTO 150MM VIDRADO - TERRA - ASFALTO': 'LNE',
  'LIG. ESGOTO 150MM VIDRADO - TERRA - PARALELO': 'LNE',
  'LIG. ESGOTO 100MM FERRO FUNDIDO - TERRA - PARALELO': 'LNE',
  'LIG. ESGOTO 100MM VIDRADO - ROCHA - PASSEIO': 'LNE',
  'LIG. ESGOTO 100MM VIDRADO - TERRA - ASFALTO': 'LNE',
  'LIG. DE AGUAS INDUST. A REDE DE ESGOTO CIP': 'LNE',
  'LIG. DE AGUAS PLUV. A REDE DE ESGOTO RES': 'OUTROS',
  'DESCONTO FUTURO': 'OUTROS',
  'DESLOC. CAVALETE >1M - 3/4" - ASFALTO': 'OUTROS',
  'DESLOCAMENTO DE CAVALETE ATÉ 1M - ASFALTO': 'OUTROS',
  'DESLOCAMENTO DE CAVALETE >1M - 3/4"': 'OUTROS',
  'DIFERENCA CONSUMO AGUA': 'SANÇÃO',
  'DIFERENCA CONSUMO ESGOTO': 'SANÇÃO',
  'EMISSAO 2.A VIA NOTA FISCAL': 'OUTROS',
  'INFRACAO NAO PREVISTA CIP': 'SANÇÃO',
  'INFRACAO NAO PREVISTA RES': 'SANÇÃO',
  'INSTALACAO DE CAIXA PADRAO': 'OUTROS',
  'INSTALACAO DE HIDRANTE - ASFALTO': 'OUTROS',
  'INSTALACAO DE HIDRANTE - TERRA': 'OUTROS',
  'INTERCALACAO DE DISPOSITIVO CIP': 'SANÇÃO',
  'INTERV. NAS INST. DE AGUA EM AREAS PUBLICAS RES': 'SANÇÃO',
  'IR': 'OUTROS',
  'IR ESTADUAL': 'OUTROS',
  'IR MUNICIPAL': 'OUTROS',
  'IRREGULARIDADE NA LIGACAO DE ESGOTO': 'SANÇÃO',
  'NAO CUMPRIMENTO DE INTIMACAO CIP': 'SANÇÃO',
  'NAO CUMPRIMENTO DE INTIMACAO RES': 'SANÇÃO',
  'OBRAS DE AGUA SEM AUTORIZACAO CIP': 'OUTROS',
  'OBSTRUCAO DA REDE DE ESGOTO CIP': 'OUTROS',
  'OBSTRUCAO DA REDE DE ESGOTO RES': 'OUTROS',
  'SUB. HIDROMETRO ULTRASSONICO - 3" - 1.100 m³/h': 'OUTROS',
  'SUBST. DE HD - 3/4" - 3 M³/H - IRREG.': 'OUTROS',
  'SUBST. DE HD. - 1/2" - 3 M³/H - IRREG.': 'OUTROS',
  'SUBSTITUIÇÃO DE NF BAIXADA INDEVIDAMENTE': 'OUTROS',
  'SUBSTITUICAO DE HIDROMETRO - 1" - 10 M³/H': 'OUTROS',
  'SUBSTITUICAO DE HIDROMETRO - 1" - 7 M³/H': 'OUTROS',
  'SUBSTITUICAO DE HIDROMETRO - 2" - 300 M³/H': 'OUTROS',
  'SUBSTITUICAO DE HIDROMETRO - 3/4" - 3 M³/H': 'OUTROS',
  'SUBSTITUICAO DE HIDROMETRO - 3/4" - 5 M³/H': 'OUTROS',
  'SUBSTITUICAO DE LIMITADOR POR HIDROMETRO': 'OUTROS',
  'SUPRESSAO - LEVANTAMENTO RAMAL 3"': 'OUTROS',
  'SUPRESSAO - LEVANTAMENTO RAMAL ATÉ 1"': 'OUTROS',
  'UNIFICACAO PARCELAMENTO': 'OUTROS',
  'USO DE DISPOSITIVOS NAO APROVADOS CIP': 'OUTROS',
  'USO DE DISPOSITIVOS NAO APROVADOS RES': 'OUTROS',
  'VALOR JUDICIAL': 'OUTROS',
  'VALOR NEGOCIADO': 'OUTROS',
  'VISTORIA': 'OUTROS',
};

// Mapa normalizado (chave estrita + chave "loose") -> categoria, para lookup robusto
// tanto a acentuação correta quanto a mojibake mais comum.
const INDIRETA_MAP = buildLookup(INDIRETA_RAW_MAP);

const CATEGORIAS_INDIRETA = ['CORTE', 'RELIGAÇÃO', 'LNA', 'LNE', 'SANÇÃO', 'OUTROS'];

// ---------------------------------------------------------------------
// Localidades (cidades) que pertencem a esta Superintendência. A base de
// Serviço Avulso vem misturada com cidades de outras Superintendências, que
// precisam ser descartadas antes de somar qualquer coisa.
// ---------------------------------------------------------------------
const LOCALIDADES_VALIDAS = [
  'APERIBE',
  'CAMBUCI',
  'CORDEIRO',
  'CANTAGALO',
  'DUAS BARRAS',
  'ITAOCARA',
  'MIRACEMA',
  'RIO BONITO',
  'S.FCO.DO ITABAPOANA', // São Francisco de Itabapoana
  'S.SEBASTIAO DO ALTO', // São Sebastião do Alto
  'CACHOEIRAS DE MACACU',
  'CASIMIRO DE ABREU',
].map(normalizeKey);

/** true se a localidade pertence às 12 cidades desta Superintendência. */
function localidadeValida(nomeLocalidade) {
  return LOCALIDADES_VALIDAS.includes(normalizeKey(nomeLocalidade));
}

/** Classifica uma rubrica da Fatura de Ciclo. Retorna 'AGUA' | 'ESGOTO' | 'CANCELAMENTO' | null */
function classificarRubricaFatura(rubrica) {
  const key = normalizeKey(rubrica);
  if (key === RUBRICA_AGUA) return 'AGUA';
  if (key === RUBRICA_ESGOTO) return 'ESGOTO';
  if (RUBRICAS_CANCELAMENTO.includes(key)) return 'CANCELAMENTO';
  return null;
}

/** Classifica uma rubrica do Serviço Avulso. Retorna a categoria (CORTE/RELIGAÇÃO/LNA/LNE/SANÇÃO/OUTROS) ou null. */
function classificarRubricaIndireta(rubrica) {
  const valor = lookupComFallback(INDIRETA_MAP, rubrica);
  if (valor !== undefined) return valor;
  // rubrica não mapeada ainda (nem na forma estrita, nem na "loose"): cai em OUTROS e fica registrada para revisão
  return 'OUTROS_NAO_MAPEADO';
}

// Exporta para uso em outros módulos (sem bundler: tudo em window)
window.Categorization = {
  normalizeKey,
  classificarRubricaFatura,
  classificarRubricaIndireta,
  CATEGORIAS_INDIRETA,
  INDIRETA_MAP,
  localidadeValida,
};
})();
