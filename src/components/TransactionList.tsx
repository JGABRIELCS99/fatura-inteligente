import React, { useState } from 'react';
import { Transaction, Category } from '../lib/types';
import { formatCurrency, cn } from '../lib/utils';
import { ChevronDown, Tag, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface TransactionListProps {
  transactions: Transaction[];
  categories: Category[];
  onUpdateCategory: (transactionId: string, newCategoryId: string, saveRule: boolean) => void;
}

export function TransactionList({ transactions, categories, onUpdateCategory }: TransactionListProps) {
  const [filter, setFilter] = useState<string>('all');
  const [rulePreferences, setRulePreferences] = useState<Record<string, boolean>>({});
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  const getShouldSaveRule = (id: string) => {
    return rulePreferences[id] ?? true; // default true
  };

  const handleToggleRulePref = (id: string) => {
    setRulePreferences(prev => ({ ...prev, [id]: !getShouldSaveRule(id) }));
  };

  const toggleExpand = (id: string) => {
    setExpandedTxId(prev => prev === id ? null : id);
  };

  const orderedCategories = React.useMemo(() => {
    const parents = categories.filter(c => !c.parentId);
    const result: Category[] = [];
    for (const p of parents) {
      result.push(p);
      result.push(...categories.filter(c => c.parentId === p.id));
    }
    return result;
  }, [categories]);

  const aiCategorizedCount = transactions.filter(t => t.isAiCategorized).length;

  const filtered = transactions.filter(t => {
    if (filter === 'all') return true;
    if (filter === 'uncategorized') return t.categoryName === 'Outros';
    if (filter === 'ai') return t.isAiCategorized;
    return t.categoryId === filter;
  });

  return (
    <div className="h-full bg-gray-900/50 rounded-2xl border border-gray-800 shadow-sm flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
        <div className="flex items-center gap-4">
          <span className="font-semibold text-white">Lista de Lançamentos</span>
          {aiCategorizedCount > 0 && (
             <button 
               onClick={() => setFilter(filter === 'ai' ? 'all' : 'ai')}
               className={cn(
                 "text-[11px] font-medium px-2 py-0.5 rounded-full border transition-colors flex items-center gap-1",
                 filter === 'ai' ? "bg-purple-500/20 border-purple-500/50 text-purple-300" : "bg-gray-800 border-gray-700 text-gray-400 hover:text-purple-300 hover:border-purple-500/30"
               )}
             >
               ✨ {aiCategorizedCount} pela IA
             </button>
          )}
        </div>
        <div className="flex gap-2">
          <select 
            className="bg-gray-800 text-gray-300 text-xs rounded-lg border-none focus:ring-1 focus:ring-purple-500 py-1.5 pl-3 pr-8"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all" className="bg-gray-900 text-gray-200" style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>Todas categorias</option>
            <option value="uncategorized" className="bg-gray-900 text-gray-200" style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>Não categorizadas</option>
            <optgroup label="Categorias" className="bg-gray-900 text-gray-400" style={{ backgroundColor: '#111827', color: '#9ca3af' }}>
              {orderedCategories.map((c, i) => (
                <option key={`filter-${c.id}-${i}`} value={c.id} className="bg-gray-900 text-gray-200" style={{ backgroundColor: '#111827', color: '#f3f4f6' }}>
                  {c.parentId ? `└ ${c.name}` : c.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 sm:p-4 space-y-2 bg-[#0a0a0a]">
        {filtered.map((t, idx) => {
          const isPayment = t.amount < 0;
          const cat = categories.find(c => c.id === t.categoryId);
          const isExpanded = expandedTxId === t.id;
          
          return (
            <div 
              key={`${t.id}-${idx}`} 
              className={cn(
                "border rounded-xl p-3 sm:p-4 transition-colors",
                isPayment ? "bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30" : "bg-gray-900 border-gray-800 hover:border-gray-700"
              )}
            >
              <div 
                className="flex items-start justify-between gap-3 cursor-pointer"
                onClick={() => toggleExpand(t.id)}
              >
                <div className="flex-1 min-w-0">
                  <h3 className={cn("text-sm font-medium truncate mb-2", isPayment ? "text-emerald-400" : "text-gray-200")}>
                    {t.title}
                  </h3>
                  
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <div className="relative inline-flex items-center gap-1.5 px-2 py-1 rounded-md border bg-gray-950 border-gray-800 transition-colors">
                      {/* Color indicator dot representing the category color */}
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: cat?.color || '#6b7280' }}
                      />
                      <select
                        className="text-[11px] font-semibold text-gray-200 cursor-pointer focus:outline-none bg-[#030712] pr-5 border-none py-0 h-5 leading-none select-none appearance-none rounded"
                        style={{ backgroundColor: '#030712', color: '#e5e7eb' }}
                        value={t.categoryId}
                        onChange={(e) => onUpdateCategory(t.id, e.target.value, getShouldSaveRule(t.id))}
                      >
                        {orderedCategories.map((c, i) => (
                          <option 
                            key={`opt-${t.id}-${c.id}-${i}`} 
                            value={c.id}
                            className="bg-[#111827] text-gray-100 placeholder-opacity-100"
                            style={{ backgroundColor: '#111827', color: '#f3f4f6' }}
                          >
                            {c.parentId ? `└ ${c.name}` : c.name}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-1.5 pointer-events-none opacity-50 flex items-center">
                        <ChevronDown className="w-3 h-3 text-gray-400" />
                      </div>
                    </div>
                    {t.isAiCategorized && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateCategory(t.id, t.categoryId, getShouldSaveRule(t.id));
                        }}
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/40 hover:text-white transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 active:scale-95"
                        title="Confirmar classificação da IA"
                      >
                        IA ✨
                      </button>
                    )}
                  </div>
                </div>
                
                <div className={cn(
                  "flex items-center text-sm font-medium whitespace-nowrap shrink-0",
                  isPayment ? "text-emerald-400" : "text-gray-200"
                )}>
                  {isPayment ? <ArrowDownLeft className="w-3 h-3 mr-1" /> : <ArrowUpRight className="w-3 h-3 mr-1 opacity-50" />}
                  {formatCurrency(Math.abs(t.amount))}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-gray-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="text-gray-400">
                    <span className="block text-gray-500 mb-0.5 font-medium">Data da Transação</span>
                    <span className={cn("font-medium", isPayment ? "text-emerald-500/60" : "text-gray-300")}>{t.date}</span>
                  </div>
                  
                  <label 
                    className="flex items-center gap-2 text-gray-400 cursor-pointer hover:text-gray-200 transition-colors bg-gray-950/50 px-3 py-2 rounded-lg border border-gray-800/50 self-start sm:self-auto w-fit" 
                    title="Se marcado, aplicará a mesma categoria a compras iguais nesta fatura e criará uma regra para futuras faturas."
                  >
                    <input 
                      type="checkbox" 
                      className="rounded bg-gray-800 border-gray-700 text-purple-500 focus:ring-purple-500/30 cursor-pointer w-3.5 h-3.5" 
                      checked={getShouldSaveRule(t.id)}
                      onChange={() => handleToggleRulePref(t.id)}
                    />
                    Criar regra p/ futuras (exceção)
                  </label>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-500 bg-gray-900 border border-gray-800 rounded-xl">
            Nenhuma transação encontrada.
          </div>
        )}
      </div>
    </div>
  );
}
