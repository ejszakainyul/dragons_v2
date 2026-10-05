/* =====================================================================
   A világ: terep, tenger, ég, hold, sarki fény, parázs, köd.

   Minden eljárásgenerált — nincs külső modell, így gyorsan tölt és
   minden végigjátszás picit más.
   ===================================================================== */
import * as THREE from 'three';

/* ---------------------------------------------------------------------
   Érték-zaj (value noise) — a terephez és a kamera remegéséhez
   ------------------------------------------------------------------- */
export function makeNoise(seed = 1) {
  const perm = new Uint8Array(512);
  let s = seed >>> 0 || 1;
  const rnd = () => {
    // xorshift32
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
  const base = new Uint8Array(256);
  for (let i = 0; i < 256; i++) base[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = base[i & 255];

  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y) => {
    const u = (h & 1) ? x : -x;
    const v = (h & 2) ? y : -y;
    return u + v;
  };

  const noise2 = (x, y) => {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);
    const aa = perm[perm[xi] + yi];
    const ab = perm[perm[xi] + yi + 1];
    const ba = perm[perm[xi + 1] + yi];
    const bb = perm[perm[xi + 1] + yi + 1];
    return lerp(
      lerp(grad(aa, xf, yf),     grad(ba, xf - 1, yf),     u),
      lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
      v
    );
  };

  /** Több oktávos zaj, nagyjából -1..1 */
  const fbm = (x, y, octaves = 4) => {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum  += noise2(x * freq, y * freq) * amp;
      norm += amp;
      amp  *= 0.5;
      freq *= 2.07;
    }
    return sum / norm;
  };

  return { noise2, fbm, rnd };
}

/* ---------------------------------------------------------------------
   Terep: egy völgy, ami a -Z tengely mentén fut
   ------------------------------------------------------------------- */
export const VALLEY_HALF_WIDTH = 42;   // ezen belül lapos a talaj
export const WORLD_LENGTH      = 1500; // -Z irányban ilyen hosszú

/**
 * A talaj magassága egy ponton. A pálya mindig a völgy alján fut.
 */
export function terrainHeight(noise, x, z) {
  const ax = Math.abs(x);

  // A völgy pereme: |x| > VALLEY_HALF_WIDTH felett meredeken emelkedik
  const t     = Math.max(0, (ax - VALLEY_HALF_WIDTH) / 58);
  const ridge = Math.pow(t, 1.7) * 120;

  // Durva sziklás moduláció a falakon
  const rough = noise.fbm(x * 0.012, z * 0.012, 5) * (12 + ridge * 0.45);

  // Finom hullámzás a völgy alján
  const floor = noise.fbm(x * 0.035, z * 0.035, 3) * 1.9;

  return ridge + rough * Math.min(1, t * 2 + 0.12) + floor;
}

export function buildTerrain(noise) {
  const segX = 110;
  const segZ = 220;
  const width = 340;

  const geo = new THREE.PlaneGeometry(width, WORLD_LENGTH, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);

  const lowColor  = new THREE.Color('#1b2540');
  const midColor  = new THREE.Color('#2b3a5e');
  const highColor = new THREE.Color('#8fa6cf');
  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) - WORLD_LENGTH / 2 + 80;   // előre toljuk a start elé
    const h = terrainHeight(noise, x, z);

    pos.setY(i, h);
    pos.setZ(i, z);

    // Magasság szerinti szín + kevés hósapka
    const k = THREE.MathUtils.clamp(h / 90, 0, 1);
    tmp.copy(lowColor).lerp(midColor, THREE.MathUtils.smoothstep(k, 0, 0.55));
    tmp.lerp(highColor, THREE.MathUtils.smoothstep(k, 0.62, 1));

    colors[i * 3]     = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  // Lambert: a terep matt (érdesség 0.96 volt), a PBR tükröző tagja
  // úgyis nulla lenne — a pixelenkénti fényszámítás viszont töredéke.
  // A terep tölti ki a kép legnagyobb részét, itt számít a legtöbbet.
  const mat = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = false;
  mesh.name = 'terrain';
  return mesh;
}

/* ---------------------------------------------------------------------
   Tenger: vertex-shaderben hullámzó sík
   ------------------------------------------------------------------- */
export function buildWater() {
  const geo = new THREE.PlaneGeometry(760, WORLD_LENGTH + 300, 60, 90);
  geo.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime:      { value: 0 },
    uColorDeep: { value: new THREE.Color('#050b1a') },
    uColorFoam: { value: new THREE.Color('#2e6f9e') },
    uOpacity:   { value: 0.92 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying float vWave;
      varying vec2  vUv;

      void main() {
        vUv = uv;
        vec3 p = position;

        // Három egymásra futó hullámvonulat
        float w =  sin(p.x * 0.035 + uTime * 0.9) * 1.25;
        w      +=  sin(p.z * 0.021 - uTime * 0.6) * 1.75;
        w      +=  sin((p.x + p.z) * 0.055 + uTime * 1.6) * 0.55;

        p.y += w;
        vWave = w;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3  uColorDeep;
      uniform vec3  uColorFoam;
      uniform float uOpacity;
      varying float vWave;

      void main() {
        float k = smoothstep(-2.0, 3.0, vWave);
        vec3 col = mix(uColorDeep, uColorFoam, k * 0.8);
        // Hullámtaréj-csillanás
        col += pow(k, 6.0) * 0.28;
        gl_FragColor = vec4(col, uOpacity);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -6, -WORLD_LENGTH / 2 + 80);
  mesh.name = 'water';
  mesh.userData.uniforms = uniforms;
  return mesh;
}

/* ---------------------------------------------------------------------
   Csillagok
   ------------------------------------------------------------------- */
export function buildStars(noise) {
  const count = 1600;
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);
  const sizes     = new Float32Array(count);

  const warm = new THREE.Color('#ffd9a8');
  const cool = new THREE.Color('#bcd9ff');
  const tmp  = new THREE.Color();

  for (let i = 0; i < count; i++) {
    // Félgömb a világ fölött
    const r     = 620 + noise.rnd() * 260;
    const theta = noise.rnd() * Math.PI * 2;
    const phi   = Math.acos(noise.rnd() * 0.85 + 0.05);

    positions[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.abs(Math.cos(phi)) * r * 0.75 + 40;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r - WORLD_LENGTH / 2;

    tmp.copy(cool).lerp(warm, noise.rnd() * 0.7);
    colors[i * 3]     = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;

    sizes[i] = 1.2 + noise.rnd() * 3.4;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSize;
      uniform float uTime;
      varying vec3  vColor;
      varying float vTwinkle;

      void main() {
        vColor = color;
        // Minden csillag kicsit más ütemben pislog
        vTwinkle = 0.62 + 0.38 * sin(uTime * 1.6 + position.x * 0.09 + position.z * 0.05);

        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Felső korlát: közelről egyébként az egész képernyőt betöltené
        gl_PointSize = min(aSize * (320.0 / -mv.z), 7.0);
        gl_Position  = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3  vColor;
      varying float vTwinkle;

      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        gl_FragColor = vec4(vColor, a * vTwinkle);
      }
    `,
  });
  mat.vertexColors = true;

  const points = new THREE.Points(geo, mat);
  points.name = 'stars';
  return points;
}

/* ---------------------------------------------------------------------
   Sarki fény (aurora) — additív, hullámzó függöny
   ------------------------------------------------------------------- */
export function buildAurora() {
  const geo = new THREE.PlaneGeometry(1100, 320, 1, 1);

  const uniforms = {
    uTime:  { value: 0 },
    uColorA:{ value: new THREE.Color('#2ad6b0') },
    uColorB:{ value: new THREE.Color('#4f7dff') },
    uColorC:{ value: new THREE.Color('#c17bff') },
    uPower: { value: 1.0 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
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
      uniform vec3  uColorA;
      uniform vec3  uColorB;
      uniform vec3  uColorC;
      uniform float uPower;
      varying vec2  vUv;

      // Olcsó, sávos zaj
      float wave(float x, float t, float f, float a) {
        return sin(x * f + t) * a;
      }

      void main() {
        float x = vUv.x;
        float y = vUv.y;

        // A függöny alja hullámzik
        float base = 0.18
          + wave(x, uTime * 0.30,  9.0, 0.055)
          + wave(x, uTime * 0.17, 21.0, 0.028)
          + wave(x, uTime * 0.46,  4.0, 0.075);

        float top = base + 0.55 + wave(x, uTime * 0.23, 6.0, 0.10);

        float band = smoothstep(base, base + 0.10, y) * (1.0 - smoothstep(top - 0.34, top, y));

        // Függőleges rovátkák
        float streak = 0.55 + 0.45 * sin(x * 140.0 + sin(x * 19.0 + uTime * 0.6) * 3.0);

        vec3 col = mix(uColorA, uColorB, y);
        col = mix(col, uColorC, smoothstep(0.55, 1.0, y) * 0.6);

        float alpha = band * streak * (1.0 - y * 0.35) * 0.55 * uPower;
        gl_FragColor = vec4(col * alpha * 2.2, alpha);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 210, -WORLD_LENGTH + 120);
  mesh.name = 'aurora';
  mesh.userData.uniforms = uniforms;
  return mesh;
}

/* ---------------------------------------------------------------------
   Hold + glória
   ------------------------------------------------------------------- */
export function buildMoon() {
  const group = new THREE.Group();
  group.name = 'moon';

  const body = new THREE.Mesh(
    new THREE.SphereGeometry(26, 48, 48),
    new THREE.MeshBasicMaterial({ color: '#eaf1ff' })
  );
  group.add(body);

  // Lágy glória: hátrafelé néző, additív korong
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uPower: { value: 1 } },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uPower;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = pow(max(0.0, 1.0 - d), 3.2) * uPower;
        gl_FragColor = vec4(vec3(0.72, 0.82, 1.0) * a, a * 0.85);
      }
    `,
  });

  const halo = new THREE.Mesh(new THREE.PlaneGeometry(230, 230), haloMat);
  halo.position.z = -1;
  group.add(halo);

  group.userData.halo = haloMat.uniforms.uPower;
  group.position.set(150, 175, -WORLD_LENGTH + 60);
  return group;
}

/* ---------------------------------------------------------------------
   Parázs / hópehely részecskék a kamera körül
   ------------------------------------------------------------------- */
export function buildMotes() {
  const count = 520;
  const positions = new Float32Array(count * 3);
  const seeds     = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Gyűrű alakban, a kamera közvetlen közelét kihagyva
    const a = Math.random() * Math.PI * 2;
    const r = 14 + Math.random() * 86;
    positions[i * 3]     = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.random() * 70 - 10;
    positions[i * 3 + 2] = Math.sin(a) * r * 1.8;
    seeds[i] = Math.random();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed',    new THREE.BufferAttribute(seeds, 1));

  const uniforms = {
    uTime:  { value: 0 },
    uColor: { value: new THREE.Color('#ffb86b') },
    uRise:  { value: 1.0 },     // 1 = felszáll (parázs), -1 = hullik (hó)
    uSize:  { value: 2.4 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aSeed;
      uniform float uTime;
      uniform float uRise;
      uniform float uSize;
      varying float vAlpha;

      void main() {
        vec3 p = position;

        float t = uTime * (0.25 + aSeed * 0.5);
        // Függőleges sodródás, körbeérve
        p.y = mod(p.y + t * 9.0 * uRise + 40.0, 80.0) - 12.0;
        // Oldalirányú lengés
        p.x += sin(t * 1.7 + aSeed * 30.0) * 3.4;
        p.z += cos(t * 1.3 + aSeed * 22.0) * 3.0;

        vAlpha = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 2.0 + aSeed * 40.0));

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // Felső korlát: közeli részecskék különben hatalmas foltként jelennek meg
        gl_PointSize = min(uSize * (1.0 + aSeed * 1.6) * (260.0 / -mv.z), 11.0);
        gl_Position  = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });

  const points = new THREE.Points(geo, mat);
  points.name = 'motes';
  points.frustumCulled = false;
  points.userData.uniforms = uniforms;
  return points;
}

/* ---------------------------------------------------------------------
   Ködsávok — additív, lassan sodródó lapok
   ------------------------------------------------------------------- */
export function buildMistBands(count = 14) {
  const group = new THREE.Group();
  group.name = 'mist';

  const geo = new THREE.PlaneGeometry(150, 40);
  const uniforms = {
    uTime:    { value: 0 },
    uColor:   { value: new THREE.Color('#9fc3ff') },
    uOpacity: { value: 0.11 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
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
      uniform vec3  uColor;
      uniform float uOpacity;
      varying vec2  vUv;

      void main() {
        vec2 uv = vUv;
        float n = sin(uv.x * 7.0 + uTime * 0.25) * 0.5 + 0.5;
        n *= sin(uv.x * 17.0 - uTime * 0.16) * 0.5 + 0.5;

        // Lágy szélek minden irányban
        float edge = smoothstep(0.0, 0.42, uv.x) * smoothstep(1.0, 0.58, uv.x)
                   * smoothstep(0.0, 0.55, uv.y) * smoothstep(1.0, 0.45, uv.y);

        float a = edge * (0.35 + n * 0.5) * uOpacity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });

  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(
      (Math.random() - 0.5) * 110,
      -3 + Math.random() * 16,
      -60 - (i / count) * (WORLD_LENGTH - 100) - Math.random() * 40
    );
    m.rotation.y = (Math.random() - 0.5) * 0.5;
    m.userData.driftSeed = Math.random() * 100;
    m.userData.baseX = m.position.x;
    group.add(m);
  }

  group.userData.uniforms = uniforms;
  return group;
}
