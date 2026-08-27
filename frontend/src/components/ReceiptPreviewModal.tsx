import { useRef, useState, useEffect } from 'react';
import { Printer, MessageCircle, X, FileText, Receipt, ShoppingCart } from 'lucide-react';
import { useSettingsStore } from '../store/settingsStore';
import type { CartItem } from '../store/cartStore';
import html2canvas from 'html2canvas';

interface ReceiptPreviewModalProps {
  items: CartItem[];
  subtotal: number;
  discount: number;
  taxAmount: number;
  taxName: string;
  taxType: string;
  total: number;
  paymentMethod: string;
  amountPaid: number;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  invoiceNumber: string;
  dueDate?: string;
  onClose: () => void;
  onNewSale?: () => void;
}

export default function ReceiptPreviewModal({
  items, subtotal, discount, taxAmount, taxName, taxType, total,
  paymentMethod, amountPaid, customerName, customerPhone, customerId, invoiceNumber, dueDate, onClose, onNewSale
}: ReceiptPreviewModalProps) {
  const [view, setView] = useState<'receipt' | 'invoice'>('receipt');
  const [sharing, setSharing] = useState(false);
  const settings = useSettingsStore();
  const previewRef = useRef<HTMLDivElement>(null);
  const date = new Date().toLocaleString('en-GB');
  const change = paymentMethod === 'CASH' ? amountPaid - total : 0;
  
  // Clean incoming ID to prevent double prefixing if old data had INV- hardcoded
  const rawId = invoiceNumber.replace(/^(RCP-|INV-)/, '');
  const docNumber = view === 'receipt' ? `RCP-${rawId}` : `INV-${rawId}`;

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handlePrint = () => {
    const el = previewRef.current;
    if (!el) return;
    const printWin = window.open('', '_blank', 'width=500,height=800');
    if (!printWin) return;
    printWin.document.write(`
      <html><head><title>${view === 'receipt' ? 'Receipt' : 'Invoice'} - ${docNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: monospace; }
        @media print { @page { margin: 15mm; } body { padding: 10mm; } }
      </style>
      </head><body>${el.innerHTML}</body></html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); printWin.close(); }, 400);
  };

  const handleWhatsApp = async () => {
    const el = previewRef.current;
    if (!el) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      canvas.toBlob(async (blob) => {
        if (!blob) { setSharing(false); return; }
        const file = new File([blob], `${docNumber}.png`, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `${view === 'receipt' ? 'Receipt' : 'Invoice'} ${docNumber}`, text: `${settings.companyName} - ${docNumber}` });
        } else {
          // Fallback: download image + open WhatsApp web
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${docNumber}.png`;
          a.click();
          URL.revokeObjectURL(url);
          const msg = encodeURIComponent(`${settings.companyName}\n${view === 'receipt' ? 'Receipt' : 'Invoice'}: ${docNumber}\nTotal: ${settings.currency} ${total.toLocaleString()}\nDate: ${date}`);
          window.open(`https://wa.me/?text=${msg}`, '_blank');
        }
        setSharing(false);
      }, 'image/png');
    } catch {
      setSharing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setView('receipt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition ${view === 'receipt' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Receipt size={15} /> Receipt
            </button>
            <button
              onClick={() => setView('invoice')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition ${view === 'invoice' ? 'bg-white shadow text-primary' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <FileText size={15} /> Invoice
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* Preview Area */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          {view === 'receipt' ? (
            <div ref={previewRef} style={{ background: '#fff', fontFamily: 'monospace', padding: '24px 20px', maxWidth: '320px', margin: '0 auto', fontSize: '13px' }}>
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #000', paddingBottom: '12px', marginBottom: '12px' }}>
                {settings.companyLogo && <img src={settings.companyLogo} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 8px' }} />}
                <div style={{ fontWeight: 'bold', fontSize: '16px' }}>{settings.companyName}</div>
                {settings.address && <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{settings.address}</div>}
                {settings.phone && <div style={{ fontSize: '11px', color: '#555' }}>Tel: {settings.phone}</div>}
                {settings.taxNumber && <div style={{ fontSize: '11px', color: '#555' }}>TPIN: {settings.taxNumber}</div>}
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#777' }}>{date}</div>
                <div style={{ fontWeight: 'bold', fontSize: '12px', marginTop: '2px' }}>{docNumber}</div>
              </div>

              {customerName && (
                <div style={{ borderBottom: '1px dashed #000', paddingBottom: '8px', marginBottom: '8px', fontSize: '12px' }}>
                  <div><strong>Customer:</strong> {customerName}</div>
                  {customerPhone && <div><strong>Phone:</strong> {customerPhone}</div>}
                  {customerId && <div><strong>ID:</strong> {customerId}</div>}
                  {paymentMethod === 'CREDIT' && dueDate && <div><strong>Due Date:</strong> {new Date(dueDate).toLocaleDateString('en-GB')}</div>}
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td style={{ padding: '3px 0', verticalAlign: 'top' }}>
                        <div>{item.name}</div>
                        <div style={{ color: '#777', fontSize: '11px' }}>{item.quantity} × {settings.currency} {item.unitPrice.toLocaleString()}</div>
                      </td>
                      <td style={{ padding: '3px 0', textAlign: 'right', fontWeight: 'bold', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        {settings.currency} {((item.quantity * item.unitPrice) - item.discount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ borderTop: '1px dashed #000', paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{settings.currency} {subtotal.toLocaleString()}</span></div>
                {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Discount</span><span>- {settings.currency} {discount.toLocaleString()}</span></div>}
                {taxAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555' }}>
                    <span>{taxType === 'INCLUSIVE' ? `Incl. ${taxName}` : taxName}</span>
                    <span>{settings.currency} {taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '16px', borderTop: '1px dashed #000', marginTop: '6px', paddingTop: '6px' }}>
                  <span>TOTAL</span><span>{settings.currency} {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Payment</span><span>{paymentMethod.replace('MOMO_', 'MoMo ').replace('BANK_', '').replace('_', ' ')}</span></div>
                  {paymentMethod === 'CASH' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid</span><span>{settings.currency} {amountPaid.toLocaleString()}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}><span>Change</span><span>{settings.currency} {change.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                    </>
                  )}
                  {paymentMethod === 'CREDIT' && (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Paid</span><span>{settings.currency} {amountPaid.toLocaleString()}</span></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: '#b45309' }}><span>Balance Due</span><span>{settings.currency} {(total - amountPaid).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>
                      <div style={{ color: '#b45309', fontWeight: 'bold', textAlign: 'center', marginTop: '4px' }}>⚠ CREDIT SALE</div>
                    </>
                  )}
                  {paymentMethod === 'BANK_NBS' && settings.nbsDetails && <div style={{ marginTop: '4px', textAlign: 'center', fontSize: '11px', padding: '4px', border: '1px dashed #ccc' }}>NBS Bank: {settings.nbsDetails}</div>}
                  {paymentMethod === 'BANK_NBM' && settings.nbmDetails && <div style={{ marginTop: '4px', textAlign: 'center', fontSize: '11px', padding: '4px', border: '1px dashed #ccc' }}>National Bank: {settings.nbmDetails}</div>}
                  {paymentMethod === 'MOMO_AIRTEL' && settings.airtelNumber && <div style={{ marginTop: '4px', textAlign: 'center', fontSize: '11px', padding: '4px', border: '1px dashed #ccc' }}>Airtel Money: {settings.airtelNumber}</div>}
                  {paymentMethod === 'MOMO_MPAMBA' && settings.mpambaNumber && <div style={{ marginTop: '4px', textAlign: 'center', fontSize: '11px', padding: '4px', border: '1px dashed #ccc' }}>TNM Mpamba: {settings.mpambaNumber}</div>}
                </div>
              </div>

              <div style={{ textAlign: 'center', marginTop: '16px', borderTop: '1px dashed #000', paddingTop: '12px', fontSize: '11px', color: '#777' }}>
                <div>Thank you for your business!</div>
                <div>Goods once sold are not returnable.</div>
                {settings.email && <div style={{ marginTop: '4px' }}>{settings.email}</div>}
                <div style={{ marginTop: '12px', fontSize: '9px', fontWeight: '500', color: '#999', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  MsikaFlo. One System. Total Control.<br />
                  Powered by Indelible Technologies
                </div>
              </div>
            </div>
          ) : (
            /* Invoice View */
            <div ref={previewRef} style={{ background: '#fff', fontFamily: 'Arial, sans-serif', padding: '32px', maxWidth: '480px', margin: '0 auto', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  {settings.companyLogo && <img src={settings.companyLogo} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', marginBottom: '8px' }} />}
                  <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{settings.companyName}</div>
                  {settings.address && <div style={{ color: '#666', fontSize: '12px' }}>{settings.address}</div>}
                  {settings.phone && <div style={{ color: '#666', fontSize: '12px' }}>{settings.phone}</div>}
                  {settings.email && <div style={{ color: '#666', fontSize: '12px' }}>{settings.email}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#1d4ed8' }}>INVOICE</div>
                  <div style={{ color: '#666', fontSize: '12px' }}>{docNumber}</div>
                  <div style={{ color: '#666', fontSize: '12px', marginTop: '4px' }}>{date}</div>
                </div>
              </div>

              {customerName && (
                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#1d4ed8' }}>Bill To:</div>
                  <div style={{ fontWeight: 'bold' }}>{customerName}</div>
                  {customerPhone && <div style={{ color: '#666' }}>{customerPhone}</div>}
                  {paymentMethod === 'CREDIT' && dueDate && <div style={{ color: '#b45309', marginTop: '4px', fontWeight: 'bold' }}>Due Date: {new Date(dueDate).toLocaleDateString('en-GB')}</div>}
                </div>
              )}

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                <thead>
                  <tr style={{ background: '#1d4ed8', color: '#fff' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: '600', fontSize: '12px' }}>Item</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', fontWeight: '600', fontSize: '12px' }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', fontSize: '12px' }}>Unit Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '600', fontSize: '12px' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                      <td style={{ padding: '8px 12px', fontSize: '12px' }}>{item.name}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px' }}>{item.quantity}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px' }}>{settings.currency} {item.unitPrice.toLocaleString()}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 'bold', fontSize: '12px' }}>{settings.currency} {((item.quantity * item.unitPrice) - item.discount).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ minWidth: '220px', fontSize: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: '#666' }}>Subtotal</span><span>{settings.currency} {subtotal.toLocaleString()}</span></div>
                  {discount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: '#666' }}>Discount</span><span>- {settings.currency} {discount.toLocaleString()}</span></div>}
                  {taxAmount > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span style={{ color: '#666' }}>{taxType === 'INCLUSIVE' ? `Includes ${taxName}` : taxName}</span><span>{settings.currency} {taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></div>}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: '#1d4ed8', color: '#fff', borderRadius: '6px', marginTop: '6px', fontWeight: 'bold', fontSize: '14px' }}>
                    <span>TOTAL DUE</span><span>{settings.currency} {total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                  </div>
                  <div style={{ marginTop: '6px', padding: '5px 12px', background: '#fef9c3', borderRadius: '6px', fontSize: '11px', color: '#92400e', textAlign: 'center', fontWeight: '600' }}>
                    Payment Due Upon Receipt
                  </div>
                </div>
              </div>
              
              {/* Payment Instructions for Invoice */}
              {(settings.nbsDetails || settings.nbmDetails || settings.airtelNumber || settings.mpambaNumber) && (
                <div style={{ marginTop: '24px', padding: '12px', background: '#f8fafc', borderRadius: '8px', fontSize: '12px' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1d4ed8' }}>Payment Instructions</div>
                  {settings.nbsDetails && <div style={{ marginBottom: '4px' }}><strong>NBS Bank:</strong> {settings.nbsDetails}</div>}
                  {settings.nbmDetails && <div style={{ marginBottom: '4px' }}><strong>National Bank:</strong> {settings.nbmDetails}</div>}
                  {settings.airtelNumber && <div style={{ marginBottom: '4px' }}><strong>Airtel Money:</strong> {settings.airtelNumber}</div>}
                  {settings.mpambaNumber && <div><strong>TNM Mpamba:</strong> {settings.mpambaNumber}</div>}
                </div>
              )}

              <div style={{ marginTop: '24px', borderTop: '1px solid #e5e7eb', paddingTop: '12px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
                {settings.taxNumber && <div>TPIN: {settings.taxNumber} · {settings.companyName}</div>}
                <div style={{ marginTop: '8px', fontWeight: '500', color: '#6b7280', WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                  MsikaFlo. One System. Total Control. | Powered by Indelible Technologies
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-4 border-t bg-gray-50 rounded-b-2xl flex flex-col gap-2 shrink-0">
          {onNewSale && (
            <button
              onClick={() => { onClose(); onNewSale(); }}
              className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-blue-700 text-white font-bold py-3 text-sm rounded-xl transition shadow-sm"
            >
              <ShoppingCart size={18} /> New Sale
            </button>
          )}
          <div className="flex gap-2.5">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-800 text-white font-medium py-1.5 px-3 text-xs rounded-lg transition"
            >
              <Printer size={14} /> Print Receipt
            </button>
            <button
              onClick={handleWhatsApp}
              disabled={sharing}
              className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white font-medium py-1.5 px-3 text-xs rounded-lg transition disabled:opacity-60"
            >
              <MessageCircle size={14} />
              {sharing ? 'Capturing...' : 'Share WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
