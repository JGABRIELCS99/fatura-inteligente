import { db, auth } from './firebase';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, 
  query, orderBy, where, writeBatch
} from 'firebase/firestore';
import { Category, Rule, Invoice } from './types';

export const dbHelpers = {
  // CATEGORIES
  async getCategories(): Promise<Category[]> {
    if (!auth.currentUser) return [];
    try {
      const q = query(
        collection(db, 'categorias'), 
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        // Seed default categories
        const defaults = [
          { name: 'Alimentação', color: '#f59e0b' },
          { name: 'Supermercado', color: '#10b981' },
          { name: 'Transporte', color: '#3b82f6' },
          { name: 'Outros', color: '#6b7280' },
          { name: 'Pagamento', color: '#22c55e' }
        ];
        
        const batch = writeBatch(db);
        const resolvedCats: Category[] = [];
        
        for (const cat of defaults) {
          const docRef = doc(collection(db, 'categorias'));
          const fullCat = { 
            name: cat.name, 
            color: cat.color, 
            createdAt: Date.now(), 
            ownerId: auth.currentUser.uid 
          };
          batch.set(docRef, fullCat);
          resolvedCats.push({ id: docRef.id, ...fullCat } as Category);
        }
        await batch.commit();
        return resolvedCats;
      }
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    } catch (e) {
      console.error(e);
      throw e;
    }
  },
  async addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    if (!auth.currentUser) throw new Error("Não autenticado");
    const docRef = await addDoc(collection(db, 'categorias'), { ...category, ownerId: auth.currentUser.uid });
    return { id: docRef.id, ...category, ownerId: auth.currentUser.uid } as Category;
  },
  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    if (!auth.currentUser) throw new Error("Não autenticado");
    await updateDoc(doc(db, 'categorias', id), category);
  },
  async deleteCategory(id: string): Promise<void> {
    if (!auth.currentUser) throw new Error("Não autenticado");
    await deleteDoc(doc(db, 'categorias', id));
  },

  // RULES
  async getRules(): Promise<Rule[]> {
    if (!auth.currentUser) return [];
    const q = query(collection(db, 'regras'), where('ownerId', '==', auth.currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Rule));
  },
  async saveRule(title: string, categoryId: string, categoryName: string): Promise<void> {
    if (!auth.currentUser) throw new Error("Não autenticado");
    const docId = btoa(encodeURIComponent(title)) + '-' + auth.currentUser.uid;
    const rule = {
      title,
      categoryId,
      categoryName,
      updatedAt: Date.now(),
      ownerId: auth.currentUser.uid
    };
    await setDoc(doc(db, 'regras', docId), rule);
  },

  // INVOICES
  async getInvoices(): Promise<Invoice[]> {
    if (!auth.currentUser) return [];
    const q = query(collection(db, 'faturas'), where('ownerId', '==', auth.currentUser.uid), orderBy('uploadDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
  },
  async saveInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice> {
    if (!auth.currentUser) throw new Error("Não autenticado");
    const docRef = await addDoc(collection(db, 'faturas'), { ...invoice, ownerId: auth.currentUser.uid });
    return { id: docRef.id, ...invoice, ownerId: auth.currentUser.uid } as Invoice;
  },
  async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<void> {
    if (!auth.currentUser) throw new Error("Não autenticado");
    await updateDoc(doc(db, 'faturas', id), invoice);
  },
  async deleteInvoice(id: string): Promise<void> {
    if (!auth.currentUser) throw new Error("Não autenticado");
    await deleteDoc(doc(db, 'faturas', id));
  }
};
