import React, { useState, useEffect } from 'react';
import { dbHelpers, customAuth } from './lib/db';
import { Category, Rule, Transaction, Invoice } from './lib/types';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { GlobalDashboard } from './components/GlobalDashboard';
import { TransactionList } from './components/TransactionList';
import { CategoryManager } from './components/CategoryManager';
import { Download, History, Tag, FileText, ChevronLeft, LayoutDashboard, CreditCard, Trash2, LogOut, BarChart2, Plus, CheckSquare, Square, FileStack } from 'lucide-react';
import Papa from 'papaparse';
import { jsPDF } from 'jspdf';
import { formatCurrency } from './lib/utils';

export default function App() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  
  type ViewMode = 'upload' | 'invoice' | 'history' | 'global_dashboard';
  const [viewMode, setViewMode] = useState<ViewMode>('upload');
  
  const [showCatManager, setShowCatManager] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  // States for merging invoices
  const [isSelectingForMerge, setIsSelectingForMerge] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeDateOption, setMergeDateOption] = useState<'keep' | 'adjust'>('keep');
  const [selectedMergeMonth, setSelectedMergeMonth] = useState(new Date().getMonth() + 1);
  const [selectedMergeYear, setSelectedMergeYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const checkUser = async () => {
      setUser(customAuth.currentUser);
      if (customAuth.currentUser) {
        await loadData();
      } else {
        setLoading(false);
      }
    };
    checkUser();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const cats = await dbHelpers.getCategories();
    const rls = await dbHelpers.getRules();
    const invs = await dbHelpers.getInvoices();
    setCategories(cats);
    setRules(rls);
    setInvoices(invs);
    setLoading(false);
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    
    if (!email || !password) {
      setAuthError("Por favor, preencha o email e a senha.");
      setIsLoggingIn(false);
      return;
    }

    try {
      if (password.length < 6) {
         setAuthError("A senha deve ter pelo menos 6 caracteres.");
         setIsLoggingIn(false);
         return;
      }

      if (isSignUp) {
        await customAuth.signUp(email, password);
      } else {
        await customAuth.signIn(email, password);
      }
      setUser(customAuth.currentUser);
      await loadData();
    } catch (error: any) {
      console.error("Login erro:", error);
      
      const msg = error?.message || String(error);
      setAuthError(`${msg}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    customAuth.signOut();
    setUser(null);
    setCategories([]);
    setRules([]);
    setInvoices([]);
    setActiveInvoice(null);
    setViewMode('upload');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUploadSuccess = async (transactions: Transaction[], fileName: string) => {
    const newInvoice: Omit<Invoice, 'id'> = {
      fileName,
      uploadDate: Date.now(),
      totalTransactions: transactions.length,
      transactions
    };
    const saved = await dbHelpers.saveInvoice(newInvoice);
    setInvoices([saved, ...invoices]);
    setActiveInvoice(saved);
    setViewMode('invoice');
    showToast(`${transactions.length} transações importadas com sucesso!`);
  };

  const handleUpdateCategory = async (transactionId: string, newCategoryId: string, saveRule: boolean) => {
    if (!activeInvoice) return;

    const cat = categories.find(c => c.id === newCategoryId);
    if (!cat) return;

    const trans = activeInvoice.transactions.find(t => t.id === transactionId);
    if (!trans) return;

    const title = trans.title;

    // Apply to current invoice state
    let updatedCount = 0;
    let someWasAi = false;
    const updatedTransactions = activeInvoice.transactions.map(t => {
      // If saveRule is true, update all with same title. 
      // If false, only update the exact transaction.
      if (saveRule ? t.title === title : t.id === transactionId) {
        if (t.categoryId !== newCategoryId) updatedCount++;
        if (t.isAiCategorized) someWasAi = true;
        return { ...t, categoryId: cat.id, categoryName: cat.name, isAiCategorized: false };
      }
      return t;
    });

    const updatedInvoice = {
      ...activeInvoice,
      transactions: updatedTransactions
    };

    setActiveInvoice(updatedInvoice);
    await dbHelpers.updateInvoice(updatedInvoice.id, { transactions: updatedTransactions });

    if (saveRule) {
      // Save Rule
      await dbHelpers.saveRule(title, cat.id, cat.name);
      
      // Update local rules state
      const newRules = rules.filter(r => r.title !== title);
      newRules.push({
        id: title,
        title,
        categoryId: cat.id,
        categoryName: cat.name,
        updatedAt: Date.now()
      });
      setRules(newRules);
    }

    if (updatedCount > 0) {
      showToast(`${updatedCount} transaç${updatedCount > 1 ? 'ões' : 'ão'} reclassificada${updatedCount > 1 ? 's' : ''}${saveRule ? ' e regra criada' : ' como exceção'}.`);
    } else if (someWasAi) {
      showToast(`Classificação da IA confirmada como '${cat.name}'.`);
    }
  };

  const handleAddCategory = async (name: string, color: string, parentId?: string) => {
    const newCat = await dbHelpers.addCategory({ name, color, parentId, createdAt: Date.now() });
    setCategories([...categories, newCat]);
  };

  const handleEditCategory = async (id: string, name: string, color: string) => {
    await dbHelpers.updateCategory(id, { name, color });
    setCategories(categories.map(c => c.id === id ? { ...c, name, color } : c));
    
    // Auto update existing transactions in active invoice
    if (activeInvoice) {
      const updated = activeInvoice.transactions.map(t => 
        t.categoryId === id ? { ...t, categoryName: name } : t
      );
      setActiveInvoice({ ...activeInvoice, transactions: updated });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    await dbHelpers.deleteCategory(id);
    setCategories(categories.filter(c => c.id !== id));
    
    // Fallback transactions to Outros
    const outrosCat = categories.find(c => c.name === 'Outros') || categories[0];
    
    if (activeInvoice) {
      const updated = activeInvoice.transactions.map(t => 
        t.categoryId === id ? { ...t, categoryId: outrosCat.id, categoryName: outrosCat.name } : t
      );
      setActiveInvoice({ ...activeInvoice, transactions: updated });
    }
  };

  const handleExportCSV = () => {
    if (!activeInvoice) return;
    const csv = Papa.unparse(activeInvoice.transactions.map(t => ({
      Data: t.date,
      Descricao: t.title,
      Valor: t.amount,
      Categoria: t.categoryName
    })));
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fatura_${activeInvoice.fileName}_categorizada.csv`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = () => {
    if (!activeInvoice) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const primaryColor = [138, 5, 190]; // Purple #8A05BE
    const darkTextColor = [31, 41, 55]; // Gray 800
    const grayText = [107, 114, 128]; // Gray 500

    // Relatório Header Custom Design
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('Relatório de Despesas', 14, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text(`Fatura: ${activeInvoice.fileName}`, 14, 27);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 32);

    // Separator
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.4);
    doc.line(14, 36, 196, 36);

    // Only compute expenses (amount > 0)
    const expenses = activeInvoice.transactions.filter(t => t.amount > 0);
    const totalExpenses = expenses.reduce((sum, t) => sum + t.amount, 0);

    // Highlight Box for Total Spendings
    doc.setFillColor(249, 250, 251); // Soft grey bg
    doc.rect(14, 40, 182, 22, 'F');
    doc.setDrawColor(229, 231, 235);
    doc.rect(14, 40, 182, 22, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text('TOTAL DE GASTOS POR CATEGORIAS', 20, 47);

    doc.setFontSize(18);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(formatCurrency(totalExpenses), 20, 56);

    doc.setFontSize(9.5);
    doc.setTextColor(grayText[0], grayText[1], grayText[2]);
    doc.text(`${expenses.length} transações analisadas`, 130, 55);

    // Compute Category Totals
    const groupedData = expenses.reduce((acc, curr) => {
      const cat = categories.find(c => c.id === curr.categoryId);
      const parentId = cat?.parentId || cat?.id || 'unknown';
      const parentCat = categories.find(c => c.id === parentId);
      const mainName = parentCat?.name || 'Outros';
      
      if (!acc[mainName]) {
        acc[mainName] = { total: 0, sub: {} };
      }
      acc[mainName].total += curr.amount;
      
      const subName = cat?.name || mainName;
      acc[mainName].sub[subName] = (acc[mainName].sub[subName] || 0) + curr.amount;
      
      return acc;
    }, {} as Record<string, { total: number, sub: Record<string, number> }>);

    const sortedCategories = (Object.entries(groupedData) as [string, { total: number, sub: Record<string, number> }][])
      .filter(([_, data]) => data.total > 0)
      .map(([name, data]) => ({
        name,
        total: data.total,
        subcategories: (Object.entries(data.sub) as [string, number][]).map(([subName, val]) => ({ name: subName, value: val })).sort((a, b) => b.value - a.value)
      }))
      .sort((a, b) => b.total - a.total);

    // Draw categories table headers
    let y = 70;
    doc.setFillColor(138, 5, 190); // primary category header style
    doc.rect(14, y, 182, 8, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text('Categoria / Subcategoria', 18, y + 5.5);
    doc.text('Total Gasto', 125, y + 5.5);
    doc.text('Participação (%)', 162, y + 5.5);

    y += 8;

    sortedCategories.forEach((catInfo) => {
      if (y > 265) {
        doc.addPage();
        y = 20;
      }

      // Group Row
      doc.setFillColor(243, 244, 246);
      doc.rect(14, y, 182, 8, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(darkTextColor[0], darkTextColor[1], darkTextColor[2]);
      doc.text(catInfo.name, 18, y + 5.5);
      
      doc.text(formatCurrency(catInfo.total), 125, y + 5.5);

      const percent = totalExpenses > 0 ? ((catInfo.total / totalExpenses) * 100).toFixed(1) : '0.0';
      doc.text(`${percent}%`, 162, y + 5.5);

      y += 8;

      // Render Subcategories if custom/multiple exists
      const hasSubs = catInfo.subcategories.length > 1 || (catInfo.subcategories.length === 1 && catInfo.subcategories[0].name !== catInfo.name);
      
      if (hasSubs) {
        catInfo.subcategories.forEach((sub) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139); // Gray
          doc.text(`└  ${sub.name}`, 22, y + 5);

          doc.text(formatCurrency(sub.value), 125, y + 5);

          const subPct = catInfo.total > 0 ? ((sub.value / catInfo.total) * 100).toFixed(1) : '0.0';
          doc.text(`${subPct}% da cat.`, 162, y + 5);

          y += 7;
        });
      }

      // Small vertical spacer
      y += 2;
    });

    // Page decoration numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(`Página ${i} de ${pageCount}`, 14, 287);
      doc.text('Nexus Faturas - Classificação Inteligente de Despesas', 120, 287);
    }

    doc.save(`relatorio_${activeInvoice.fileName.replace(/\.[^/.]+$/, "")}.pdf`);
    showToast("Relatório PDF exportado com sucesso!");
  };

  const toggleInvoiceSelection = (id: string) => {
    setSelectedInvoiceIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleOpenMergeModal = () => {
    if (selectedInvoiceIds.length < 2) {
      showToast("Selecione pelo menos duas faturas para mesclar.");
      return;
    }
    const currentSelected = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
    
    // Guess default name based on first file name or current date
    const dateStr = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    setMergeName(`Faturas Mescladas - ${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}`);
    setMergeDateOption('keep');
    setShowMergeModal(true);
  };

  const handleMergeInvoices = async () => {
    if (!mergeName.trim()) {
      alert("Por favor, digite um nome para a fatura mesclada.");
      return;
    }

    setLoading(true);
    setShowMergeModal(false);

    try {
      const selectedInvoices = invoices.filter(inv => selectedInvoiceIds.includes(inv.id));
      const mergedTransactions: Transaction[] = [];

      selectedInvoices.forEach(inv => {
        inv.transactions.forEach(t => {
          let updatedDate = t.date;
          if (mergeDateOption === 'adjust') {
            const dmRef = t.date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
            if (dmRef) {
              const day = dmRef[1].padStart(2, '0');
              const month = String(selectedMergeMonth).padStart(2, '0');
              updatedDate = `${day}/${month}/${selectedMergeYear}`;
            } else {
              const dayOnlyMatch = t.date.match(/^(\d{1,2})\b/);
              if (dayOnlyMatch) {
                const day = dayOnlyMatch[1].padStart(2, '0');
                const month = String(selectedMergeMonth).padStart(2, '0');
                updatedDate = `${day}/${month}/${selectedMergeYear}`;
              } else {
                const month = String(selectedMergeMonth).padStart(2, '0');
                updatedDate = `01/${month}/${selectedMergeYear}`;
              }
            }
          }

          mergedTransactions.push({
            ...t,
            id: `${inv.id}-${t.id}-${crypto.randomUUID().slice(0, 4)}`, // absolute uniqueness
            date: updatedDate
          });
        });
      });

      const newInvoiceData: Omit<Invoice, 'id'> = {
        fileName: mergeName.endsWith('.csv') ? mergeName : `${mergeName}.csv`,
        uploadDate: Date.now(),
        totalTransactions: mergedTransactions.length,
        transactions: mergedTransactions
      };

      const savedInvoice = await dbHelpers.saveInvoice(newInvoiceData);
      
      setInvoices([savedInvoice, ...invoices]);
      setActiveInvoice(savedInvoice);
      setIsSelectingForMerge(false);
      setSelectedInvoiceIds([]);
      setViewMode('invoice');
      showToast(`Faturas mescladas com sucesso em "${savedInvoice.fileName}"!`);
    } catch (error) {
      console.error("Erro ao mesclar faturas:", error);
      showToast("Não foi possível mesclar as faturas.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Deseja realmente apagar esta fatura do histórico?")) return;
    await dbHelpers.deleteInvoice(id);
    setInvoices(invoices.filter((inv) => inv.id !== id));
    showToast("Fatura apagada com sucesso.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-gray-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-xl bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/30 mb-6">
            <CreditCard className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2 bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">Nexus Faturas</h1>
          <p className="text-gray-400 text-center mb-8">Faça login para gerenciar e classificar suas faturas utilizando inteligência.</p>
          <form onSubmit={handleLogin} className="w-full space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Senha</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Sua senha"
                required
                className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all"
              />
            </div>
            
            <button 
              type="submit"
              disabled={isLoggingIn}
              className={`w-full py-3 mt-2 rounded-xl font-medium transition-colors cursor-pointer flex justify-center items-center ${isLoggingIn ? 'bg-purple-800 text-white/70 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
            >
              {isLoggingIn ? (
                <span className="flex items-center">
                  <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin mr-2"></span>
                  Autenticando...
                </span>
              ) : (
                isSignUp ? "Criar Conta" : "Entrar"
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors bg-transparent border-none cursor-pointer"
            >
              {isSignUp ? "Já tenho uma conta. Quero entrar." : "Ainda não tenho conta. Criar agora."}
            </button>
          </div>

          {authError && (
            <div className="mt-6 p-4 rounded-xl bg-red-950/40 border border-red-900/60 text-red-200 text-xs leading-relaxed">
              <p className="font-semibold text-red-400 mb-1">⚠️ Status da Autenticação:</p>
              <p>{authError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-100 font-sans flex overflow-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-emerald-600 text-white px-6 py-3 rounded-xl shadow-2xl z-50 animate-in slide-in-from-bottom font-medium flex items-center">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse mr-3"></div>
          {toastMessage}
        </div>
      )}

      {/* Categories Modal */}
      {showCatManager && (
        <CategoryManager 
          categories={categories}
          onAdd={handleAddCategory}
          onEdit={handleEditCategory}
          onDelete={handleDeleteCategory}
          onClose={() => setShowCatManager(false)}
        />
      )}

      {/* Merge Invoices Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-800 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-lg bg-purple-600/10 border border-purple-500/20 flex items-center justify-center">
                  <FileStack className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Mesclar Faturas</h3>
                  <p className="text-xs text-gray-400">Unir {selectedInvoiceIds.length} faturas em uma única</p>
                </div>
              </div>
              <button 
                onClick={() => setShowMergeModal(false)}
                className="text-gray-400 hover:text-white transition-colors cursor-pointer text-xl"
              >
                &times;
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 custom-scrollbar text-left text-gray-200">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Faturas Selecionadas:</label>
                <div className="p-3 rounded-lg bg-gray-950 border border-gray-850 space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                  {invoices.filter(inv => selectedInvoiceIds.includes(inv.id)).map((inv, i) => (
                    <div key={i} className="text-xs text-gray-300 flex items-center">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mr-2"></span>
                      <span className="truncate">{inv.fileName}</span>
                      <span className="text-[10px] text-gray-500 ml-auto mr-1">({inv.totalTransactions} transações)</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nome da nova fatura mesclada:</label>
                <input 
                  type="text" 
                  value={mergeName}
                  onChange={(e) => setMergeName(e.target.value)}
                  placeholder="Ex: Faturas Mescladas - Junho 2026"
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-650 focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider">Ajuste de datas das transações:</label>
                
                <label className="flex items-start p-3 rounded-xl border border-gray-850 hover:bg-gray-800/10 cursor-pointer transition-all">
                  <input 
                    type="radio" 
                    name="dateOption" 
                    checked={mergeDateOption === 'keep'}
                    onChange={() => setMergeDateOption('keep')}
                    className="mt-1 mr-3 accent-purple-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-100">Manter datas originais</p>
                    <p className="text-xs text-gray-500 mt-0.5">As transações preservarão seus dias, meses e anos originais.</p>
                  </div>
                </label>

                <label className="flex items-start p-3 rounded-xl border border-gray-850 hover:bg-gray-800/10 cursor-pointer transition-all">
                  <input 
                    type="radio" 
                    name="dateOption" 
                    checked={mergeDateOption === 'adjust'}
                    onChange={() => setMergeDateOption('adjust')}
                    className="mt-1 mr-3 accent-purple-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-100">Ajustar todas para o mesmo mês</p>
                    <p className="text-xs text-gray-500 mt-0.5">Corrige e força todas as transações para o mês e ano escolhidos abaixo, mantendo os dias originais.</p>
                  </div>
                </label>
              </div>

              {mergeDateOption === 'adjust' && (
                <div className="grid grid-cols-2 gap-4 pt-2 animate-in slide-in-from-top-4 duration-200 text-left">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Mês de Destino:</label>
                    <select
                      value={selectedMergeMonth}
                      onChange={(e) => setSelectedMergeMonth(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-gray-850 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      <option value="1">Janeiro</option>
                      <option value="2">Fevereiro</option>
                      <option value="3">Março</option>
                      <option value="4">Abril</option>
                      <option value="5">Maio</option>
                      <option value="6">Junho</option>
                      <option value="7">Julho</option>
                      <option value="8">Agosto</option>
                      <option value="9">Setembro</option>
                      <option value="10">Outubro</option>
                      <option value="11">Novembro</option>
                      <option value="12">Dezembro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Ano de Destino:</label>
                    <select
                      value={selectedMergeYear}
                      onChange={(e) => setSelectedMergeYear(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-gray-850 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      {Array.from({ length: 11 }, (_, i) => 2020 + i).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-800 bg-gray-950/40 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowMergeModal(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-350 rounded-xl font-medium transition-colors cursor-pointer text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleMergeInvoices}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors cursor-pointer text-sm flex items-center shadow-md border-none"
              >
                <FileStack className="w-4 h-4 mr-2" />
                Mesclar e Visualizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto custom-scrollbar relative">
        <header className="border-b border-gray-800 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setActiveInvoice(null); setViewMode('upload'); }}>
              <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shadow-lg shadow-purple-600/30">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-gray-100 to-gray-400 bg-clip-text text-transparent">Nexus Faturas</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={() => { setActiveInvoice(null); setViewMode('upload'); }}
                className={`flex items-center text-sm font-medium transition-colors ${viewMode === 'upload' ? 'text-purple-400' : 'text-gray-400 hover:text-purple-400'}`}
              >
                <Plus className="w-4 h-4 mr-2" />
                Nova
              </button>
              <button 
                onClick={() => setViewMode('global_dashboard')} 
                className={`flex items-center text-sm font-medium transition-colors ${viewMode === 'global_dashboard' ? 'text-purple-400' : 'text-gray-400 hover:text-purple-400'}`}
              >
                <BarChart2 className="w-4 h-4 mr-2" />
                Dashboard
              </button>
              <button 
                onClick={() => setViewMode('history')} 
                className={`flex items-center text-sm font-medium transition-colors ${viewMode === 'history' ? 'text-purple-400' : 'text-gray-400 hover:text-purple-400'}`}
              >
                <History className="w-4 h-4 mr-2" />
                Histórico
              </button>
              <div className="w-px h-6 bg-gray-800 mx-1"></div>
              <button 
                onClick={() => setShowCatManager(true)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-700 flex items-center shadow-sm"
              >
                <Tag className="w-4 h-4 mr-2 text-purple-400" />
                Categorias
              </button>
              <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400 font-medium text-sm flex items-center transition-colors ml-2"
                title="Sair da conta"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8 flex flex-col h-full">
          
          {viewMode === 'upload' && (
            <div className="max-w-2xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-8 duration-500">
               <div className="text-center mb-10">
                 <h2 className="text-3xl font-bold mb-4">Inteligência para seus Gastos</h2>
                 <p className="text-gray-400 text-lg">Faça o upload da sua fatura em CSV ou PDF. O sistema aprenderá suas categorias e classificará automaticamente as próximas.</p>
               </div>
               <FileUpload 
                 onUploadSuccess={handleUploadSuccess} 
                 categories={categories}
                 rules={rules} 
               />
               <div className="mt-8 grid grid-cols-3 gap-6 text-center text-sm text-gray-500">
                 <div><div className="w-10 h-10 mx-auto bg-gray-900 rounded-full flex items-center justify-center mb-3"><FileText className="w-5 h-5 text-purple-500" /></div>Leitura de PDFs e CSVs</div>
                 <div><div className="w-10 h-10 mx-auto bg-gray-900 rounded-full flex items-center justify-center mb-3"><LayoutDashboard className="w-5 h-5 text-emerald-500" /></div>Dashboard Automático</div>
                 <div><div className="w-10 h-10 mx-auto bg-gray-900 rounded-full flex items-center justify-center mb-3"><Tag className="w-5 h-5 text-blue-500" /></div>Categorização com Memória</div>
               </div>
            </div>
          )}
          
          {viewMode === 'invoice' && activeInvoice && (
            <div className="animate-in fade-in duration-300">
              <div className="flex justify-between items-end mb-6 flex-wrap gap-4">
                <div>
                  <button 
                    onClick={() => setViewMode('upload')} 
                    className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center mb-3 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Voltar ao Upload
                  </button>
                  <h2 className="text-2xl font-bold flex items-center">
                    <FileText className="w-6 h-6 mr-3 text-gray-500" />
                    {activeInvoice.fileName}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExportPDF}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors flex items-center shadow-md cursor-pointer text-sm"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar PDF por Categoria
                  </button>
                  <button 
                    onClick={handleExportCSV}
                    className="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center shadow-sm cursor-pointer text-sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-4">
                  <Dashboard transactions={activeInvoice.transactions} categories={categories} />
                </div>
                <div className="lg:col-span-8 min-h-[500px]">
                  <TransactionList 
                    transactions={activeInvoice.transactions} 
                    categories={categories}
                    onUpdateCategory={handleUpdateCategory}
                  />
                </div>
              </div>
            </div>
          )}
          
          {viewMode === 'global_dashboard' && (
            <GlobalDashboard invoices={invoices} categories={categories} />
          )}
          
          {viewMode === 'history' && (
             <div className="animate-in fade-in duration-300">
                <div className="flex justify-between items-center mb-8 flex-wrap gap-4 text-left">
                  <div>
                    <h2 className="text-2xl font-bold">Histórico de Faturas</h2>
                    <p className="text-gray-400 text-sm mt-1">Gerencie suas faturas importadas ou selecione-as para unir faturas do mesmo mês.</p>
                  </div>
                  {invoices.length > 1 && (
                    <div className="flex items-center gap-3">
                      {isSelectingForMerge ? (
                        <>
                          <button 
                            onClick={() => {
                              setIsSelectingForMerge(false);
                              setSelectedInvoiceIds([]);
                            }}
                            className="px-4 py-2 bg-gray-850 hover:bg-gray-800 text-gray-300 rounded-lg transition-colors text-sm cursor-pointer border border-gray-800"
                          >
                            Cancelar Seleção
                          </button>
                          <button 
                            onClick={handleOpenMergeModal}
                            disabled={selectedInvoiceIds.length < 2}
                            className={`px-4 py-2 rounded-lg font-semibold flex items-center text-sm transition-all border-none ${
                              selectedInvoiceIds.length >= 2 
                              ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer shadow-md' 
                              : 'bg-purple-900/30 text-purple-400/50 cursor-not-allowed'
                            }`}
                          >
                            <FileStack className="w-4 h-4 mr-2" />
                            Mesclar Selecionadas ({selectedInvoiceIds.length})
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => setIsSelectingForMerge(true)}
                          className="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center shadow-sm cursor-pointer text-sm"
                        >
                          <FileStack className="w-4 h-4 mr-2 text-purple-400" />
                          Unir Faturas do Mês
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {invoices.length === 0 ? (
                  <div className="text-center py-20 bg-gray-900 rounded-2xl border border-gray-800">
                    <History className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum histórico encontrado.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                    {invoices.map((inv, idx) => {
                      const isSelected = selectedInvoiceIds.includes(inv.id);
                      return (
                        <div 
                          key={`inv-${inv.id}-${idx}`} 
                          className={`relative p-6 rounded-2xl cursor-pointer hover:bg-gray-800/80 transition-all flex flex-col group border ${
                            isSelected 
                            ? 'bg-purple-950/10 border-purple-500 shadow-md shadow-purple-500/5' 
                            : 'bg-gray-900 border-gray-800 hover:border-purple-500/30'
                          }`}
                          onClick={() => {
                            if (isSelectingForMerge) {
                              toggleInvoiceSelection(inv.id);
                            } else {
                              setActiveInvoice(inv);
                              setViewMode('invoice');
                            }
                          }}
                        >
                          {isSelectingForMerge && (
                            <div className="absolute top-4 right-4 z-10 p-1 bg-gray-950 rounded-lg border border-gray-800 shadow">
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-purple-500" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-500 hover:text-purple-400 transition-colors" />
                              )}
                            </div>
                          )}
                          <div className="flex justify-between items-start mb-4">
                            <FileText className="w-8 h-8 text-gray-600 group-hover:text-purple-400 transition-colors" />
                            {!isSelectingForMerge && (
                              <button 
                                onClick={(e) => handleDeleteInvoice(inv.id, e)}
                                className="text-gray-650 hover:text-red-400 transition-colors p-1"
                                title="Apagar fatura"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                          <h3 className="font-semibold text-gray-200 mb-1 truncate pr-8">{inv.fileName}</h3>
                          <p className="text-sm text-gray-500 mb-4">{new Date(inv.uploadDate).toLocaleDateString('pt-BR')}</p>
                          <div className="mt-auto pt-4 border-t border-gray-800 flex justify-between items-center text-sm">
                             <span className="text-gray-400">{inv.totalTransactions} transações</span>
                             <span className="text-purple-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                               {isSelectingForMerge ? (isSelected ? 'Desmarcar' : 'Selecionar') : 'Acessar \u2192'}
                             </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
             </div>
          )}
        </main>
      </div>
      
      {/* Global CSS required overrides */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #374151;
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #4B5563;
        }
      `}</style>
    </div>
  );
}
