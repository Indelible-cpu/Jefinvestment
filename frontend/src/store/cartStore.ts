import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Shared Product Store ─────────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  isService: boolean;
  unit: string;
}

interface ProductState {
  products: Product[];
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  decrementStock: (id: string, qty: number) => void;
}

const DEFAULT_PRODUCTS: Product[] = [
  { id: '1', name: 'Samsung Galaxy S23', sku: 'PH-S23', category: 'Smartphones', costPrice: 700000, sellingPrice: 850000, stock: 5, reorderLevel: 2, isService: false, unit: 'pcs' },
  { id: '2', name: 'iPhone 14 Case', sku: 'ACC-IP14C', category: 'Accessories', costPrice: 3500, sellingPrice: 5000, stock: 30, reorderLevel: 10, isService: false, unit: 'pcs' },
  { id: '3', name: 'Exercise Book 2 Quire', sku: 'ST-EB2', category: 'Stationery', costPrice: 900, sellingPrice: 1500, stock: 200, reorderLevel: 50, isService: false, unit: 'pcs' },
  { id: '4', name: 'A4 Paper Ream', sku: 'ST-A4R', category: 'Stationery', costPrice: 6000, sellingPrice: 8500, stock: 25, reorderLevel: 10, isService: false, unit: 'ream' },
  { id: '5', name: 'Photocopy (B&W)', sku: 'SV-CPY', category: 'Services', costPrice: 0, sellingPrice: 100, stock: 0, reorderLevel: 0, isService: true, unit: 'pcs' },
  { id: '6', name: 'Phone Software Install', sku: 'SV-SW', category: 'Services', costPrice: 0, sellingPrice: 5000, stock: 0, reorderLevel: 0, isService: true, unit: 'pcs' },
  { id: '7', name: 'Charging Cable USB-C', sku: 'ACC-UC', category: 'Accessories', costPrice: 1500, sellingPrice: 3000, stock: 3, reorderLevel: 5, isService: false, unit: 'pcs' },
];

export const useProductStore = create<ProductState>()(
  persist(
    (set) => ({
      products: DEFAULT_PRODUCTS,
      setProducts: (products) => set({ products }),
      addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
      updateProduct: (product) => set((state) => ({ products: state.products.map(p => p.id === product.id ? product : p) })),
      deleteProduct: (id) => set((state) => ({ products: state.products.filter(p => p.id !== id) })),
      decrementStock: (id, qty) => set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock - qty) } : p)
      })),
    }),
    { name: 'jef-product-storage' }
  )
);

// ─── Cart Store ───────────────────────────────────────────────────────────────
export interface CartItem {
  id: string; // product id
  name: string;
  sku: string;
  unitPrice: number;
  quantity: number;
  discount: number;
  isService: boolean;
}

export interface HeldCart {
  id: string;
  name: string;
  items: CartItem[];
  globalDiscount: number;
  timestamp: number;
}

interface CartState {
  items: CartItem[];
  globalDiscount: number;
  heldCarts: HeldCart[];
  addItem: (item: CartItem) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateItemDiscount: (id: string, discount: number) => void;
  removeItem: (id: string) => void;
  setGlobalDiscount: (discount: number) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
  holdCart: (name: string) => void;
  restoreCart: (id: string) => void;
  removeHeldCart: (id: string) => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      globalDiscount: 0,
      heldCarts: [],

      addItem: (newItem: CartItem) => set((state: CartState) => {
        const existing = state.items.find((i: CartItem) => i.id === newItem.id);
        if (existing) {
          return {
            items: state.items.map((i: CartItem) =>
              i.id === newItem.id ? { ...i, quantity: i.quantity + 1 } : i
            )
          };
        }
        return { items: [...state.items, { ...newItem, quantity: 1, discount: 0 }] };
      }),

      updateQuantity: (id: string, quantity: number) => set((state: CartState) => ({
        items: state.items.map((i: CartItem) => i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i)
      })),

      updateItemDiscount: (id: string, discount: number) => set((state: CartState) => ({
        items: state.items.map((i: CartItem) => i.id === id ? { ...i, discount: Math.max(0, discount) } : i)
      })),

      removeItem: (id: string) => set((state: CartState) => ({
        items: state.items.filter((i: CartItem) => i.id !== id)
      })),

      setGlobalDiscount: (discount: number) => set({ globalDiscount: Math.max(0, discount) }),

      clearCart: () => set({ items: [], globalDiscount: 0 }),

      getSubtotal: () => {
        return get().items.reduce((sum: number, item: CartItem) => sum + (item.unitPrice * item.quantity) - item.discount, 0);
      },

      getTotal: () => {
        const subtotal = get().getSubtotal();
        return Math.max(0, subtotal - get().globalDiscount);
      },

      holdCart: (name: string) => {
        const { items, globalDiscount, clearCart } = get();
        if (items.length === 0) return;
        set((state: CartState) => ({
          heldCarts: [
            ...state.heldCarts,
            {
              id: Date.now().toString(),
              name: name || `Cart ${state.heldCarts.length + 1}`,
              items: [...items],
              globalDiscount,
              timestamp: Date.now()
            }
          ]
        }));
        clearCart();
      },

      restoreCart: (id: string) => {
        const { heldCarts } = get();
        const cartToRestore = heldCarts.find(c => c.id === id);
        if (!cartToRestore) return;
        set((state: CartState) => ({
          items: cartToRestore.items,
          globalDiscount: cartToRestore.globalDiscount,
          heldCarts: state.heldCarts.filter(c => c.id !== id)
        }));
      },

      removeHeldCart: (id: string) => set((state: CartState) => ({
        heldCarts: state.heldCarts.filter(c => c.id !== id)
      }))
    }),
    { name: 'jef-cart-storage' }
  )
);
