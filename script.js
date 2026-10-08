/* LAZER Print Lab — поведение страницы.
   Ничего критичного для показа контента: без скрипта класс .no-js оставит
   все блоки видимыми, а меню доступно по прямой ссылке в подвале. */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.remove("no-js");

  /* ---------- Меню-оверлей (нативный dialog) ----------
     dialog попадает в top layer, поэтому рисуется поверх страницы без z-index. */
  var dialog = document.getElementById("siteMenu");
  var toggle = document.querySelector(".nav__toggle");

  function openMenu() {
    if (!dialog) return;
    if (typeof dialog.showModal !== "function") {
      var fallback = document.getElementById("catalog");
      if (fallback) fallback.scrollIntoView();
      return;
    }
    if (dialog.open) return;
    dialog.showModal();
    root.classList.add("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "true");
  }

  function closeMenu() {
    if (!dialog || !dialog.open) return;
    if (typeof dialog.close === "function") dialog.close();
    root.classList.remove("menu-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
  }

  if (dialog) {
    if (toggle) toggle.addEventListener("click", openMenu);

    dialog.addEventListener("click", function (e) {
      if (e.target.closest("[data-menu-close]")) { closeMenu(); return; }
      if (e.target.closest(".mmenu__panel a")) closeMenu();
      if (e.target !== dialog) return;
      var panel = dialog.querySelector(".mmenu__panel");
      if (!panel) { closeMenu(); return; }
      if (e.clientY > panel.getBoundingClientRect().bottom) closeMenu();
    });

    dialog.addEventListener("close", function () {
      root.classList.remove("menu-open");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  }

  /* ---------- Кнопка «наверх» ---------- */
  var toTop = document.getElementById("toTop");
  var lastY = window.pageYOffset || 0;
  var ticking = false;

  function onScrollFrame() {
    ticking = false;
    var y = window.pageYOffset || 0;
    if (toTop) toTop.classList.toggle("is-visible", y > 600);
    lastY = y;
  }

  window.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(onScrollFrame);
  }, { passive: true });

  onScrollFrame();

  if (toTop) {
    toTop.addEventListener("click", function () {
      var smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "auto" });
      var brand = document.querySelector(".nav__brand");
      if (brand && typeof brand.focus === "function") {
        brand.setAttribute("tabindex", "-1");
        brand.focus({ preventScroll: true });
      }
    });
  }

  /* ---------- Слайдеры в карточках товаров ----------
     Прокрутка нативная, поэтому слайдер работает и без скрипта. Здесь только
     точки-индикаторы: они создаются по числу кадров и подсвечивают текущий. */
  var cardSliders = Array.prototype.slice.call(document.querySelectorAll("[data-slider]"));

  cardSliders.forEach(function (box) {
    var trackEl = box.querySelector(".cslider__track");
    var dotsBox = box.querySelector(".cslider__dots");
    var slides = Array.prototype.slice.call(box.querySelectorAll(".cslider__slide"));
    if (!trackEl || !dotsBox || slides.length < 2) return;

    // Портретные кадры выводим в пропорции 3:4, иначе вертикальное фото
    // пришлось бы сильно уменьшить и изделие потерялось бы.
    // Критерий берём из атрибутов width/height в разметке, а не из naturalWidth:
    // у ленивых картинок размеры ещё не измерены, и проверка дала бы ложный ноль.
    var firstImg = slides[0] && slides[0].querySelector("img");
    if (firstImg) {
      var iw = parseInt(firstImg.getAttribute("width"), 10);
      var ih = parseInt(firstImg.getAttribute("height"), 10);
      if (iw && ih && ih > iw) box.classList.add("cslider--portrait");
    }

    var dots = slides.map(function (_, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "cslider__dot";
      b.setAttribute("aria-label", "Кадр " + (i + 1) + " из " + slides.length);
      b.addEventListener("click", function () {
        // Подсвечиваем точку сразу, не дожидаясь события прокрутки:
        // иначе отклик на клик запаздывает и выглядит как «не сработало».
        setActive(i);
        trackEl.scrollTo({ left: slides[i].offsetLeft - trackEl.offsetLeft, behavior: "smooth" });
      });
      dotsBox.appendChild(b);
      return b;
    });

    var currentSlide = -1;

    function setActive(index) {
      if (index === currentSlide) return;
      currentSlide = index;
      dots.forEach(function (d, i) {
        if (i === index) d.setAttribute("aria-current", "true");
        else d.removeAttribute("aria-current");
      });
    }

    var tick = false;

    function sync() {
      tick = false;
      if (!trackEl.clientWidth) return;
      var index = Math.max(0, Math.min(slides.length - 1, Math.round(trackEl.scrollLeft / trackEl.clientWidth)));
      setActive(index);
    }

    trackEl.addEventListener("scroll", function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(sync);
    }, { passive: true });

    setActive(0);
  });

  /* ---------- Появление блоков при прокрутке ---------- */
  var items = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (items.length) {
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
    } else {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.05 });

      items.forEach(function (el, i) {
        el.style.transitionDelay = Math.min(i % 5, 4) * 70 + "ms";
        observer.observe(el);
      });
    }
  }

  /* ---------- Год в подвале ---------- */
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
