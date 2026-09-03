import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  increment,
  setDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { registerListener } from './authStore';

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
  isEquipment?: boolean;
  unit: string;
  // AI-Assisted Visual Product Finder Fields (Phase 1)
  aliases?: string[];
  mapCoordinates?: { x: number; y: number };
  displayLocationText?: string;
  images?: string[];
  createdAt?: number;
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
  (set, get) => ({
    products: [],
    isLoading: false,

    loadProducts: async () => {
      set({ isLoading: true });
      const unsub_products = onSnapshot(collection(db, 'products'), (snapshot) => {
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
            isEquipment: !!p.isEquipment,
            unit: p.unit || 'pcs',
            aliases: p.aliases || [],
            mapCoordinates: p.mapCoordinates,
            displayLocationText: p.displayLocationText || '',
            images: p.images || [],
            createdAt: p.createdAt,
          };
        });
        set({ products: mapped, isLoading: false });
      }, (err) => {
        console.warn('Failed to load products from Firestore', err);
        set({ isLoading: false });
      });
      registerListener(unsub_products);
    },

    setProducts: (products) => set({ products }),

    addProduct: async (product) => {
      const currentProducts = get().products;
      const nameLower = product.name.trim().toLowerCase();
      const skuLower = product.sku?.trim().toLowerCase();

      const existingName = currentProducts.find(p => p.name.trim().toLowerCase() === nameLower);
      if (existingName) {
        throw new Error(`An item named "${product.name.trim()}" already exists.`);
      }

      if (skuLower) {
        const existingSku = currentProducts.find(p => p.sku.trim().toLowerCase() === skuLower);
        if (existingSku) {
          throw new Error(`SKU "${product.sku.trim()}" is already assigned to "${existingSku.name}".`);
        }
      }

      const payload = {
        name: product.name.trim(),
        sku: product.sku.trim(),
        category: product.category,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
        isService: product.isService,
        isEquipment: !!product.isEquipment,
        unit: product.unit,
        stock: product.stock,
        aliases: product.aliases || [],
        mapCoordinates: product.mapCoordinates || null,
        displayLocationText: product.displayLocationText || '',
        images: product.images || [],
        createdAt: Date.now(),
      };

      addDoc(collection(db, 'products'), payload).catch(e => console.warn('Offline write deferred or failed:', e));
    },

    updateProduct: async (product) => {
      const currentProducts = get().products;
      const nameLower = product.name.trim().toLowerCase();
      const skuLower = product.sku?.trim().toLowerCase();

      const existingName = currentProducts.find(p => p.id !== product.id && p.name.trim().toLowerCase() === nameLower);
      if (existingName) {
        throw new Error(`An item named "${product.name.trim()}" already exists.`);
      }

      if (skuLower) {
        const existingSku = currentProducts.find(p => p.id !== product.id && p.sku.trim().toLowerCase() === skuLower);
        if (existingSku) {
          throw new Error(`SKU "${product.sku.trim()}" is already assigned to "${existingSku.name}".`);
        }
      }

      const payload = {
        name: product.name.trim(),
        sku: product.sku.trim(),
        category: product.category,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
        isService: product.isService,
        isEquipment: !!product.isEquipment,
        unit: product.unit,
        stock: product.stock,
        aliases: product.aliases || [],
        mapCoordinates: product.mapCoordinates || null,
        displayLocationText: product.displayLocationText || '',
        images: product.images || [],
      };

      updateDoc(doc(db, 'products', product.id), payload).catch(e => console.warn('Offline write deferred or failed:', e));
    },

    deleteProduct: async (id) => {
      deleteDoc(doc(db, 'products', id)).catch(e => console.warn('Offline write deferred or failed:', e));
    },

    decrementStock: async (id, qty) => {
      updateDoc(doc(db, 'products', id), {
        stock: increment(-qty)
      }).catch(e => console.warn('Offline write deferred or failed:', e));
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
  isOther?: boolean;
  category?: string;
  costPrice?: number;
  materialsConsumed?: { inventoryItemId: string; quantityPerUnit: number; name: string }[];
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
  holdCart: (userId: string, name: string) => void;
  restoreCart: (userId: string, id: string) => void;
  removeHeldCart: (userId: string, id: string) => void;
  loadHeldCarts: (userId: string) => void;
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

      holdCart: async (userId: string, name: string) => {
        const { items, globalDiscount, clearCart } = get();
        if (items.length === 0) return;
        
        const newHeldCart = {
          id: Date.now().toString(),
          name: name || `Cart ${get().heldCarts.length + 1}`,
          items: [...items],
          globalDiscount,
          timestamp: Date.now()
        };

        try {
          setDoc(doc(db, 'users', userId, 'heldCarts', newHeldCart.id), newHeldCart).catch(e => console.warn('Offline write deferred or failed:', e));
          clearCart();
        } catch (error) {
          console.error("Failed to hold cart in Firestore", error);
        }
      },

      restoreCart: async (userId: string, id: string) => {
        const { heldCarts } = get();
        const cartToRestore = heldCarts.find(c => c.id === id);
        if (!cartToRestore) return;
        
        set(() => ({
          items: cartToRestore.items,
          globalDiscount: cartToRestore.globalDiscount
        }));

        try {
          deleteDoc(doc(db, 'users', userId, 'heldCarts', id)).catch(e => console.warn('Offline write deferred or failed:', e));
        } catch (error) {
          console.error("Failed to remove restored cart from Firestore", error);
        }
      },

      removeHeldCart: async (userId: string, id: string) => {
        try {
          deleteDoc(doc(db, 'users', userId, 'heldCarts', id)).catch(e => console.warn('Offline write deferred or failed:', e));
        } catch (error) {
          console.error("Failed to remove held cart from Firestore", error);
        }
      },

      loadHeldCarts: (userId: string) => {
        try {
          const unsub_carts = onSnapshot(collection(db, 'users', userId, 'heldCarts'), (snapshot) => {
            const loadedCarts: HeldCart[] = [];
            snapshot.forEach((document) => {
              loadedCarts.push({ id: document.id, ...document.data() } as HeldCart);
            });
            set({ heldCarts: loadedCarts });
          });
          registerListener(unsub_carts);
        } catch (error) {
          console.error("Failed to load held carts from Firestore", error);
        }
      }
    }),
    { name: 'jef-cart-storage',
      partialize: (state) => ({ items: state.items, globalDiscount: state.globalDiscount }),
    }
  )
);
