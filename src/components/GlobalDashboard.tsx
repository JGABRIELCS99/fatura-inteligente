import React, { useMemo, useState } from 'react';
import { Invoice, Category } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { PieChart, Pie, Cell, Tooltip as PieTooltip, BarChart, Bar, XAxis, YAxis, Tooltip as BarTooltip, ResponsiveContainer, Legend } from 'recharts';

interface GlobalDashboardProps {
  invoices: Invoice[];
  categories: Category[];
}

export function GlobalDashboard({ invoices, categories }: GlobalDashboardProps) {
  // Sort invoices by uploadDate (assuming chronological for simplicity, ideally they have a billing period, but we only have uploadDate)
  const sortedInvoices = [...invoices].sort((a, b) => a.uploadDate - b.uploadDate);

  const { monthlyData, categoryEvolutions, aggregateTotals } = useMemo(() => {
    const monthly: any[] = [];
    const catMap: Record<string, number> = {};
    const evolutionMap: Record<string, any[]> = {};

    sortedInvoices.forEach(inv => {
      // Find month name (approximate by upload date or filename? Use upload date for now)
      const dateStr = new Date(inv.uploadDate).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      
      const expenses = inv.transactions.filter(t => t.amount > 0);
      const totalSpend = expenses.reduce((acc, curr) => acc + curr.amount, 0);

      const monthEntry: any = {
        name: dateStr || inv.fileName,
        total: totalSpend,
      };

      expenses.forEach(t => {
        // Find parent category to group
        const cat = categories.find(c => c.id === t.categoryId);
        const parentId = cat?.parentId || cat?.id;
        const parentCat = categories.find(c => c.id === parentId);
        const groupName = parentCat?.name || 'Outros';

        monthEntry[groupName] = (monthEntry[groupName] || 0) + t.amount;
        catMap[groupName] = (catMap[groupName] || 0) + t.amount;
      });

      monthly.push(monthEntry);
    });

    const parsedTotals = Object.entries(catMap)
      .filter(([_, val]) => val > 0)
      .map(([name, value]) => {
        const c = categories.find(cat => cat.name === name);
        return { name, value, color: c?.color || '#8884d8' };
      })
      .sort((a, b) => b.value - a.value);

    return { monthlyData: monthly, aggregateTotals: parsedTotals };
  }, [sortedInvoices, categories]);

  if (invoices.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <h2 className="text-2xl font-bold mb-4 text-gray-200">Dashboard Global</h2>
        <p className="text-gray-500">Faça upload de faturas para ver o comparativo.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-300">
      <h2 className="text-2xl font-bold flex items-center">
        Comparativo Consolidado
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[400px]">         {/* Evolução de Gastos Totais por Mês */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex flex-col shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">Evolução do Faturamento Mensal</h3>
          <div className="flex-1 min-h-0">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={monthlyData}>
                 <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                 <BarTooltip 
                   cursor={{ fill: '#374151', opacity: 0.4 }}
                   contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#F3F4F6' }}
                   formatter={(value: number) => [formatCurrency(value), 'Total']}
                 />
                 <Bar dataKey="total" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição Global de Gastos (Pizza) */}
        <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex flex-col shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">Gastos por Categoria (Global)</h3>
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={aggregateTotals}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius="80%"
                  innerRadius="50%"
                  label={false}
                >
                  {aggregateTotals.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <PieTooltip 
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#F3F4F6' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

       <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 flex flex-col shadow-sm min-h-[400px]">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">Evolução por Categoria</h3>
          <div className="flex-1 min-h-0">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={monthlyData}>
                 <XAxis dataKey="name" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                 <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$ ${(val/1000).toFixed(0)}k`} />
                 <BarTooltip 
                   cursor={{ fill: '#374151', opacity: 0.4 }}
                   contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px', color: '#F3F4F6' }}
                   formatter={(value: number) => formatCurrency(value)}
                 />
                 <Legend wrapperStyle={{ fontSize: '12px' }} />
                 {aggregateTotals.map((cat) => (
                   <Bar key={cat.name} dataKey={cat.name} stackId="a" fill={cat.color} />
                 ))}
               </BarChart>
             </ResponsiveContainer>
          </div>
       </div>

    </div>
  );
}
