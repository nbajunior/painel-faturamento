/**
 * parsers.js
 * Leitura dos CSVs exportados diariamente (Fatura de Ciclo, Consumo, Serviço Avulso).
 * - BOM UTF-8, separador ";", linha "sep=;" opcional antes do cabeçalho
 * - números em formato BR: "1.234,56"
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

/** Lê um File como texto, remove a linha "sep=;" se existir e devolve as linhas parseadas. */
function lerCSV(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}`));
    reader.onload = () => {
      let text = reader.result;
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
        transformHeader: (h) => h.trim(),
        chunk: (results) => {
          // for em vez de push(...array): o spread estoura a pilha com arquivos grandes
          for (let i = 0; i < results.data.length; i++) linhas.push(results.data[i]);
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
