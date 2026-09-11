import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSettingsStore } from '../store/settingsStore';
import { useCartStore } from '../store/cartStore';
import { useProductStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import {
  ShoppingBag,
  Search,
  Phone,
  Truck,
  Store,
  MessageCircle,
  ExternalLink,
  Trash2,
  Receipt,
} from 'lucide-react';
import { toast } from 'sonner';

export interface OnlineOrder {
  id: string;
  orderId: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryAddress: string;
  notes?: string;
  items: {
    id: string;
    name: string;
    category?: string;
    sellingPrice: number;
    quantity: number;
    unit?: string;
    lineTotal: number;
  }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
  source?: string;
  createdAt: number;
}

export default function OnlineOrders() {
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const user = useAuthStore((s) => s.user);
  const { addItem: addPosItem, clearCart: clearPosCart } = useCartStore();
  const { products } = useProductStore();

  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);

  // Subscribe to onlineOrders in real time
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'onlineOrders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const loaded = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as OnlineOrder[];
        setOrders(loaded);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to load online orders', error);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // Filter orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === 'ALL' || order.status === statusFilter;

      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        order.orderId?.toLowerCase().includes(term) ||
        order.customerName?.toLowerCase().includes(term) ||
        order.customerPhone?.toLowerCase().includes(term);

      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchTerm]);

  // Counts
  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === 'PENDING').length,
      confirmed: orders.filter((o) => o.status === 'CONFIRMED').length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
      cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    };
  }, [orders]);

  // Update order status
  const handleUpdateStatus = async (
    orderId: string,
    nextStatus: 'CONFIRMED' | 'COMPLETED' | 'CANCELLED'
  ) => {
    try {
      await updateDoc(doc(db, 'onlineOrders', orderId), {
        status: nextStatus,
        updatedAt: Date.now(),
        updatedBy: user?.name || 'Staff',
      });
      toast.success(`Order marked as ${nextStatus}`);
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: nextStatus });
      }
    } catch (err) {
      console.error('Failed to update status', err);
      toast.error('Failed to update order status');
    }
  };

  // Convert to POS Cart
  const handleTransferToPOS = (order: OnlineOrder) => {
    clearPosCart();
    let loadedCount = 0;

    order.items.forEach((item) => {
      const match = products.find((p) => p.id === item.id);
      if (match) {
        // Add existing inventory item
        for (let i = 0; i < item.quantity; i++) {
          addPosItem({
            id: match.id,
            name: match.name,
            sku: match.sku,
            unitPrice: match.sellingPrice,
            quantity: 1,
            discount: 0,
            isService: match.isService,
            costPrice: match.costPrice,
            category: match.category,
          });
        }
        loadedCount++;
      } else {
        // Fallback for items with slight changes
        for (let i = 0; i < item.quantity; i++) {
          addPosItem({
            id: item.id,
            name: item.name,
            sku: '',
            unitPrice: item.sellingPrice,
            quantity: 1,
            discount: 0,
            isService: false,
            costPrice: 0,
            category: item.category || 'Online Order',
          });
        }
        loadedCount++;
      }
    });

    toast.success(`Transferred ${loadedCount} items to POS terminal`);
    navigate('/pos');
  };

  // Direct WhatsApp follow up with customer
  const handleWhatsAppCustomer = (order: OnlineOrder) => {
    const cleanPhone = order.customerPhone.replace(/[^0-9]/g, '');
    const msg = `Hello ${order.customerName}! 👋 This is ${settings.companyName || 'MsikaFlo'}. We have received your order request #${order.orderId} (Total: ${order.currency} ${order.total.toLocaleString()}). How would you like to proceed with payment and fulfillment?`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // Delete an order
  const handleDeleteOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this order?')) return;
    try {
      await deleteDoc(doc(db, 'onlineOrders', orderId));
      toast.success('Order deleted');
      if (selectedOrder?.id === orderId) setSelectedOrder(null);
    } catch (err) {
      console.error('Failed to delete order', err);
      toast.error('Failed to delete order');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="px-2.5 py-1 text-xs font-black bg-amber-100 text-amber-800 rounded-full border border-amber-200 animate-pulse">
            Pending WhatsApp
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="px-2.5 py-1 text-xs font-black bg-blue-100 text-blue-800 rounded-full border border-blue-200">
            Confirmed
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="px-2.5 py-1 text-xs font-black bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
            Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-1 text-xs font-black bg-slate-100 text-slate-600 rounded-full border border-slate-200">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 flex items-center gap-3">
            <ShoppingBag className="text-blue-600" />
            <span>WhatsApp Online Orders</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Real-time incoming orders placed by customers through your public online storefront.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => window.open('/store', '_blank')}
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition flex items-center gap-1.5"
          >
            <ExternalLink size={14} />
            <span>View Public Store</span>
          </button>
        </div>
      </div>

      {/* Stats / Status Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            statusFilter === 'ALL'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase opacity-80">All Orders</div>
          <div className="text-xl font-black mt-0.5">{counts.all}</div>
        </button>

        <button
          onClick={() => setStatusFilter('PENDING')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            statusFilter === 'PENDING'
              ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
              : 'bg-white text-amber-700 border-gray-200 hover:bg-amber-50/50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase opacity-80">Pending Attention</div>
          <div className="text-xl font-black mt-0.5">{counts.pending}</div>
        </button>

        <button
          onClick={() => setStatusFilter('CONFIRMED')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            statusFilter === 'CONFIRMED'
              ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
              : 'bg-white text-blue-700 border-gray-200 hover:bg-blue-50/50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase opacity-80">Confirmed</div>
          <div className="text-xl font-black mt-0.5">{counts.confirmed}</div>
        </button>

        <button
          onClick={() => setStatusFilter('COMPLETED')}
          className={`p-3.5 rounded-2xl border text-left transition ${
            statusFilter === 'COMPLETED'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
              : 'bg-white text-emerald-700 border-gray-200 hover:bg-emerald-50/50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase opacity-80">Completed</div>
          <div className="text-xl font-black mt-0.5">{counts.completed}</div>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search orders by customer name, phone number, or Order ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white rounded-xl border border-gray-200 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-600 outline-none"
        />
      </div>

      {/* Orders Table & Cards */}
      {isLoading ? (
        <div className="p-12 text-center text-gray-400">Loading incoming orders...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center max-w-md mx-auto space-y-3">
          <div className="w-14 h-14 bg-gray-100 text-gray-400 rounded-full flex items-center justify-center mx-auto">
            <ShoppingBag size={28} />
          </div>
          <h3 className="font-bold text-gray-800 text-base">No online orders found</h3>
          <p className="text-xs text-gray-500">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try adjusting your search or filters.'
              : 'When customers place orders on your WhatsApp storefront, they will appear here in real time.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Order Cards List */}
          <div className="lg:col-span-2 space-y-3">
            {filteredOrders.map((order) => {
              const isSelected = selectedOrder?.id === order.id;
              const dateStr = new Date(order.createdAt).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`bg-white rounded-2xl border p-4 sm:p-5 transition cursor-pointer ${
                    isSelected
                      ? 'border-blue-600 ring-2 ring-blue-600/10 shadow-md'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-gray-900">
                          #{order.orderId}
                        </span>
                        {getStatusBadge(order.status)}
                      </div>
                      <h4 className="font-bold text-gray-900 text-base mt-1">
                        {order.customerName}
                      </h4>
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone size={12} className="text-gray-400" />
                        {order.customerPhone}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-base sm:text-lg font-black text-blue-600">
                        {order.currency} {order.total.toLocaleString()}
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium block mt-0.5">
                        {dateStr}
                      </span>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 text-gray-600">
                      {order.deliveryMethod === 'DELIVERY' ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                          <Truck size={12} /> Delivery: {order.deliveryAddress}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          <Store size={12} /> Store Pickup
                        </span>
                      )}
                      <span>&bull;</span>
                      <span>
                        {order.items?.length || 0} item{(order.items?.length || 0) === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Quick WhatsApp Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWhatsAppCustomer(order);
                      }}
                      className="px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold text-xs border border-emerald-200 transition flex items-center gap-1.5"
                    >
                      <MessageCircle size={13} />
                      <span>WhatsApp Customer</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Order Details Panel */}
          <div className="lg:col-span-1">
            {selectedOrder ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-5 sticky top-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-gray-400">Order Details</span>
                    <h3 className="text-lg font-black text-gray-900">#{selectedOrder.orderId}</h3>
                  </div>
                  {getStatusBadge(selectedOrder.status)}
                </div>

                {/* Customer Details */}
                <div className="space-y-2 text-xs">
                  <div className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                    Customer Information
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl space-y-1.5">
                    <div className="font-bold text-gray-900 text-sm">
                      {selectedOrder.customerName}
                    </div>
                    <div className="text-gray-600 flex items-center gap-1.5">
                      <Phone size={13} className="text-gray-400" />
                      <span>{selectedOrder.customerPhone}</span>
                    </div>
                    <div className="text-gray-600 flex items-center gap-1.5">
                      {selectedOrder.deliveryMethod === 'DELIVERY' ? (
                        <>
                          <Truck size={13} className="text-indigo-600 shrink-0" />
                          <span>Address: {selectedOrder.deliveryAddress}</span>
                        </>
                      ) : (
                        <>
                          <Store size={13} className="text-emerald-600 shrink-0" />
                          <span>Fulfillment: In-Store Pickup</span>
                        </>
                      )}
                    </div>
                    {selectedOrder.notes && (
                      <div className="text-gray-700 italic border-t border-gray-200/80 pt-1.5 mt-1.5">
                        &quot;{selectedOrder.notes}&quot;
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Ordered */}
                <div className="space-y-2">
                  <div className="font-bold text-gray-500 uppercase tracking-wider text-[10px]">
                    Items Breakdown
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedOrder.items?.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold text-gray-800 truncate">{item.name}</div>
                          <span className="text-gray-400 text-[11px]">
                            {item.quantity} &times; {selectedOrder.currency}{' '}
                            {item.sellingPrice.toLocaleString()}
                          </span>
                        </div>
                        <span className="font-bold text-gray-900">
                          {selectedOrder.currency} {item.lineTotal.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-gray-100 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal:</span>
                      <span>
                        {selectedOrder.currency} {selectedOrder.subtotal?.toLocaleString()}
                      </span>
                    </div>
                    {selectedOrder.deliveryMethod === 'DELIVERY' && (
                      <div className="flex justify-between text-gray-500">
                        <span>Delivery Fee:</span>
                        <span>
                          {selectedOrder.currency} {selectedOrder.deliveryFee?.toLocaleString()}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between font-black text-sm text-gray-900 pt-1 border-t">
                      <span>Grand Total:</span>
                      <span className="text-blue-600">
                        {selectedOrder.currency} {selectedOrder.total?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  {/* Process as POS Sale */}
                  <button
                    onClick={() => handleTransferToPOS(selectedOrder)}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Receipt size={15} />
                    <span>Load into POS & Checkout</span>
                  </button>

                  {/* Status Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {selectedOrder.status !== 'CONFIRMED' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'CONFIRMED')}
                        className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl border border-blue-200 transition"
                      >
                        Confirm Order
                      </button>
                    )}
                    {selectedOrder.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'COMPLETED')}
                        className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition"
                      >
                        Mark Completed
                      </button>
                    )}
                    {selectedOrder.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleUpdateStatus(selectedOrder.id, 'CANCELLED')}
                        className="py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 transition"
                      >
                        Cancel Order
                      </button>
                    )}
                  </div>

                  {/* WhatsApp Button */}
                  <button
                    onClick={() => handleWhatsAppCustomer(selectedOrder)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5"
                  >
                    <MessageCircle size={15} />
                    <span>Message Customer on WhatsApp</span>
                  </button>

                  {/* Delete Button */}
                  {user?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleDeleteOrder(selectedOrder.id)}
                      className="w-full py-1.5 text-gray-400 hover:text-rose-600 font-semibold text-[11px] transition flex items-center justify-center gap-1"
                    >
                      <Trash2 size={12} />
                      <span>Delete order record</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl border border-dashed border-gray-200 p-8 text-center text-xs text-gray-400">
                Select an order from the list to view complete details, items, and fulfillment options.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
