// FILE: script.js
// Unified front-end logic for IELTS Powerhouse Workshop landing + multiple register buttons
// - Fills current year
// - FAQ accordion toggle
// - Smooth anchor scrolling
// - Unified Razorpay checkout flow for any registration button on the page
//
// Usage for registration buttons in HTML:
// <button class="register-btn" data-amount="99" data-receipt="booking_1" data-description="Workshop Booking">Register</button>
// or
// <button class="register-btn" data-amount="99">Register Now for ₹99</button>
//
// Notes:
// - Replace RAZORPAY_KEY_ID_PLACEHOLDER with your Razorpay Key ID (publishable).
// - Implement POST /create-order on your server returning { order_id, amount } when possible.
// - Implement POST /verify-payment on your server to verify signature and finalize booking.

(() => {
  const RAZORPAY_KEY_ID = 'RAZORPAY_KEY_ID_PLACEHOLDER'; // <-- replace with your publishable key
  const CREATE_ORDER_ENDPOINT = '/create-order';
  const VERIFY_PAYMENT_ENDPOINT = '/verify-payment';

  // ---------- Utility helpers ----------
  const q = (sel, ctx = document) => ctx.querySelector(sel);
  const qa = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  const toPaise = amount => {
    // Accept numbers, numeric strings, or decimals — return integer paise
    const n = typeof amount === 'string' ? amount.trim() : amount;
    const x = Number(n) || 0;
    return Math.round(x * 100);
  };

  const safeJSON = async res => {
    try { return await res.json(); } catch (e) { return null; }
  };

  // ---------- Fill current year ----------
  const yearEl = q('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- FAQ accordion ----------
  qa('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const a = btn.nextElementSibling;
      const open = a && a.style.display === 'block';
      qa('.faq-a').forEach(x => x.style.display = 'none');
      if (a) a.style.display = open ? 'none' : 'block';
    });
  });

  // ---------- Smooth anchor scrolling ----------
  qa('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // ---------- Razorpay flow ----------
  // Create order on server (recommended). Returns { order_id, amount } or null.
  async function createOrderOnServer(amountPaise, receipt) {
    try {
      const resp = await fetch(CREATE_ORDER_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: amountPaise, receipt: receipt || undefined })
      });
      if (!resp.ok) return null;
      return await safeJSON(resp);
    } catch (err) {
      console.warn('createOrderOnServer failed:', err);
      return null;
    }
  }

  // Verify payment on server: returns verification result (recommended)
  async function verifyPaymentOnServer(payload) {
    try {
      const resp = await fetch(VERIFY_PAYMENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      return resp.ok ? await safeJSON(resp) : null;
    } catch (err) {
      console.warn('verifyPaymentOnServer failed:', err);
      return null;
    }
  }

  // Open Razorpay checkout and return a Promise that resolves with the response object
  function openRazorpayCheckout(options) {
    return new Promise((resolve, reject) => {
      let rzp;
      try {
        rzp = new Razorpay(Object.assign({}, options, {
          handler: function (response) {
            // resolve successful payment response
            resolve(response);
          },
          modal: {
            ondismiss: function () {
              // user closed the checkout
              reject(new Error('checkout_dismissed'));
            }
          }
        }));
        rzp.open();
      } catch (err) {
        reject(err);
      }
    });
  }

  // Main handler used for any register button
  async function handleRegisterClick(e) {
    const btn = e.currentTarget;
    // read data attributes or fallbacks
    const amountAttr = btn.dataset.amount || btn.getAttribute('data-amount') || '99';
    const amountPaise = toPaise(amountAttr);
    const receipt = btn.dataset.receipt || btn.getAttribute('data-receipt') || `receipt_${Date.now()}`;
    const description = btn.dataset.description || btn.getAttribute('data-description') || 'Workshop Booking';
    const prefillName = btn.dataset.name || '';
    const prefillEmail = btn.dataset.email || '';
    const prefillContact = btn.dataset.contact || '';

    // disable button while initializing
    btn.disabled = true;
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Loading...';

    // Try create order on server (recommended)
    let serverOrder = await createOrderOnServer(amountPaise, receipt);
    if (serverOrder && serverOrder.amount) {
      // If server returned numeric amount string, ensure it matches
      // (server may return amount in paise)
    } else {
      // fallback: continue without order_id (client-only checkout)
      serverOrder = null;
    }

    // Prepare Razorpay options
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: amountPaise,
      currency: 'INR',
      name: 'IELTS Powerhouse Workshop',
      description: description,
      image: '', // optional logo URL
      order_id: serverOrder ? serverOrder.order_id : undefined,
      prefill: {
        name: prefillName,
        email: prefillEmail,
        contact: prefillContact
      },
      notes: { receipt, source: 'landing_page' },
      theme: { color: '#D4AF37' }
    };

    try {
      const paymentResp = await openRazorpayCheckout(options);
      // paymentResp: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
      // Send to server for verification (recommended)
      const verification = await verifyPaymentOnServer(paymentResp);

      // You can use verification to show a confirmation, or fallback to a simple success message
      if (verification && verification.verified) {
        // server says payment is verified
        window.alert('Payment successful and verified. Payment ID: ' + paymentResp.razorpay_payment_id);
      } else {
        // If server verification not implemented or failed, still show a success message but note verification required
        window.alert('Payment successful. Payment ID: ' + paymentResp.razorpay_payment_id + '\nPlease wait while we verify your payment.');
      }
    } catch (err) {
      // handle errors (user dismissed popup, network issues, etc.)
      if (err && err.message === 'checkout_dismissed') {
        // do nothing or show a mild message
        console.info('Razorpay checkout dismissed by user.');
      } else {
        console.error('Payment error:', err);
        window.alert('Payment could not be completed. Please try again or contact support.');
      }
    } finally {
      // restore button
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  }

  // ---------- Initialize register buttons ----------
  function initRegisterButtons() {
    // select by class name or data attribute; supports buttons/links
    const selectors = ['.register-btn', '.registerBtn', '[data-register]', '.register-big', '#registerBtn', '#registerSectionBtn'];
    const elems = new Set();
    selectors.forEach(sel => qa(sel).forEach(el => elems.add(el)));

    // Attach click handler to each unique element
    elems.forEach(el => {
      // avoid attaching multiple handlers
      if (el.__registerHandlerAttached) return;
      el.addEventListener('click', handleRegisterClick);
      el.__registerHandlerAttached = true;
      // ensure it has dataset.amount or default present (helps other code)
      if (!el.dataset.amount) el.dataset.amount = el.getAttribute('data-amount') || '99';
    });
  }

  // Kick off initialization after DOM ready
  document.addEventListener('DOMContentLoaded', initRegisterButtons);
  // Also run immediately in case DOMContentLoaded already fired
  initRegisterButtons();

  // Expose for debugging if needed
  window.__IELTS_Register = {
    init: initRegisterButtons,
    open: openRazorpayCheckout,
    createOrderOnServer,
    verifyPaymentOnServer
  };
})();



