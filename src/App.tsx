import React, { useState, useEffect, useRef } from 'react';
import { 
  ShoppingCart, 
  Package, 
  History, 
  FileSpreadsheet, 
  Plus, 
  Minus, 
  Check, 
  AlertCircle, 
  Send, 
  User, 
  Clock, 
  DollarSign,
  TrendingUp,
  Download,
  Trash2,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InventoryItem, SaleRecord, Order, OrderItem, AIAction } from './types';
import { processCommand } from './services/geminiService';

// Initial dummy data with images
const INITIAL_INVENTORY: InventoryItem[] = [
  { code: 'P001', name: 'Espresso', category: 'Coffee', stock: 50, reorderLevel: 10, unitCost: 2.5, lastUpdated: new Date().toISOString(), image: 'https://picsum.photos/seed/espresso/400/300' },
  { code: 'P002', name: 'Latte', category: 'Coffee', stock: 40, reorderLevel: 10, unitCost: 3.5, lastUpdated: new Date().toISOString(), image: 'https://picsum.photos/seed/latte/400/300' },
  { code: 'P003', name: 'Croissant', category: 'Pastry', stock: 20, reorderLevel: 5, unitCost: 2.0, lastUpdated: new Date().toISOString(), image: 'https://picsum.photos/seed/croissant/400/300' },
  { code: 'P004', name: 'Muffin', category: 'Pastry', stock: 15, reorderLevel: 5, unitCost: 1.8, lastUpdated: new Date().toISOString(), image: 'https://picsum.photos/seed/muffin/400/300' },
  { code: 'P005', name: 'Cappuccino', category: 'Coffee', stock: 30, reorderLevel: 10, unitCost: 3.8, lastUpdated: new Date().toISOString(), image: 'https://picsum.photos/seed/cappuccino/400/300' },
  { code: 'P006', name: 'Bagel', category: 'Pastry', stock: 25, reorderLevel: 5, unitCost: 2.2, lastUpdated: new Date().toISOString(), image: 'https://picsum.photos/seed/bagel/400/300' },
  { code: 'P007', name: 'Iced Tea', category: 'Drinks', stock: 60, reorderLevel: 15, unitCost: 2.5, lastUpdated: new Date().toISOString(), image: 'https://picsum.photos/seed/icedtea/400/300' },
  { code: 'P008', name: 'Orange Juice', category: 'Drinks', stock: 45, reorderLevel: 10, unitCost: 3.0, lastUpdated: new Date().toISOString(), image: 'https://picsum.photos/seed/orangejuice/400/300' },
];

export default function App() {
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: 'Welcome to AI Cashier. How can I help you today? (e.g., "New order", "Add item Latte qty 2")' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'cashier' | 'inventory' | 'sales'>('cashier');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAITerminal, setShowAITerminal] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState<string>('');
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const ADMIN_PASSWORD = 'admin'; // Simple hardcoded password

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setShowAuthModal(false);
      setPasswordInput('');
      setMessages(prev => [...prev, { role: 'ai', text: 'Admin access granted. You can now manage inventory and sales.' }]);
    } else {
      setMessages(prev => [...prev, { role: 'ai', text: 'Incorrect password. Access denied.' }]);
      setPasswordInput('');
    }
  };

  const handleTabChange = (tab: 'cashier' | 'inventory' | 'sales') => {
    if ((tab === 'inventory' || tab === 'sales') && !isAdmin) {
      setShowAuthModal(true);
      return;
    }
    setActiveTab(tab);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (inventory.find(i => i.code === editingItem.code && i !== editingItem)) {
      // If editing existing
      setInventory(prev => prev.map(i => i.code === editingItem.code ? editingItem : i));
    } else {
      // If adding new
      setInventory(prev => [...prev, { ...editingItem, lastUpdated: new Date().toISOString() }]);
    }
    setShowItemModal(false);
    setEditingItem(null);
  };

  const deleteItem = (code: string) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      setInventory(prev => prev.filter(i => i.code !== code));
    }
  };

  const deleteSale = (orderId: string) => {
    if (window.confirm('Delete this sale record? This will NOT restore inventory. Use Void if you want to return items to stock.')) {
      setSales(prev => prev.filter(s => s.orderId !== orderId));
    }
  };

  const voidSale = (orderId: string) => {
    const saleItems = sales.filter(s => s.orderId === orderId && s.status === 'completed');
    if (saleItems.length === 0) return;

    if (window.confirm(`Void order ${orderId}? This will restore ${saleItems.length} item(s) to inventory.`)) {
      // Restore inventory
      setInventory(prev => {
        const newInv = [...prev];
        saleItems.forEach(sale => {
          const item = newInv.find(i => i.name === sale.itemName);
          if (item) {
            item.stock += sale.quantity;
            item.lastUpdated = new Date().toISOString();
          }
        });
        return newInv;
      });

      // Update sale status
      setSales(prev => prev.map(s => s.orderId === orderId ? { ...s, status: 'voided' } : s));
      setMessages(prev => [...prev, { role: 'ai', text: `Order ${orderId} has been voided and items returned to stock.` }]);
    }
  };

  const changeToReturn = Math.max(0, (parseFloat(amountReceived) || 0) - (currentOrder?.total || 0));

  const finalizeOrderWithPayment = () => {
    if (!currentOrder) return;
    finalizeOrder();
    setShowPaymentModal(false);
    setAmountReceived('');
  };

  const categories = ['All', ...new Set(inventory.map(item => item.category))];

  const handleCommand = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const action = await processCommand(userMsg, inventory, currentOrder);
      handleAIAction(action);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'ai', text: 'Error processing command. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateOrderTotals = (items: OrderItem[], discountType: 'none' | 'senior' | 'pwd' = 'none') => {
    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    let discountAmount = 0;
    let total = subtotal;

    if (discountType !== 'none') {
      // Philippine Senior/PWD Discount:
      // 1. Remove 12% VAT: subtotal / 1.12
      // 2. Apply 20% discount on the VAT-exempt amount
      const vatExemptSales = subtotal / 1.12;
      discountAmount = vatExemptSales * 0.20;
      total = vatExemptSales - discountAmount;
    }

    return { subtotal, discountAmount, total };
  };

  const applyDiscount = (type: 'none' | 'senior' | 'pwd') => {
    setCurrentOrder(prev => {
      if (!prev) return null;
      const { subtotal, discountAmount, total } = calculateOrderTotals(prev.items, type);
      return {
        ...prev,
        discountType: type,
        discountAmount,
        subtotal,
        total
      };
    });
  };

  const handleAIAction = (action: AIAction) => {
    switch (action.type) {
      case 'ADD_ITEM': {
        const item = inventory.find(i => i.name.toLowerCase() === action.name.toLowerCase());
        if (!item) {
          setMessages(prev => [...prev, { role: 'ai', text: `Item "${action.name}" not found in inventory.` }]);
          return;
        }
        addToOrder(item, action.quantity, action.price);
        break;
      }

      case 'REMOVE_ITEM': {
        if (!currentOrder) return;
        const existingItem = currentOrder.items.find(i => i.name.toLowerCase() === action.name.toLowerCase());
        if (!existingItem) return;

        let newItems;
        if (action.quantity && existingItem.quantity > action.quantity) {
          newItems = currentOrder.items.map(i => 
            i.name.toLowerCase() === action.name.toLowerCase() 
              ? { ...i, quantity: i.quantity - action.quantity, total: (i.quantity - action.quantity) * i.unitPrice }
              : i
          );
        } else {
          newItems = currentOrder.items.filter(i => i.name.toLowerCase() !== action.name.toLowerCase());
        }

        const { subtotal, discountAmount, total } = calculateOrderTotals(newItems, currentOrder.discountType);
        setCurrentOrder({ ...currentOrder, items: newItems, subtotal, discountAmount, total });
        setMessages(prev => [...prev, { role: 'ai', text: `Updated ${action.name} in order.` }]);
        break;
      }

      case 'FINALIZE_ORDER': {
        finalizeOrder();
        break;
      }

      case 'CHECK_INVENTORY': {
        const item = inventory.find(i => i.name.toLowerCase() === action.name.toLowerCase());
        if (item) {
          setMessages(prev => [...prev, { role: 'ai', text: `${item.name}: ${item.stock} units in stock. (Reorder level: ${item.reorderLevel})` }]);
        } else {
          setMessages(prev => [...prev, { role: 'ai', text: `Item "${action.name}" not found.` }]);
        }
        break;
      }

      case 'RESTOCK': {
        const newInventory = inventory.map(item => {
          if (item.name.toLowerCase() === action.name.toLowerCase()) {
            return { ...item, stock: item.stock + action.quantity, lastUpdated: new Date().toISOString() };
          }
          return item;
        });
        setInventory(newInventory);
        setMessages(prev => [...prev, { role: 'ai', text: `Restocked ${action.quantity} units of ${action.name}.` }]);
        break;
      }

      case 'EXPORT_SALES': {
        exportToCSV(sales, 'sales_report.csv');
        setMessages(prev => [...prev, { role: 'ai', text: 'Sales report exported to Excel-ready CSV.' }]);
        break;
      }

      case 'EXPORT_INVENTORY': {
        exportToCSV(inventory, 'inventory_report.csv');
        setMessages(prev => [...prev, { role: 'ai', text: 'Inventory report exported to Excel-ready CSV.' }]);
        break;
      }

      case 'MESSAGE':
        setMessages(prev => [...prev, { role: 'ai', text: action.text }]);
        break;
    }
  };

  const addToOrder = (item: InventoryItem, quantity: number = 1, price?: number) => {
    if (item.stock < quantity) {
      setMessages(prev => [...prev, { role: 'ai', text: `Insufficient stock for ${item.name}. Only ${item.stock} left.` }]);
      return;
    }

    const unitPrice = price || item.unitCost * 1.5; // Default 50% markup
    const newItem: OrderItem = {
      name: item.name,
      quantity,
      unitPrice,
      total: quantity * unitPrice
    };

    setCurrentOrder(prev => {
      // Check if item already exists in order
      const existingItemIndex = prev?.items.findIndex(i => i.name === item.name) ?? -1;
      let items = [...(prev?.items || [])];

      if (existingItemIndex > -1) {
        const existingItem = items[existingItemIndex];
        items[existingItemIndex] = {
          ...existingItem,
          quantity: existingItem.quantity + quantity,
          total: (existingItem.quantity + quantity) * existingItem.unitPrice
        };
      } else {
        items.push(newItem);
      }

      const discountType = prev?.discountType || 'none';
      const { subtotal, discountAmount, total } = calculateOrderTotals(items, discountType);

      return {
        id: prev?.id || `ORD-${Date.now()}`,
        items,
        subtotal,
        discountAmount,
        total,
        discountType,
        status: 'pending',
        date: new Date().toISOString()
      };
    });
  };

  const finalizeOrder = () => {
    if (!currentOrder || currentOrder.items.length === 0) {
      setMessages(prev => [...prev, { role: 'ai', text: 'No active order to finalize.' }]);
      return;
    }

    // Update inventory
    const newInventory = [...inventory];
    const newSales: SaleRecord[] = [];
    currentOrder.items.forEach(orderItem => {
      const invItem = newInventory.find(i => i.name === orderItem.name);
      if (invItem) {
        invItem.stock -= orderItem.quantity;
        invItem.lastUpdated = new Date().toISOString();
      }

      // Distribute discount per item for accurate sales reporting
      let itemTotal = orderItem.total;
      let itemDiscount = 0;
      if (currentOrder.discountType && currentOrder.discountType !== 'none') {
        const vatExempt = orderItem.total / 1.12;
        itemDiscount = vatExempt * 0.20;
        itemTotal = vatExempt - itemDiscount;
      }

      newSales.push({
        date: new Date().toISOString(),
        orderId: currentOrder.id,
        itemName: orderItem.name,
        quantity: orderItem.quantity,
        unitPrice: orderItem.unitPrice,
        total: itemTotal,
        paymentMethod: 'Cash',
        cashier: 'AI System',
        status: 'completed',
        discountType: currentOrder.discountType,
        discountAmount: itemDiscount
      });
    });

    setInventory(newInventory);
    setSales(prev => [...prev, ...newSales]);
    setCurrentOrder(null);
    setMessages(prev => [...prev, { role: 'ai', text: `Order ${currentOrder.id} finalized. Total: PHP ${currentOrder.total.toFixed(2)}. Inventory updated.` }]);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalSales = sales.reduce((sum, s) => s.status === 'completed' ? sum + s.total : sum, 0);
  const lowStockItems = inventory.filter(i => i.stock <= i.reorderLevel);

  const filteredInventory = selectedCategory === 'All' 
    ? inventory 
    : inventory.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Sidebar / Navigation */}
      <div className="fixed left-0 top-0 h-full w-64 border-r border-[#141414] p-8 hidden md:flex flex-col gap-12">
        <div>
          <h1 className="font-serif italic text-2xl mb-2">AI Cashier</h1>
          <p className="text-[11px] uppercase tracking-widest opacity-50 font-mono">System v1.0.4</p>
        </div>

        <nav className="flex flex-col gap-4">
          <button 
            onClick={() => handleTabChange('cashier')}
            className={`flex items-center gap-3 text-sm uppercase tracking-wider transition-all ${activeTab === 'cashier' ? 'font-bold' : 'opacity-50 hover:opacity-100'}`}
          >
            <ShoppingCart size={18} /> Cashier
          </button>
          <button 
            onClick={() => handleTabChange('inventory')}
            className={`flex items-center gap-3 text-sm uppercase tracking-wider transition-all ${activeTab === 'inventory' ? 'font-bold' : 'opacity-50 hover:opacity-100'}`}
          >
            <Package size={18} /> Inventory
          </button>
          <button 
            onClick={() => handleTabChange('sales')}
            className={`flex items-center gap-3 text-sm uppercase tracking-wider transition-all ${activeTab === 'sales' ? 'font-bold' : 'opacity-50 hover:opacity-100'}`}
          >
            <History size={18} /> Sales Tracking
          </button>
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          {isAdmin && (
            <button 
              onClick={() => setIsAdmin(false)}
              className="text-[10px] uppercase tracking-widest font-bold text-red-600 hover:underline text-left"
            >
              Logout Admin
            </button>
          )}
          <div className="p-4 border border-[#141414] rounded-sm bg-white/50">
            <p className="text-[10px] uppercase font-mono opacity-50 mb-1">Daily Revenue</p>
            <p className="text-xl font-mono">PHP {totalSales.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="md:ml-64 p-8 min-h-screen flex flex-col">
        
        {/* Header Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-12">
          <div className="border-b border-[#141414] pb-4">
            <p className="font-serif italic text-xs opacity-50 uppercase mb-2">Total Sales</p>
            <p className="text-3xl font-mono">PHP {totalSales.toFixed(2)}</p>
          </div>
          <div className="border-b border-[#141414] pb-4">
            <p className="font-serif italic text-xs opacity-50 uppercase mb-2">Orders Today</p>
            <p className="text-3xl font-mono">{new Set(sales.map(s => s.orderId)).size}</p>
          </div>
          <div className="border-b border-[#141414] pb-4">
            <p className="font-serif italic text-xs opacity-50 uppercase mb-2">Low Stock Alerts</p>
            <p className={`text-3xl font-mono ${lowStockItems.length > 0 ? 'text-red-600' : ''}`}>
              {lowStockItems.length}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'cashier' && (
            <motion.div 
              key="cashier"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex-1 flex flex-col lg:flex-row gap-8"
            >
              {/* Product Listing (Fastfood Style) */}
              <div className="flex-1 flex flex-col gap-6">
                {/* Category Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-6 py-2 text-[10px] uppercase tracking-widest font-bold border border-[#141414] transition-all whitespace-nowrap ${selectedCategory === cat ? 'bg-[#141414] text-[#E4E3E0]' : 'bg-white hover:bg-[#F0EFEA]'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {filteredInventory.map(item => (
                    <motion.div
                      layout
                      key={item.code}
                      className="border border-[#141414] bg-white rounded-sm overflow-hidden shadow-sm hover:shadow-md transition-all group"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-gray-100 relative">
                        {item.image && (
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                        )}
                        {item.stock <= item.reorderLevel && (
                          <div className="absolute top-2 right-2 bg-red-600 text-white text-[8px] uppercase font-bold px-2 py-1 rounded-full">
                            Low Stock
                          </div>
                        )}
                      </div>
                      <div className="p-4 flex flex-col gap-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-[10px] uppercase opacity-50 font-mono">{item.category}</p>
                            <h3 className="font-serif italic text-lg">{item.name}</h3>
                          </div>
                          <p className="font-mono font-bold">PHP {(item.unitCost * 1.5).toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => addToOrder(item)}
                          disabled={item.stock <= 0}
                          className="mt-2 w-full py-2 border border-[#141414] text-[10px] uppercase tracking-widest font-bold hover:bg-[#141414] hover:text-[#E4E3E0] transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#141414]"
                        >
                          {item.stock <= 0 ? 'Out of Stock' : 'Add to Order'}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Order Summary & AI Assistant */}
              <div className="w-full lg:w-96 flex flex-col gap-6">
                {/* Visual Cart */}
                <div className="border border-[#141414] bg-white p-6 rounded-sm shadow-lg flex flex-col h-fit max-h-[500px]">
                  <div className="flex justify-between items-center mb-4 border-b border-[#141414] pb-2">
                    <h2 className="font-serif italic text-lg">Current Order</h2>
                    {currentOrder && (
                      <button 
                        onClick={() => setCurrentOrder(null)}
                        className="text-[9px] uppercase tracking-tighter opacity-50 hover:opacity-100"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                    {currentOrder && currentOrder.items.length > 0 ? (
                      currentOrder.items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-bold">{item.name}</p>
                            <p className="text-[10px] opacity-50 font-mono">PHP {item.unitPrice.toFixed(2)} each</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 border border-[#141414] rounded-full px-2 py-1">
                              <button 
                                onClick={() => handleAIAction({ type: 'REMOVE_ITEM', name: item.name, quantity: 1 })}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                              >
                                <Minus size={10} />
                              </button>
                              <span className="font-mono text-xs w-4 text-center">{item.quantity}</span>
                              <button 
                                onClick={() => {
                                  const invItem = inventory.find(inv => inv.name === item.name);
                                  if (invItem) addToOrder(invItem, 1);
                                }}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                              >
                                <Plus size={10} />
                              </button>
                            </div>
                            <button 
                              onClick={() => handleAIAction({ type: 'REMOVE_ITEM', name: item.name })}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                              title="Remove item"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <p className="font-mono text-sm w-16 text-right">PHP {item.total.toFixed(2)}</p>
                        </div>
                      ))
                    ) : (
                      <div className="py-12 text-center opacity-30">
                        <ShoppingCart size={48} className="mx-auto mb-4" />
                        <p className="text-xs uppercase tracking-widest">Your cart is empty</p>
                      </div>
                    )}
                  </div>

                  {currentOrder && (
                    <div className="mt-6 pt-4 border-t border-[#141414] space-y-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] uppercase tracking-widest opacity-50">Discount</span>
                          <div className="flex gap-1">
                            {(['none', 'senior', 'pwd'] as const).map(type => (
                              <button
                                key={type}
                                onClick={() => applyDiscount(type)}
                                className={`px-2 py-1 text-[9px] uppercase tracking-tighter border border-[#141414] rounded-sm transition-all ${
                                  currentOrder.discountType === type 
                                    ? 'bg-[#141414] text-white' 
                                    : 'hover:bg-gray-100'
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-end">
                          <span className="text-[10px] uppercase tracking-widest opacity-50">Subtotal</span>
                          <span className="font-mono text-sm opacity-70">PHP {currentOrder.subtotal?.toFixed(2) || currentOrder.total.toFixed(2)}</span>
                        </div>

                        {currentOrder.discountAmount && currentOrder.discountAmount > 0 ? (
                          <div className="flex justify-between items-end text-red-600">
                            <span className="text-[10px] uppercase tracking-widest">Discount (20%)</span>
                            <span className="font-mono text-sm">- PHP {currentOrder.discountAmount.toFixed(2)}</span>
                          </div>
                        ) : null}

                        <div className="flex justify-between items-end pt-2 border-t border-dashed border-[#141414]/20">
                          <span className="text-[10px] uppercase tracking-widest font-bold">Total Due</span>
                          <span className="font-mono text-xl font-bold">PHP {currentOrder.total.toFixed(2)}</span>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => setShowPaymentModal(true)}
                        className="w-full py-3 bg-[#141414] text-[#E4E3E0] text-xs uppercase tracking-widest font-bold hover:bg-opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        <Check size={16} /> Complete Order
                      </button>
                    </div>
                  )}
                </div>

                {/* Integrated AI Assistant */}
                <div className="border border-[#141414] bg-[#141414] text-[#E4E3E0] p-4 rounded-sm shadow-lg flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] uppercase tracking-widest font-bold">AI Assistant</span>
                    </div>
                    <button 
                      onClick={() => setShowAITerminal(!showAITerminal)}
                      className="text-[9px] uppercase tracking-tighter opacity-70 hover:opacity-100"
                    >
                      {showAITerminal ? 'Hide Log' : 'Show Log'}
                    </button>
                  </div>

                  {showAITerminal && (
                    <div className="h-32 overflow-y-auto font-mono text-[10px] space-y-2 border-y border-white/10 py-2 scrollbar-hide">
                      {messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                            <span className="opacity-40 uppercase mr-1">[{msg.role}]:</span>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                  )}

                  <form onSubmit={handleCommand} className="flex gap-2">
                    <input 
                      type="text" 
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Voice/Text command..."
                      className="flex-1 bg-white/10 border-b border-white/20 px-2 py-1 focus:outline-none font-mono text-xs text-white placeholder:text-white/30"
                    />
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="p-1.5 bg-white text-[#141414] hover:bg-opacity-80 transition-all disabled:opacity-50"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end mb-4">
                <h2 className="font-serif italic text-2xl">Inventory Management</h2>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setEditingItem({ code: `P${inventory.length + 1}`, name: '', category: 'Coffee', stock: 0, reorderLevel: 5, unitCost: 0, lastUpdated: new Date().toISOString() });
                      setShowItemModal(true);
                    }}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold border border-[#141414] px-4 py-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                  >
                    <Plus size={14} /> Add Product
                  </button>
                  <button 
                    onClick={() => handleAIAction({ type: 'EXPORT_INVENTORY' })}
                    className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold border border-[#141414] px-4 py-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                  >
                    <Download size={14} /> Export to Excel
                  </button>
                </div>
              </div>

              <div className="border border-[#141414] bg-white overflow-hidden rounded-sm shadow-xl">
                <div className="grid grid-cols-8 gap-4 p-4 bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest font-mono">
                  <div>Code</div>
                  <div className="col-span-2">Item Name</div>
                  <div>Category</div>
                  <div className="text-right">Stock</div>
                  <div className="text-right">Unit Cost</div>
                  <div className="text-right">Status</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="divide-y divide-[#141414]">
                  {inventory.map((item) => (
                    <div key={item.code} className="grid grid-cols-8 gap-4 p-4 text-sm font-mono hover:bg-[#F0EFEA] transition-colors">
                      <div className="opacity-50">{item.code}</div>
                      <div className="col-span-2 font-bold">{item.name}</div>
                      <div className="opacity-70">{item.category}</div>
                      <div className={`text-right ${item.stock <= item.reorderLevel ? 'text-red-600 font-bold' : ''}`}>
                        {item.stock}
                      </div>
                      <div className="text-right">PHP {item.unitCost.toFixed(2)}</div>
                      <div className="text-right">
                        {item.stock <= item.reorderLevel ? (
                          <span className="text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full uppercase">Low</span>
                        ) : (
                          <span className="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded-full uppercase">OK</span>
                        )}
                      </div>
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => { setEditingItem(item); setShowItemModal(true); }} 
                          className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-sm transition-all"
                          title="Edit Product"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button 
                          onClick={() => deleteItem(item.code)} 
                          className="p-1.5 hover:bg-red-50 text-red-600 rounded-sm transition-all"
                          title="Delete Product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'sales' && (
            <motion.div 
              key="sales"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-end mb-4">
                <h2 className="font-serif italic text-2xl">Sales History</h2>
                <button 
                  onClick={() => handleAIAction({ type: 'EXPORT_SALES' })}
                  className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold border border-[#141414] px-4 py-2 hover:bg-[#141414] hover:text-[#E4E3E0] transition-all"
                >
                  <Download size={14} /> Export to Excel
                </button>
              </div>

              <div className="border border-[#141414] bg-white overflow-hidden rounded-sm shadow-xl">
                <div className="grid grid-cols-8 gap-4 p-4 bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest font-mono">
                  <div>Date</div>
                  <div>Order ID</div>
                  <div className="col-span-2">Item</div>
                  <div className="text-right">Qty</div>
                  <div className="text-right">Total</div>
                  <div className="text-right">Status</div>
                  <div className="text-right">Actions</div>
                </div>
                <div className="divide-y divide-[#141414] max-h-[600px] overflow-y-auto">
                  {sales.length > 0 ? (
                    sales.map((sale, i) => (
                      <div key={i} className={`grid grid-cols-8 gap-4 p-4 text-sm font-mono hover:bg-[#F0EFEA] transition-colors ${sale.status === 'voided' ? 'opacity-40 grayscale' : ''}`}>
                        <div className="opacity-50 text-[10px]">{new Date(sale.date).toLocaleDateString()}</div>
                        <div className="opacity-70">{sale.orderId}</div>
                        <div className="col-span-2 font-bold">{sale.itemName}</div>
                        <div className="text-right">{sale.quantity}</div>
                        <div className="text-right font-bold">PHP {sale.total.toFixed(2)}</div>
                        <div className="text-right">
                          <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase ${sale.status === 'voided' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                            {sale.status}
                          </span>
                        </div>
                        <div className="flex justify-end gap-2">
                          {sale.status === 'completed' && (
                            <button 
                              onClick={() => voidSale(sale.orderId)} 
                              className="p-1 hover:text-orange-600"
                              title="Void Sale"
                            >
                              <AlertCircle size={14} />
                            </button>
                          )}
                          <button 
                            onClick={() => deleteSale(sale.orderId)} 
                            className="p-1 hover:text-red-600"
                            title="Delete Record"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center opacity-30 font-mono text-xs uppercase tracking-widest">
                      No sales recorded yet
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {/* Auth Modal */}
        {showAuthModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white border border-[#141414] p-8 rounded-sm shadow-2xl w-full max-w-md"
            >
              <h2 className="font-serif italic text-2xl mb-6">Admin Access Required</h2>
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Password</label>
                  <input 
                    type="password" 
                    autoFocus
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    className="w-full border-b border-[#141414] py-2 focus:outline-none font-mono"
                    placeholder="Enter admin password"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAuthModal(false)}
                    className="flex-1 py-2 border border-[#141414] text-[10px] uppercase tracking-widest font-bold hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest font-bold"
                  >
                    Unlock
                  </button>
                </div>
                <p className="text-[9px] text-center opacity-30 mt-4">Hint: default password is "admin"</p>
              </form>
            </motion.div>
          </motion.div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white border border-[#141414] p-8 rounded-sm shadow-2xl w-full max-w-md"
            >
              <h2 className="font-serif italic text-2xl mb-6">Payment Confirmation</h2>
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-end opacity-50">
                    <span className="text-[10px] uppercase tracking-widest">Subtotal</span>
                    <span className="text-sm font-mono">PHP {currentOrder?.subtotal?.toFixed(2) || currentOrder?.total.toFixed(2)}</span>
                  </div>
                  {currentOrder?.discountAmount && currentOrder.discountAmount > 0 ? (
                    <div className="flex justify-between items-end text-red-600">
                      <span className="text-[10px] uppercase tracking-widest">Discount ({currentOrder.discountType?.toUpperCase()})</span>
                      <span className="text-sm font-mono">- PHP {currentOrder.discountAmount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between items-end border-b border-[#141414] pb-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold">Total Due</span>
                    <span className="text-2xl font-mono font-bold">PHP {currentOrder?.total.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold opacity-50">Amount Received</label>
                  <div className="relative">
                    <span className="absolute left-0 bottom-2 text-xl font-mono">PHP</span>
                    <input 
                      type="number" 
                      autoFocus
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      className="w-full border-b border-[#141414] pl-12 py-2 focus:outline-none font-mono text-xl"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="bg-[#F0EFEA] p-4 flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest font-bold opacity-50">Change to Return</span>
                  <span className={`text-xl font-mono font-bold ${changeToReturn > 0 ? 'text-green-600' : ''}`}>
                    PHP {changeToReturn.toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 py-3 border border-[#141414] text-[10px] uppercase tracking-widest font-bold hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={!amountReceived || parseFloat(amountReceived) < (currentOrder?.total || 0)}
                    onClick={finalizeOrderWithPayment}
                    className="flex-1 py-3 bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest font-bold disabled:opacity-30"
                  >
                    Confirm & Print
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Item Edit Modal */}
        {showItemModal && editingItem && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-white border border-[#141414] p-8 rounded-sm shadow-2xl w-full max-w-lg"
            >
              <h2 className="font-serif italic text-2xl mb-6">{inventory.find(i => i.code === editingItem.code) ? 'Edit Product' : 'Add New Product'}</h2>
              <form onSubmit={handleSaveItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest font-bold opacity-50">Code</label>
                    <input value={editingItem.code} onChange={e => setEditingItem({...editingItem, code: e.target.value})} className="w-full border-b border-[#141414] py-1 font-mono text-sm focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest font-bold opacity-50">Category</label>
                    <select value={editingItem.category} onChange={e => setEditingItem({...editingItem, category: e.target.value})} className="w-full border-b border-[#141414] py-1 font-mono text-sm focus:outline-none bg-transparent">
                      <option value="Coffee">Coffee</option>
                      <option value="Pastry">Pastry</option>
                      <option value="Drinks">Drinks</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest font-bold opacity-50">Product Name</label>
                  <input value={editingItem.name} onChange={e => setEditingItem({...editingItem, name: e.target.value})} className="w-full border-b border-[#141414] py-1 font-mono text-sm focus:outline-none" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest font-bold opacity-50">Stock</label>
                    <input type="number" value={editingItem.stock} onChange={e => setEditingItem({...editingItem, stock: parseInt(e.target.value) || 0})} className="w-full border-b border-[#141414] py-1 font-mono text-sm focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest font-bold opacity-50">Reorder Level</label>
                    <input type="number" value={editingItem.reorderLevel} onChange={e => setEditingItem({...editingItem, reorderLevel: parseInt(e.target.value) || 0})} className="w-full border-b border-[#141414] py-1 font-mono text-sm focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest font-bold opacity-50">Unit Cost</label>
                    <input type="number" step="0.01" value={editingItem.unitCost} onChange={e => setEditingItem({...editingItem, unitCost: parseFloat(e.target.value) || 0})} className="w-full border-b border-[#141414] py-1 font-mono text-sm focus:outline-none" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest font-bold opacity-50">Image URL</label>
                  <input value={editingItem.image || ''} onChange={e => setEditingItem({...editingItem, image: e.target.value})} className="w-full border-b border-[#141414] py-1 font-mono text-sm focus:outline-none" placeholder="https://..." />
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setShowItemModal(false)} className="flex-1 py-2 border border-[#141414] text-[10px] uppercase tracking-widest font-bold hover:bg-gray-100">Cancel</button>
                  <button type="submit" className="flex-1 py-2 bg-[#141414] text-[#E4E3E0] text-[10px] uppercase tracking-widest font-bold">Save Product</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
