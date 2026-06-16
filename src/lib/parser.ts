import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';

// Carga do worker via CDN como sugerido
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.mjs`;

interface RawTransaction {
  date: string;
  title: string;
  amount: number;
}

export const parseCSV = (file: File): Promise<RawTransaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const transactions = results.data.map((row: any) => {
          // Normalize amount (handling "1,234.56" or "1.234,56")
          let amountStr = String(row.amount || '0').replace(/R\$\s*/g, '').trim();
          
          // Basic heuristic for BR vs US format
          if (amountStr.includes(',') && amountStr.includes('.')) {
             // 1.234,56 -> 1234.56
             if (amountStr.lastIndexOf(',') > amountStr.lastIndexOf('.')) {
               amountStr = amountStr.replace(/\./g, '').replace(',', '.');
             } else {
               // 1,234.56 -> 1234.56
               amountStr = amountStr.replace(/,/g, '');
             }
          } else if (amountStr.includes(',')) {
             // 123,45 -> 123.45
             amountStr = amountStr.replace(',', '.');
          }
          
          const amount = parseFloat(amountStr) || 0;
          return {
            date: row.date || row.Data || '',
            title: row.title || row.descricao || row.Descricao || row.Title || '',
            amount
          };
        }).filter(t => t.title !== '');
        
        resolve(transactions);
      },
      error: (error) => reject(error)
    });
  });
};

export const parsePDF = async (file: File): Promise<RawTransaction[]> => {
  const arrayBuffer = await file.arrayBuffer();
  
  // Initialize standard PDF loader
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textContent = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str);
    textContent += strings.join(' ') + '\n';
  }

  // Rudimentary parser for Nubank-style or generic PDF lines
  // Example line: "12 JUN  Uber *Uber  -23,40"
  // Example pattern matching: \d{2} [A-Z]{3}.*?(-?\d+,\d{2})
  
  const transactions: RawTransaction[] = [];
  const lines = textContent.split('\n');
  
  const dateRegex = /^(\d{2}\s[A-Z]{3}|\d{2}\/\d{2}\/\d{4})/i;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Very simple heuristic: looking for a date format at the start of a logical visual block
    // Since PDF text extraction is raw, this is a basic attempt
    const dateMatch = line.match(dateRegex);
    if (dateMatch) {
       const dateTokens = line.split(/\s+/);
       // Attempt to find amount at the end
       const lastToken = dateTokens[dateTokens.length - 1];
       if (/^[-+]?[\d.,]+$/.test(lastToken)) {
          let amountStr = lastToken.replace(/\./g, '').replace(',', '.');
          const amount = parseFloat(amountStr) || 0;
          
          const date = dateMatch[0];
          // Title is everything in between
          const title = line.substring(dateMatch[0].length, line.length - lastToken.length).trim();
          
          if (title) {
             transactions.push({ date, title, amount });
          }
       }
    }
  }
  
  return transactions;
}
