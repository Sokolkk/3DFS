/* LAZER Print Lab — фон hero: каркас печатаемой детали и частицы.
   ─────────────────────────────────────────────────────────────────
   Принципы, чтобы сайт остался лёгким:
   1. Никаких библиотек. Проекция 3D → 2D считается вручную: это пара
      килобайт кода вместо ~150 КБ three.js.
   2. Рисуем только то, что видно: canvas лежит в hero, и когда hero уходит
      за экран или вкладка скрыта, цикл полностью останавливается.
   3. Частиц мало (по умолчанию 30), линии связей обрезаны по расстоянию и
      количеству — иначе получается «волосяной клубок» и просадка fps.
   4. Частота кадров ограничена 40: на глаз плавно, а нагрузка почти вдвое
      ниже, чем при 60.
   5. Уважаем prefers-reduced-motion: тогда рисуем один кадр без анимации.
*/
(function () {
  "use strict";

  var canvas = document.getElementById("fxCanvas");
  var hero = document.getElementById("hero");
  if (!canvas || !hero) return;

  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Размер и плотность пикселей ---------- */
  // Плотность выше 2 не нужна: на телефонах это вчетверо больше пикселей
  // при том же визуальном результате.
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0;
  var H = 0;

  function resize() {
    /* Размер холста. Сцена закреплена на экране (position: fixed), поэтому
       брать размер у родителя нельзя: у body высота равна всей странице, и
       холст получился бы в десятки раз выше окна — картинка размывалась бы
       сжатием. Для fixed-слоя верный размер — размер окна. */
    var rect = hero.getBoundingClientRect();
    var fixed = window.getComputedStyle(canvas).position === "fixed";
    W = Math.max(320, Math.round(fixed ? window.innerWidth : rect.width));
    H = Math.max(280, Math.round(fixed ? window.innerHeight : rect.height));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildObject();
    buildParticles();
  }

  /* ---------- Печатаемые детали ----------
     Параметрическая поверхность: круглый профиль по высоте с «талией»,
     как у настоящей напечатанной детали. Горизонтали дают эффект слоёв.

     Деталей несколько, и вот почему. Сцена теперь фон всей страницы, а не
     одной шапки: одна деталь по центру огромного экрана выглядела бы
     мелкой и одинокой. Поэтому это «ферма» — несколько деталей на разной
     глубине, каждая печатается со своей задержкой. Так фон читается как
     мастерская, где работа идёт параллельно. */
  var RINGS = 24;   // горизонтальных слоёв
  var SEGS = 20;    // точек по окружности
  var detali = [];  // список печатаемых деталей
  var objScale = 1;

  function makeMesh() {
    // Радиус профиля: плавное сужение к середине и расширение к низу
    function radiusAt(v) {
      var waist = 0.72 + 0.28 * Math.abs(Math.cos(v * Math.PI));
      var base = 1 + 0.14 * (1 - v);
      return waist * base;
    }

    var m = [];
    for (var i = 0; i <= RINGS; i++) {
      var v = i / RINGS;
      var y = (v - 0.5) * 1.55;
      var r = radiusAt(v) * 0.62;
      var ring = [];
      for (var j = 0; j < SEGS; j++) {
        var a = (j / SEGS) * Math.PI * 2;
        ring.push([Math.cos(a) * r, y, Math.sin(a) * r]);
      }
      m.push(ring);
    }
    return m;
  }

  function buildObject() {
    /* Раскладка. Детали летают по всему экрану — это и есть эффект
       работающей мастерской. Читаемость текста обеспечивается тем, что
       сцена лежит ПОД контентом (у main есть z-index) и что у текста
       появилась тень: раньше детали налезали на буквы именно из-за
       отсутствия z-index у main. */
    objScale = Math.max(42, Math.min(H * 0.11, 92));

    /* Полосы разнесены по площади: слева, справа и по краям. По
       вертикали они проплывают всю высоту экрана. */
    var spots = [
      { x: W * 0.08, y: H * 0.20, s: 1.00, build: 0.82 },
      { x: W * 0.06, y: H * 0.62, s: 0.80, build: 0.55 },
      { x: W * 0.78, y: H * 0.16, s: 0.90, build: 0.68 },
      { x: W * 0.92, y: H * 0.55, s: 0.85, build: 0.60 },
      { x: W * 0.14, y: H * 0.88, s: 0.70, build: 0.44 }
    ];

    detali = [];
    for (var i = 0; i < spots.length; i++) {
      var st = spots[i];
      detali.push({
        mesh: makeMesh(),
        x: st.x,
        y: st.y,
        /* Стартовый прогресс: без него деталь начинает с нуля и в первый
           момент видно только одно кольцо — фон выглядит пустым. */
        build: st.build,
        rate: 0.45 + (i % 2) * 0.3,
        scale: objScale * st.s,
        alpha: 0.5 + (i % 3) * 0.2,
        spin: (i % 2 === 0 ? 1 : -1) * 0.7,
        /* Своя скорость всплытия при прокрутке: слои движутся не синхронно. */
        rise: 0.5 + i * 0.35
      });
    }
  }

  /* ---------- Частицы ---------- */
  var particles = [];
  var PARTICLE_COUNT = 30;
  var LINK_DIST = 132;
  var MAX_LINKS = 26;

  function buildParticles() {
    // Плотность частиц тоже зависит от площади: на большом экране
    // тридцать точек выглядят пусто, на маленьком — тесно.
    var area = W * H;
    var count = Math.round(Math.min(46, Math.max(18, area / 26000)));
    PARTICLE_COUNT = count;

    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: Math.random() * 1.4 + 0.6,
        // Часть точек — «золотые»: это тёплый акцент бренда
        warm: Math.random() < 0.35
      });
    }
  }

  /* ---------- Проекция ---------- */
  var cosA = 1, sinA = 0;
  var cosB = 1, sinB = 0;

  /* Проекция точки детали в экран.
     Центр и размер передаём явно: деталей несколько, и у каждой своё
     место и свой масштаб. */
  function project(p, cx, cy, scale) {
    // Поворот вокруг Y, затем лёгкий наклон вокруг X
    var x = p[0] * cosA - p[2] * sinA;
    var z = p[0] * sinA + p[2] * cosA;
    var y = p[1] * cosB - z * sinB;
    var zz = p[1] * sinB + z * cosB;

    // Перспектива: дальние точки чуть меньше
    var d = 3.1;
    var k = d / (d + zz);
    return [cx + x * scale * k, cy + y * scale * k, zz, k];
  }

  /* ---------- Отрисовка ---------- */
  /* ---------- Цикл «печати» ----------
     Прогресс привязан ко времени, а не к числу кадров. Если считать по кадрам,
     на слабом устройстве деталь строится в разы дольше: там меньше кадров
     в секунду, а значит и шагов. С временем скорость одинаковая везде. */
  var PRINT_SECONDS = 11;   // сколько строится деталь при простое
  var HOLD_SECONDS = 3;     // сколько стоит готовой
  var progress = 0;
  var holding = false;
  var holdElapsed = 0;
  var phase = 0;
  /* Доля пройденной страницы. Печать не может отставать от неё:
     так прокрутка напрямую ведёт процесс. */
  var scrollRatio = 0;

  /* Автовращение. Пользователь может его перехватить: потянув мышью по
     каркасу, он вращает деталь сам, и автовращение на паузе. */
  var AUTO_SPIN = 0.42;
  var spinPaused = false;
  var userTilt = 0;      // наклон вокруг X от перетаскивания
  var targetTilt = 0;

  function advance(dt) {
    if (holding) {
      holdElapsed += dt;
      if (holdElapsed >= HOLD_SECONDS) {
        holding = false;
        holdElapsed = 0;
        progress = 0;
      }
    } else {
      progress += dt / PRINT_SECONDS;
      if (progress >= 1) {
        progress = 1;
        holding = true;
      }
    }

    /* Прокрутка тянет печать за собой: поднимаем прогресс до нижней
       границы, которую задаёт страница. Так человек листает вниз —
       деталь собирается на глазах, а возвращается наверх — процесс
       откатывается. Фон становится частью чтения, а не отдельной
       картинкой. */
    var floor = scrollRatio * 0.95;
    if (progress < floor) {
      progress = floor;
      // Если прокрутка довела до конца, дальше держим готовую деталь
      if (progress >= 1) { progress = 1; holding = true; }
    }

    // Вращение по времени: скорость одна и та же при любом fps.
    // Пока деталь крутит пользователь, автовращение отдыхает.
    if (!spinPaused) phase += dt * AUTO_SPIN;
    // Наклон плавно возвращается к нулю, когда руку отпустили
    userTilt += (targetTilt - userTilt) * Math.min(1, dt * 3.2);
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // --- Частицы и связи ---
    var i, j, p;
    var links = 0;

    for (i = 0; i < particles.length; i++) {
      p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      // Мягкая закольцовка по краям
      if (p.x < -10) p.x = W + 10;
      if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10;
      if (p.y > H + 10) p.y = -10;

      // Ограничение по вертикали: над текстом частиц быть не должно
      var alpha = 0.5;
      if (p.x < W * 0.52 && W > 900) alpha = 0.18; // зона текста — почти невидимо

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.warm
        ? "rgba(232, 184, 75, " + alpha + ")"
        : "rgba(94, 194, 240, " + alpha + ")";
      ctx.fill();
    }

    // Связи: только между близкими точками и не больше лимита
    ctx.lineWidth = 1;
    for (i = 0; i < particles.length && links < MAX_LINKS; i++) {
      for (j = i + 1; j < particles.length && links < MAX_LINKS; j++) {
        var dx = particles[i].x - particles[j].x;
        var dy = particles[i].y - particles[j].y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > LINK_DIST) continue;
        links++;
        var a = (1 - dist / LINK_DIST) * 0.16;
        ctx.strokeStyle = "rgba(94, 194, 240, " + a.toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }

    // --- Детали: рисуем только «напечатанные» слои ---
    for (var d = 0; d < detali.length; d++) {
      var obj = detali[d];
      /* Прогресс детали держим в пределах от 0,45 до 1.
         Важно: деталь НЕ сбрасывается в ноль. Раньше цикл начинался
         заново, и в этот момент на экране оставалось одно кольцо —
         фон выглядел пустым. Теперь печать идёт волной: деталь
         подрастает до конца и мягко возвращается к частично собранной. */
      var pr = obj.build + progress * obj.rate;
      pr -= Math.floor(pr);              // 0..1
      pr = 0.45 + pr * 0.55;             // 0,45..1

      /* Прокрутка поднимает детали: у каждой своя скорость, поэтому
         слои проплывают мимо читателя не синхронно. Движение
         закольцовано так, чтобы деталь всегда была в кадре: полоса
         движения — от верхнего края над экраном до нижнего под ним,
         а стартовая позиция приводится внутрь этой полосы. Без этого
         деталь с позицией ниже середины на первом кадре уезжала за
         верх экрана и пропадала. */
      var span = H + obj.scale * 2;
      var top = -obj.scale;
      var y0 = top + (((obj.y - top) % span) + span) % span;
      /* scrollRatio — доля пройденной страницы, она же ведёт печать. */
      var dy = y0 - (scrollRatio * obj.rise * span) % span;
      if (dy < top) dy += span;

      drawDetail(obj, pr, d === 0, dy);
    }
  }

  /* Рисует одну деталь. head — нужно ли показать головку печати:
     одновременно работающих головок на экране было бы слишком много,
     поэтому её получает только первая деталь. */
  function drawDetail(obj, pr, withHead, cy) {
    var m = obj.mesh;
    var printedRings = Math.max(1, Math.floor(pr * RINGS));
    var i, j;
    /* Вертикальное положение: базовое плюс сдвиг от прокрутки. */
    var oy = cy === undefined ? obj.y : cy;

    ctx.globalAlpha = obj.alpha;

    // Вертикальные образующие
    ctx.strokeStyle = "rgba(94, 194, 240, 0.40)";
    ctx.lineWidth = 1;
    for (j = 0; j < SEGS; j += 2) {
      ctx.beginPath();
      var started = false;
      for (i = 0; i <= printedRings; i++) {
        var vp = project(m[i][j], obj.x, oy, obj.scale);
        if (!started) { ctx.moveTo(vp[0], vp[1]); started = true; }
        else ctx.lineTo(vp[0], vp[1]);
      }
      ctx.stroke();
    }

    // Горизонтальные слои печати
    for (i = 0; i <= printedRings; i++) {
      // Верхние слои ярче: они «только что напечатаны»
      var fresh = i / Math.max(1, printedRings);
      var la = 0.28 + fresh * 0.55;
      ctx.strokeStyle = "rgba(94, 194, 240, " + la.toFixed(3) + ")";
      ctx.beginPath();
      for (j = 0; j <= SEGS; j++) {
        var q = project(m[i][j % SEGS], obj.x, oy, obj.scale);
        if (j === 0) ctx.moveTo(q[0], q[1]);
        else ctx.lineTo(q[0], q[1]);
      }
      ctx.stroke();
    }

    // Головка печати на текущем слое
    if (withHead && printedRings < RINGS) {
      var head = project(m[printedRings][0], obj.x, oy, obj.scale);
      ctx.beginPath();
      ctx.arc(head[0], head[1], 3.2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(232, 184, 75, 0.95)";
      ctx.fill();

      // Тёплое пятно от головки
      var grad = ctx.createRadialGradient(head[0], head[1], 0, head[0], head[1], 46);
      grad.addColorStop(0, "rgba(232, 184, 75, 0.22)");
      grad.addColorStop(1, "rgba(232, 184, 75, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(head[0], head[1], 46, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  function step(dt) {
    advance(dt);

    cosA = Math.cos(phase);
    sinA = Math.sin(phase);
    // Базовый наклон 0,42 рад плюс то, что добавил пользователь
    var tilt = 0.42 + userTilt;
    cosB = Math.cos(tilt);
    sinB = Math.sin(tilt);

    draw();
  }

  /* ---------- Цикл с остановкой ---------- */
  var raf = 0;
  var running = false;
  var lastTime = 0;
  var FRAME_MS = 1000 / 40; // 40 кадров в секунду достаточно и дешевле 60

  function loop(now) {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    if (!lastTime) { lastTime = now; return; }
    var delta = now - lastTime;
    if (delta < FRAME_MS) return;
    // Ограничиваем шаг: после сворачивания окна delta может быть огромной,
    // и без ограничения анимация «прыгнет» вперёд.
    var dt = Math.min(delta, 200) / 1000;
    lastTime = now;
    step(dt);
  }

  function start() {
    if (running || reduce) return;
    running = true;
    lastTime = 0;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* Сцена закреплена на экране и видна всегда, пока открыта страница.
     Поэтому следить за hero нельзя: он уезжает вверх при прокрутке, и
     сцена глохла бы ровно тогда, когда нужна. Единственное условие
     остановки — документ скрыт (вкладка в фоне или окно свёрнуто). */
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  /* ---------- Прокрутка ведёт печать ---------- */
  var scrollTick = false;
  function readScroll() {
    scrollTick = false;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    scrollRatio = max > 0 ? Math.min(1, Math.max(0, window.pageYOffset / max)) : 0;
  }

  window.addEventListener("scroll", function () {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(readScroll);
  }, { passive: true });

  // Пересчёт при смене размера — с задержкой, чтобы не дёргать layout в процессе
  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      resize();
      if (!running) draw();
    }, 180);
  }, { passive: true });

  /* ---------- Перетаскивание каркаса мышью ----------
     Взаимодействие только там, где курсор мыши: иначе каркас «хватал» бы
     касания и мешал прокручивать страницу на телефоне. */
  var dragging = false;
  var dragStartX = 0;
  var dragStartY = 0;
  var dragStartPhase = 0;
  var dragStartTilt = 0;

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    canvas.style.pointerEvents = "auto";
    canvas.style.cursor = "grab";

    canvas.addEventListener("pointerdown", function (e) {
      dragging = true;
      spinPaused = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartPhase = phase;
      dragStartTilt = targetTilt;
      canvas.style.cursor = "grabbing";
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      // Горизонталь вращает деталь, вертикаль наклоняет её.
      // Делитель подобран так, чтобы оборот занимал примерно ширину экрана.
      phase = dragStartPhase + (e.clientX - dragStartX) * 0.011;
      // Наклон ограничен: переворачивать деталь вверх дном не даём
      var tilt = dragStartTilt - (e.clientY - dragStartY) * 0.005;
      targetTilt = Math.max(-0.45, Math.min(0.45, tilt));
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
      targetTilt = 0; // наклон возвращаем, вращение оставляем как есть
      // Автовращение возобновляем с задержкой, чтобы не было рывка
      setTimeout(function () { spinPaused = false; }, 900);
    }

    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", endDrag);
  }

  readScroll();
  resize();

  if (reduce) {
    // Без анимации: показываем готовую деталь целиком, один раз
    progress = 1;
    draw();
  } else {
    draw();
    start();
  }
})();
