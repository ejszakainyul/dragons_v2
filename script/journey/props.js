/* =====================================================================
   Kellékek: rúnakövek, kapuívek, sziklák, fenyők, lávarepedések,
   a ködben nyíló szempár, a koponyaív és a sárkány sziluettje.
   ===================================================================== */
import * as THREE from 'three';
import { terrainHeight } from './world.js';
import { VirtualLight } from './lightpool.js';

/*
 * Anyagválasztás: MeshLambertMaterial a MeshStandardMaterial helyett.
 * Minden itteni felület matt (érdesség 0.75–1.0), tehát a PBR tükröző
 * tagja gyakorlatilag nulla — a látvány ugyanaz, a pixelenkénti
 * fényszámítás viszont töredéke. Gyengébb gépen ez sokat számít, mert
 * a terep és a kellékek töltik ki a kép nagy részét.
 */

/* ---------------------------------------------------------------------
   Rúnatextúra — canvasra rajzolt, világító jelek
   ------------------------------------------------------------------- */
const RUNES = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ'];

let runeTextureCache = null;

export function runeTexture() {
  if (runeTextureCache) return runeTextureCache;

  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size * 4;
  const ctx = c.getContext('2d');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, c.width, c.height);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(size * 0.46)}px serif`;

  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const glyph = RUNES[Math.floor(Math.random() * RUNES.length)];
    ctx.globalAlpha = 0.5 + Math.random() * 0.5;
    ctx.fillText(glyph, size / 2, (i + 0.5) * (c.height / rows));
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  runeTextureCache = tex;
  return tex;
}

/* ---------------------------------------------------------------------
   Rúnakő (checkpoint jelző)
   ------------------------------------------------------------------- */
export function buildMonolith(color = '#4fd6ff') {
  const group = new THREE.Group();

  const stoneGeo = new THREE.BoxGeometry(2.6, 11, 1.5, 1, 4, 1);
  // Enyhe deformáció, hogy ne legyen doboz-szerű
  const p = stoneGeo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setX(i, p.getX(i) + (Math.random() - 0.5) * 0.42);
    p.setZ(i, p.getZ(i) + (Math.random() - 0.5) * 0.34);
  }
  stoneGeo.computeVertexNormals();

  const stone = new THREE.Mesh(
    stoneGeo,
    new THREE.MeshLambertMaterial({ color: '#2c3550', flatShading: true })
  );
  stone.position.y = 5.5;
  group.add(stone);

  // Világító rúnák a kő előlapján
  const runeMat = new THREE.MeshBasicMaterial({
    map: runeTexture(),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    color: new THREE.Color(color),
  });
  const runes = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 9.4), runeMat);
  runes.position.set(0, 5.6, 0.79);
  group.add(runes);

  const runesBack = runes.clone();
  runesBack.position.z = -0.79;
  runesBack.rotation.y = Math.PI;
  group.add(runesBack);

  // Talapzatfény
  const glow = new VirtualLight(new THREE.Color(color), 26, 46, 2);
  glow.position.y = 4.5;
  group.add(glow);

  group.userData.runeMat = runeMat;
  group.userData.glow = glow;
  return group;
}

/* ---------------------------------------------------------------------
   Kapuív — ezen repül át a kamera, ha ezt a választ adod
   ------------------------------------------------------------------- */
let gateSharedCache = null;

/** A kapuk közös geometriái és anyaga — kapunként újra létrehozni fölösleges. */
function gateShared() {
  if (!gateSharedCache) {
    gateSharedCache = {
      pillarGeo: new THREE.CylinderGeometry(0.55, 0.85, 13, 7),
      pillarMat: new THREE.MeshLambertMaterial({ color: '#27304a', flatShading: true }),
      archGeo:   new THREE.TorusGeometry(5.2, 0.48, 8, 40, Math.PI),
      portalGeo: new THREE.CircleGeometry(5.0, 48),
    };
  }
  return gateSharedCache;
}

/** Egy kapu saját (nem közös) erőforrásainak felszabadítása. */
export function disposeGate(gate) {
  const portal = gate.userData.portal;
  if (portal && portal.material) portal.material.dispose();
}

export function buildGate(color = '#ff8a3d') {
  const group = new THREE.Group();
  const col = new THREE.Color(color);

  // Két oszlop — a geometria és az anyag minden kapué közös
  const { pillarGeo, pillarMat, archGeo, portalGeo } = gateShared();
  for (const sx of [-5.2, 5.2]) {
    const pillar = new THREE.Mesh(pillarGeo, pillarMat);
    pillar.position.set(sx, 6.5, 0);
    group.add(pillar);
  }

  // Ív
  const arch = new THREE.Mesh(archGeo, pillarMat);
  arch.position.y = 13;
  group.add(arch);

  // A kapu „hártyája" — additív, hullámzó felület
  const portalUniforms = {
    uTime:   { value: 0 },
    uColor:  { value: col.clone() },
    uPower:  { value: 0.0 },      // 0 = halvány, 1 = izzik (kiválasztva)
    // Kapunként külön fázis: e nélkül a három kapu ütemre lüktet, ami
    // azonnal elárulja, hogy ugyanaz a shader fut mindháromban.
    uPhase:  { value: Math.random() * 6.283 },
  };

  const portal = new THREE.Mesh(
    portalGeo,
    new THREE.ShaderMaterial({
      uniforms: portalUniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform float uTime;
        uniform vec3  uColor;
        uniform float uPower;
        uniform float uPhase;
        varying vec2  vUv;

        vec2 rot(vec2 p, float a) {
          float c = cos(a), s = sin(a);
          return mat2(c, -s, s, c) * p;
        }

        void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          float r = length(uv);
          float t = uTime * 0.42 + uPhase;

          // Tartomány-torzítás: a minta önmagát sodorja el. Ettől lesz
          // folyós; a korábbi egyetlen sin() hullám ehelyett ütemesen
          // villogott, mint egy hibás neonfelirat.
          vec2 q = uv;
          q += 0.16 * vec2(sin(q.y * 3.1 + t * 0.9), cos(q.x * 2.7 - t * 0.7));
          q  = rot(q, t * 0.11 + r * 0.55);

          float ang = atan(q.y, q.x);
          float rq  = length(q);

          // Két, eltérő sebességű fátyol egymásra csúsztatva
          float veil = sin(ang * 3.0 + rq * 4.2 - t * 1.35)
                     + 0.62 * sin(ang * 5.0 - rq * 6.5 + t * 0.85);
          veil = veil * 0.24 + 0.5;

          // Befelé futó, lágy hullámgyűrűk
          float w = fract(rq * 1.35 - t * 0.30);
          float ripple = smoothstep(0.55, 0.0, abs(w - 0.5) * 2.0);

          float disc = smoothstep(1.02, 0.84, r);
          float core = smoothstep(1.0, 0.12, r);
          float rim  = smoothstep(1.0, 0.90, r) * smoothstep(0.70, 0.90, r);

          // Lassú lélegzet, nem pulzálás
          float breathe = 0.88 + 0.12 * sin(t * 0.8);

          float alpha = disc * (core * (0.09 + veil * 0.20) + ripple * 0.09 + rim * 0.85);
          alpha *= breathe * (0.26 + uPower * 0.92);

          gl_FragColor = vec4(uColor * (1.0 + uPower * 1.5 + rim * 0.55), alpha);
        }
      `,
    })
  );
  portal.position.y = 7.4;
  group.add(portal);

  const light = new VirtualLight(col, 12, 52, 2);
  light.position.set(0, 8, 0);
  group.add(light);

  group.userData.portalUniforms = portalUniforms;
  group.userData.light = light;
  group.userData.baseIntensity = 12;
  // Az üresjárati lebegéshez és a megnyíláshoz (lásd journey.js)
  group.userData.portal = portal;
  group.userData.phase = portalUniforms.uPhase.value;
  return group;
}

/* ---------------------------------------------------------------------
   Fénykorona a finálé sárkánya mögé

   A billboard önmagában matricának látszik a sötét völgyben: nincs se
   háttere, se fénye. Ez az additív korong adja alá a glóriát, és mivel
   mindig a kamerára néz, együtt mozog a sárkánnyal.
   ------------------------------------------------------------------- */
export function buildAura(color = '#ffb066') {
  const uniforms = {
    uColor: { value: new THREE.Color(color) },
    uTime:  { value: 0 },
    uPower: { value: 0 },
  };

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 150),
    new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */`
        uniform vec3  uColor;
        uniform float uTime;
        uniform float uPower;
        varying vec2  vUv;

        void main() {
          vec2 uv = (vUv - 0.5) * 2.0;
          float r = length(uv);

          float halo  = smoothstep(1.0, 0.0, r);
          halo = halo * halo;
          float inner = smoothstep(0.55, 0.0, r) * 0.55;

          // Lassan forgó sugarak, hogy ne egy tompa folt legyen
          float a = atan(uv.y, uv.x);
          float rays = 0.5 + 0.5 * sin(a * 9.0 + uTime * 0.25);
          rays *= smoothstep(0.95, 0.25, r) * smoothstep(0.05, 0.3, r) * 0.22;

          float alpha = (halo * 0.5 + inner + rays) * uPower;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    })
  );

  mesh.name = 'aura';
  mesh.visible = false;
  mesh.userData.uniforms = uniforms;
  return mesh;
}

/* ---------------------------------------------------------------------
   Szórt kellékek: sziklák és fenyők a völgyben (instancolva)
   ------------------------------------------------------------------- */
export function scatterProps(noise, count = 320) {
  const group = new THREE.Group();
  group.name = 'props';

  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: '#222b45', flatShading: true });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, count);

  const trunkMat = new THREE.MeshLambertMaterial({ color: '#181f33' });
  const pineGeo  = new THREE.ConeGeometry(1, 3.4, 6);
  const pines    = new THREE.InstancedMesh(pineGeo, trunkMat, Math.floor(count * 0.8));

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const v = new THREE.Vector3();

  let pineIndex = 0;

  for (let i = 0; i < count; i++) {
    // A pálya két oldalán, de nem az úton
    const side = noise.rnd() < 0.5 ? -1 : 1;
    const x = side * (16 + noise.rnd() * 78);
    const z = -40 - noise.rnd() * 1380;
    const y = terrainHeight(noise, x, z);

    v.set(x, y, z);
    q.setFromEuler(new THREE.Euler(noise.rnd() * 3, noise.rnd() * 6, noise.rnd() * 3));
    const sc = 0.8 + noise.rnd() * 3.4;
    s.set(sc, sc * (0.5 + noise.rnd() * 0.7), sc);
    m.compose(v, q, s);
    rocks.setMatrixAt(i, m);

    // Fenyők csak a völgy alján, mérsékelt magasságban
    if (pineIndex < pines.count && Math.abs(x) < 62 && y < 34 && noise.rnd() < 0.62) {
      const px = side * (14 + noise.rnd() * 52);
      const pz = -40 - noise.rnd() * 1380;
      const py = terrainHeight(noise, px, pz);
      v.set(px, py + 1.6, pz);
      q.setFromEuler(new THREE.Euler(0, noise.rnd() * 6, 0));
      const ps = 0.9 + noise.rnd() * 1.9;
      s.set(ps, ps * (1.2 + noise.rnd()), ps);
      m.compose(v, q, s);
      pines.setMatrixAt(pineIndex++, m);
    }
  }

  // A fel nem használt példányokat a látótéren kívülre tesszük
  for (let i = pineIndex; i < pines.count; i++) {
    m.compose(new THREE.Vector3(0, -9999, 0), q, new THREE.Vector3(0.01, 0.01, 0.01));
    pines.setMatrixAt(i, m);
  }

  rocks.instanceMatrix.needsUpdate = true;
  pines.instanceMatrix.needsUpdate = true;
  group.add(rocks, pines);
  return group;
}

/* ---------------------------------------------------------------------
   Lávarepedések (3. felvonás) — a talajra fektetett izzó szalagok
   ------------------------------------------------------------------- */
export function buildLavaCracks(noise, zStart, zEnd, count = 22) {
  const group = new THREE.Group();
  group.name = 'lava';

  const uniforms = {
    uTime:  { value: 0 },
    uPower: { value: 0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uPower;
      varying vec2  vUv;

      void main() {
        // Hosszanti izzó ér, lüktető fénnyel
        float core = smoothstep(0.5, 0.0, abs(vUv.y - 0.5) * 2.0);
        core = pow(core, 2.4);

        float pulse = 0.72 + 0.28 * sin(uTime * 2.2 + vUv.x * 9.0);
        float ends  = smoothstep(0.0, 0.16, vUv.x) * smoothstep(1.0, 0.84, vUv.x);

        vec3 col = mix(vec3(1.0, 0.28, 0.05), vec3(1.0, 0.86, 0.45), pow(core, 3.0));
        float a  = core * ends * pulse * uPower;
        gl_FragColor = vec4(col * (1.0 + core), a);
      }
    `,
  });

  for (let i = 0; i < count; i++) {
    const len = 14 + noise.rnd() * 34;
    const geo = new THREE.PlaneGeometry(len, 1.4 + noise.rnd() * 2.2);
    geo.rotateX(-Math.PI / 2);

    const mesh = new THREE.Mesh(geo, mat);
    const x = (noise.rnd() - 0.5) * 84;
    const z = zStart + (zEnd - zStart) * noise.rnd();
    mesh.position.set(x, terrainHeight(noise, x, z) + 0.28, z);
    mesh.rotation.y = noise.rnd() * Math.PI;
    group.add(mesh);
  }

  group.userData.uniforms = uniforms;
  return group;
}

/* ---------------------------------------------------------------------
   Szempár a ködben (5. felvonás)
   ------------------------------------------------------------------- */
export function buildEyes() {
  const group = new THREE.Group();
  group.name = 'eyes';

  const uniforms = {
    uTime:   { value: 0 },
    uOpen:   { value: 0 },      // 0 = csukva, 1 = tágra nyílt
    uColor:  { value: new THREE.Color('#ffb03a') },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform float uOpen;
      uniform vec3  uColor;
      varying vec2  vUv;

      void main() {
        vec2 uv = (vUv - 0.5) * 2.0;

        // A szemrés magassága a nyitottsággal nő
        float lid = 0.06 + uOpen * 0.5;
        float eye = 1.0 - smoothstep(0.0, 1.0, abs(uv.y) / max(lid, 0.001));
        eye *= 1.0 - smoothstep(0.55, 1.0, abs(uv.x));

        // Függőleges pupilla
        float pupil = smoothstep(0.10, 0.02, abs(uv.x));
        float iris  = eye * (1.0 - pupil * 0.92);

        float flick = 0.86 + 0.14 * sin(uTime * 5.0);
        vec3 col = mix(uColor, vec3(1.0, 0.94, 0.7), pow(iris, 3.0));

        float a = iris * flick * uOpen;
        gl_FragColor = vec4(col * (1.0 + iris * 1.5), a);
      }
    `,
  });

  for (const sx of [-13, 13]) {
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(17, 11), mat);
    eye.position.set(sx, 0, 0);
    group.add(eye);
  }

  const light = new VirtualLight(0xff9a3a, 0, 240, 2);
  light.position.set(0, 0, 8);
  group.add(light);

  group.userData.uniforms = uniforms;
  group.userData.light = light;
  return group;
}

/* ---------------------------------------------------------------------
   Sárkánysziluett (átrepülés) — a meglévő pixelgrafikából
   ------------------------------------------------------------------- */
export function buildSilhouette(partUrl) {
  const loader = new THREE.TextureLoader();
  const tex = loader.load(partUrl('body', 7));
  tex.minFilter = THREE.LinearMipmapLinearFilter;   // sima skálázás: a rajz nagy felbontású
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0,
    color: 0x05070f,          // sötét sziluett, ami kitakarja a holdat
    depthWrite: false,
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), mat);
  mesh.name = 'silhouette';
  mesh.visible = false;
  return mesh;
}

/* ---------------------------------------------------------------------
   Koponyaív — a 4. felvonás végén ezen repül át a kamera
   ------------------------------------------------------------------- */
export function buildSkullArch(partUrl) {
  const group = new THREE.Group();
  group.name = 'skullArch';
  group.visible = false;

  const loader = new THREE.TextureLoader();
  const tex = loader.load(partUrl('head', 7));
  tex.colorSpace = THREE.SRGBColorSpace;

  const skull = new THREE.Mesh(
    new THREE.PlaneGeometry(78, 78),
    new THREE.MeshBasicMaterial({
      map: tex, transparent: true, color: 0x9fb4d8, opacity: 0.94, depthWrite: false,
    })
  );
  skull.position.y = 34;
  group.add(skull);

  // Két oldalt agyarszerű oszlopok, hogy tényleg kapunak hasson
  const tuskMat = new THREE.MeshLambertMaterial({ color: '#d8e2f5', flatShading: true });
  for (const sx of [-15, 15]) {
    const tusk = new THREE.Mesh(new THREE.ConeGeometry(2.4, 26, 6), tuskMat);
    tusk.position.set(sx, 13, 2);
    tusk.rotation.z = sx > 0 ? -0.12 : 0.12;
    group.add(tusk);
  }

  const light = new VirtualLight(0xbcd9ff, 0, 130, 2);
  light.position.set(0, 24, 6);
  group.add(light);
  group.userData.light = light;

  return group;
}

/* ---------------------------------------------------------------------
   Lökéshullám-gyűrű (a 3. felvonás csavarjához)
   ------------------------------------------------------------------- */
export function buildShockwave() {
  const uniforms = {
    uProgress: { value: 0 },
    uColor:    { value: new THREE.Color('#ff7a2c') },
  };

  const geo = new THREE.RingGeometry(1, 1.5, 96);
  geo.rotateX(-Math.PI / 2);

  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uProgress;
      uniform vec3  uColor;
      varying vec2  vUv;
      void main() {
        float band = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        float a = band * (1.0 - uProgress) * 0.9;
        gl_FragColor = vec4(uColor * 2.0, a);
      }
    `,
  }));

  mesh.name = 'shockwave';
  mesh.visible = false;
  mesh.userData.uniforms = uniforms;
  return mesh;
}
