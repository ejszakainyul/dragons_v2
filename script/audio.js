/* =====================================================================
   Háttérzene (rejtett YouTube-lejátszóval) + süti-hozzájárulás.

   A korábbi verzióban a showCookieModal() belsejében újra definiálva volt
   a handleToggleChange és egy második window 'load' figyelő is — ezek
   duplikált eseménykezelőket hoztak létre. Itt minden egyszer szerepel.
   ===================================================================== */
(() => {
  'use strict';

  const COOKIE = 'soundState';
  const VIDEO_ID = 'SQFMyeh9xg0';
  const START_AT = 3271;
  const VOLUME   = 25;

  let player = null;
  let ready  = false;

  /* --- Sütik --------------------------------------------------------- */
  function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 864e5);
    document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/; SameSite=Lax`;
  }

  function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
    return match ? match[1] : '';
  }

  /* --- Kapcsolók ----------------------------------------------------- */
  const toggles = () => [
    document.getElementById('toggleSwitch'),
    document.getElementById('toggleSwitchMobile'),
  ].filter(Boolean);

  function reflect(on) {
    toggles().forEach((t) => { t.checked = on; });
  }

  function apply(on) {
    if (!player || !ready) return;
    if (on) {
      player.unMute();
      player.setVolume(VOLUME);
      player.playVideo();
    } else {
      player.mute();
      player.pauseVideo();
    }
  }

  function onToggle(on) {
    setCookie(COOKIE, on ? 'true' : 'false', 7);
    reflect(on);
    apply(on);
  }

  toggles().forEach((t) => {
    t.addEventListener('change', function () { onToggle(this.checked); });
  });

  /* --- YouTube API --------------------------------------------------- */
  function loadPlayerApi() {
    if (document.getElementById('yt-iframe-api')) return;
    const tag = document.createElement('script');
    tag.id  = 'yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }

  window.onYouTubeIframeAPIReady = function () {
    const host = document.getElementById('youtubePlayer');
    if (!host) return;
    host.removeAttribute('hidden');
    host.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0';

    player = new YT.Player('youtubePlayer', {
      height: '0',
      width: '0',
      videoId: VIDEO_ID,
      playerVars: {
        autoplay: 0,
        mute: 1,
        controls: 0,
        modestbranding: 1,
        start: START_AT,
        enablejsapi: 1,
        origin: window.location.origin,
      },
      events: {
        onReady() {
          ready = true;
          if (getCookie(COOKIE) === 'true') apply(true);
        },
      },
    });
  };

  /* --- Hozzájárulás-ablak -------------------------------------------- */
  function showConsent() {
    const modal = document.createElement('div');
    modal.id = 'cookieModal';
    modal.innerHTML = `
      <div id="cookieModalContent">
        <h2>Sütik és háttérhang</h2>
        <p>Engedélyezed a háttérzenét? A választásodat egy sütiben jegyezzük meg,
           hogy ne kérdezzük meg minden oldalon.</p>
        <div class="cookie-actions">
          <button type="button" class="btn btn-primary" id="acceptCookies">Engedélyezem</button>
          <button type="button" class="btn" id="rejectCookies">Most nem</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#acceptCookies').addEventListener('click', () => {
      onToggle(true);
      loadPlayerApi();
      modal.remove();
    });

    modal.querySelector('#rejectCookies').addEventListener('click', () => {
      onToggle(false);
      modal.remove();
    });
  }

  /* --- Indulás ------------------------------------------------------- */
  const state = getCookie(COOKIE);

  if (state === '') {
    reflect(false);
    // A kalandjátékban nem ugrunk fel kérdéssel: ott saját hangok szólnak,
    // és az ablak a játék felületét takarná el
    if (!document.body.classList.contains('game-page')) showConsent();
  } else {
    const on = state === 'true';
    reflect(on);
    if (on) loadPlayerApi();      // csak akkor töltjük be a YT API-t, ha kell
  }
})();
