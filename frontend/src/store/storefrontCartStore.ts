import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from './cartStore';

export interface StorefrontCartItem {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  quantity: number;
  unit: string;
  image?: string;
  sku?: string;
  isService?: boolean;
}

export type DeliveryMethod = 'PICKUP' | 'DELIVERY';

interface StorefrontCartState {
  items: StorefrontCartItem[];
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string;
  notes: string;
  agreedToTerms: boolean;

  // Actions
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  setCustomerDetails: (details: {
    customerName?: string;
    customerPhone?: string;
    deliveryMethod?: DeliveryMethod;
    deliveryAddress?: string;
    notes?: string;
    agreedToTerms?: boolean;
  }) => void;
  getSubtotal: () => number;
  getTotal: (deliveryFee?: number) => number;
  getItemCount: () => number;
}

export const useStorefrontCartStore = create<StorefrontCartState>()(
  persist(
    (set, get) => ({
      items: [],
      customerName: '',
      customerPhone: '',
      deliveryMethod: 'PICKUP',
      deliveryAddress: '',
      notes: '',
      agreedToTerms: false,

      addItem: (product: Product, quantity = 1) => {
        set((state) => {
          const existing = state.items.find((i) => i.id === product.id);
          const maxStock = product.isService ? 9999 : Math.max(1, product.stock);

          if (existing) {
            const nextQty = Math.min(maxStock, existing.quantity + quantity);
            return {
              items: state.items.map((i) =>
                i.id === product.id ? { ...i, quantity: nextQty } : i
              ),
            };
          }

          const newItem: StorefrontCartItem = {
            id: product.id,
            name: product.name,
            category: product.category,
            sellingPrice: product.sellingPrice,
            quantity: Math.min(maxStock, quantity),
            unit: product.unit || 'pcs',
            image: product.images && product.images.length > 0 ? product.images[0] : undefined,
            sku: product.sku,
            isService: !!product.isService,
          };

          return { items: [...state.items, newItem] };
        });
      },

      removeItem: (id: string) => {
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        }));
      },

      updateQuantity: (id: string, quantity: number) => {
        set((state) => ({
          items: state.items
            .map((i) => (i.id === id ? { ...i, quantity: Math.max(0, quantity) } : i))
            .filter((i) => i.quantity > 0),
        }));
      },

      clearCart: () => {
        set({
          items: [],
          notes: '',
        });
      },

      setCustomerDetails: (details) => {
        set((state) => ({ ...state, ...details }));
      },

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
      },

      getTotal: (deliveryFee = 0) => {
        const subtotal = get().getSubtotal();
        const fee = get().deliveryMethod === 'DELIVERY' ? deliveryFee : 0;
        return subtotal + fee;
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },
    }),
    {
      name: 'msikaflo_customer_cart',
    }
  )
);
