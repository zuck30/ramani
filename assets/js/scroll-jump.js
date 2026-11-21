(function () {
  'use strict';

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  function motion() {
    return reduce && reduce.matches ? 'auto' : 'smooth';
  }

  function sync() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var view = window.innerHeight;
    var total = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );
    up.hidden = y < 200;
    down.hidden = y + view >= total - 200;
  }

  var wrap = document.createElement('div');
  wrap.className = 'scroll-jump';
  wrap.innerHTML =
    '<button type="button" class="to-top" aria-label="back to top">' +
    '<i aria-hidden="true"></i></button>' +
    '<button type="button" class="to-footer" aria-label="jump to the footer">' +
    '<i aria-hidden="true"></i></button>';
  document.body.appendChild(wrap);

  var up = wrap.querySelector('.to-top');
  var down = wrap.querySelector('.to-footer');

  up.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: motion() });
  });

  down.addEventListener('click', function () {
    var footer = document.querySelector('.site-footer');
    if (footer) {
      footer.scrollIntoView({ behavior: motion(), block: 'start' });
    } else {
      window.scrollTo({ top: document.body.scrollHeight, behavior: motion() });
    }
  });

  window.addEventListener("scroll", sync, { passive: true });
  window.addEventListener("resize", sync);
  sync();
})();
