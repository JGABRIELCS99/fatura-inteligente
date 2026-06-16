import { db } from './firebase';
import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc,
  query, orderBy, where, writeBatch
} from 'firebase/firestore';
import { Category, Rule, Invoice } from './types';

let currentUserCache: { uid: string, email: string } | null = null;

export const customAuth = {
  get currentUser() {
    if (currentUserCache) return currentUserCache;
    const stored = localStorage.getItem('NEXUS_SAVED_USER');
    if (stored) {
      currentUserCache = JSON.parse(stored);
      return currentUserCache;
    }
    return null;
  },
  
  setUser(user: { uid: string, email: string } | null) {
    currentUserCache = user;
    if (user) {
      localStorage.setItem('NEXUS_SAVED_USER', JSON.stringify(user));
    } else {
      localStorage.removeItem('NEXUS_SAVED_USER');
    }
  },

  async signUp(email: string, pass: string) {
    const emailLower = email.toLowerCase();
    const userRef = doc(db, 'usuarios', emailLower);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      throw new Error("Este email já está cadastrado.");
    }
    // Very basic pass storage for prototype bypass
    await setDoc(userRef, { email: emailLower, pass });
    this.setUser({ uid: emailLower, email: emailLower });
  },

  async signIn(email: string, pass: string) {
    const emailLower = email.toLowerCase();
    const userRef = doc(db, 'usuarios', emailLower);
    const snap = await getDoc(userRef);
    if (!snap.exists() || snap.data().pass !== pass) {
      throw new Error("Email ou senha incorretos.");
    }
    this.setUser({ uid: emailLower, email: emailLower });
  },

  signOut() {
    this.setUser(null);
  }
};

export const dbHelpers = {
  // CATEGORIES
  async getCategories(): Promise<Category[]> {
    if (!customAuth.currentUser) return [];
    try {
      const q = query(
        collection(db, 'categorias'), 
        where('ownerId', '==', customAuth.currentUser.uid),
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
            ownerId: customAuth.currentUser.uid 
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
    if (!customAuth.currentUser) throw new Error("Não autenticado");
    const docRef = await addDoc(collection(db, 'categorias'), { ...category, ownerId: customAuth.currentUser.uid });
    return { id: docRef.id, ...category, ownerId: customAuth.currentUser.uid } as Category;
  },
  async updateCategory(id: string, category: Partial<Category>): Promise<void> {
    if (!customAuth.currentUser) throw new Error("Não autenticado");
    await updateDoc(doc(db, 'categorias', id), category);
  },
  async deleteCategory(id: string): Promise<void> {
    if (!customAuth.currentUser) throw new Error("Não autenticado");
    await deleteDoc(doc(db, 'categorias', id));
  },

  // RULES
  async getRules(): Promise<Rule[]> {
    if (!customAuth.currentUser) return [];
    const q = query(collection(db, 'regras'), where('ownerId', '==', customAuth.currentUser.uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Rule));
  },
  async saveRule(title: string, categoryId: string, categoryName: string): Promise<void> {
    if (!customAuth.currentUser) throw new Error("Não autenticado");
    const docId = btoa(encodeURIComponent(title)) + '-' + customAuth.currentUser.uid;
    const rule = {
      title,
      categoryId,
      categoryName,
      updatedAt: Date.now(),
      ownerId: customAuth.currentUser.uid
    };
    await setDoc(doc(db, 'regras', docId), rule);
  },

  // INVOICES
  async getInvoices(): Promise<Invoice[]> {
    if (!customAuth.currentUser) return [];
    const q = query(collection(db, 'faturas'), where('ownerId', '==', customAuth.currentUser.uid), orderBy('uploadDate', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Invoice));
  },
  async saveInvoice(invoice: Omit<Invoice, 'id'>): Promise<Invoice> {
    if (!customAuth.currentUser) throw new Error("Não autenticado");
    const docRef = await addDoc(collection(db, 'faturas'), { ...invoice, ownerId: customAuth.currentUser.uid });
    return { id: docRef.id, ...invoice, ownerId: customAuth.currentUser.uid } as Invoice;
  },
  async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<void> {
    if (!customAuth.currentUser) throw new Error("Não autenticado");
    await updateDoc(doc(db, 'faturas', id), invoice);
  },
  async deleteInvoice(id: string): Promise<void> {
    if (!customAuth.currentUser) throw new Error("Não autenticado");
    await deleteDoc(doc(db, 'faturas', id));
  }
};

