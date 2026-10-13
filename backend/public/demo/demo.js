// Demo-only behaviour (not part of the tracker).
(function () {
  var cart = 0;
  document.querySelectorAll('.add').forEach(function (btn) {
    btn.addEventListener('click', function () {
      cart++;
      var s = document.getElementById('cart-status');
      s.hidden = false;
      s.textContent = 'Added ' + btn.dataset.item + ' – ' + cart + ' item(s) in cart';
    });
  });

  var form = document.getElementById('checkout-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      document.getElementById('order-status').hidden = false;
    });
  }

  // Show the current session id so testers can find it in the dashboard.
  // Hidden when embedded in the dashboard heatmap iframe.
  var dbg = document.getElementById('debug');
  if (dbg && window.Tracker && window.self === window.top) {
    dbg.textContent = 'session: ' + window.Tracker.getSessionId().slice(0, 8) + '…';
  } else if (dbg) {
    dbg.remove();
  }
})();
