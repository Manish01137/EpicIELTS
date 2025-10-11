 // FILE: script.js
// Front-end logic for IELTS Powerhouse Workshop landing page
// - Fills current year
// - FAQ accordion toggle
// - Smooth anchor scrolling
// - Razorpay checkout integration (client-side + recommended server order creation)
//
// IMPORTANT:
// 1) Replace 'RAZORPAY_KEY_ID_PLACEHOLDER' with your Razorpay Key ID (publishable).
// 2) Implement a server endpoint POST /create-order that creates a Razorpay order using your
//    Razorpay secret key and returns JSON: { order_id: 'order_XXXX', amount: 9900 }
//    (amount should be in paise). This server-side step is recommended for security and
//    signature verification after payment.
// 3) After successful payment, verify the payment on your server using the response fields:
//    razorpay_payment_id, razorpay_order_id, razorpay_signature (to verify signature).

document.addEventListener('DOMContentLoaded', () => {
    // Fill current year in footer
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  
    // FAQ toggle
    document.querySelectorAll('.faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const content = btn.nextElementSibling;
        const isOpen = content.style.display === 'block';
        // close all
        document.querySelectorAll('.faq-a').forEach(a => a.style.display = 'none');
        // toggle this one
        content.style.display = isOpen ? 'none' : 'block';
      });
    });
  
    // Smooth scroll for in-page anchor links
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        e.preventDefault();
        const id = a.getAttribute('href');
        const el = document.querySelector(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  
    // Register button -> Razorpay flow
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener('click', async () => {
        // Booking amount: ₹99 -> amount in paise = 99 * 100 = 9900
        const amount = 99 * 100;
  
        // ====== CONFIGURE ======
        // Replace with your Razorpay publishable key (Key ID)
        const RAZORPAY_KEY_ID = 'RAZORPAY_KEY_ID_PLACEHOLDER';
  
        // Recommended: create an order on the server to get an order_id for secure flow.
        // Server endpoint expected: POST /create-order
        // Body: { amount: <amount_in_paise>, receipt?: 'receipt_xyz' }
        // Response: { order_id: 'order_XXXX', amount: 9900 }
        let orderId = null;
        try {
          const resp = await fetch('/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount })
          });
  
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.order_id) {
              orderId = data.order_id;
            } else {
              console.warn('Server returned no order_id, falling back to client-only checkout.');
            }
          } else {
            console.warn('Create-order endpoint returned non-OK status. Falling back to client checkout.');
          }
        } catch (err) {
          console.warn('Could not reach /create-order endpoint, falling back to client-only checkout.', err);
        }
  
        // Prepare options for Razorpay checkout
        const options = {
          key: RAZORPAY_KEY_ID, // required: publishable key
          amount: amount, // in paise
          currency: 'INR',
          name: 'IELTS Powerhouse Workshop',
          description: 'One-day workshop — Booking Fee (₹99)',
          image: '', // optional: URL to logo
          order_id: orderId || undefined, // use server order_id when available
          handler: function (response) {
            // Called on successful payment
            // response contains: razorpay_payment_id, razorpay_order_id, razorpay_signature
            // IMPORTANT: Send these to your server to verify the signature and record the payment.
            alert('Payment successful! Payment ID: ' + response.razorpay_payment_id);
  
            // Example: POST to /verify-payment on your server
            /*
            fetch('/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            }).then(r => r.json()).then(j => {
              // handle server verification result
            }).catch(err => console.error('Verification failed', err));
            */
          },
          prefill: {
            name: '',
            email: '',
            contact: ''
          },
          notes: {
            workshop: 'IELTS Powerhouse — Booking Fee'
          },
          theme: {
            color: '#D4AF37'
          }
        };
  
        // Open Razorpay checkout
        try {
          const rzp = new Razorpay(options);
          rzp.open();
        } catch (err) {
          console.error('Razorpay checkout error:', err);
          alert('Payment popup failed to open. Please try again or contact support.');
        }
      });
    }
  });
  