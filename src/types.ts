export interface InventoryItem {
  code: string;
  name: string;
  category: string;
  stock: number;
  reorderLevel: number;
  unitCost: number;
  lastUpdated: string;
  image?: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SaleRecord {
  date: string;
  orderId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  total: number;
  paymentMethod: string;
  cashier: string;
  status: 'completed' | 'voided';
  discountType?: 'none' | 'senior' | 'pwd';
  discountAmount?: number;
}

export interface Order {
  id: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'finalized';
  date: string;
  discountType?: 'none' | 'senior' | 'pwd';
  discountAmount?: number;
  subtotal: number;
}

export type AIAction = 
  | { type: 'ADD_ITEM'; name: string; quantity: number; price?: number }
  | { type: 'REMOVE_ITEM'; name: string; quantity?: number }
  | { type: 'FINALIZE_ORDER' }
  | { type: 'CHECK_INVENTORY'; name: string }
  | { type: 'RESTOCK'; name: string; quantity: number }
  | { type: 'SHOW_SALES'; range?: string }
  | { type: 'EXPORT_SALES' }
  | { type: 'EXPORT_INVENTORY' }
  | { type: 'MESSAGE'; text: string };
