import { db, auth } from './firebase';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, 
  query, orderBy, where, writeBatch
} from 'firebase/firestore';
import { Category, Rule, Invoice } from './types';

// Fallback logic
const isConfigured = () => {
  return db.app.options.apiKey && db.app.options.apiKey !== "SUA_API_KEY";
};

// Error handling helper per skill
enum OperationType {
  CREATE = 'create', UPDATE = 'update', DELETE = 'delete', LIST = 'list', GET = 'get', WRITE = 'write',
}
interface FirestoreErrorInfo {
  error: string; operationType: OperationType; path: string | null;
  authInfo: any;
}
function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType, path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Simple Mock local storage memory
let localCategories: Category[] = [
  { id: '1', name: 'Alimentação', color: '#f59e0b', createdAt: Date.now() },
  { id: '2', name: 'Supermercado', color: '#10b981', createdAt: Date.now() },
  { id: '3', name: 'Transporte', color: '#3b82f6', createdAt: Date.now() },
  { id: '4', name: 'Outros', color: '#6b7280', createdAt: Date.now() },
  { id: '5', name: 'Pagamento', color: '#22c55e', createdAt: Date.now() },
];
let localRules: Rule[] = [];
let localInvoices: Invoice[] = [];

export const dbHelpers = {
  // CATEGORIES
  async getCategories(): Promise<Category[]> {
    if (!isConfigured() || !auth.currentUser) return localCategories;
    try {
      const q = query(
        collection(db, 'categorias'), 
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        // Seed default categories
        const batch = writeBatch(db);
        const resolvedCats = [];
        for (const cat of localCategories) {
          const docRef = doc(db, 'categorias', cat.id + auth.currentUser.uid); // unique ids per user generated
          const fullCat = { ...cat, id: docRef.id, ownerId: auth.currentUser.uid };
          batch.set(docRef, fullCat);
          resolvedCats.push(fullCat);
        }
        await batch.commit();
        return resolvedCats;
      }
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Category));
    } catch (e) {
      return handleFirestoreError(e, OperationType.LIST, 'categorias') as never;
    }
  },
  async addCategory(category: Omit<Category, 'id'>): Promise<Category> {
    if (!isConfigured() || !auth.currentUser) {
      const newCat = { ...category, id: crypto.randomUUID() };
      localCategories.push(newCat as Category);
      return newCat as Category;
    }
    const path = 'categorias';
    try {
      const docRef = await addDoc(collection(db, path), { ...category, ownerId: auth.currentUser.uid });
      return { id: docRef.id, ...category, ownerId: auth.currentUser.uid } as Category;
    } catch (e) {
      return handleFirestoreError(e, OperationType.CREATE, path) as never;
    }
  },
  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    if (!isConfigured() || !auth.currentUser) {
      localCategories = localCategories.map(c => c.id === id ? { ...c, ...category } : c);
      return;
    }
    const path = `categorias/${id}`;
    try {
      await updateDoc(doc(db, 'categorias', id), category);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },
  async deleteCategory(id: string): Promise<void> {
    if (!isConfigured() || !auth.currentUser) {
      localCategories = localCategories.filter(c => c.id !== id);
      return;
    }
    const path = `categorias/${id}`;
    try {
      await deleteDoc(doc(db, 'categorias', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  },

  // RULES
  async getRules(): Promise<Rule[]> {
    if (!isConfigured() || !auth.currentUser) return localRules;
    const path = 'regras';
    try {
      const q = query(
        collection(db, path),
        where('ownerId', '==', auth.currentUser.uid)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Rule));
    } catch (e) {
      return handleFirestoreError(e, OperationType.LIST, path) as never;
    }
  },
  async saveRule(title: string, categoryId: string, categoryName: string): Promise<void> {
    if (!isConfigured() || !auth.currentUser) {
      const rule: Rule = { id: title, title, categoryId, categoryName, updatedAt: Date.now() };
      localRules = localRules.filter(r => r.id !== title);
      localRules.push(rule);
      return;
    }
    const path = `regras`;
    const docId = btoa(encodeURIComponent(title)) + '-' + auth.currentUser.uid; // Unique consistent ID per user
    const rule: Rule = {
      id: docId,
      title,
      categoryId,
      categoryName,
      updatedAt: Date.now(),
      ownerId: auth.currentUser.uid
    };
    try {
      await setDoc(doc(db, 'regras', docId), rule);
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, path);
    }
  },

  // INVOICES
  async getInvoices(): Promise<Invoice[]> {
    if (!isConfigured() || !auth.currentUser) return localInvoices;
    const path = 'faturas';
    try {
      const q = query(
        collection(db, path), 
        where('ownerId', '==', auth.currentUser.uid),
        orderBy('uploadDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
    } catch (e) {
      return handleFirestoreError(e, OperationType.LIST, path) as never;
    }
  },
  async saveInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice> {
    if (!isConfigured() || !auth.currentUser) {
      const newInvoice = { ...invoice, id: crypto.randomUUID() };
      localInvoices.push(newInvoice as Invoice);
      return newInvoice as Invoice;
    }
    const path = 'faturas';
    const invoiceWithAuth = { ...invoice, ownerId: auth.currentUser.uid };
    try {
      const docRef = await addDoc(collection(db, path), invoiceWithAuth);
      return { id: docRef.id, ...invoiceWithAuth } as Invoice;
    } catch (e) {
      return handleFirestoreError(e, OperationType.CREATE, path) as never;
    }
  },
  async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<void> {
    if (!isConfigured() || !auth.currentUser) {
      localInvoices = localInvoices.map(i => i.id === id ? { ...i, ...invoice } : i);
      return;
    }
    const path = `faturas/${id}`;
    try {
      await updateDoc(doc(db, 'faturas', id), invoice);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, path);
    }
  },
  async deleteInvoice(id: string): Promise<void> {
    if (!isConfigured() || !auth.currentUser) {
      localInvoices = localInvoices.filter(i => i.id !== id);
      return;
    }
    const path = `faturas/${id}`;
    try {
      await deleteDoc(doc(db, 'faturas', id));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, path);
    }
  }
};
