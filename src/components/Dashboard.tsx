import React, { useState } from 'react';
import { Transaction, Category } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
  categories: Category[];
}

export function Dashboard({ transactions, categories }: DashboardProps) {
  const [expandedCats, setExpandedCats] = useState<string[]>([]);
  
  // Only sum up positive expenses for total spending
  const expenses = transactions.filter(t => t.amount > 0);
  const total = expenses.reduce((acc, curr) => acc + curr.amount, 0);
  
  const uncat = transactions.filter(t => t.categoryName === 'Outros');

  // Compute category totals including subcategories under parents
  const groupedData = expenses.reduce((acc, curr) => {
    const cat = categories.find(c => c.id === curr.categoryId);
    const parentId = cat?.parentId || cat?.id || 'unknown';
    const parentCat = categories.find(c => c.id === parentId);
    const mainName = parentCat?.name || 'Desconhecida';
    
    if (!acc[mainName]) {
      acc[mainName] = { total: 0, sub: {}, color: parentCat?.color || '#8884d8' };
    }
    
    acc[mainName].total += curr.amount;
    
    const subName = cat?.name || mainName;
    acc[mainName].sub[subName] = (acc[mainName].sub[subName] || 0) + curr.amount;
    
    return acc;
  }, {} as Record<string, { total: number, sub: Record<string, number>, color: string }>);

  const chartData = Object.entries(groupedData)
    .filter(([_, data]) => data.total > 0)
    .map(([name, data]) => ({
      name,
      total: data.total,
      color: data.color,
      subcategories: Object.entries(data.sub).map(([subName, val]) => ({ name: subName, value: val })).sort((a,b) => b.value - a.value)
    }))
    .sort((a, b) => b.total - a.total);

  const toggleExpand = (name: string) => {
    setExpandedCats(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 shadow-sm shrink-0">
        <p className="text-gray-400 text-sm mb-1">Total da Fatura</p>
        <h3 className="text-4xl font-bold text-[#8A05BE]">{formatCurrency(total)}</h3>
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 bg-purple-900/30 text-purple-400 rounded text-xs font-medium border border-purple-500/20">
            {transactions.length} transações
          </span>
          {uncat.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-900/30 text-amber-500 rounded text-xs font-medium border border-amber-500/20">
              {uncat.length} pendentes
            </span>
          )}
        </div>
      </div>

      <div className="bg-gray-900 p-6 rounded-2xl border border-gray-800 flex flex-col flex-1 shadow-sm min-h-[300px]">
        <h4 className="text-lg font-semibold mb-6 text-white text-left">Gastos por Categoria</h4>
        {chartData.length > 0 ? (
          <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1">
            {chartData.map((data, i) => {
              const isExpanded = expandedCats.includes(data.name);
              const hasSubs = data.subcategories.length > 1 || (data.subcategories.length === 1 && data.subcategories[0].name !== data.name);
              
              return (
                <div key={i} className="flex flex-col">
                  <div 
                    className={`flex flex-col cursor-pointer hover:bg-gray-800/40 p-2 rounded-lg transition-colors ${isExpanded ? 'bg-gray-800/40' : ''}`}
                    onClick={() => hasSubs && toggleExpand(data.name)}
                  >
                    <div className="flex justify-between items-center text-sm mb-2 font-medium">
                      <div className="flex items-center text-gray-200">
                        {hasSubs ? (isExpanded ? <ChevronDown className="w-4 h-4 mr-1 text-gray-400" /> : <ChevronRight className="w-4 h-4 mr-1 text-gray-400" />) : <div className="w-5" />}
                        {data.name}
                      </div>
                      <span className="text-white">{formatCurrency(data.total)}</span>
                    </div>
                    <div className="w-full bg-gray-800 h-2 rounded-full overflow-hidden ml-5" style={{ width: 'calc(100% - 20px)' }}>
                      <div 
                        className="h-2 rounded-full transition-all duration-500" 
                        style={{ 
                          width: `${Math.max(1, (data.total / total) * 100)}%`,
                          backgroundColor: data.color 
                        }} 
                      />
                    </div>
                    <div className="text-right text-xs text-gray-500 mt-1">
                      {((data.total / total) * 100).toFixed(1)}%
                    </div>
                  </div>
                  
                  {isExpanded && hasSubs && (
                    <div className="ml-8 mt-2 space-y-3 border-l pl-3 border-gray-800">
                      {data.subcategories.map((sub, j) => (
                        <div key={j} className="flex flex-col text-[13px] mb-1">
                           <div className="flex justify-between text-gray-400 mb-1">
                             <span>{sub.name}</span>
                             <span>{formatCurrency(sub.value)}</span>
                           </div>
                           <div className="w-full bg-gray-800/50 h-1 rounded-full overflow-hidden">
                              <div 
                                className="h-1 rounded-full" 
                                style={{ 
                                  width: `${Math.max(1, (sub.value / data.total) * 100)}%`,
                                  backgroundColor: data.color,
                                  opacity: 0.7 
                                }} 
                              />
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="w-full text-center text-gray-500 my-auto">Nenhum gasto registrado</div>
        )}
      </div>
    </div>
  );
}
