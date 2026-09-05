// Akmal Farm — Taklifnoma :: external script (CSP-compliant under script-src 'self')

// ── Scroll-reveal engine (Motion'ning inView o'rnini bosadi, CSP-mos) ──
// Progressive enhancement: .js-scroll qo'shilmasa kontent baribir ko'rinadi.
(function () {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  if (reduce || !('IntersectionObserver' in window)) return;

  document.documentElement.classList.add('js-scroll');

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.16, rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('.reveal-up, .ecg').forEach(function (el) { io.observe(el); });
})();

// ── Countdown: standart 2-iyul 2026, 11:00 (Oʻzbekiston, UTC+5) ────────
// Kontent yuklansa (pastda), nishon vaqt admin panelda kiritilgan
// qiymatga almashtiriladi — sahifa qayta yuklanmasdan.
(function () {
  var cd = document.getElementById('cd');
  if (!cd) return;
  var target = new Date('2026-07-02T11:00:00+05:00').getTime();
  var done = false;
  var d = cd.querySelector('[data-cd=d]'), h = cd.querySelector('[data-cd=h]'),
      m = cd.querySelector('[data-cd=m]'), s = cd.querySelector('[data-cd=s]');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function tick() {
    if (done) return;
    var diff = target - Date.now();
    if (diff <= 0) {
      var g = cd.querySelector('.cd-grid');
      if (g) g.innerHTML = '<div class="cd-done">Marosim boshlandi! · Мероприятие началось!</div>';
      done = true;
      return;
    }
    var sec = Math.floor(diff / 1000);
    d.textContent = Math.floor(sec / 86400);
    h.textContent = pad(Math.floor((sec % 86400) / 3600));
    m.textContent = pad(Math.floor((sec % 3600) / 60));
    s.textContent = pad(sec % 60);
  }
  tick();
  setInterval(tick, 1000);
  window.__akmalSetCountdownTarget = function (iso) {
    var t = Date.parse(iso);
    if (!Number.isNaN(t)) { target = t; done = false; tick(); }
  };
})();

// ── Kontentni /api/content'dan yuklash (admin panelda tahrirlangan) ────
// Progressive enhancement: so'rov muvaffaqiyatsiz bo'lsa, sahifadagi
// standart matnlar (server-render qilingan) o'zgarishsiz qoladi.
(function () {
  function get(obj, path) {
    return path.split('.').reduce(function (o, k) { return o && typeof o === 'object' ? o[k] : undefined; }, obj);
  }
  fetch('/api/content', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (res) {
      var data = res && res.data;
      if (!data || typeof data !== 'object') return;

      document.querySelectorAll('[data-ck]').forEach(function (el) {
        var val = get(data, el.getAttribute('data-ck'));
        if (typeof val === 'string' && val) {
          if (val.includes('<br>') || val.includes('<span') || el.getAttribute('data-ck').includes('title')) {
            el.innerHTML = val;
          } else {
            el.textContent = val;
          }
        }
      });

      var mapUrl = get(data, 'event.map_url');
      var mapLink = document.getElementById('event-map-link');
      if (mapLink && typeof mapUrl === 'string' && /^https:\/\//i.test(mapUrl)) {
        mapLink.setAttribute('href', mapUrl);
      }

      var pageTitle = get(data, 'meta.page_title');
      if (typeof pageTitle === 'string' && pageTitle) document.title = pageTitle;

      var iso = get(data, 'event.countdown_target_iso');
      if (typeof iso === 'string' && iso && window.__akmalSetCountdownTarget) {
        window.__akmalSetCountdownTarget(iso);
      }
    })
    .catch(function () { /* jim: statik matnlar ko'rinishda qoladi */ });
})();

// "Taqvimga qo'shish" tugmasi endi to'g'ridan-to'g'ri /akmal-farm-ochilish.ics
// faylига ссылка (<a href>) — mobil (iOS) da ishonchli ishlaydi, JS shart emas.

// ── Kapsula parallaksi (nozik, hero reveal tugagach) ──────────────────
(function () {
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var stage = document.querySelector('.hero .stage3d');
  if (!stage || reduce) return;
  var ticking = false;
  function update() {
    var y = window.pageYOffset || 0;
    stage.style.transform = 'translateY(' + (y * 0.08).toFixed(1) + 'px)';
    ticking = false;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  // hero reveal animatsiyasi tugagach ulanamiz (transform to'qnashuvidan qochish)
  setTimeout(function () {
    stage.style.animation = 'none';
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
  }, 1100);
})();

// ── RSVP ──────────────────────────────────────────────────────────────
(function () {
  var block = document.getElementById('rsvp-form-block');
  if (!block) return;
  var form = block.querySelector('.rform');
  var opts = form.querySelectorAll('.rsvp-opt');
  var guestsField = form.querySelector('.rsvp-guests');
  var statusEl = form.querySelector('.rsvp-status');
  var submitBtn = form.querySelector('.rsvp-submit');
  var thanks = block.querySelector('.rsvp-thanks');
  var attending = null;
  var startedAt = Date.now();
  guestsField.style.display = 'none';

  function setStatus(kind, msg) {
    statusEl.className = 'rsvp-status' + (kind ? ' ' + kind : '');
    statusEl.textContent = msg || '';
  }

  opts.forEach(function (b) {
    b.addEventListener('click', function () {
      opts.forEach(function (x) { x.classList.remove('sel'); x.setAttribute('aria-pressed', 'false'); });
      b.classList.add('sel');
      b.setAttribute('aria-pressed', 'true');
      attending = (b.dataset.val === 'yes');
      guestsField.style.display = attending ? '' : 'none';
      setStatus('', '');
    });
  });

  function showThanks(yes) {
    form.style.display = 'none';
    thanks.classList.add('show');
    if (!yes) thanks.classList.add('no');
    var svg = thanks.querySelector('.tick svg');
    var path = svg.querySelector('path');
    svg.setAttribute('stroke', yes ? '#34d17a' : '#ff6b78');
    path.setAttribute('d', yes ? 'M20 6 9 17l-5-5' : 'M18 6 6 18M6 6l12 12');
    thanks.querySelector('.tt').textContent = yes ? 'Rahmat! Sizni kutamiz' : 'Rahmat, xabar berdingiz';
    thanks.querySelector('.tp').innerHTML = yes
      ? 'Javobingiz qabul qilindi.<br>Ваш ответ принят. Ждём вас!'
      : 'Afsuski, koʼrisha olmaymiz.<br>Жаль, что не сможете. Спасибо!';
    thanks.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.company.value) { showThanks(true); return; } // honeypot
    if (attending === null) { setStatus('err', 'Iltimos, javobni tanlang · Выберите ответ'); return; }
    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    if (name.length < 2) { setStatus('err', 'Ismingizni kiriting · Укажите имя'); form.name.focus(); return; }
    if (phone.replace(/\D/g, '').length < 7) { setStatus('err', 'Telefonni toʼgʼri kiriting · Укажите телефон'); form.phone.focus(); return; }
    var payload = {
      name: name, phone: phone, attending: attending,
      guests: attending ? (parseInt(form.guests.value, 10) || 1) : 0,
      message: form.message.value.trim(), company: form.company.value,
      elapsed: Date.now() - startedAt
    };
    submitBtn.disabled = true;
    setStatus('load', 'Yuborilmoqda · Отправка…');
    fetch('/api/rsvp', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }).then(function (r) {
      if (r.status === 429) throw { tag: 'rate' };
      if (!r.ok) throw { tag: 'http' };
      return r.json();
    }).then(function () {
      showThanks(attending);
    }).catch(function (err) {
      submitBtn.disabled = false;
      if (err && err.tag === 'rate') setStatus('err', 'Juda koʼp urinish. Birozdan soʼng qayta urining · Слишком много попыток');
      else setStatus('err', 'Xatolik. Qayta urinib koʼring · Ошибка, попробуйте ещё раз');
    });
  });

  // 3D Parallax & Astrolabe Interaction
  var stage = document.querySelector('.stage3d');
  var card = document.getElementById('academyCard');
  var glare = document.getElementById('academyGlare');
  
  if (stage && card) {
    function setTilt(x, y, w, h) {
      var xc = w / 2;
      var yc = h / 2;
      var dx = x - xc;
      var dy = y - yc;
      
      // Limit tilt angles to maximum of 14 degrees for an elegant reaction
      var rx = -(dy / yc) * 14;
      var ry = (dx / xc) * 14;
      
      card.style.transform = 'rotateX(' + rx + 'deg) rotateY(' + ry + 'deg)';
      
      if (glare) {
        var gx = (x / w) * 100;
        var gy = (y / h) * 100;
        glare.style.background = 'radial-gradient(circle at ' + gx + '% ' + gy + '%, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0) 65%)';
      }
    }
    
    function resetTilt() {
      card.style.transform = 'rotateX(0deg) rotateY(0deg)';
      if (glare) {
        glare.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0) 55%, rgba(0, 0, 0, 0.04) 100%)';
      }
    }
    
    stage.addEventListener('mousemove', function (e) {
      var rect = stage.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      setTilt(x, y, rect.width, rect.height);
    });
    
    stage.addEventListener('mouseleave', resetTilt);
    
    stage.addEventListener('touchmove', function (e) {
      if (e.touches.length > 0) {
        var touch = e.touches[0];
        var rect = stage.getBoundingClientRect();
        var x = touch.clientX - rect.left;
        var y = touch.clientY - rect.top;
        if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
          e.preventDefault();
          setTilt(x, y, rect.width, rect.height);
        }
      }
    }, { passive: false });
    
    stage.addEventListener('touchend', resetTilt);
  }
})();
