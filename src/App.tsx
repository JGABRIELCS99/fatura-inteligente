import React, { useState, useEffect } from 'react';
import { dbHelpers } from './lib/db';
import { auth } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { Category, Rule, Transaction, Invoice } from './lib/types';
import { FileUpload } from './components/FileUpload';
import { Dashboard } from './components/Dashboard';
import { GlobalDashboard } from './components/GlobalDashboard';
import { TransactionList } from './components/TransactionList';
import { CategoryManager } from './components/CategoryManager';
import { Download, History, Tag, FileText, ChevronLeft, LayoutDashboard, CreditCard, Trash2, LogOut, BarChart2, Plus } from 'lucide-react';
import Papa from 'papaparse';

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser || !dbHelpers) {
        await loadData();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
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

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login erro:", error);
      showToast("Erro ao fazer login.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
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
          <button 
            onClick={handleLogin}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors"
          >
            Entrar com Google
          </button>
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
                <button 
                  onClick={handleExportCSV}
                  className="px-4 py-2 bg-gray-800 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center shadow-sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Exportar CSV
                </button>
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
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-2xl font-bold">Histórico de Faturas</h2>
                </div>
                {invoices.length === 0 ? (
                  <div className="text-center py-20 bg-gray-900 rounded-2xl border border-gray-800">
                    <History className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum histórico encontrado.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {invoices.map((inv, idx) => (
                      <div 
                        key={`inv-${inv.id}-${idx}`} 
                        className="bg-gray-900 border border-gray-800 hover:border-purple-500/50 p-6 rounded-2xl cursor-pointer hover:bg-gray-800/80 transition-all flex flex-col group"
                        onClick={() => {
                          setActiveInvoice(inv);
                          setViewMode('invoice');
                        }}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <FileText className="w-8 h-8 text-gray-600 group-hover:text-purple-400 transition-colors" />
                          <button 
                            onClick={(e) => handleDeleteInvoice(inv.id, e)}
                            className="text-gray-600 hover:text-red-400 transition-colors p-1"
                            title="Apagar fatura"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <h3 className="font-semibold text-gray-200 mb-1 truncate">{inv.fileName}</h3>
                        <p className="text-sm text-gray-500 mb-4">{new Date(inv.uploadDate).toLocaleDateString('pt-BR')}</p>
                        <div className="mt-auto pt-4 border-t border-gray-800 flex justify-between items-center text-sm">
                           <span className="text-gray-400">{inv.totalTransactions} linhas</span>
                           <span className="text-purple-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">Acessar &rarr;</span>
                        </div>
                      </div>
                    ))}
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
