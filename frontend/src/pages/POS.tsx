import { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useCartStore, useProductStore, type CartItem } from '../store/cartStore';
import { useSaleStore } from '../store/dataStore';
import { useStationeryStore, type StationeryService } from '../store/stationeryStore';
import { useSettingsStore } from '../store/settingsStore';
import { useAuthStore } from '../store/authStore';
import { Search, Plus, Minus, Trash2, AlertCircle, Clock, Save, X, ScanLine, Printer } from 'lucide-react';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import BarcodeScanner from '../components/BarcodeScanner';
import { generateInvoiceNumber } from '../utils/invoiceNumber';
import { toast } from 'sonner';

export default function POS() {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const [searchTerm, setSearchTerm] = useState(queryParams.get('search') || '');
  const [catFilter, setCatFilter] = useState(queryParams.get('category') || 'All');
  
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('0');
  const [customerId, setCustomerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creditInitialPayment, setCreditInitialPayment] = useState<number | ''>('');
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showHeldCarts, setShowHeldCarts] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const [receiptData, setReceiptData] = useState<null | {
    items: CartItem[]; subtotal: number; discount: number; taxAmount: number;
    taxName: string; taxType: string; total: number; paymentMethod: string;
    amountPaid: number; customerName?: string; customerPhone?: string; customerId?: string; invoiceNumber: string; dueDate?: string;
  }>(null);
  const [txStatus, setTxStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const cartSectionRef = useRef<HTMLDivElement>(null);
  const cartActionsRef = useRef<HTMLDivElement>(null);
  const prevCartLengthRef = useRef(0);

  const cart = useCartStore();
  const { products, isLoading: productsLoading } = useProductStore();
  const { addSale } = useSaleStore();
  const { services: stationeryServices, loadStationeryServices } = useStationeryStore();
  const settings = useSettingsStore();
  const { user } = useAuthStore();
  const { taxRate, taxName, taxType } = settings;

  const normalizeCategory = (cat: string) => {
    if (!cat) return '';
    const lower = cat.trim().toLowerCase();
    if (lower === 'general' || lower === 'stationery service') return '';
    if (lower === 'stationery' || lower === 'stationery items') return 'Stationery Items';
    return cat.trim();
  };

  const categories = ['All', ...Array.from(new Set(products.map(p => normalizeCategory(p.category)).filter(Boolean)))];

  const filteredProducts = products.filter(p => {
    if (p.isEquipment) return false;
    const pCat = normalizeCategory(p.category);
    if (!pCat) return false;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = catFilter === 'All' || pCat === catFilter;
    return matchSearch && matchCat;
  });

  // Stationery services filtered by search
  const filteredStationeryServices = stationeryServices.filter(s =>
    catFilter === 'All' || catFilter === 'Stationery Services'
      ? s.serviceName.toLowerCase().includes(searchTerm.toLowerCase())
      : false
  );

  const handleAddStationeryToCart = (svc: StationeryService) => {
    const matCost = svc.materialsUsed.reduce((sum, m) => {
      const product = products.find(p => p.id === m.inventoryItemId);
      return sum + (product?.costPrice || 0) * m.quantityPerUnit;
    }, 0);
    const unitCost = matCost + (svc.laborCost || 0) + (svc.electricityCost || 0) + (svc.otherOverheadCost || 0);

    const stockIssues = svc.materialsUsed.map(m => {
      const product = products.find(p => p.id === m.inventoryItemId);
      const needed = m.quantityPerUnit;
      const available = product?.stock || 0;
      return { name: product?.name || m.inventoryItemId, needed, available, ok: available >= needed };
    }).filter(x => !x.ok);

    if (stockIssues.length > 0) {
      playSound('error');
      toast.error(`Cannot add "${svc.serviceName}": Insufficient material stock (${stockIssues[0].name})`);
      return;
    }

    cart.addItem({
      id: `stationery_${svc.id}`,
      name: svc.serviceName,
      sku: 'STAT-SVC',
      unitPrice: svc.sellingPrice,
      costPrice: unitCost,
      quantity: 1,
      discount: 0,
      isService: true,
      materialsConsumed: svc.materialsUsed.map(m => {
        const product = products.find(p => p.id === m.inventoryItemId);
        return {
          inventoryItemId: m.inventoryItemId,
          quantityPerUnit: m.quantityPerUnit,
          name: product?.name || m.inventoryItemId
        };
      })
    });

    playSound('success');
    toast.success(`Added ${svc.serviceName} to cart`);
    setSearchTerm('');
  };

  const finalTotal = useMemo(() => {
    const baseTotal = cart.getTotal();
    if (taxRate > 0 && taxType === 'EXCLUSIVE') {
      return baseTotal + (baseTotal * (taxRate / 100));
    }
    return baseTotal;
  }, [cart.getTotal(), taxRate, taxType]);

  // Load stationery services when POS mounts (lazy-loaded page)
  useEffect(() => {
    loadStationeryServices();
  }, []);

  useEffect(() => {
    if (paymentMethod === 'CASH') {
      setAmountPaid(finalTotal || '');
    }
  }, [paymentMethod, finalTotal]);

  // Auto-scroll to action buttons whenever a new item is added on mobile
  useEffect(() => {
    if (cart.items.length > prevCartLengthRef.current && window.innerWidth < 1024) {
      setTimeout(() => {
        cartActionsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }
    prevCartLengthRef.current = cart.items.length;
  }, [cart.items.length]);

const playSound = (type: 'success' | 'error') => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
    }
  } catch (e) {
    console.error('Audio playback failed', e);
  }
};

  const handlePayNow = () => {
    setErrorMsg('');

    if (paymentMethod === 'CREDIT') {
      if (!customerName.trim() || !customerPhone.trim()) {
        playSound('error');
        setTxStatus({ type: 'error', message: 'Customer Name and Phone Number are required for Credit Sales!' });
        return;
      }
      if (customerPhone.length !== 10) {
        playSound('error');
        setTxStatus({ type: 'error', message: 'Phone number must be exactly 10 digits.' });
        return;
      }
      if (customerId && customerId.length !== 8) {
        playSound('error');
        setTxStatus({ type: 'error', message: 'National ID must be exactly 8 characters.' });
        return;
      }
    }

    const subtotal = cart.getSubtotal();
    const discount = cart.globalDiscount;
    const baseTotal = cart.getTotal();
    
    let taxAmount = 0;
    if (taxRate > 0) {
      if (taxType === 'EXCLUSIVE') {
        taxAmount = baseTotal * (taxRate / 100);
      } else {
        // INCLUSIVE
        taxAmount = baseTotal - (baseTotal / (1 + (taxRate / 100)));
      }
    }

    if (paymentMethod === 'CASH') {
      const paid = Number(amountPaid);
      if (paid < finalTotal) {
        playSound('error');
        setTxStatus({ type: 'error', message: `Amount paid (${settings.currency} ${paid.toLocaleString()}) cannot be less than the total (${settings.currency} ${finalTotal.toLocaleString()}).` });
        return;
      }
    }

    const invoiceNumber = generateInvoiceNumber();

    playSound('success');
    setTxStatus({ type: 'success', message: 'Transaction completed successfully!' });

    setIsSubmitting(true);
    setTimeout(async () => {
      setTxStatus(null);
      // Save receipt data and show preview modal (no auto-print)
      setReceiptData({
        items: [...cart.items],
        subtotal,
        discount,
        taxAmount,
        taxName,
        taxType,
        total: finalTotal,
        paymentMethod,
        amountPaid: paymentMethod === 'CREDIT' ? Number(creditInitialPayment || 0) : (paymentMethod === 'CASH' ? Number(amountPaid) : finalTotal),
        customerName: paymentMethod === 'CREDIT' ? customerName : '',
        customerPhone: paymentMethod === 'CREDIT' ? customerPhone : '',
        customerId: paymentMethod === 'CREDIT' ? customerId : '',
        dueDate: paymentMethod === 'CREDIT' ? dueDate : '',
        invoiceNumber,
      });

      try {
        await addSale({
          invoiceNumber,
          cashier: useAuthStore.getState().user?.name || 'Staff',
          items: cart.items.map(i => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            costPrice: i.costPrice || 0,
            productId: i.id,
            isService: i.isService || false,
            ...(i.materialsConsumed && i.materialsConsumed.length > 0 ? { materialsConsumed: i.materialsConsumed } : {})
          })),
          subtotal,
          discount,
          taxAmount,
          taxName,
          taxType,
          total: finalTotal,
          paymentMethod,
          amountPaid: paymentMethod === 'CREDIT' ? Number(creditInitialPayment || 0) : (paymentMethod === 'CASH' ? Number(amountPaid) : finalTotal),
          customerName: paymentMethod === 'CREDIT' ? customerName : '',
          customerPhone: paymentMethod === 'CREDIT' ? customerPhone : '',
          customerId: paymentMethod === 'CREDIT' ? customerId : '',
          dueDate: paymentMethod === 'CREDIT' ? (dueDate || '') : '',
          isCredit: paymentMethod === 'CREDIT',
        });
        
        toast.success('Sale completed successfully');
      } catch (err: any) {
        if (err.message === 'OFFLINE_QUEUED') {
          toast.warning('Offline', { description: 'Sale queued and will sync when online' });
        } else {
          toast.error('Sale failed', { description: err.message || 'Unknown error' });
          return;
        }
      }

      cart.clearCart();
      setCustomerName('');
      setCustomerPhone('0');
      setCustomerId('');
      setDueDate('');
      setAmountPaid('');
      setCreditInitialPayment('');
      setIsSubmitting(false);
    }, 50);
  };

  // Use a ref to keep the latest values without re-binding the event listener on every render
  const shortcutsRef = useRef({ handlePayNow, cart, showHeldCarts, setShowHeldCarts, isSubmitting, searchInputRef, receiptData, handleHoldCart: () => {} });
  useEffect(() => {
    shortcutsRef.current = { handlePayNow, cart, showHeldCarts, setShowHeldCarts, isSubmitting, searchInputRef, receiptData, handleHoldCart };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const { handlePayNow, cart, showHeldCarts, setShowHeldCarts, isSubmitting, searchInputRef, receiptData, handleHoldCart } = shortcutsRef.current;
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select';

      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F8' || (e.key === 'Enter' && !isTyping && cart.items.length > 0 && !receiptData && !showHeldCarts)) {
        e.preventDefault();
        if (cart.items.length > 0 && !isSubmitting) handlePayNow();
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.items.length > 0) {
          handleHoldCart();
        }
      } else if (e.key === 'F10') {
        e.preventDefault();
        cart.clearCart();
      } else if (e.key === 'Escape') {
        setShowHeldCarts(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleBarcodeScan = (scannedSku: string) => {
    // Find the product that matches the SKU exactly
    const product = products.find(p => p.sku === scannedSku);
    if (product) {
      if (!product.isService && product.stock <= 0) {
        toast.error('Out of stock', { description: `${product.name} has 0 stock remaining.` });
      } else {
        cart.addItem({
          id: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.sellingPrice,
          quantity: 1,
          discount: 0,
          isService: product.isService,
        });
        toast.success('Added to cart', { description: product.name });
      }
    } else {
      toast.error('Product not found', { description: `No product matches SKU: ${scannedSku}` });
    }
    setSearchTerm('');
    setShowScanner(false);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Hardware scanners typically append 'Enter' after typing the barcode rapidly
      if (searchTerm) {
        handleBarcodeScan(searchTerm);
      }
    }
  };

  const handleHoldCart = () => {
    // Automatically generate a 4-digit order number for the held cart
    const orderNumber = Math.floor(1000 + Math.random() * 9000);
    const name = `Order #${orderNumber}`;
    
    cart.holdCart(user?.id || 'unknown', name);
    setPaymentMethod('CASH');
    toast.success('Cart held successfully', { description: name });
  };

  const productSectionRef = useRef<HTMLDivElement>(null);

  const handleNewSale = () => {
    if (window.innerWidth < 1024) {
      productSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
      // Don't focus search on mobile — avoids triggering the virtual keyboard
    } else {
      // Only auto-focus search on desktop where there's a physical keyboard
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  return (
    <div className="flex h-full flex-col p-3 md:p-4 bg-background">
      <h1 className="text-xl md:text-3xl font-bold mb-3 md:mb-4 text-primary">Point of Sale</h1>
      
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span className="font-medium text-sm">{errorMsg}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row flex-1 gap-6 overflow-y-auto lg:overflow-hidden pb-20 md:pb-0">
        {/* Product Selection Area */}
        <div ref={productSectionRef} className="flex-1 bg-card rounded-lg shadow border p-4 flex flex-col min-h-[500px] lg:min-h-0">
          <div className="relative mb-3 flex items-center">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search products or services by name or SKU... (F2)"
              className="w-full pl-10 pr-12 py-2 border rounded-md focus:ring-2 focus:ring-primary outline-none"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            <button 
              onClick={() => setShowScanner(true)}
              className="absolute right-2 top-2 p-1 text-gray-500 hover:text-primary hover:bg-blue-50 rounded transition"
              title="Scan Barcode"
            >
              <ScanLine size={20} />
            </button>
          </div>

          {showScanner && (
            <BarcodeScanner 
              onScan={handleBarcodeScan} 
              onClose={() => setShowScanner(false)} 
            />
          )}

          {/* Category Tabs */}
          <div className="flex gap-2 flex-wrap mb-3">
            {categories.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1 rounded-full text-xs font-semibold transition ${catFilter === c ? 'bg-primary text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {c}
              </button>
            ))}
            {stationeryServices.length > 0 && (
              <button
                onClick={() => setCatFilter('Stationery Services')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                  catFilter === 'Stationery Services' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                }`}
              >
                <Printer size={11} /> Stationery Services
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-auto grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 auto-rows-max">
            {productsLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="border p-3 rounded-lg h-32 bg-gray-100 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-5 bg-gray-200 rounded w-1/3 mt-auto"></div>
                </div>
              ))
            ) : (filteredProducts.length === 0 && filteredStationeryServices.length === 0) ? (
              <div className="col-span-4 text-center py-12 text-gray-400">No items found.</div>
            ) : (
              <>
                {filteredProducts.map(product => {
                  const outOfStock = !product.isService && product.stock === 0;
                  return (
                    <div
                      key={product.id}
                      onClick={() => {
                        if (!outOfStock) {
                          cart.addItem({ id: product.id, name: product.name, sku: product.sku, unitPrice: product.sellingPrice, costPrice: product.costPrice || 0, quantity: 1, discount: 0, isService: product.isService });
                          setSearchTerm('');
                        }
                      }}
                      className={`border p-3 rounded-lg flex flex-col justify-between h-32 transition ${
                        outOfStock
                          ? 'opacity-50 cursor-not-allowed bg-gray-50'
                          : 'cursor-pointer hover:border-primary hover:shadow-md bg-white'
                      }`}
                    >
                      <div>
                        <h3 className="font-semibold text-sm line-clamp-2">{product.name}</h3>
                        <span className="text-xs text-gray-500">{product.sku}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="font-bold text-primary text-sm">{settings.currency} {product.sellingPrice.toLocaleString()}</div>
                        {!product.isService && (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                            (!product.isEquipment && product.stock <= product.reorderLevel) ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                          }`}>
                            {product.isEquipment ? `Asset: ${product.stock}` : `${product.stock} in stock`}
                          </span>
                        )}
                        {product.isService && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">Service</span>}
                      </div>
                      {outOfStock && <div className="text-xs text-red-500 font-semibold text-center">Out of Stock</div>}
                    </div>
                  );
                })}

                {/* Stationery Service Cards */}
                {filteredStationeryServices.map(svc => (
                  <div
                    key={svc.id}
                    onClick={() => handleAddStationeryToCart(svc)}
                    className="border-2 border-blue-200 p-3 rounded-lg flex flex-col justify-between h-32 cursor-pointer hover:border-blue-500 hover:shadow-md bg-blue-50 transition"
                  >
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Printer size={12} className="text-blue-600" />
                        <span className="text-[10px] font-semibold text-blue-600 uppercase">Stationery</span>
                      </div>
                      <h3 className="font-semibold text-sm line-clamp-2">{svc.serviceName}</h3>
                    </div>
                    <div className="flex justify-between items-end">
                      <div className="font-bold text-blue-700 text-sm">{settings.currency} {svc.sellingPrice.toLocaleString()}/unit</div>
                      <Plus size={16} className="text-blue-500" />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
        
        {/* Cart & Checkout Area */}
        <div ref={cartSectionRef} className="w-full lg:w-[400px] bg-card rounded-lg shadow border flex flex-col flex-shrink-0 min-h-[600px] lg:min-h-0">
          <div className="p-4 border-b bg-gray-50 rounded-t-lg flex justify-between items-center">
            <h2 className="font-bold text-lg">Current Sale</h2>
            <div className="flex gap-2">
              {cart.heldCarts.length > 0 && (
                <button 
                  onClick={() => setShowHeldCarts(true)}
                  className="flex items-center gap-1 text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition font-medium"
                >
                  <Clock size={16} />
                  <span>{cart.heldCarts.length} Held</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {cart.items.length === 0 ? (
              <div className="text-center text-gray-500 mt-10">Cart is empty</div>
            ) : (
              cart.items.map((item: CartItem) => (
                <div key={item.id} className="flex justify-between items-start border-b pb-4">
                  <div className="flex-1">
                    <h4 className="font-medium">{item.name}</h4>
                    <div className="text-sm text-gray-500">{settings.currency} {item.unitPrice.toLocaleString()}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => cart.updateQuantity(item.id, item.quantity - 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200">
                        <Minus size={16} />
                      </button>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={(e) => cart.updateQuantity(item.id, Number(e.target.value) || 1)}
                        onFocus={(e) => e.target.select()}
                        className="w-12 text-center font-medium border rounded outline-none p-1 no-spinners"
                      />
                      <button onClick={() => cart.updateQuantity(item.id, item.quantity + 1)} className="p-1 bg-gray-100 rounded hover:bg-gray-200">
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between ml-4">
                    <button onClick={() => cart.removeItem(item.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 size={18} />
                    </button>
                    <div className="font-bold mt-4 text-right">
                      {settings.currency} {((item.unitPrice * item.quantity) - item.discount).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="border-t bg-gray-50 rounded-b-lg flex flex-col flex-shrink-0">
            <div className="p-4 overflow-y-auto max-h-[45vh] space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{settings.currency} {cart.getSubtotal().toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Discount</span>
                  <div className="flex items-center gap-1">
                    <span className="text-sm">{settings.currency}</span>
                    <input 
                      type="number"
                      value={cart.globalDiscount || ''}
                      onChange={e => cart.setGlobalDiscount(parseFloat(e.target.value) || 0)}
                      onFocus={e => e.target.select()}
                      className="w-24 text-right border rounded px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                      placeholder="0"
                      min={0}
                    />
                  </div>
                </div>
                
                {(() => {
                  const baseTotal = cart.getTotal();
                  let taxAmount = 0;
                  let finalTotal = baseTotal;

                  if (taxRate > 0) {
                    if (taxType === 'EXCLUSIVE') {
                      taxAmount = baseTotal * (taxRate / 100);
                      finalTotal = baseTotal + taxAmount;
                      return (
                        <>
                          <div className="flex justify-between text-gray-600">
                            <span>{taxName} ({taxRate}%)</span>
                            <span>{settings.currency} {taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between font-bold text-2xl text-primary pt-2 border-t mt-2">
                            <span>Total</span>
                            <span>{settings.currency} {finalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      );
                    } else {
                      taxAmount = baseTotal - (baseTotal / (1 + (taxRate / 100)));
                      return (
                        <>
                          <div className="flex justify-between text-gray-500 text-sm">
                            <span>Includes {taxName} ({taxRate}%)</span>
                            <span>{settings.currency} {taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between font-bold text-2xl text-primary pt-2 border-t mt-2">
                            <span>Total</span>
                            <span>{settings.currency} {finalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      );
                    }
                  }

                  return (
                    <div className="flex justify-between font-bold text-2xl text-primary pt-2 border-t mt-2">
                      <span>Total</span>
                      <span>{settings.currency} {finalTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  );
                })()}


              </div>

              {/* Payment Method Selector */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-2">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setPaymentMethod('CASH')}
                      className={`py-2 px-3 text-sm font-bold rounded-lg border-2 transition ${paymentMethod === 'CASH' ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      Cash
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('MOMO_AIRTEL')}
                      className={`py-2 px-3 text-sm font-bold rounded-lg border-2 transition ${paymentMethod.startsWith('MOMO') ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      MoMo
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('BANK_NBS')}
                      className={`py-2 px-3 text-sm font-bold rounded-lg border-2 transition ${paymentMethod.startsWith('BANK') ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      Bank
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('CREDIT')}
                      className={`py-2 px-3 text-sm font-bold rounded-lg border-2 transition ${paymentMethod === 'CREDIT' ? 'border-primary bg-blue-50 text-primary' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                    >
                      Credit
                    </button>
                  </div>
                </div>

                {/* Conditional MoMo Sub-Selector */}
                {paymentMethod.startsWith('MOMO') && (
                  <div className="flex gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <button 
                      onClick={() => setPaymentMethod('MOMO_AIRTEL')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${paymentMethod === 'MOMO_AIRTEL' ? 'bg-red-500 text-white shadow-sm' : 'bg-white text-red-600 border border-red-200 hover:bg-red-50'}`}
                    >
                      Airtel Money
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('MOMO_MPAMBA')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${paymentMethod === 'MOMO_MPAMBA' ? 'bg-green-600 text-white shadow-sm' : 'bg-white text-green-700 border border-green-200 hover:bg-green-50'}`}
                    >
                      TNM Mpamba
                    </button>
                  </div>
                )}

                {/* Conditional Bank Sub-Selector */}
                {paymentMethod.startsWith('BANK') && (
                  <div className="flex gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <button 
                      onClick={() => setPaymentMethod('BANK_NBS')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${paymentMethod === 'BANK_NBS' ? 'bg-red-600 text-white shadow-sm' : 'bg-white text-red-700 border border-red-200 hover:bg-red-50'}`}
                    >
                      NBS Bank
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('BANK_NBM')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-md transition ${paymentMethod === 'BANK_NBM' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'}`}
                    >
                      National Bank (NBM)
                    </button>
                  </div>
                )}

                {/* Conditional Credit Sale Inputs */}
                {paymentMethod === 'CREDIT' && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2.5">
                    <div className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Credit Customer Details</div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Customer Full Name *</label>
                      <input 
                        type="text" 
                        placeholder="e.g. John Doe" 
                        className="w-full p-2 text-sm border rounded bg-white"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePayNow()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number * (10 digits)</label>
                      <input 
                        type="tel" 
                        placeholder="e.g. 0991234567" 
                        className="w-full p-2 text-sm border rounded bg-white"
                        value={customerPhone}
                        onChange={e => {
                          let val = e.target.value.replace(/\D/g, '');
                          // Ensure starts with 0
                          if (!val.startsWith('0')) val = '0' + val;
                          // Max 10 digits
                          if (val.length > 10) val = val.slice(0, 10);
                          setCustomerPhone(val);
                        }}
                        onKeyDown={e => e.key === 'Enter' && handlePayNow()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">National ID <span className="font-normal text-gray-500">(8 chars, optional)</span></label>
                      <input 
                        type="text" 
                        placeholder="e.g. A1B2C3D4" 
                        className="w-full p-2 text-sm border rounded bg-white uppercase tracking-widest"
                        maxLength={8}
                        value={customerId}
                        onChange={e => {
                          // Only allow letters and numbers, auto uppercase
                          const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                          setCustomerId(val);
                        }}
                        onKeyDown={e => e.key === 'Enter' && handlePayNow()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Due Date</label>
                      <input 
                        type="date" 
                        className="w-full p-2 text-sm border rounded text-gray-600 bg-white"
                        value={dueDate}
                        onChange={e => setDueDate(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handlePayNow()}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Initial Payment Amount (Optional)</label>
                      <input 
                        type="number" 
                        placeholder={`e.g. 5000`} 
                        className="w-full p-2 text-sm border rounded bg-white"
                        value={creditInitialPayment}
                        onChange={e => setCreditInitialPayment(e.target.value === '' ? '' : Number(e.target.value))}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => e.key === 'Enter' && handlePayNow()}
                      />
                    </div>
                  </div>
                )}

                {/* Cash Payment Details */}
                {paymentMethod === 'CASH' && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg space-y-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Amount Paid ({settings.currency})</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 10000" 
                        className="w-full p-2 text-sm border border-green-300 rounded font-bold"
                        value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value === '' ? '' : Number(e.target.value))}
                        onFocus={e => e.target.select()}
                        onKeyDown={e => e.key === 'Enter' && handlePayNow()}
                      />
                    </div>
                    {amountPaid !== '' && Number(amountPaid) >= (taxType === 'EXCLUSIVE' ? cart.getTotal() * (1 + taxRate/100) : cart.getTotal()) && (
                      <div className="flex justify-between items-center text-sm font-bold text-green-700 bg-green-100 p-2 rounded">
                        <span>Change Due:</span>
                        <span className="text-lg">{settings.currency} {(Number(amountPaid) - (taxType === 'EXCLUSIVE' ? cart.getTotal() * (1 + taxRate/100) : cart.getTotal())).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div ref={cartActionsRef} className="p-4 border-t grid grid-cols-3 gap-2 bg-gray-100 rounded-b-lg">
              <button 
                onClick={cart.clearCart}
                className="p-3 border text-gray-700 rounded-lg font-medium hover:bg-gray-100 transition flex flex-col items-center justify-center gap-1"
              >
                <span>Clear</span>
                <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">F10</span>
              </button>
              <button 
                onClick={handleHoldCart}
                disabled={cart.items.length === 0}
                className="p-3 border text-amber-700 border-amber-200 bg-amber-50 rounded-lg font-medium hover:bg-amber-100 transition disabled:opacity-50 flex flex-col items-center justify-center gap-1"
              >
                <div className="flex items-center justify-center gap-1">
                  <Save size={18} />
                  Hold
                </div>
                <span className="text-[10px] text-amber-600 bg-amber-200 px-1.5 py-0.5 rounded">F9</span>
              </button>
              <button 
                onClick={handlePayNow}
                className={`p-3 text-white rounded-lg font-bold transition shadow-md disabled:opacity-50 flex flex-col items-center justify-center gap-1 ${
                  paymentMethod === 'CREDIT' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-primary hover:bg-blue-700'
                }`}
                disabled={cart.items.length === 0 || isSubmitting}
              >
                <span>{isSubmitting ? 'Processing...' : paymentMethod === 'CREDIT' ? 'Complete Credit Sale' : 'Pay Now'}</span>
                <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded text-white font-normal">F8</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Held Carts Modal */}
      {showHeldCarts && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowHeldCarts(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <Clock size={20} className="text-primary" />
                Held Carts
              </h2>
              <button onClick={() => setShowHeldCarts(false)} className="text-gray-500 hover:bg-gray-100 p-1 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {cart.heldCarts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No held carts.</div>
              ) : (
                cart.heldCarts.map(hc => (
                  <div key={hc.id} className="border rounded-lg p-3 hover:border-primary transition group">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold">{hc.name}</div>
                        <div className="text-xs text-gray-500">{new Date(hc.timestamp).toLocaleTimeString()} - {hc.items.length} items</div>
                      </div>
                      <div className="font-bold text-primary">{settings.currency} {(hc.items.reduce((s, i) => s + (i.unitPrice * i.quantity) - i.discount, 0) - hc.globalDiscount).toLocaleString()}</div>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      {cart.items.length > 0 ? (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { handleHoldCart(); cart.restoreCart(user?.id || 'unknown', hc.id); setShowHeldCarts(false); }} 
                            className="px-3 py-1.5 text-sm border border-blue-200 text-blue-700 bg-blue-50 rounded font-medium hover:bg-blue-100 transition whitespace-nowrap"
                          >
                            Hold current & Restore
                          </button>
                          <button 
                            onClick={() => { cart.restoreCart(user?.id || 'unknown', hc.id); setShowHeldCarts(false); }} 
                            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition whitespace-nowrap shadow-sm"
                          >
                            Restore Only
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => {
                            cart.restoreCart(user?.id || 'unknown', hc.id);
                            setShowHeldCarts(false);
                          }}
                          className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded font-medium hover:bg-blue-700 transition shadow-sm"
                        >
                          Restore Cart
                        </button>
                      )}
                      <button 
                        onClick={() => cart.removeHeldCart(user?.id || 'unknown', hc.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded transition"
                        title="Discard held cart"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {/* Transaction Status Modal */}
      {txStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onMouseDown={() => setTxStatus(null)}>
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full mx-4 text-center transform animate-in zoom-in duration-200" onMouseDown={e => e.stopPropagation()}>
            {txStatus.type === 'success' ? (
              <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            ) : (
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mb-6">
                <X className="w-12 h-12 text-red-500" strokeWidth={3} />
              </div>
            )}
            <h2 className={`text-2xl font-extrabold mb-2 ${txStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {txStatus.type === 'success' ? 'Success!' : 'Transaction Failed'}
            </h2>
            <p className="text-gray-600 text-lg mb-6">{txStatus.message}</p>
            {txStatus.type === 'error' && (
              <button onClick={() => setTxStatus(null)} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition">
                Dismiss
              </button>
            )}
          </div>
        </div>
      )}

      {receiptData && (
        <ReceiptPreviewModal
          {...receiptData}
          onClose={() => setReceiptData(null)}
          onNewSale={handleNewSale}
        />
      )}
    </div>
  )
}

