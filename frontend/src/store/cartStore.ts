import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  increment
} from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  isLoading: boolean;
  loadProducts: () => Promise<void>;
  setProducts: (products: Product[]) => void;
  addProduct: (product: Product) => Promise<void>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  decrementStock: (id: string, qty: number) => Promise<void>;
}

export const useProductStore = create<ProductState>()(
  (set) => ({
    products: [],
    isLoading: false,

    loadProducts: async () => {
      set({ isLoading: true });
      onSnapshot(collection(db, 'products'), (snapshot) => {
        const mapped = snapshot.docs.map(doc => {
          const p = doc.data();
          return {
            id: doc.id,
            name: p.name,
            sku: p.sku,
            category: p.category || p.categoryId || 'General',
            costPrice: Number(p.costPrice) || 0,
            sellingPrice: Number(p.sellingPrice) || 0,
            stock: p.stock ?? 0,
            reorderLevel: p.reorderLevel || 0,
            isService: !!p.isService,
            unit: p.unit || 'pcs',
          };
        });
        set({ products: mapped, isLoading: false });
      }, (err) => {
        console.warn('Failed to load products from Firestore', err);
        set({ isLoading: false });
      });
    },

    setProducts: (products) => set({ products }),

    addProduct: async (product) => {
      const payload = {
        name: product.name,
        sku: product.sku,
        category: product.category,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
        isService: product.isService,
        unit: product.unit,
        stock: product.stock,
        createdAt: Date.now(),
      };

      try {
        await addDoc(collection(db, 'products'), payload);
      } catch (err: any) {
        console.error('Failed to sync new product to Firestore', err);
        throw new Error('OFFLINE_QUEUED');
      }
    },

    updateProduct: async (product) => {
      const payload = {
        name: product.name,
        sku: product.sku,
        category: product.category,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
        isService: product.isService,
        unit: product.unit,
        stock: product.stock,
      };

      try {
        await updateDoc(doc(db, 'products', product.id), payload);
      } catch (err: any) {
        console.error('Failed to update product in Firestore', err);
        throw new Error('OFFLINE_QUEUED');
      }
    },

    deleteProduct: async (id) => {
      try {
        await deleteDoc(doc(db, 'products', id));
      } catch (err: any) {
        console.error('Failed to delete product from Firestore', err);
        throw new Error('OFFLINE_QUEUED');
      }
    },

    decrementStock: async (id, qty) => {
      try {
        await updateDoc(doc(db, 'products', id), {
          stock: increment(-qty)
        });
      } catch (err: any) {
        console.error('Failed to decrement stock in Firestore', err);
        throw new Error('OFFLINE_QUEUED');
      }
    },
  })
);

// ─── Cart Store ───────────────────────────────────────────────────────────────
// Cart keeps persist because we want the cart to survive page refreshes on the same device
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
