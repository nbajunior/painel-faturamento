/**
 * parsers.js
 * -----------------------------------------------------------------------
 * Leitura dos 3 arquivos CSV exportados diariamente (Fatura de Ciclo,
 * Consumo, Serviço Avulso). Usa PapaParse (via CDN) para não travar o
 * navegador com arquivos de 100-250 mil linhas.
 *
 * Particularidades tratadas:
 *  - BOM UTF-8 no início do arquivo
 *  - separador ";"
 *  - Consumo e Serviço Avulso trazem uma 1ª linha "sep=;" antes do cabeçalho real
 *  - números em formato BR: "1.234,56" (ponto = milhar, vírgula = decimal)
 */

(function () {
'use strict';

/** Converte um número em formato BR ("1.234,56" ou "85,41" ou "-12,30") para float JS. */
function parseNumeroBR(valor) {
  if (valor === null || valor === undefined || valor === '') return 0;
  if (typeof valor === 'number') return valor;
  const limpo = String(valor).trim().replace(/\./g, '').replace(',', '.');
  const n = parseFloat(limpo);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Lê um File (do <input type="file">) como texto, detectando e removendo
 * a linha "sep=;" quando presente, e retorna as linhas já parseadas pelo PapaParse.
 * @param {File} file
 * @param {(rowCount:number)=>void} onProgress callback opcional, chamado periodicamente com a contagem de linhas já lidas
 * @returns {Promise<Array<Object>>} array de objetos {coluna: valor}
 */
function lerCSV(file, onProgress) {
  return new Promise((resolve, reject) => {
    // Primeiro lemos o arquivo inteiro como texto pra poder checar/remover a 1ª linha "sep=;"
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}`));
    reader.onload = () => {
      let text = reader.result;
      // remove BOM se sobrou
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

      const primeiraQuebra = text.indexOf('\n');
      const primeiraLinha = text.slice(0, primeiraQuebra).trim();
      if (/^sep=.$/i.test(primeiraLinha)) {
        text = text.slice(primeiraQuebra + 1);
      }

      const linhas = [];
      Papa.parse(text, {
        header: true,
        delimiter: ';',
        skipEmptyLines: true,
        worker: true,
        transformHeader: (h) => h.trim(),
        chunk: (results) => {
          linhas.push(...results.data);
          if (onProgress) onProgress(linhas.length);
        },
        complete: () => resolve(linhas),
        error: (err) => reject(err),
      });
    };
    reader.readAsText(file, 'UTF-8');
  });
}

window.Parsers = { parseNumeroBR, lerCSV };
})();
