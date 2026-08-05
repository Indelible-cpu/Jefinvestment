import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

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
  addProduct: (product: Product) => void;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  decrementStock: (id: string, qty: number) => void;
}

export const useProductStore = create<ProductState>()(
  (set) => ({
    products: [],
    isLoading: false,

    loadProducts: async () => {
      set({ isLoading: true });
      try {
        const res: any = await api.get('/api/v1/inventory');
        if (res.data && Array.isArray(res.data)) {
          const mapped = res.data.map((p: any) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            category: p.category?.name || 'General',
            costPrice: Number(p.costPrice) || 0,
            sellingPrice: Number(p.sellingPrice) || 0,
            stock: p.branches?.[0]?.quantity ?? 0,
            reorderLevel: p.reorderLevel || 0,
            isService: !!p.isService,
            unit: p.unit || 'pcs',
          }));
          set({ products: mapped, isLoading: false });
        } else {
          set({ isLoading: false });
        }
      } catch (err) {
        console.warn('Failed to load products from API', err);
        set({ isLoading: false });
      }
    },

    setProducts: (products) => set({ products }),

    addProduct: async (product) => {
      // Optimistic add
      set((state) => ({ products: [...state.products, product] }));
      try {
        const res: any = await api.post('/api/v1/inventory', {
          name: product.name,
          sku: product.sku,
          categoryId: 'general',
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          reorderLevel: product.reorderLevel,
          isService: product.isService,
          unit: product.unit,
          initialStock: product.stock,
        });
        // Replace local ID with server ID
        if (res.data?.id) {
          set((state) => ({
            products: state.products.map(p => p.id === product.id ? { ...p, id: res.data.id } : p)
          }));
        }
      } catch (err) {
        console.error('Failed to sync new product to server', err);
      }
    },

    updateProduct: async (product) => {
      set((state) => ({ products: state.products.map(p => p.id === product.id ? product : p) }));
      try {
        await api.put(`/api/v1/inventory/${product.id}`, {
          name: product.name,
          sku: product.sku,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          reorderLevel: product.reorderLevel,
          isService: product.isService,
          unit: product.unit,
        });
      } catch (err) {
        console.error('Failed to sync updated product to server', err);
      }
    },

    deleteProduct: async (id) => {
      set((state) => ({ products: state.products.filter(p => p.id !== id) }));
      try {
        await api.delete(`/api/v1/inventory/${id}`);
      } catch (err) {
        console.error('Failed to delete product from server', err);
      }
    },

    decrementStock: async (id, qty) => {
      // Optimistically update local state
      set((state) => ({
        products: state.products.map(p => p.id === id ? { ...p, stock: Math.max(0, p.stock - qty) } : p)
      }));
      // Persist to backend
      try {
        await api.put(`/api/v1/inventory/${id}/stock`, { adjustment: -qty, reason: 'SALE' });
      } catch (err) {
        console.error('Failed to sync stock decrement to server', err);
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
