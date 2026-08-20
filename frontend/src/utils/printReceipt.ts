import { useSettingsStore } from '../store/settingsStore';

export const printReceipt = (
  cartItems: any[], 
  subtotal: number, 
  discount: number, 
  total: number, 
  paymentMethod: string, 
  amountPaid: number,
  taxAmount: number = 0,
  taxName: string = '',
  taxType: string = 'EXCLUSIVE'
) => {
  const receiptWindow = window.open('', '_blank', 'width=400,height=600');
  
  if (!receiptWindow) return;
  
  const settings = useSettingsStore.getState();
  const date = new Date().toLocaleString();
  const invoiceNumber = `INV-${Math.floor(Math.random() * 1000000)}`;

  const itemsHtml = cartItems.map(item => `
    <tr>
      <td style="padding: 4px 0;">${item.name} <br> <small>${item.quantity} x ${item.unitPrice}</small></td>
      <td style="text-align: right; padding: 4px 0;">${(item.quantity * item.unitPrice).toLocaleString()}</td>
    </tr>
  `).join('');

  const html = `
    <html>
      <head>
        <title>Receipt - ${invoiceNumber}</title>
        <style>
          body { font-family: monospace; padding: 20px; font-size: 14px; max-width: 350px; margin: 0 auto; color: #000; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: bold; }
          .border-bottom { border-bottom: 1px dashed #000; margin: 10px 0; padding-bottom: 10px; }
          .mb { margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; }
          .logo { width: 80px; height: 80px; margin: 0 auto 10px auto; display: block; filter: grayscale(100%); border-radius: 50%; object-fit: cover; }
        </style>
      </head>
      <body>
        ${settings.companyLogo ? `<img src="${settings.companyLogo}" class="logo" />` : ''}
        <div class="text-center mb border-bottom">
          <h2 style="margin: 0;">${settings.companyName || 'MsikaFlo'}</h2>
          ${settings.address ? `<p style="margin: 4px 0;">${settings.address}</p>` : ''}
          ${settings.phone ? `<p style="margin: 4px 0;">Tel: ${settings.phone}</p>` : ''}
          ${settings.taxNumber ? `<p style="margin: 4px 0;">TPIN: ${settings.taxNumber}</p>` : ''}
          <p style="margin: 4px 0;">Date: ${date}</p>
          <p style="margin: 4px 0;">Invoice: ${invoiceNumber}</p>
        </div>
        
        <div class="border-bottom">
          <table>
            ${itemsHtml}
          </table>
        </div>
        
        <div class="border-bottom">
          <table style="font-weight: bold;">
            <tr><td>Subtotal</td><td class="text-right">${settings.currency} ${subtotal.toLocaleString()}</td></tr>
            <tr><td>Discount</td><td class="text-right">${settings.currency} ${discount.toLocaleString()}</td></tr>
            ${taxAmount > 0 ? `
              <tr>
                <td style="font-weight: ${taxType === 'INCLUSIVE' ? 'normal' : 'bold'}; ${taxType === 'INCLUSIVE' ? 'font-size: 12px; color: #555;' : ''}">
                  ${taxType === 'INCLUSIVE' ? 'Includes ' : ''}${taxName}
                </td>
                <td class="text-right" style="font-weight: ${taxType === 'INCLUSIVE' ? 'normal' : 'bold'}; ${taxType === 'INCLUSIVE' ? 'font-size: 12px; color: #555;' : ''}">
                  ${settings.currency} ${taxAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </td>
              </tr>
            ` : ''}
            <tr><td style="padding-top: 8px;">Total</td><td class="text-right" style="padding-top: 8px;">${settings.currency} ${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>
          </table>
        </div>
        
        <div class="border-bottom">
          <table>
            <tr><td>Payment Method</td><td class="text-right">${paymentMethod}</td></tr>
            <tr><td>Amount Paid</td><td class="text-right">${settings.currency} ${amountPaid.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>
            <tr><td>Change</td><td class="text-right">${settings.currency} ${(amountPaid - total).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td></tr>
          </table>
        </div>
        
        <div class="text-center">
          <p>Thank you for your business!</p>
          <p>Goods once sold are not returnable.</p>
        </div>
      </body>
    </html>
  `;
  
  receiptWindow.document.write(html);
  receiptWindow.document.close();
  
  // Wait for images/styles to load then print
  setTimeout(() => {
    receiptWindow.print();
    receiptWindow.close();
  }, 500);
};
