/* =====================================================================
   A jóslat — kérdőív
   A válaszok összege dönti el, melyik testrész-szett lesz a sárkányodé.
   ===================================================================== */
/** Akkor is lefut, ha a scriptet a DOMContentLoaded UTÁN töltjük be. */
function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

onReady(() => {
  'use strict';

  const CFG = window.QUIZ || { saveUrl: 'save_dragon.php', partsDir: 'dragons/', partsExt: 'png', csrf: '' };
  const EXT = CFG.partsExt || 'png';

  const questions = [
    'A tengerparton a homokba mélyedt karmok nyoma látszik, hatalmas lépéseket tett. A nyomok közvetlenül a tenger felé vezetnek, mintha egy sárkány rejtőzködne a hullámok alatt.',
    'A hajó orrán a ködben egy sárkány feje tűnik fel. Az óceán egyik ősi uralkodója. A szemei olyan élesek, hogy minden mozdulatot figyelnek.',
    'A hegyek között egy lángoló tűzgömb tűnik fel, a sárkányok haragja. A föld elreped a tűz erejétől, és a levegő hirtelen megtelik a hatalmas lény füstjével.',
    'Az éjszakai égbolton egy árnyék suhan el, majd a hold fénye elhalványul. Mintha valami hatalmas és sötét alak közeledne. A szél felerősödik, és egy ismerős, régi sárkányfajta illata kúszik a levegőbe.',
    'A ködben egy hatalmas, tüzes szempár jelenik meg, a sárkányok ősi uralkodója figyel minket. Az éles pillantás mindent áthat, egy titokzatos erő rejtőzködik a sötétben, amit csak a legerősebbek képesek megérinteni.'
  ];

  const options = [
    ['Követés', 'Menekülés'],
    ['Tisztelet', 'Harc'],
    ['Bátorság', 'Óvatosság', 'Menekülés'],
    ['Követés', 'Várakozás', 'Erőszak'],
    ['Barátság', 'Támadás']
  ];

  const questionEl = document.querySelector('.question');
  const optionsEl  = document.querySelector('.options');
  const stepEl     = document.getElementById('quizStep');
  const progressEl = document.getElementById('quizProgress');
  const resultEl   = document.getElementById('result');
  const containerEl = document.getElementById('quizContainer');

  if (!questionEl || !optionsEl) return;

  let soundEnabled = false;
  let current      = 0;      // a most MUTATOTT kérdés indexe
  const answers    = [];

  /* ------------------------------------------------------------------ */
  /* Hangengedély                                                        */
  /* ------------------------------------------------------------------ */
  function askForSound() {
    const overlay = document.createElement('div');
    overlay.id = 'sound-prompt';
    overlay.innerHTML = `
      <div class="sound-prompt-box">
        <h2>Hangos elbeszélés?</h2>
        <p>A kérdéseket és a válaszlehetőségeket fel is olvassuk.</p>
        <div class="sound-prompt-actions">
          <button type="button" class="btn btn-primary" id="enable-sound">Engedélyezem</button>
          <button type="button" class="btn" id="disable-sound">Némán olvasom</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const start = (enabled) => {
      soundEnabled = enabled;
      overlay.remove();
      loadQuestion();
    };

    overlay.querySelector('#enable-sound').addEventListener('click', () => start(true));
    overlay.querySelector('#disable-sound').addEventListener('click', () => start(false));
  }

  /* ------------------------------------------------------------------ */
  /* Betűk szétrebbenése a kurzor elől                                   */
  /* ------------------------------------------------------------------ */
  let pointerRaf = null;
  let pointer    = { x: -9999, y: -9999 };

  function onPointerMove(e) {
    const t = e.touches && e.touches[0];
    pointer = { x: t ? t.clientX : e.clientX, y: t ? t.clientY : e.clientY };
    if (!pointerRaf) pointerRaf = requestAnimationFrame(applyScatter);
  }

  function applyScatter() {
    pointerRaf = null;
    questionEl.querySelectorAll('span').forEach((span) => {
      const r  = span.getBoundingClientRect();
      const dx = r.left + r.width  / 2 - pointer.x;
      const dy = r.top  + r.height / 2 - pointer.y;
      const dist = Math.hypot(dx, dy);

      if (dist < 120) {
        const angle     = Math.atan2(dy, dx);
        const intensity = (120 - dist) / 60;
        span.style.transform = `translate(${Math.cos(angle) * intensity * 20}px, ` +
                               `${Math.sin(angle) * intensity * 20}px) ` +
                               `rotate(${(dx > 0 ? -1 : 1) * intensity * 10}deg)`;
        span.style.color = `rgb(${Math.floor(120 + 135 * intensity)}, ` +
                           `${Math.floor(90 + 60 * intensity)}, ${Math.floor(60 * intensity)})`;
      } else {
        span.style.transform = '';
        span.style.color     = '';
      }
    });
  }

  function resetScatter() {
    pointer = { x: -9999, y: -9999 };
    questionEl.querySelectorAll('span').forEach((s) => { s.style.transform = ''; s.style.color = ''; });
  }

  document.addEventListener('mousemove',  onPointerMove, { passive: true });
  document.addEventListener('touchmove',  onPointerMove, { passive: true });
  document.addEventListener('mouseleave', resetScatter);
  document.addEventListener('touchend',   resetScatter);

  /* ------------------------------------------------------------------ */
  /* Kérdés megjelenítése                                                */
  /* ------------------------------------------------------------------ */
  function loadQuestion() {
    if (current >= questions.length) {
      finish();
      return;
    }

    const index = current;

    stepEl.textContent = `${index + 1} / ${questions.length}`;
    if (progressEl) progressEl.style.width = `${(index / questions.length) * 100}%`;

    questionEl.innerHTML = '';
    optionsEl.innerHTML  = '';
    questionEl.classList.remove('fade-in');

    // Szavanként, azon belül betűnként — így tud szétrebbenni a szöveg
    questions[index].split(' ').forEach((word) => {
      const wordEl = document.createElement('div');
      wordEl.className = 'word';
      for (const char of word) {
        const span = document.createElement('span');
        span.textContent = char;
        wordEl.appendChild(span);
      }
      questionEl.appendChild(wordEl);
    });

    void questionEl.offsetWidth;          // újraindítja az animációt
    questionEl.classList.add('fade-in');

    if (soundEnabled) {
      playAudio(`voices/question${index + 1}.mp3`, () => revealOptions(index));
    } else {
      revealOptions(index);
    }
  }

  /** Lejátszik egy hangfájlt; hiba esetén azonnal továbblép. */
  function playAudio(src, onDone) {
    const audio = new Audio(src);
    let done = false;
    const finishOnce = () => { if (!done) { done = true; onDone(); } };

    audio.addEventListener('ended', finishOnce);
    audio.addEventListener('error', finishOnce);
    audio.play().catch(finishOnce);       // pl. ha a böngésző blokkolja
  }

  function makeOptionButton(index, label, optionIndex) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option tuz';
    btn.textContent = label;
    btn.addEventListener('click', () => selectAnswer(optionIndex + 1));
    optionsEl.appendChild(btn);
    if (typeof window.addCursorEvents === 'function') window.addCursorEvents(btn);
    return btn;
  }

  function revealOptions(index) {
    if (!soundEnabled) {
      options[index].forEach((label, i) => makeOptionButton(index, label, i));
      return;
    }

    // Hanggal: egyesével jelennek meg, ahogy elhangzanak
    const step = (i) => {
      if (i >= options[index].length) return;
      makeOptionButton(index, options[index][i], i);
      playAudio(`voices/question${index + 1}_a${i + 1}.mp3`, () => step(i + 1));
    };
    step(0);
  }

  function selectAnswer(value) {
    answers.push(value);
    current++;

    optionsEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    questionEl.classList.add('fade-out');

    const next = () => {
      questionEl.classList.remove('fade-out');
      loadQuestion();
    };
    questionEl.addEventListener('animationend', next, { once: true });
    setTimeout(next, 700);                // ha az animáció nem futna le
  }

  /* ------------------------------------------------------------------ */
  /* Eredmény                                                            */
  /* ------------------------------------------------------------------ */
  function finish() {
    if (progressEl) progressEl.style.width = '100%';
    showDragon(pickParts(answers));
  }

  function showDragon(parts) {
    containerEl.style.display = 'none';
    resultEl.classList.add('visible');

    resultEl.innerHTML = `
      <div class="result-inner">
        <p class="result-kicker">A köd felszakad</p>
        <h2>Ez a te sárkányod</h2>

        <div class="result-dragon">
          <svg class="tint-def" aria-hidden="true">
            <filter id="quizTint" color-interpolation-filters="sRGB">
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
            </filter>
          </svg>
          <div class="dragon-render floating">
            ${['body', 'legs', 'head', 'wings'].map((s) => `<img src="${CFG.partsDir}${s}[${parts[s]}].${EXT}" alt="" style="filter:url(#quizTint)">`
              + (EXT === 'png' ? `<img src="${CFG.partsDir}${s}[${parts[s]}]-fx.png" alt="" onerror="this.remove()">` : '')).join('')}
          </div>
        </div>

        <div class="result-form">
          <div class="field">
            <label for="dragonName">Hogy hívják?</label>
            <input type="text" id="dragonName" maxlength="60" placeholder="pl. Zafír" autocomplete="off">
          </div>
          <div class="field">
            <label for="dragonColor">Milyen színű?</label>
            <input type="color" id="dragonColor" value="#ff8a3d">
          </div>
          <button class="btn btn-primary" id="submitDragon" type="button">Befogadom</button>
          <p class="result-error" id="resultError" hidden></p>
        </div>
      </div>`;

    const colorInput = document.getElementById('dragonColor');
    const matrixEl   = document.querySelector('#quizTint feColorMatrix');

    const applyColor = () => {
      const hex = colorInput.value.replace('#', '');
      const f   = 1.3;
      const c   = (i) => Math.min(parseInt(hex.substr(i, 2), 16) / 255 * f, 1).toFixed(4);
      matrixEl.setAttribute('values', `${c(0)} 0 0 0 0  0 ${c(2)} 0 0 0  0 0 ${c(4)} 0 0  0 0 0 1 0`);
    };
    colorInput.addEventListener('input', applyColor);
    applyColor();

    const button  = document.getElementById('submitDragon');
    const errorEl = document.getElementById('resultError');

    button.addEventListener('click', () => {
      const name = document.getElementById('dragonName').value.trim();
      if (!name) {
        errorEl.textContent = 'Adj nevet a sárkányodnak!';
        errorEl.hidden = false;
        return;
      }

      errorEl.hidden = true;
      button.disabled = true;
      button.textContent = 'Mentés…';

      const form = new FormData();
      form.append('_csrf', CFG.csrf);
      form.append('dragonName', name);
      form.append('color', colorInput.value);
      form.append('body',  parts.body);
      form.append('head',  parts.head);
      form.append('legs',  parts.legs);
      form.append('wings', parts.wings);

      fetch(CFG.saveUrl, { method: 'POST', body: form, credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          window.location.href = 'user.php';
        })
        .catch((err) => {
          errorEl.textContent = `Nem sikerült elmenteni: ${err.message}`;
          errorEl.hidden = false;
          button.disabled = false;
          button.textContent = 'Befogadom';
        });
    });
  }

  /** A válaszokból testrészek (lásd script/pick_parts.js). */
  function pickParts(ans) {
    return window.pickParts ? window.pickParts(ans)
                            : { head: 1, body: 1, legs: 1, wings: 1 };
  }

  askForSound();
});
