import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, File as FileIcon } from 'lucide-react';
import { parseCSV, parsePDF } from '../lib/parser';
import { dbHelpers } from '../lib/db';
import { Category, Rule, Transaction, Invoice } from '../lib/types';
import { cn } from '../lib/utils';

interface FileUploadProps {
  onUploadSuccess: (transactions: any[], fileName: string) => void;
  categories: Category[];
  rules: Rule[];
}

export function FileUpload({ onUploadSuccess, categories, rules }: FileUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsProcessing(true);
    setProgress(10);
    setProgressText('Lendo arquivo...');
    let rawTransactions: any[] = [];
    
    try {
      if (file.name.endsWith('.csv')) {
        rawTransactions = await parseCSV(file);
      } else if (file.name.endsWith('.pdf')) {
        rawTransactions = await parsePDF(file);
      } else {
        alert("Formato não suportado. Envie CSV ou PDF.");
        setIsProcessing(false);
        return;
      }

      setProgress(40);
      setProgressText('Aplicando regras locais...');

      // Auto-categorize
      // 1. Find "Outros" category as default, or "Pagamento" for negative
      const outrosCat = categories.find(c => c.name === 'Outros') || categories[0];
      const pagamentoCat = categories.find(c => c.name === 'Pagamento');
      
      let transactions = rawTransactions.map((t, index) => {
        let categoryId = outrosCat?.id || '4';
        let categoryName = outrosCat?.name || 'Outros';
        let matchedRule = rules.find(r => r.title === t.title);
        let isAiTarget = false;

        if (matchedRule) {
           categoryId = matchedRule.categoryId;
           categoryName = matchedRule.categoryName;
        } else if (t.amount < 0 && pagamentoCat) {
           categoryId = pagamentoCat.id;
           categoryName = pagamentoCat.name;
        } else {
           isAiTarget = true;
        }

        return {
          id: crypto.randomUUID(),
          ...t,
          categoryId,
          categoryName,
          isAiCategorized: false,
          _isAiTarget: isAiTarget
        };
      });

      const aiTargets = transactions.filter(t => t._isAiTarget);
      
      if (aiTargets.length > 0) {
        setProgress(60);
        setProgressText(`Categorizando com IA (${aiTargets.length} transações)...`);
        try {
          const res = await fetch('/api/categorize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactions: aiTargets, categories, rules })
          });
          
          if (res.ok) {
            setProgress(80);
            setProgressText('Processando resposta da IA...');
            const aiCategorized = await res.json();
            
            transactions = transactions.map(t => {
              if (t._isAiTarget) {
                const match = aiCategorized.find((ai: any) => ai.transactionId === t.id);
                if (match && match.categoryId) {
                  const cat = categories.find(c => c.id === match.categoryId);
                  if (cat) {
                    return { ...t, categoryId: cat.id, categoryName: cat.name, isAiCategorized: true };
                  }
                }
              }
              return t;
            });
          } else {
            const errData = await res.json().catch(() => ({}));
            const errMsg = errData.error || "Erro desconhecido";
            console.error("AI categorization failed with code:", res.status, errMsg);
            alert(`Atenção: A Inteligência Artificial falhou ou não está configurada (${errMsg}). O arquivo foi importado com categorias padrão ("Outros").`);
          }
        } catch (error) {
          console.error("AI categorization failed", error);
        }
      }

      setProgress(90);
      setProgressText('Finalizando...');

      // Cleanup local temp flag
      transactions = transactions.map(t => {
        const copy = { ...t };
        delete copy._isAiTarget;
        return copy;
      });

      setProgress(100);
      setProgressText('Concluído!');
      onUploadSuccess(transactions, file.name);

    } catch (e) {
      console.error(e);
      alert("Erro ao processar o arquivo.");
    } finally {
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
        setProgressText('');
      }, 500);
    }

  }, [categories, rules, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  } as any);

  return (
    <div 
      {...getRootProps()} 
      className={cn(
        "border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-colors",
        isDragActive ? "border-purple-500 bg-purple-500/10" : "border-gray-700 bg-gray-800/50 hover:bg-gray-800"
      )}
    >
      <input {...getInputProps()} />
      <Upload className="w-12 h-12 text-purple-400 mb-4" />
      {isProcessing ? (
        <div className="w-full max-w-sm flex flex-col items-center">
          <p className="text-gray-300 font-medium mb-4">{progressText || 'Processando arquivo...'}</p>
          <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
             <div 
               className="h-full bg-purple-500 transition-all duration-300 ease-out"
               style={{ width: `${progress}%` }}
             />
          </div>
        </div>
      ) : isDragActive ? (
        <p className="text-purple-400 font-medium">Solte o arquivo aqui...</p>
      ) : (
        <>
          <p className="text-gray-200 font-medium mb-2">Arraste a fatura para cá</p>
          <p className="text-gray-500 text-sm">Ou clique para selecionar. Aceitamos CSV ou PDF.</p>
        </>
      )}
    </div>
  );
}
