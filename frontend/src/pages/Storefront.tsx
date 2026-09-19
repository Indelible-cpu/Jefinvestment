import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Truck, 
  Store, 
  ArrowRight,
  ShieldCheck,
  Sparkles,
  MessageCircle,
  Printer,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSettingsStore } from '../store/settingsStore';
import { useStorefrontCartStore } from '../store/storefrontCartStore';
import { useStationeryStore } from '../store/stationeryStore';
import type { Product } from '../store/cartStore';
import { toast } from 'sonner';
import { dispatchSalePushNotification } from '../utils/pushNotifications';

export default function Storefront() {
  const settings = useSettingsStore();
  const {
    items: cartItems,
    addItem,
    updateQuantity,
    clearCart,
    customerName,
    customerPhone,
    deliveryMethod,
    deliveryAddress,
    notes,
    agreedToTerms,
    setCustomerDetails,
    getSubtotal,
    getTotal,
    getItemCount,
  } = useStorefrontCartStore();

  const { services: stationeryServices, loadStationeryServices } = useStationeryStore();

  // Local state
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<{ id: string; total: number } | null>(null);

  // Load settings and stationery services on mount
  useEffect(() => {
    settings.loadSettings();
    loadStationeryServices();
  }, []);

  // Fetch products in real time directly from Firestore
  useEffect(() => {
    setIsLoading(true);
    setCatalogError(null);
    const unsub = onSnapshot(
      collection(db, 'products'),
      (snapshot) => {
        const loaded = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || 'Unnamed Item',
            sku: data.sku || '',
            category: data.category || data.categoryId || 'General',
            costPrice: 0, // Protected: never exposed to public
            sellingPrice: Number(data.sellingPrice) || 0,
            stock: Number(data.stock) ?? 0,
            reorderLevel: Number(data.reorderLevel) || 0,
            isService: !!data.isService,
            isEquipment: !!data.isEquipment,
            unit: data.unit || 'pcs',
            aliases: data.aliases || [],
            images: data.images || [],
            displayLocationText: '',
            createdAt: data.createdAt,
          } as Product;
        });
        setProducts(loaded);
        setIsLoading(false);
        setCatalogError(null);
      },
      (error) => {
        console.error('Failed to load catalog products', error);
        setCatalogError(error.message || 'Failed to load catalog products from company server');
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [retryCount]);

  // Combine products and stationery services into a unified storefront catalog
  const catalogItems = useMemo<Product[]>(() => {
    const stationeryAsProducts: Product[] = stationeryServices.map((svc) => ({
      id: `stationery_${svc.id}`,
      name: svc.serviceName,
      sku: 'STAT-SVC',
      category: 'Stationery Services',
      costPrice: 0,
      sellingPrice: svc.sellingPrice,
      stock: 9999, // services are not limited by raw stock on public storefront
      reorderLevel: 0,
      isService: true,
      isEquipment: false,
      unit: svc.unit || 'page',
      aliases: ['typing', 'scanning', 'photocopy', 'photocopying', 'lamination', 'printing', 'print'],
      images: [],
      displayLocationText: 'Stationery Counter',
      createdAt: 0,
    }));

    return [...products, ...stationeryAsProducts];
  }, [products, stationeryServices]);

  // Normalize a raw category — collapse bare "Stationery" into "Stationery Items"
  const normalizeCategory = (cat: string): string => {
    const trimmed = cat.trim();
    if (trimmed.toLowerCase() === 'stationery') return 'Stationery Items';
    if (trimmed.toLowerCase() === 'stationery service' || trimmed.toLowerCase() === 'stationery services') {
      return 'Stationery Services';
    }
    return trimmed;
  };

  // Compute unique categories (using normalized values)
  const categories = useMemo(() => {
    const set = new Set<string>();
    catalogItems.forEach((p) => {
      if (p.category && p.category.trim()) {
        set.add(normalizeCategory(p.category));
      }
    });
    return ['ALL', ...Array.from(set).sort()];
  }, [catalogItems]);

  // Filter products by search & category
  const filteredProducts = useMemo(() => {
    return catalogItems.filter((p) => {
      // Exclude internal tools/equipment
      if (p.isEquipment) return false;

      const normalizedProductCategory = normalizeCategory(p.category);
      const matchesCategory =
        selectedCategory === 'ALL' || normalizedProductCategory.toLowerCase() === selectedCategory.toLowerCase();

      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term) ||
        (p.aliases && p.aliases.some((a) => a.toLowerCase().includes(term)));

      return matchesCategory && matchesSearch;
    });
  }, [catalogItems, selectedCategory, searchTerm]);

  // Formatting helpers
  const currency = settings.currency || 'MWK';
  const deliveryFee = settings.storefrontDeliveryFee ?? 2500;
  const subtotal = getSubtotal();
  const grandTotal = getTotal(deliveryFee);
  const itemCount = getItemCount();

  const formatMoney = (amount: number) => {
    return `${currency} ${amount.toLocaleString('en-US')}`;
  };

  // WhatsApp Order Submission Handler
  const handlePlaceWhatsAppOrder = async (e: React.FormEvent) => {
    e.preventDefault();

    if (cartItems.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    if (!customerName.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    if (!customerPhone.trim()) {
      toast.error('Please enter your WhatsApp phone number');
      return;
    }

    if (deliveryMethod === 'DELIVERY' && !deliveryAddress.trim()) {
      toast.error('Please enter your delivery address');
      return;
    }

    if (!agreedToTerms) {
      toast.error('Please accept the purchase terms to proceed');
      return;
    }

    setOrderSubmitting(true);

    const orderRefId = `ORD-${Math.floor(100000 + Math.random() * 900000)}`;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    // 1. Generate structured WhatsApp message first so it is ALWAYS available
    const targetPhone = (settings.storefrontWhatsApp || settings.phone || '+265999123456')
      .replace(/[^0-9]/g, '');

    let msg = `🛍️ *NEW PURCHASE REQUEST — ${settings.companyName.toUpperCase()}*\n`;
    msg += `📋 *Purchase Ref:* #${orderRefId}\n`;
    msg += `📅 *Date:* ${formattedDate}\n`;
    msg += `────────────────────────\n`;
    msg += `👤 *Customer:* ${customerName.trim()}\n`;
    msg += `📞 *Phone:* ${customerPhone.trim()}\n`;
    msg += `📍 *Fulfillment:* ${deliveryMethod === 'DELIVERY' ? 'Home/Office Delivery' : 'In-Store Pickup'}\n`;
    if (deliveryMethod === 'DELIVERY') {
      msg += `🏠 *Address:* ${deliveryAddress.trim()}\n`;
    }
    if (notes.trim()) {
      msg += `💬 *Note:* ${notes.trim()}\n`;
    }
    msg += `────────────────────────\n`;
    msg += `📦 *ITEMS PURCHASED:*\n`;

    cartItems.forEach((item, index) => {
      msg += `${index + 1}. *${item.name}* (x${item.quantity} ${item.unit || 'pcs'})\n`;
      msg += `   @ ${currency} ${(Number(item.sellingPrice) || 0).toLocaleString()} = ${currency} ${((Number(item.sellingPrice) || 0) * item.quantity).toLocaleString()}\n`;
    });

    msg += `────────────────────────\n`;
    msg += `💰 *Subtotal:* ${currency} ${subtotal.toLocaleString()}\n`;
    if (deliveryMethod === 'DELIVERY') {
      msg += `🚚 *Delivery Fee:* ${currency} ${deliveryFee.toLocaleString()}\n`;
    }
    msg += `🏷️ *TOTAL DUE:* *${currency} ${grandTotal.toLocaleString()}*\n`;
    if (settings.taxRate) {
      msg += `ℹ️ _Includes ${settings.taxName || 'VAT'} (${settings.taxRate}%)_\n`;
    }
    msg += `────────────────────────\n`;
    msg += `💳 *Preferred Payment:* Airtel Money / TNM Mpamba / Cash on Pickup\n`;
    msg += `✅ _Please confirm availability and dispatch terms. Thank you!_`;

    const whatsappUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`;

    const openWhatsAppDirectly = (url: string) => {
      try {
        const win = window.open(url, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
          // Popup was blocked by browser or running on mobile webview
          window.location.href = url;
        }
      } catch {
        window.location.href = url;
      }
    };

    // 2. Build sanitized payload for Cloud Firestore
    const orderPayload = {
      orderId: orderRefId,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryMethod,
      deliveryAddress: deliveryMethod === 'DELIVERY' ? (deliveryAddress?.trim() || '') : 'Store Pickup',
      notes: (notes || '').trim(),
      items: cartItems.map((item) => ({
        id: item.id || '',
        name: item.name || 'Unnamed Item',
        category: item.category || 'General',
        sellingPrice: Number(item.sellingPrice) || 0,
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'pcs',
        lineTotal: (Number(item.sellingPrice) || 0) * (Number(item.quantity) || 1),
      })),
      subtotal: Number(subtotal) || 0,
      deliveryFee: deliveryMethod === 'DELIVERY' ? (Number(deliveryFee) || 0) : 0,
      total: Number(grandTotal) || 0,
      currency: currency || 'MWK',
      status: 'PENDING',
      source: 'STOREFRONT_WHATSAPP',
      createdAt: Date.now(),
    };

    try {
      // 3. Ingest order into Firestore for ERP staff
      await addDoc(collection(db, 'onlineOrders'), orderPayload);

      // Fire-and-forget push notification to authorized managers/admins (never blocks order)
      dispatchSalePushNotification({
        type: 'ONLINE_ORDER',
        orderNumber: String(orderRefId),
        amount: grandTotal,
        currency,
        itemCount: cartItems.reduce((s, i) => s + i.quantity, 0),
      }).catch((e) => console.warn('Online order push notification dispatch notice:', e));

      // 4. Clear cart and set completed state
      clearCart();
      setIsCartOpen(false);
      setCompletedOrder({ id: orderRefId, total: grandTotal });

      // 5. Open WhatsApp with prefilled order
      openWhatsAppDirectly(whatsappUrl);
      toast.success('Purchase request sent to WhatsApp! Waiting for merchant confirmation.');
    } catch (err) {
      console.error('Failed to submit online order to Firestore', err);
      // Even if cloud write was blocked or offline, never block the customer!
      clearCart();
      setIsCartOpen(false);
      setCompletedOrder({ id: orderRefId, total: grandTotal });

      openWhatsAppDirectly(whatsappUrl);
      toast.info('Connecting you to WhatsApp to confirm your purchase directly...');
    } finally {
      setOrderSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased selection:bg-blue-600 selection:text-white">
      {/* Top Notification Announcement Banner */}
      {settings.storefrontBanner && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white text-xs sm:text-sm py-2 px-4 text-center font-medium shadow-sm flex items-center justify-center gap-2">
          <Sparkles size={16} className="text-amber-300 animate-pulse shrink-0" />
          <span>{settings.storefrontBanner.replace(/\bOrder\b/g, 'Buy').replace(/\border\b/g, 'buy')}</span>
        </div>
      )}

      {/* Main Header & Branding */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-4">
            {/* Logo / Brand Name */}
            <Link to="/store" className="flex items-center gap-3 group">
              {settings.companyLogo ? (
                <img
                  src={settings.companyLogo}
                  alt={settings.companyName}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover shadow-xs border border-slate-200"
                />
              ) : (
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-sm">
                  {settings.companyName?.charAt(0) || 'M'}
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-base sm:text-xl font-black tracking-tight text-slate-900 group-hover:text-blue-600 transition">
                  {settings.companyName || 'MsikaFlo Market'}
                </span>
                <span className="text-[11px] sm:text-xs text-slate-500 flex items-center gap-1 font-medium">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Online Shop
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* WhatsApp Quick Link with Cart Quote */}
              <a
                href={(() => {
                  const phone = (settings.storefrontWhatsApp || settings.phone || '+265999123456').replace(/[^0-9]/g, '');
                  if (cartItems.length > 0) {
                    let text = `Hello ${settings.companyName || ''}! I am inquiring about the following items in my cart:\n`;
                    cartItems.forEach((item) => {
                      text += `• ${item.name} (x${item.quantity} ${item.unit}) - ${currency} ${(item.sellingPrice * item.quantity).toLocaleString()}\n`;
                    });
                    text += `Total: ${currency} ${subtotal.toLocaleString()}\n\nPlease let me know about availability or any details. Thank you!`;
                    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
                  }
                  return `https://wa.me/${phone}?text=${encodeURIComponent(`Hello! I have an inquiry regarding products/services at ${settings.companyName || 'your store'}.`)}`;
                })()}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200 transition"
                title={cartItems.length > 0 ? "Chat with quote of your cart items" : "Chat with Us on WhatsApp"}
              >
                <MessageCircle size={16} className="text-emerald-600" />
                <span className="hidden sm:inline">
                  {cartItems.length > 0 ? `Chat Quote (${itemCount})` : 'Chat with Us'}
                </span>
                <span className="sm:hidden">{cartItems.length > 0 ? `Quote (${itemCount})` : 'Chat'}</span>
              </a>

              {/* Cart Drawer Trigger */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-blue-600/20 transition cursor-pointer"
              >
                <ShoppingBag size={18} />
                <span className="hidden sm:inline">My Cart</span>
                {itemCount > 0 && (
                  <span className="bg-amber-400 text-slate-950 text-[10px] sm:text-xs font-black px-1.5 sm:px-2 py-0.5 rounded-full">
                    {itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Banner with Search */}
      <section className="bg-gradient-to-b from-white via-slate-50 to-slate-100 border-b border-slate-200/80 py-8 sm:py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold">
            <Store size={14} /> Official Customer Storefront
          </div>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Browse Quality Products & Buy via WhatsApp
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto">
            {settings.storefrontAbout ||
              'Instant stock availability, transparent prices, and fast purchase processing directly to our sales team.'}
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto pt-3">
            <div className="relative flex items-center">
              <Search className="absolute left-4 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Search products by name, brand, or category..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-10 py-3.5 sm:py-4 bg-white rounded-2xl border border-slate-200 shadow-sm text-sm sm:text-base focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-4 text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Business Hours & Location Chips */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-xs">
              <MapPin size={13} className="text-blue-600" />
              {settings.address || 'Blantyre, Malawi'}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-xs">
              <Clock size={13} className="text-blue-600" />
              Open Mon - Sat: {settings.workTimeStart || '07:30'} - {settings.workTimeEnd || '17:30'}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-xs">
              <Truck size={13} className="text-blue-600" />
              Fast Delivery Available
            </span>
          </div>
        </div>
      </section>

      {/* Category Pills Bar */}
      <div className="sticky top-16 sm:top-20 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 py-3 px-4 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat === 'ALL' ? '🌟 All Products' : cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Products Grid */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs sm:text-sm text-slate-500 font-medium">
            Showing <span className="font-bold text-slate-800">{filteredProducts.length}</span> product
            {filteredProducts.length === 1 ? '' : 's'}
            {selectedCategory !== 'ALL' && <span> in <strong className="text-blue-600">{selectedCategory}</strong></span>}
          </div>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              Clear search
            </button>
          )}
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse space-y-3">
                <div className="h-36 sm:h-44 bg-slate-200 rounded-xl"></div>
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                <div className="h-8 bg-slate-200 rounded-xl"></div>
              </div>
            ))}
          </div>
        ) : catalogError && catalogItems.length === 0 ? (
          /* Catalog Connection / Rules Error State */
          <div className="bg-white rounded-3xl border border-rose-200 p-8 sm:p-12 text-center max-w-md mx-auto my-12 space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Catalog Currently Unavailable</h3>
            <p className="text-xs sm:text-sm text-slate-500">
              We were unable to load the product list from the store database. This can occur if database access rules are still propagating or during a network blip.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setRetryCount((c) => c + 1)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Retry Loading</span>
              </button>
              <a
                href={`https://wa.me/${(settings.storefrontWhatsApp || settings.phone || '+265999123456').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Hello ${settings.companyName || ''}! I visited your online storefront, but products are currently loading slowly. Can you assist me with prices and availability?`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200 transition flex items-center gap-1.5"
              >
                <MessageCircle size={14} />
                <span>Buy on WhatsApp</span>
              </a>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty Search State */
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-12 space-y-4 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Search size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No products found</h3>
            <p className="text-xs sm:text-sm text-slate-500">
              We couldn't find anything matching &quot;{searchTerm}&quot;. Try searching with different keywords or browse all categories.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('ALL');
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition"
            >
              View All Products
            </button>
          </div>
        ) : (
          /* Product Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => {
              const inStock = product.isService || product.stock > 0;
              const isLowStock = !product.isService && product.stock > 0 && product.stock <= 3;
              const cartItem = cartItems.find((i) => i.id === product.id);

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl border border-slate-200 hover:border-blue-400/80 shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition duration-200 flex flex-col overflow-hidden group"
                >
                  {/* Thumbnail / Image */}
                  <div
                    onClick={() => setSelectedProduct(product)}
                    className="relative h-40 sm:h-48 bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    {product.images && product.images.length > 0 ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        loading="lazy"
                      />
                    ) : product.category === 'Stationery Services' || product.sku === 'STAT-SVC' ? (
                      <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-xs">
                        <Printer size={32} />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center font-bold text-xl">
                        {product.name.charAt(0)}
                      </div>
                    )}

                    {/* Stock Pill Badge */}
                    <div className="absolute top-2.5 left-2.5">
                      {product.isService ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-indigo-500 text-white rounded-md shadow-xs">
                          Service
                        </span>
                      ) : !inStock ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-600 text-white rounded-md shadow-xs">
                          Out of Stock
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-md shadow-xs">
                          Only {product.stock} left
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-600 text-white rounded-md shadow-xs">
                          In Stock
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                        {product.category}
                      </span>
                      <h3
                        onClick={() => setSelectedProduct(product)}
                        className="font-bold text-slate-900 text-sm sm:text-base leading-snug line-clamp-2 hover:text-blue-600 cursor-pointer transition"
                      >
                        {product.name}
                      </h3>
                    </div>

                    <div className="space-y-3 pt-1">
                      {/* Price Display */}
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-base sm:text-lg font-black text-slate-900">
                            {formatMoney(product.sellingPrice)}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">/{product.unit}</span>
                        </div>
                      </div>

                      {/* Add to Cart Actions */}
                      {cartItem ? (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-1">
                          <button
                            onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-blue-700 shadow-xs hover:bg-blue-600 hover:text-white transition cursor-pointer"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xs font-black text-blue-900">
                            {cartItem.quantity}
                          </span>
                          <button
                            onClick={() => addItem(product, 1)}
                            disabled={!product.isService && cartItem.quantity >= product.stock}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center text-blue-700 shadow-xs hover:bg-blue-600 hover:text-white transition disabled:opacity-40 cursor-pointer"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (!inStock) return;
                            addItem(product, 1);
                            toast.success(`Added ${product.name} to cart`);
                          }}
                          disabled={!inStock}
                          className={`w-full py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer ${
                            inStock
                              ? 'bg-slate-900 hover:bg-blue-600 text-white shadow-xs active:scale-95'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <ShoppingBag size={14} />
                          <span>{inStock ? 'Add to Cart' : 'Unavailable'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Floating Bottom Cart Bar for Mobile */}
      {itemCount > 0 && !isCartOpen && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden z-30">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-slate-900 text-white py-3.5 px-5 rounded-2xl shadow-xl flex items-center justify-between font-bold text-sm active:scale-98 transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs">
                {itemCount}
              </div>
              <span>View Cart</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>{formatMoney(grandTotal)}</span>
              <ArrowRight size={16} />
            </div>
          </button>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="relative h-60 bg-slate-100 flex items-center justify-center">
              {selectedProduct.images && selectedProduct.images.length > 0 ? (
                <img
                  src={selectedProduct.images[0]}
                  alt={selectedProduct.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-3xl">
                  {selectedProduct.name.charAt(0)}
                </div>
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 text-slate-600 hover:text-slate-900 flex items-center justify-center shadow-md transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  {selectedProduct.category}
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{selectedProduct.name}</h2>
                {selectedProduct.sku && (
                  <span className="text-xs text-slate-400 font-mono mt-0.5 block">
                    SKU: {selectedProduct.sku}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between py-3 border-y border-slate-100">
                <div>
                  <span className="text-2xl font-black text-slate-900">
                    {formatMoney(selectedProduct.sellingPrice)}
                  </span>
                  <span className="text-xs text-slate-400 ml-1">per {selectedProduct.unit}</span>
                </div>
                <div>
                  {selectedProduct.isService ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Service
                    </span>
                  ) : selectedProduct.stock > 0 ? (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {selectedProduct.stock} available in stock
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                      Currently Out of Stock
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => {
                    addItem(selectedProduct, 1);
                    setSelectedProduct(null);
                    setIsCartOpen(true);
                  }}
                  disabled={!selectedProduct.isService && selectedProduct.stock <= 0}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <ShoppingBag size={18} />
                  <span>Add to Cart</span>
                </button>
                <a
                  href={`https://wa.me/${(settings.storefrontWhatsApp || settings.phone || '+265999123456').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                    `Hello ${settings.companyName || ''}! I am inquiring about:\n\n` +
                    `📦 *${selectedProduct.name}*\n` +
                    `💰 Price: ${currency} ${selectedProduct.sellingPrice.toLocaleString()} / ${selectedProduct.unit}\n` +
                    (selectedProduct.sku ? `🏷️ SKU: ${selectedProduct.sku}\n` : '') +
                    `\nIs this currently available?`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer text-xs sm:text-sm"
                  title="Inquire about this product on WhatsApp"
                >
                  <MessageCircle size={18} />
                  <span>Ask on WhatsApp</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out Shopping Cart & WhatsApp Checkout Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 flex max-w-full w-full sm:w-auto sm:pl-10">
            <div className="w-full sm:w-screen max-w-md bg-white shadow-2xl flex flex-col">
              {/* Drawer Header */}
              <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <ShoppingBag size={18} />
                  </div>
                  <div>
                    <h2 className="font-black text-slate-900 text-base">Your Shopping Cart</h2>
                    <span className="text-xs text-slate-500 font-medium">
                      {itemCount} item{itemCount === 1 ? '' : 's'} selected
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {cartItems.length === 0 ? (
                  <div className="text-center py-16 space-y-3">
                    <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
                      <ShoppingBag size={30} />
                    </div>
                    <p className="font-bold text-slate-800">Your cart is empty</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Browse our catalog to select products, stationery, or phone tech items.
                    </p>
                    <button
                      onClick={() => setIsCartOpen(false)}
                      className="mt-2 px-5 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl"
                    >
                      Start Shopping
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Quick WhatsApp Quote Action Banner */}
                    <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-2xl border border-emerald-200 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MessageCircle size={18} className="text-emerald-600 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-emerald-950 truncate">Need help with these items?</p>
                          <p className="text-[10px] text-emerald-700 truncate">Quote your cart directly in WhatsApp chat</p>
                        </div>
                      </div>
                      <a
                        href={(() => {
                          const phone = (settings.storefrontWhatsApp || settings.phone || '+265999123456').replace(/[^0-9]/g, '');
                          let text = `Hello ${settings.companyName || ''}! I have the following items in my cart:\n\n`;
                          cartItems.forEach((item, idx) => {
                            text += `${idx + 1}. *${item.name}* (x${item.quantity} ${item.unit}) - ${currency} ${(item.sellingPrice * item.quantity).toLocaleString()}\n`;
                          });
                          text += `\n💰 *Total:* ${currency} ${subtotal.toLocaleString()}\n\nCould you please assist me with availability/pricing? Thank you!`;
                          return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
                        })()}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-bold shrink-0 transition flex items-center gap-1 shadow-xs"
                      >
                        <span>Chat Quote</span>
                      </a>
                    </div>

                    {/* Item List */}
                    <div className="space-y-3">
                      {cartItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold text-slate-900 text-sm truncate">{item.name}</h4>
                            <span className="text-xs text-slate-500">
                              {formatMoney(item.sellingPrice)} &times; {item.quantity} {item.unit}
                            </span>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                            <div className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm">
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-rose-600 cursor-pointer transition"
                              >
                                {item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                              </button>
                              <span className="w-8 text-center font-bold text-xs text-slate-900">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 flex items-center justify-center text-slate-600 hover:text-blue-600 cursor-pointer transition"
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <span className="font-bold text-sm text-slate-900 min-w-[70px] text-right">
                              {formatMoney(item.sellingPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Delivery Method Selection */}
                    <div className="space-y-2 pt-2">
                      <label className="block text-xs font-black uppercase text-slate-500 tracking-wider">
                        Fulfillment Option
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setCustomerDetails({ deliveryMethod: 'PICKUP' })}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition cursor-pointer ${
                            deliveryMethod === 'PICKUP'
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Store size={18} className="shrink-0" />
                          <span className="text-center sm:text-left">In-Store Pickup (Free)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setCustomerDetails({ deliveryMethod: 'DELIVERY' })}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-2 transition cursor-pointer ${
                            deliveryMethod === 'DELIVERY'
                              ? 'border-blue-600 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <Truck size={18} className="shrink-0" />
                          <span className="text-center sm:text-left">Delivery (+{formatMoney(deliveryFee)})</span>
                        </button>
                      </div>
                    </div>

                    {/* Customer Information Form */}
                    <form id="checkout-form" onSubmit={handlePlaceWhatsAppOrder} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Your Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Chimwemwe Phiri"
                          value={customerName}
                          onChange={(e) => setCustomerDetails({ customerName: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          WhatsApp Phone Number <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            required
                            placeholder="e.g. +265 991 234 567"
                            value={customerPhone}
                            onChange={(e) => setCustomerDetails({ customerPhone: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                          />
                        </div>
                      </div>

                      {deliveryMethod === 'DELIVERY' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Delivery Address / Street / Landmark <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Area 47 Sector 3, near Total Station"
                            value={deliveryAddress}
                            onChange={(e) => setCustomerDetails({ deliveryAddress: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          Purchase Notes (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Prefer afternoon pickup, or color preference"
                          value={notes}
                          onChange={(e) => setCustomerDetails({ notes: e.target.value })}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-600 outline-none"
                        />
                      </div>

                      {/* Legal Compliance & Disclaimer Box */}
                      <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-2">
                        <div className="flex items-start gap-2">
                          <ShieldCheck size={16} className="text-amber-700 shrink-0 mt-0.5" />
                          <p className="leading-snug">
                            <strong>Legal Notice:</strong> Submitting creates a purchase reservation request on WhatsApp. Purchases are finalized once stock and payment details are verified with our sales desk.
                          </p>
                        </div>
                        <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-amber-200/80">
                          <input
                            type="checkbox"
                            required
                            checked={agreedToTerms}
                            onChange={(e) => setCustomerDetails({ agreedToTerms: e.target.checked })}
                            className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 border-amber-300"
                          />
                          <span className="text-[10px] text-amber-800 leading-tight">
                            I accept the{' '}
                            <Link to="/terms" target="_blank" className="underline font-bold hover:text-blue-700">
                              Terms
                            </Link>{' '}
                            &{' '}
                            <Link to="/privacy" target="_blank" className="underline font-bold hover:text-blue-700">
                              Privacy Policy
                            </Link>
                            , and agree to be contacted via WhatsApp regarding this purchase.
                          </span>
                        </label>
                      </div>
                    </form>
                  </>
                )}
              </div>

              {/* Drawer Footer / Checkout CTA */}
              {cartItems.length > 0 && (
                <div className="p-5 border-t border-slate-200 bg-slate-50 space-y-3">
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-bold text-slate-900">{formatMoney(subtotal)}</span>
                    </div>
                    {deliveryMethod === 'DELIVERY' && (
                      <div className="flex justify-between">
                        <span>Estimated Delivery:</span>
                        <span className="font-bold text-slate-900">{formatMoney(deliveryFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                      <span>Total Amount:</span>
                      <span className="text-blue-600">{formatMoney(grandTotal)}</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    form="checkout-form"
                    disabled={orderSubmitting || !agreedToTerms}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    <MessageCircle size={18} />
                    <span>
                      {orderSubmitting ? 'Opening WhatsApp...' : `Buy via WhatsApp`}
                    </span>
                  </button>

                  <p className="text-[10px] text-center text-slate-400 font-medium">
                    Direct chat with {settings.companyName} sales desk &bull; Safe & Secure
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Post-Order Success Dialog */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="text-xl font-black text-slate-900">Purchase Confirmed!</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your purchase reference is <strong className="text-slate-900 font-mono">#{completedOrder.id}</strong>.
              WhatsApp has been launched with your itemized breakdown. Please press &quot;Send&quot; in WhatsApp to reach our sales team.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-800">
                <span>Amount:</span>
                <span>{formatMoney(completedOrder.total)}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Accepted Payments: Airtel Money, TNM Mpamba, NBS/National Bank, or Cash on Pickup.
              </p>
            </div>

            <button
              onClick={() => setCompletedOrder(null)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition"
            >
              Continue Browsing Store
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto bg-white border-t border-slate-200 py-8 px-4 text-center text-xs text-slate-500 space-y-3">
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-slate-600">
          <Link to="/terms" className="hover:text-blue-600 transition">Terms of Service</Link>
          <span>&bull;</span>
          <Link to="/privacy" className="hover:text-blue-600 transition">Privacy Policy</Link>
        </div>
        <p className="text-slate-600">
          &copy; 2026 {settings.companyName || 'MsikaFlo'}. All rights reserved.
        </p>
        <p className="text-[11px] text-slate-400 font-medium">
          Powered by MsikaFlo &bull; Indelible Technologies
        </p>
      </footer>
    </div>
  );
}
