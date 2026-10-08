/* LAZER Print Lab — интерактив по всей странице.
   ─────────────────────────────────────────────────────────────
   Общие правила, чтобы «сок» не превратился в тормоза:
   1. Анимируем только transform и opacity — их считает композитор.
   2. Всё, что можно, пишем в CSS-переменные; кадр не перерисовывается.
   3. Любое движение слушаем через requestAnimationFrame с флагом, а не
      напрямую в обработчике события.
   4. На тач-устройствах эффекты курсора не включаются вовсе.
   5. prefers-reduced-motion отключает всё движение.
*/
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ============================================================
     1. Прогресс «печати» страницы
     Полоса вверху растёт по мере прокрутки. Работает всегда,
     даже при reduced-motion: это индикатор, а не украшение.
     ============================================================ */
  var bar = document.createElement("div");
  bar.className = "print-progress";
  bar.setAttribute("aria-hidden", "true");
  document.body.appendChild(bar);

  var scrollTick = false;

  function updateProgress() {
    scrollTick = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var ratio = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
    bar.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
  }

  window.addEventListener("scroll", function () {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(updateProgress);
  }, { passive: true });

  window.addEventListener("resize", updateProgress, { passive: true });
  updateProgress();

  /* ============================================================
     2. Свечение за курсором
     Отдельный слой, который плавно догоняет мышь. Отдельный — потому
     что подменять системный курсор нельзя: это ломает привычное
     поведение и мешает нажимать.
     ============================================================ */
  if (finePointer && !reduce) {
    var glow = document.createElement("div");
    glow.className = "cursor-glow";
    glow.setAttribute("aria-hidden", "true");
    document.body.appendChild(glow);

    var targetX = window.innerWidth / 2;
    var targetY = window.innerHeight / 2;
    var curX = targetX;
    var curY = targetY;
    var glowRaf = 0;

    function glowStep() {
      // Догоняем с коэффициентом: получается мягкое отставание
      curX += (targetX - curX) * 0.12;
      curY += (targetY - curY) * 0.12;
      glow.style.transform = "translate3d(" + curX.toFixed(1) + "px," + curY.toFixed(1) + "px,0)";

      if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
        glowRaf = requestAnimationFrame(glowStep);
      } else {
        glowRaf = 0;
      }
    }

    window.addEventListener("pointermove", function (e) {
      targetX = e.clientX;
      targetY = e.clientY;
      glow.classList.add("is-on");
      if (!glowRaf) glowRaf = requestAnimationFrame(glowStep);
    }, { passive: true });

    // Мышь ушла из окна — гасим
    document.addEventListener("pointerleave", function () {
      glow.classList.remove("is-on");
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) glow.classList.remove("is-on");
    });
  }

  /* ============================================================
     3. Наклон карточек за курсором
     Карточка слегка поворачивается к мыши, а по ней бежит блик.
     Угол намеренно маленький (до 5°): большой выглядит как балаган.
     ============================================================ */
  if (finePointer && !reduce) {
    var MAX_TILT = 4.5;

    document.querySelectorAll(".card").forEach(function (card) {
      card.classList.add("tilt", "tilt--glare");

      var raf = 0;
      var nextX = 0.5;
      var nextY = 0.5;
      var ticking = false;

      function apply() {
        ticking = false;
        var rx = (0.5 - nextY) * MAX_TILT * 2;
        var ry = (nextX - 0.5) * MAX_TILT * 2;
        card.style.setProperty("--mx", (nextX * 100).toFixed(1) + "%");
        card.style.setProperty("--my", (nextY * 100).toFixed(1) + "%");
        card.style.transform =
          "perspective(900px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-3px)";
      }

      card.addEventListener("pointerenter", function () {
        card.classList.add("is-tilting");
      });

      card.addEventListener("pointermove", function (e) {
        var r = card.getBoundingClientRect();
        nextX = (e.clientX - r.left) / r.width;
        nextY = (e.clientY - r.top) / r.height;
        if (!ticking) {
          ticking = true;
          raf = requestAnimationFrame(apply);
        }
      }, { passive: true });

      card.addEventListener("pointerleave", function () {
        card.classList.remove("is-tilting");
        card.style.removeProperty("--mx");
        card.style.removeProperty("--my");
        // Возвращаем на место; transition из CSS сделает это плавно
        card.style.transform = "";
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
      });
    });
  }

  /* ============================================================
     4. Магнитные кнопки
     Кнопка слегка тянется к курсору, но не больше 4 пикселей:
     иначе прицел по кнопке сбивается и становится неудобно.
     ============================================================ */
  if (finePointer && !reduce) {
    document.querySelectorAll(".btn").forEach(function (btn) {
      var raf = 0;
      var tx = 0;
      var ty = 0;

      btn.addEventListener("pointermove", function (e) {
        var r = btn.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 8;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 6;
        if (raf) return;
        raf = requestAnimationFrame(function () {
          raf = 0;
          btn.style.transform = "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0)";
        });
      }, { passive: true });

      btn.addEventListener("pointerleave", function () {
        tx = ty = 0;
        btn.style.transform = "";
      });
    });
  }

  /* ============================================================
     5. Счётчики цифр
     Числа в статистике «досчитываются» при появлении. Работает
     по data-атрибутам, поэтому разметку можно менять свободно.
     ============================================================ */
  var counters = document.querySelectorAll("[data-count-to]");

  function runCounter(el) {
    var to = parseFloat(el.getAttribute("data-count-to"));
    var decimals = parseInt(el.getAttribute("data-count-decimals") || "0", 10);
    var prefix = el.getAttribute("data-count-prefix") || "";
    var suffix = el.getAttribute("data-count-suffix") || "";
    var duration = 1100;

    function render(value) {
      el.textContent = prefix + value.toFixed(decimals).replace(".", ",") + suffix;
    }

    // Финальное значение выставляем сразу же: даже если анимация не пойдёт
    // (или её прервут), на экране останется правильное число, а не ноль.
    function settle() {
      render(to);
      el.classList.remove("is-counting");
    }

    if (reduce) {
      settle();
      return;
    }

    el.classList.add("is-counting");
    var t0 = 0;

    function tick(now) {
      if (!t0) t0 = now;
      var elapsed = now - t0;
      var p = Math.min(1, elapsed / duration);
      // Плавное замедление в конце
      var eased = 1 - Math.pow(1 - p, 3);
      render(to * eased);
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        settle();
      }
    }

    requestAnimationFrame(tick);

    // Страховка: если кадры не приходят (фоновая вкладка, экономия батареи),
    // число всё равно встанет на место.
    setTimeout(function () {
      if (el.classList.contains("is-counting")) settle();
    }, duration + 450);
  }

  if (counters.length) {
    if (!("IntersectionObserver" in window) || reduce) {
      counters.forEach(runCounter);
    } else {
      var countObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          runCounter(entry.target);
          countObserver.unobserve(entry.target);
        });
      }, { threshold: 0.4 });
      counters.forEach(function (el) { countObserver.observe(el); });
    }
  }

  /* ============================================================
     6. Заголовки «печатаются» снизу вверх
     Метафора принтера: блок как будто проявляется слой за слоем.
     ============================================================ */
  var printTargets = document.querySelectorAll(".print-reveal");

  if (printTargets.length) {
    if (!("IntersectionObserver" in window) || reduce) {
      printTargets.forEach(function (el) { el.classList.add("is-printed"); });
    } else {
      var printObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-printed");
          printObserver.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -12% 0px", threshold: 0.15 });
      printTargets.forEach(function (el) { printObserver.observe(el); });

      // Страховка: если наблюдатель почему-то не сработал, заголовки всё равно
      // должны появиться. Оставлять контент невидимым ради эффекта нельзя —
      // заголовок секции важнее анимации.
      // Проверяем регулярно, а не один раз: при быстрой прокрутке наблюдатель
      // может не успеть, и тогда заголовок остался бы скрытым навсегда.
      var rescueTimer = setInterval(function () {
        var pending = document.querySelectorAll(".print-reveal:not(.is-printed)");
        if (!pending.length) {
          clearInterval(rescueTimer);
          return;
        }
        pending.forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.top < window.innerHeight && r.bottom > 0) el.classList.add("is-printed");
        });
      }, 1200);
    }
  }

  /* ============================================================
     7. Подсказка про 3D-объект
     Если у hero есть canvas с каркасом, намекаем, что деталь
     можно повернуть: это приглашение к взаимодействию.
     ============================================================ */
  var hint = document.querySelector("[data-mesh-hint]");
  if (hint && !finePointer) hint.remove();
})();
