/* =====================================================================
   A jóslat kiértékelése: a válaszokból testrészek.

   Szándékosan NEM egy kész szettet ad vissza: minden testrész más-más
   válaszkombinációból jön, így kevert sárkányok születnek. A választék a
   szerverről érkezik (window.QUIZ.pools), tehát a katalógus bővítésekor
   magától bővül — a titkos darabok viszont soha nincsenek benne.
   ===================================================================== */
window.pickParts = function pickParts(answers) {
  const pools = (window.QUIZ && window.QUIZ.pools) || {};
  const a = (i) => answers[i] || 1;

  // Részenként más súlyozás, hogy két válasz ugyanarra a kombinációra
  // ne adjon mindenhol azonos eredményt
  const weights = {
    head:  [3, 5, 0, 2, 1],
    body:  [1, 2, 5, 0, 3],
    legs:  [2, 0, 3, 5, 1],
    wings: [0, 3, 1, 2, 5],
  };

  const out = {};
  for (const slot of ['head', 'body', 'legs', 'wings']) {
    const pool = pools[slot];
    if (!pool || !pool.length) { out[slot] = 1; continue; }

    let n = 0;
    weights[slot].forEach((w, i) => { n += w * a(i); });
    out[slot] = pool[n % pool.length];
  }
  return out;
};
