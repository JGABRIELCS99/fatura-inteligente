export interface Transaction {
  id: string;
  date: string;
  title: string;
  amount: number;
  categoryId: string;
  categoryName: string;
  isAiCategorized?: boolean;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  createdAt: number;
  ownerId?: string;
  parentId?: string;
}

export interface Rule {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  updatedAt: number;
  ownerId?: string;
}

export interface Invoice {
  id: string;
  fileName: string;
  uploadDate: number;
  totalTransactions: number;
  transactions: Transaction[];
  ownerId?: string;
}
