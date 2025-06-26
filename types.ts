
export interface InventoryItem {
  id: string;
  category: string; // Key from CATEGORIES
  serialSuffix: string;
  description: string;
  location: string;
  status: string; // Value from STATUSES
  assignedTo?: string;
  createdAt: string; // ISO date string
}

export interface Category {
  name: string;
  prefix: string;
}

export enum View {
  Summary,
  Detail,
}

export type ModalType = null | 'addItem' | 'editItem' | 'report' | 'batchEdit' | 'confirmDelete' | 'confirmBatchDelete';
