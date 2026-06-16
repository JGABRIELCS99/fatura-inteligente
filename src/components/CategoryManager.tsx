import React, { useState } from 'react';
import { Category } from '../lib/types';
import { Plus, X, Edit2, Trash2 } from 'lucide-react';

interface CategoryManagerProps {
  categories: Category[];
  onAdd: (name: string, color: string, parentId?: string) => void;
  onEdit: (id: string, name: string, color: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function CategoryManager({ categories, onAdd, onEdit, onDelete, onClose }: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#8B5CF6'); // Default purple
  
  const [newCatParentId, setNewCatParentId] = useState<string>(''); // empty means no parent
  const [addingSubcategoryTo, setAddingSubcategoryTo] = useState<string | null>(null);
  
  const handleAddNew = () => {
    if (editName.trim() !== '') {
      onAdd(editName.trim(), editColor, newCatParentId || undefined);
      setEditName('');
      setNewCatParentId('');
      setAddingSubcategoryTo(null);
    }
  };

  const handleSaveEdit = () => {
    if (editingId && editName.trim() !== '') {
      onEdit(editingId, editName.trim(), editColor);
      setEditingId(null);
      setEditName('');
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  const startSubcategory = (parentId: string) => {
    setNewCatParentId(parentId);
    setAddingSubcategoryTo(parentId);
    setEditName('');
    setEditColor('#8B5CF6');
  };

  const topLevelCategories = categories.filter(c => !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="px-6 py-4 border-b border-gray-800 flex justify-between items-center bg-gray-900/80">
          <h2 className="text-xl font-semibold text-gray-100">Gerenciar Categorias</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <div className="space-y-3 mb-8">
            {topLevelCategories.map((c, idx) => (
              <div key={`${c.id}-${idx}`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-800 bg-gray-800/20 hover:bg-gray-800/50 transition-colors">
                  {editingId === c.id ? (
                    <div className="flex-1 flex gap-2 items-center">
                      <input 
                        type="color" 
                        value={editColor} 
                        onChange={e => setEditColor(e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer shrink-0 p-0 border-0 bg-transparent"
                      />
                      <input 
                        type="text" 
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 bg-gray-950 border border-gray-700 rounded-md px-3 py-1.5 text-sm text-gray-100 focus:outline-none focus:border-purple-500"
                      />
                      <button onClick={handleSaveEdit} className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-md font-medium transition-colors">Salvar</button>
                      <button onClick={() => setEditingId(null)} className="text-xs bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded-md font-medium transition-colors">Cancelar</button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center">
                        <div className="w-4 h-4 rounded-full mr-3 border border-gray-700 shadow-sm" style={{ backgroundColor: c.color }} />
                        <span className="text-gray-200 font-medium">{c.name}</span>
                      </div>
                      {/* Cannot delete native default categories if we want to enforce it, but let's allow anything except Outros */}
                      {c.name !== 'Outros' && c.name !== 'Pagamento' && (
                        <div className="flex gap-2">
                          <button onClick={() => startSubcategory(c.id)} className="text-gray-500 hover:text-emerald-400 transition-colors p-1" title="Adicionar Subcategoria"><Plus className="w-4 h-4" /></button>
                          <button onClick={() => startEdit(c)} className="text-gray-500 hover:text-purple-400 transition-colors p-1" title="Editar"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => onDelete(c.id)} className="text-gray-500 hover:text-red-400 transition-colors p-1" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                {/* Subcategories */}
                <div className="pl-6 space-y-2">
                  {getSubcategories(c.id).map(sub => (
                    <div key={sub.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-800 bg-gray-800/10 hover:bg-gray-800/30 transition-colors">
                      {editingId === sub.id ? (
                        <div className="flex-1 flex gap-2 items-center">
                          <input 
                            type="color" 
                            value={editColor} 
                            onChange={e => setEditColor(e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer shrink-0 p-0 border-0 bg-transparent"
                          />
                          <input 
                            type="text" 
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            className="flex-1 bg-gray-950 border border-gray-700 rounded-md px-2 py-1 text-sm text-gray-100 focus:outline-none focus:border-purple-500"
                          />
                          <button onClick={handleSaveEdit} className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded-md font-medium transition-colors">Salvar</button>
                          <button onClick={() => setEditingId(null)} className="text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-md font-medium transition-colors">Cancelar</button>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center">
                            <div className="w-3 h-3 rounded-full mr-2 border border-gray-700 shadow-sm" style={{ backgroundColor: sub.color }} />
                            <span className="text-gray-300 text-sm">{sub.name}</span>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(sub)} className="text-gray-500 hover:text-purple-400 transition-colors p-1"><Edit2 className="w-3 h-3" /></button>
                            <button onClick={() => onDelete(sub.id)} className="text-gray-500 hover:text-red-400 transition-colors p-1"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  
                  {/* Inline Add subcategory */}
                  {addingSubcategoryTo === c.id && (
                     <div className="flex items-center gap-2 p-2 rounded-lg border border-purple-500/30 bg-purple-500/5 mt-1">
                        <input 
                          type="color" 
                          value={editColor} 
                          onChange={e => setEditColor(e.target.value)}
                          className="w-6 h-6 rounded cursor-pointer shrink-0 p-0 border-0 bg-transparent"
                        />
                        <input 
                          type="text" 
                          placeholder="Subcategoria"
                          value={editName}
                          onChange={e => setEditName(e.target.value)}
                          autoFocus
                          className="flex-1 bg-gray-950 border border-gray-700 rounded-md px-2 py-1 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        />
                        <button onClick={handleAddNew} className="text-[10px] bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded-md font-medium">Add</button>
                        <button onClick={() => { setAddingSubcategoryTo(null); setNewCatParentId(''); }} className="text-[10px] bg-gray-700 hover:bg-gray-600 text-white px-2 py-1 rounded-md font-medium">Cancel</button>
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Criar Nova Categoria</h3>
            <div className="flex gap-2 items-center">
              <input 
                type="color" 
                value={editingId === null && addingSubcategoryTo === null ? editColor : '#8B5CF6'} 
                onChange={e => {
                  if (editingId === null && addingSubcategoryTo === null) setEditColor(e.target.value);
                }}
                className="w-10 h-10 rounded cursor-pointer shrink-0 p-0 border-0 bg-transparent"
                disabled={editingId !== null || addingSubcategoryTo !== null}
              />
              <input 
                type="text" 
                placeholder="Nome da categoria princial"
                value={editingId === null && addingSubcategoryTo === null ? editName : ''}
                onChange={e => {
                  if (editingId === null && addingSubcategoryTo === null) setEditName(e.target.value);
                }}
                disabled={editingId !== null || addingSubcategoryTo !== null}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
              <button 
                onClick={() => {
                  setNewCatParentId('');
                  handleAddNew();
                }}
                disabled={editingId !== null || addingSubcategoryTo !== null || !editName.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
                title="Adicionar"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
