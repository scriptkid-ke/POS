/* =====================================================
   HardwarePOS Kenya — script.js
   =====================================================
   DATA STRUCTURES:
   - products[]   → inventory items
   - sales[]      → completed sale records
   - customers[]  → customer + credit records

   FLOW:
   Sales Page → add to cart → choose payment
            → record sale → update stock → print receipt
   ===================================================== */

/* =====================
   UTILITY HELPERS
   ===================== */

// Format number as KSh currency
function fmt(n) {
  return 'KSh ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Generate a unique ID (timestamp + random)
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Get today's date string YYYY-MM-DD
function today() {
  return new Date().toISOString().slice(0, 10);
}

// Format timestamp to readable time
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

/* =====================
   LOCAL STORAGE LAYER
   (Easy to swap for API calls later)
   ===================== */

// Load array from localStorage, fallback to default
function load(key, def = []) {
  try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; }
}

// Save array to localStorage
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

/* =====================
   SEED DATA
   Pre-loaded products for a Kenya hardware store
   ===================== */

const SEED_PRODUCTS = [
  { id: uid(), name: 'Steel', variant: 'D12', category: 'Steel', unit: 'length', buyPrice: 700, sellPrice: 850, stock: 200, lowStockAt: 20 },
  { id: uid(), name: 'Steel', variant: 'D10', category: 'Steel', unit: 'length', buyPrice: 480, sellPrice: 600, stock: 150, lowStockAt: 20 },
  { id: uid(), name: 'Steel', variant: 'D8',  category: 'Steel', unit: 'length', buyPrice: 320, sellPrice: 420, stock: 100, lowStockAt: 15 },
  { id: uid(), name: 'Steel', variant: 'D16', category: 'Steel', unit: 'length', buyPrice: 1100, sellPrice: 1350, stock: 80,  lowStockAt: 10 },
  { id: uid(), name: 'Cement', variant: 'Bamburi 50kg', category: 'Cement', unit: 'bag', buyPrice: 680, sellPrice: 750, stock: 300, lowStockAt: 30 },
  { id: uid(), name: 'Cement', variant: 'Simba 50kg',   category: 'Cement', unit: 'bag', buyPrice: 650, sellPrice: 720, stock: 200, lowStockAt: 30 },
  { id: uid(), name: 'Pipe', variant: '1/2 inch', category: 'Pipes', unit: 'length', buyPrice: 280, sellPrice: 350, stock: 120, lowStockAt: 10 },
  { id: uid(), name: 'Pipe', variant: '1 inch',   category: 'Pipes', unit: 'length', buyPrice: 420, sellPrice: 520, stock: 100, lowStockAt: 10 },
  { id: uid(), name: 'Pipe', variant: '2 inch',   category: 'Pipes', unit: 'length', buyPrice: 680, sellPrice: 820, stock: 60,  lowStockAt: 8  },
  { id: uid(), name: 'Binding Wire', variant: '2kg', category: 'Other', unit: 'piece', buyPrice: 280, sellPrice: 370, stock: 50, lowStockAt: 5 },
  { id: uid(), name: 'Nails',        variant: '4 inch', category: 'Other', unit: 'kg', buyPrice: 110, sellPrice: 140, stock: 80, lowStockAt: 10 },
  { id: uid(), name: 'Timber',       variant: '2x4 inch', category: 'Other', unit: 'length', buyPrice: 350, sellPrice: 450, stock: 60, lowStockAt: 8 },
];

/* =====================
   APP STATE
   ===================== */

let products  = load('hw_products');
let sales     = load('hw_sales');
let customers = load('hw_customers');
let cart      = []; // NOT persisted (session only)

// Seed products on first load
if (products.length === 0) {
  products = SEED_PRODUCTS;
  save('hw_products', products);
}

/* =====================
   CLOCK
   ===================== */

function startClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick();
  setInterval(tick, 1000);
}

/* =====================
   NAVIGATION
   ===================== */

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + page).classList.add('active');

    // Refresh page data on switch
    if (page === 'inventory') renderInventory();
    if (page === 'customers') renderCustomers();
    if (page === 'reports')   renderReports();
  });
});

/* =====================
   PRODUCT GRID (Sales)
   ===================== */

let activeCategory = 'all';
let searchQuery    = '';

function renderProductGrid() {
  const grid = document.getElementById('product-grid');
  const query = searchQuery.toLowerCase().trim();

  // Filter products
  const visible = products.filter(p => {
    const matchCat = activeCategory === 'all' || p.category === activeCategory;
    const matchQ   = !query ||
      p.name.toLowerCase().includes(query) ||
      p.variant.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query);
    return matchCat && matchQ;
  });

  if (visible.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-light);font-size:0.85rem;padding:1rem;">No products found.</p>';
    return;
  }

  grid.innerHTML = visible.map(p => {
    const stockClass = p.stock <= 0 ? 'out' : p.stock <= p.lowStockAt ? 'low' : '';
    const stockLabel = p.stock <= 0 ? 'OUT' : p.stock + ' ' + p.unit + 's';
    return `
      <div class="product-card" onclick="addToCart('${p.id}')">
        <span class="pc-stock ${stockClass}">${stockLabel}</span>
        <div class="pc-category">${p.category}</div>
        <div class="pc-name">${p.name}</div>
        <div class="pc-variant">${p.variant}</div>
        <div class="pc-price">${fmt(p.sellPrice)}</div>
        <div class="pc-unit">per ${p.unit}</div>
      </div>
    `;
  }).join('');
}

// Category pills
document.querySelectorAll('.pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeCategory = pill.dataset.cat;
    renderProductGrid();
  });
});

// Search
document.getElementById('product-search').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderProductGrid();
});

/* =====================
   CART LOGIC
   ===================== */

// Add product to cart (or increment qty if already there)
function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (product.stock <= 0) {
    alert('⚠ This item is out of stock.');
    return;
  }

  const existing = cart.find(i => i.productId === productId);
  if (existing) {
    existing.qty = parseFloat((existing.qty + 1).toFixed(2));
  } else {
    cart.push({
      cartId:    uid(),
      productId: product.id,
      name:      product.name,
      variant:   product.variant,
      unit:      product.unit,
      price:     product.sellPrice, // editable at POS
      qty:       1
    });
  }
  renderCart();
}

// Remove item from cart
function removeFromCart(cartId) {
  cart = cart.filter(i => i.cartId !== cartId);
  renderCart();
}

// Update qty from input
function updateQty(cartId, val) {
  const item = cart.find(i => i.cartId === cartId);
  if (!item) return;
  const qty = parseFloat(val);
  if (isNaN(qty) || qty <= 0) { removeFromCart(cartId); return; }
  item.qty = qty;
  renderCart();
}

// Update price from input (allow editing at POS)
function updatePrice(cartId, val) {
  const item = cart.find(i => i.cartId === cartId);
  if (!item) return;
  const price = parseFloat(val);
  if (!isNaN(price) && price >= 0) item.price = price;
  renderTotals();
}

// Render all cart items
function renderCart() {
  const container = document.getElementById('cart-items');
  const emptyMsg  = document.getElementById('cart-empty');

  if (cart.length === 0) {
    container.innerHTML = '';
    container.appendChild(emptyMsg);
    renderTotals();
    return;
  }

  container.innerHTML = cart.map(item => `
    <div class="cart-item" id="ci-${item.cartId}">
      <div class="ci-info">
        <div class="ci-name">${item.name}</div>
        <div class="ci-variant">${item.variant} · ${item.unit}</div>
        <!-- Editable price field -->
        <input class="ci-price-edit" type="number" value="${item.price}"
          onchange="updatePrice('${item.cartId}', this.value)"
          title="Edit price" min="0" />
      </div>
      <div class="ci-controls">
        <button class="qty-btn" onclick="updateQty('${item.cartId}', ${(item.qty - 1).toFixed(2)})">−</button>
        <input class="qty-input" type="number" value="${item.qty}" min="0.1" step="0.5"
          onchange="updateQty('${item.cartId}', this.value)" />
        <button class="qty-btn" onclick="updateQty('${item.cartId}', ${(item.qty + 1).toFixed(2)})">+</button>
      </div>
      <div class="ci-line-total">${fmt(item.price * item.qty)}</div>
      <button class="ci-remove" onclick="removeFromCart('${item.cartId}')" title="Remove">✕</button>
    </div>
  `).join('');

  renderTotals();
}

// Calculate and display totals
function renderTotals() {
  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discountVal  = parseFloat(document.getElementById('discount-input').value) || 0;
  const discountType = document.getElementById('discount-type').value;
  let discount = discountType === 'percent' ? subtotal * discountVal / 100 : discountVal;
  discount = Math.min(discount, subtotal);
  const total = subtotal - discount;

  document.getElementById('subtotal').textContent   = fmt(subtotal);
  document.getElementById('grand-total').textContent = fmt(total);
}

// Discount changes
document.getElementById('discount-input').addEventListener('input', renderTotals);
document.getElementById('discount-type').addEventListener('change', renderTotals);

// Clear cart
document.getElementById('clear-cart-btn').addEventListener('click', () => {
  if (cart.length === 0) return;
  if (confirm('Clear all items from cart?')) {
    cart = [];
    renderCart();
  }
});

/* =====================
   COMPUTE GRAND TOTAL
   ===================== */
function getGrandTotal() {
  const subtotal     = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const discountVal  = parseFloat(document.getElementById('discount-input').value) || 0;
  const discountType = document.getElementById('discount-type').value;
  let discount = discountType === 'percent' ? subtotal * discountVal / 100 : discountVal;
  discount = Math.min(discount, subtotal);
  return { subtotal, discount, total: subtotal - discount };
}

/* =====================
   PAYMENT HANDLERS
   ===================== */

// Validate cart before checkout
function validateCart() {
  if (cart.length === 0) { alert('Cart is empty. Add products first.'); return false; }
  return true;
}

// --- Cash ---
document.getElementById('pay-cash-btn').addEventListener('click', () => {
  if (!validateCart()) return;
  const { total } = getGrandTotal();
  document.getElementById('cash-due').textContent = fmt(total);
  document.getElementById('cash-received').value  = '';
  document.getElementById('cash-change').textContent = fmt(0);
  openModal('cash-modal');
});

document.getElementById('cash-received').addEventListener('input', e => {
  const { total } = getGrandTotal();
  const received   = parseFloat(e.target.value) || 0;
  const change     = received - total;
  document.getElementById('cash-change').textContent = fmt(Math.max(change, 0));
  document.getElementById('cash-change').style.color = change < 0 ? 'var(--red)' : 'var(--green)';
});

document.getElementById('confirm-cash-btn').addEventListener('click', () => {
  const { total } = getGrandTotal();
  const received   = parseFloat(document.getElementById('cash-received').value) || 0;
  if (received < total) { alert('Cash received is less than amount due.'); return; }
  completeSale('Cash', { received, change: received - total });
  closeModal('cash-modal');
});

// --- M-Pesa ---
document.getElementById('pay-mpesa-btn').addEventListener('click', () => {
  if (!validateCart()) return;
  const { total } = getGrandTotal();
  document.getElementById('mpesa-amount-display').textContent = fmt(total);
  document.getElementById('mpesa-code').value = '';
  openModal('mpesa-modal');
});

document.getElementById('confirm-mpesa-btn').addEventListener('click', () => {
  const ref = document.getElementById('mpesa-code').value.trim() || 'N/A';
  completeSale('M-Pesa', { mpesaCode: ref });
  closeModal('mpesa-modal');
});

// --- Credit ---
document.getElementById('pay-credit-btn').addEventListener('click', () => {
  if (!validateCart()) return;
  const customerName = document.getElementById('cart-customer-name').value.trim();
  if (!customerName) {
    alert('Please enter a customer name for credit sales.');
    document.getElementById('cart-customer-name').focus();
    return;
  }
  if (!confirm(`Record credit sale for "${customerName}"?`)) return;
  completeSale('Credit', {});
});

/* =====================
   COMPLETE SALE
   Records sale, deducts stock, shows receipt
   ===================== */

function completeSale(method, paymentDetails) {
  const { subtotal, discount, total } = getGrandTotal();
  const customerName  = document.getElementById('cart-customer-name').value.trim();
  const customerPhone = document.getElementById('cart-customer-phone').value.trim();

  // Build sale record
  const sale = {
    id:          uid(),
    timestamp:   Date.now(),
    date:        today(),
    items:       cart.map(i => ({ ...i })), // snapshot
    subtotal,
    discount,
    total,
    method,
    paymentDetails,
    customerName:  customerName || 'Walk-in',
    customerPhone: customerPhone || '',
  };

  // Deduct stock
  cart.forEach(cartItem => {
    const product = products.find(p => p.id === cartItem.productId);
    if (product) {
      product.stock = Math.max(0, product.stock - cartItem.qty);
    }
  });
  save('hw_products', products);

  // If credit, update customer debt
  if (method === 'Credit') {
    updateCustomerCredit(customerName, customerPhone, sale);
  }

  // Save sale
  sales.push(sale);
  save('hw_sales', sales);

  // Reset cart & fields
  cart = [];
  document.getElementById('cart-customer-name').value  = '';
  document.getElementById('cart-customer-phone').value = '';
  document.getElementById('discount-input').value       = '0';
  renderCart();
  renderProductGrid(); // refresh stock counts

  // Show receipt
  showReceipt(sale);
}

/* =====================
   RECEIPT
   ===================== */

function showReceipt(sale) {
  const itemRows = sale.items.map(i => `
    <tr>
      <td>${i.name} ${i.variant}</td>
      <td>${i.qty} ${i.unit}</td>
      <td>${fmt(i.price)}</td>
      <td>${fmt(i.price * i.qty)}</td>
    </tr>
  `).join('');

  const discountRow = sale.discount > 0
    ? `<tr><td colspan="3">Discount</td><td>-${fmt(sale.discount)}</td></tr>` : '';

  document.getElementById('receipt-content').innerHTML = `
    <div class="receipt-body">
      <div class="receipt-header">
        <div class="receipt-store">⚙ HARDWARE STORE</div>
        <div style="font-size:0.75rem;color:#666;">Nairobi, Kenya</div>
        <div style="font-size:0.72rem;margin-top:4px;">${new Date(sale.timestamp).toLocaleString('en-KE')}</div>
        <div style="font-size:0.72rem;">Receipt #${sale.id.toUpperCase().slice(0,8)}</div>
      </div>

      <div style="font-size:0.78rem;margin-bottom:0.5rem;">
        Customer: <strong>${sale.customerName}</strong>
        ${sale.customerPhone ? ' · ' + sale.customerPhone : ''}
      </div>

      <table class="receipt-table">
        <thead>
          <tr>
            <td><strong>Item</strong></td>
            <td><strong>Qty</strong></td>
            <td><strong>Price</strong></td>
            <td><strong>Total</strong></td>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          ${discountRow}
          <tr class="receipt-total-line">
            <td colspan="3"><strong>TOTAL</strong></td>
            <td><strong>${fmt(sale.total)}</strong></td>
          </tr>
          <tr>
            <td colspan="3" style="color:#666;">Payment</td>
            <td style="color:#666;">${sale.method}</td>
          </tr>
        </tbody>
      </table>

      <div class="receipt-footer">
        Thank you for shopping with us!<br/>
        Asante sana — karibu tena!
      </div>
    </div>
  `;
  openModal('receipt-modal');
}

/* =====================
   CUSTOMER CREDIT
   ===================== */

function updateCustomerCredit(name, phone, sale) {
  // Find existing customer or create new one
  let customer = customers.find(c =>
    c.name.toLowerCase() === name.toLowerCase() ||
    (phone && c.phone === phone)
  );

  const creditEntry = {
    saleId:    sale.id,
    date:      sale.date,
    timestamp: sale.timestamp,
    items:     sale.items.map(i => `${i.qty}x ${i.name} ${i.variant}`).join(', '),
    amount:    sale.total,
    paid:      0,
    status:    'unpaid',
  };

  if (customer) {
    customer.totalDebt  = (customer.totalDebt || 0) + sale.total;
    customer.lastSale   = sale.date;
    customer.creditLog  = customer.creditLog || [];
    customer.creditLog.push(creditEntry);
  } else {
    customers.push({
      id:        uid(),
      name,
      phone:     phone || '',
      totalDebt: sale.total,
      lastSale:  sale.date,
      creditLog: [creditEntry],
    });
  }
  save('hw_customers', customers);
}

/* =====================
   INVENTORY PAGE
   ===================== */

function renderInventory() {
  // Low stock alert
  const lowItems = products.filter(p => p.stock > 0 && p.stock <= p.lowStockAt);
  const alertBox = document.getElementById('low-stock-alert');
  if (lowItems.length > 0) {
    alertBox.style.display = 'block';
    alertBox.innerHTML = '⚠ <strong>Low stock:</strong> ' +
      lowItems.map(p => `${p.name} ${p.variant} (${p.stock} left)`).join(' · ');
  } else {
    alertBox.style.display = 'none';
  }

  const tbody = document.getElementById('inventory-body');
  tbody.innerHTML = products.map(p => {
    const stockClass = p.stock <= 0 ? 'stock-out' : p.stock <= p.lowStockAt ? 'stock-low' : 'stock-ok';
    const catTag = `tag-${p.category.toLowerCase()}`;
    return `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td><span class="tag ${catTag}">${p.variant}</span></td>
        <td>${p.category}</td>
        <td>${p.unit}</td>
        <td class="mono">${fmt(p.buyPrice)}</td>
        <td class="mono">${fmt(p.sellPrice)}</td>
        <td><span class="stock-badge ${stockClass}">${p.stock} ${p.unit}s</span></td>
        <td>
          <button class="btn-icon" onclick="editProduct('${p.id}')" title="Edit">✏</button>
          <button class="btn-icon danger" onclick="deleteProduct('${p.id}')" title="Delete">🗑</button>
        </td>
      </tr>
    `;
  }).join('');
}

// Open product modal for adding
document.getElementById('add-product-btn').addEventListener('click', () => {
  document.getElementById('product-modal-title').textContent = 'Add Product';
  document.getElementById('pm-id').value       = '';
  document.getElementById('pm-name').value     = '';
  document.getElementById('pm-variant').value  = '';
  document.getElementById('pm-category').value = 'Steel';
  document.getElementById('pm-unit').value     = 'piece';
  document.getElementById('pm-buy-price').value  = '';
  document.getElementById('pm-sell-price').value = '';
  document.getElementById('pm-stock').value      = '';
  document.getElementById('pm-low-stock').value  = '5';
  openModal('product-modal');
});

// Edit product
function editProduct(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  document.getElementById('product-modal-title').textContent = 'Edit Product';
  document.getElementById('pm-id').value         = p.id;
  document.getElementById('pm-name').value       = p.name;
  document.getElementById('pm-variant').value    = p.variant;
  document.getElementById('pm-category').value   = p.category;
  document.getElementById('pm-unit').value       = p.unit;
  document.getElementById('pm-buy-price').value  = p.buyPrice;
  document.getElementById('pm-sell-price').value = p.sellPrice;
  document.getElementById('pm-stock').value      = p.stock;
  document.getElementById('pm-low-stock').value  = p.lowStockAt;
  openModal('product-modal');
}

// Save product (add or edit)
document.getElementById('pm-save-btn').addEventListener('click', () => {
  const id       = document.getElementById('pm-id').value;
  const name     = document.getElementById('pm-name').value.trim();
  const variant  = document.getElementById('pm-variant').value.trim();
  const category = document.getElementById('pm-category').value;
  const unit     = document.getElementById('pm-unit').value;
  const buyPrice  = parseFloat(document.getElementById('pm-buy-price').value)  || 0;
  const sellPrice = parseFloat(document.getElementById('pm-sell-price').value) || 0;
  const stock     = parseFloat(document.getElementById('pm-stock').value)      || 0;
  const lowStockAt = parseFloat(document.getElementById('pm-low-stock').value) || 5;

  if (!name || !variant) { alert('Name and variant are required.'); return; }

  if (id) {
    // Update existing
    const p = products.find(x => x.id === id);
    if (p) Object.assign(p, { name, variant, category, unit, buyPrice, sellPrice, stock, lowStockAt });
  } else {
    // Add new
    products.push({ id: uid(), name, variant, category, unit, buyPrice, sellPrice, stock, lowStockAt });
  }

  save('hw_products', products);
  closeModal('product-modal');
  renderInventory();
  renderProductGrid(); // refresh sales grid too
});

// Delete product
function deleteProduct(id) {
  if (!confirm('Delete this product? This cannot be undone.')) return;
  products = products.filter(p => p.id !== id);
  save('hw_products', products);
  renderInventory();
  renderProductGrid();
}

/* =====================
   CUSTOMERS PAGE
   ===================== */

function renderCustomers() {
  const tbody = document.getElementById('customers-body');
  if (customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:2rem;">No customers yet.</td></tr>';
    return;
  }
  tbody.innerHTML = customers.map(c => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.phone || '—'}</td>
      <td class="mono" style="color:${c.totalDebt > 0 ? 'var(--red)' : 'var(--green)'};font-weight:600;">
        ${fmt(c.totalDebt || 0)}
      </td>
      <td>${c.lastSale || '—'}</td>
      <td>
        <button class="btn-icon" onclick="viewDebt('${c.id}')" title="View credit">📋</button>
        <button class="btn-icon" onclick="editCustomer('${c.id}')" title="Edit">✏</button>
        <button class="btn-icon danger" onclick="deleteCustomer('${c.id}')" title="Delete">🗑</button>
      </td>
    </tr>
  `).join('');
}

// Add customer
document.getElementById('add-customer-btn').addEventListener('click', () => {
  document.getElementById('customer-modal-title').textContent = 'Add Customer';
  document.getElementById('cm-id').value    = '';
  document.getElementById('cm-name').value  = '';
  document.getElementById('cm-phone').value = '';
  openModal('customer-modal');
});

// Edit customer
function editCustomer(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  document.getElementById('customer-modal-title').textContent = 'Edit Customer';
  document.getElementById('cm-id').value    = c.id;
  document.getElementById('cm-name').value  = c.name;
  document.getElementById('cm-phone').value = c.phone;
  openModal('customer-modal');
}

// Save customer
document.getElementById('cm-save-btn').addEventListener('click', () => {
  const id    = document.getElementById('cm-id').value;
  const name  = document.getElementById('cm-name').value.trim();
  const phone = document.getElementById('cm-phone').value.trim();
  if (!name) { alert('Name is required.'); return; }

  if (id) {
    const c = customers.find(x => x.id === id);
    if (c) { c.name = name; c.phone = phone; }
  } else {
    customers.push({ id: uid(), name, phone, totalDebt: 0, lastSale: null, creditLog: [] });
  }

  save('hw_customers', customers);
  closeModal('customer-modal');
  renderCustomers();
});

// Delete customer
function deleteCustomer(id) {
  if (!confirm('Delete this customer? All their credit records will be lost.')) return;
  customers = customers.filter(c => c.id !== id);
  save('hw_customers', customers);
  renderCustomers();
}

// View / manage customer debt
let activeDebtCustomerId = null;

function viewDebt(id) {
  const c = customers.find(x => x.id === id);
  if (!c) return;
  activeDebtCustomerId = id;

  document.getElementById('debt-modal-title').textContent = `${c.name} — Credit Ledger`;
  document.getElementById('debt-summary').innerHTML = `
    <div class="totals-row total-row">
      <span>Outstanding Balance</span>
      <span style="color:${c.totalDebt > 0 ? 'var(--red)' : 'var(--green)'};">${fmt(c.totalDebt || 0)}</span>
    </div>
  `;

  const log = c.creditLog || [];
  document.getElementById('debt-log-body').innerHTML = log.length === 0
    ? '<tr><td colspan="5" style="text-align:center;color:var(--text-light);">No records.</td></tr>'
    : log.map((entry, i) => `
        <tr>
          <td>${entry.date}</td>
          <td style="font-size:0.75rem;">${entry.items}</td>
          <td class="mono">${fmt(entry.amount)}</td>
          <td>
            <span style="color:${entry.status === 'paid' ? 'var(--green)' : 'var(--red)'};">
              ${entry.status === 'paid' ? 'Paid' : `Owes ${fmt(entry.amount - entry.paid)}`}
            </span>
          </td>
          <td></td>
        </tr>
      `).join('');

  document.getElementById('debt-payment-amount').value = '';
  openModal('debt-modal');
}

// Record a credit payment
document.getElementById('debt-pay-btn').addEventListener('click', () => {
  if (!activeDebtCustomerId) return;
  const amount = parseFloat(document.getElementById('debt-payment-amount').value) || 0;
  if (amount <= 0) { alert('Enter a valid payment amount.'); return; }

  const customer = customers.find(c => c.id === activeDebtCustomerId);
  if (!customer) return;

  // Reduce debt, apply to oldest unpaid entries first
  let remaining = amount;
  (customer.creditLog || []).forEach(entry => {
    if (remaining <= 0 || entry.status === 'paid') return;
    const owed    = entry.amount - entry.paid;
    const payment = Math.min(owed, remaining);
    entry.paid   += payment;
    remaining    -= payment;
    if (entry.paid >= entry.amount) entry.status = 'paid';
  });

  customer.totalDebt = Math.max(0, (customer.totalDebt || 0) - amount + remaining);
  // remaining > 0 means overpayment — credit is fully cleared
  if (remaining > 0) customer.totalDebt = 0;

  save('hw_customers', customers);
  closeModal('debt-modal');
  renderCustomers();
  alert(`Payment of ${fmt(amount)} recorded for ${customer.name}.`);
});

/* =====================
   REPORTS PAGE
   ===================== */

function renderReports() {
  const dateInput = document.getElementById('report-date');
  if (!dateInput.value) dateInput.value = today();
  const reportDate = dateInput.value;

  const daySales = sales.filter(s => s.date === reportDate);
  const revenue  = daySales.reduce((sum, s) => sum + s.total, 0);

  // Estimate profit (sell price - buy price per item)
  let profit = 0;
  daySales.forEach(s => {
    s.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        profit += (item.price - product.buyPrice) * item.qty;
      }
    });
  });

  const totalOutstanding = customers.reduce((sum, c) => sum + (c.totalDebt || 0), 0);

  document.getElementById('rpt-sales-count').textContent = daySales.length;
  document.getElementById('rpt-revenue').textContent     = fmt(revenue);
  document.getElementById('rpt-profit').textContent      = fmt(profit);
  document.getElementById('rpt-credit').textContent      = fmt(totalOutstanding);

  // Sales log table
  const tbody = document.getElementById('sales-log-body');
  if (daySales.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:1.5rem;">No sales on this date.</td></tr>';
    return;
  }
  tbody.innerHTML = [...daySales].reverse().map(s => `
    <tr>
      <td>${fmtTime(s.timestamp)}</td>
      <td>${s.customerName}</td>
      <td style="font-size:0.78rem;">${s.items.map(i => `${i.qty}× ${i.name} ${i.variant}`).join(', ')}</td>
      <td class="mono"><strong>${fmt(s.total)}</strong></td>
      <td>
        <span style="
          background:${s.method === 'Cash' ? 'var(--green-lt)' : s.method === 'M-Pesa' ? '#e8f5e9' : 'var(--red-lt)'};
          color:${s.method === 'Cash' ? 'var(--green)' : s.method === 'M-Pesa' ? '#1b5e20' : 'var(--red)'};
          padding:2px 8px; border-radius:99px; font-size:0.75rem; font-weight:600;">
          ${s.method}
        </span>
      </td>
    </tr>
  `).join('');
}

// Refresh report when date changes
document.getElementById('report-date').addEventListener('change', renderReports);

/* =====================
   MODAL HELPERS
   ===================== */

function openModal(id) {
  document.getElementById(id).classList.add('open');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Close modal buttons
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});

// Click outside modal to close
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// Keyboard shortcut: Escape closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
  }
});

//sw.js
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(() => console.log("Service Worker Registered"));
}

/* =====================
   INIT
   ===================== */

function init() {
  startClock();
  renderProductGrid();
  // Reports date picker default
  document.getElementById('report-date').value = today();
}

init();
