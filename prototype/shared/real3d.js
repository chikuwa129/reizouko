/* Realistic 3D kit shared by the 3D prototype and the main game's post-credits scene.
   Everything is procedural (no external models or images): scaled skin, facades, asphalt.
   Usage: const R = createReal(THREE, { EffectComposer, RenderPass, BokehPass, UnrealBloomPass, ShaderPass, OutputPass }); */
function createReal(THREE, A) {
  // ---------- small helpers ----------
  let seed = 7;
  const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); return t; };

  // height field -> normal map
  function normalFromHeight(hf, w, h, strength) {
    const c = canvas(w, h), g = c.getContext('2d'), im = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const l = hf[y * w + (x - 1 + w) % w], r = hf[y * w + (x + 1) % w], u = hf[((y - 1 + h) % h) * w + x], d = hf[((y + 1) % h) * w + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1; const L = Math.hypot(nx, ny, nz); nx /= L; ny /= L; nz /= L;
      const i = (y * w + x) * 4; im.data[i] = (nx * 0.5 + 0.5) * 255; im.data[i + 1] = (ny * 0.5 + 0.5) * 255; im.data[i + 2] = (nz * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
    }
    g.putImageData(im, 0, 0); return c;
  }

  // ---------- reptile skin: voronoi scales (jittered grid, 3x3 lookup) ----------
  function skinMaps(base = [44, 56, 40], size = 512, N = 28) {
    const pts = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) pts.push([(i + 0.15 + rnd() * 0.7) / N, (j + 0.15 + rnd() * 0.7) / N, rnd()]);
    const P = (i, j) => pts[((j + N) % N) * N + ((i + N) % N)];
    const hf = new Float32Array(size * size);
    const col = canvas(size, size), cg = col.getContext('2d'), ci = cg.createImageData(size, size);
    const rough = canvas(size, size), rg = rough.getContext('2d'), ri = rg.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size, gi = Math.floor(u * N), gj = Math.floor(v * N);
      let d1 = 9, d2 = 9, r1 = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const p = P(gi + di, gj + dj);
        let px = p[0] + Math.floor((gi + di) / N) * 0, py = p[1];
        // wrap offsets so the texture tiles
        px += Math.floor((gi + di) / N) === -1 ? -1 : Math.floor((gi + di) / N) === 1 ? 1 : 0;
        py += Math.floor((gj + dj) / N) === -1 ? -1 : Math.floor((gj + dj) / N) === 1 ? 1 : 0;
        const d = Math.hypot(u - px, v - py);
        if (d < d1) { d2 = d1; d1 = d; r1 = p[2]; } else if (d < d2) d2 = d;
      }
      const edge = (d2 - d1) * N;                         // 0 at cell borders
      const crev = Math.min(1, edge / 0.22);
      const dome = Math.sqrt(Math.max(0, 1 - d1 * N * 1.1)) * 0.6 + crev * 0.4;
      hf[y * size + x] = dome * (0.75 + r1 * 0.35);
      const k = (0.55 + r1 * 0.35) * (0.35 + 0.65 * crev);
      const i = (y * size + x) * 4;
      ci.data[i] = base[0] * k * 1.25; ci.data[i + 1] = base[1] * k * 1.25; ci.data[i + 2] = base[2] * k * 1.25; ci.data[i + 3] = 255;
      const rv = 150 + (1 - crev) * 90 + r1 * 15; ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = Math.min(255, rv); ri.data[i + 3] = 255;
    }
    cg.putImageData(ci, 0, 0); rg.putImageData(ri, 0, 0);
    return { map: tex(col, true, [3, 3]), normalMap: tex(normalFromHeight(hf, size, size, 5), false, [3, 3]), roughnessMap: tex(rough, false, [3, 3]) };
  }
  // bony plates: streaked, chipped
  function boneMaps() {
    const s = 256, c = canvas(s, s), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#d9c49a'); gr.addColorStop(1, '#7a5a34'); g.fillStyle = gr; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) { g.strokeStyle = `rgba(${40 + rnd() * 40},${30 + rnd() * 20},10,${0.08 + rnd() * 0.15})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); const x = rnd() * s; g.moveTo(x, 0); g.lineTo(x + (rnd() - 0.5) * 30, s); g.stroke(); }
    return tex(c);
  }

  // ---------- facades ----------
  const FACADES = [
    { wall: '#6c6a66', glass: '#2b3440', lit: 0.2, cols: 12, rows: 34 },   // concrete office
    { wall: '#3a4250', glass: '#1d2a3a', lit: 0.16, cols: 16, rows: 48 },   // glass tower
    { wall: '#7d6a58', glass: '#2c2a2a', lit: 0.26, cols: 10, rows: 24 },     // brick apartments
    { wall: '#8d8f8a', glass: '#303a42', lit: 0.2, cols: 14, rows: 38 },    // pale tower
  ];
  function facade(f) {
    const w = 256, h = 512, c = canvas(w, h), g = c.getContext('2d'), e = canvas(w, h), eg = e.getContext('2d');
    g.fillStyle = f.wall; g.fillRect(0, 0, w, h); eg.fillStyle = '#000'; eg.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.06})`; g.fillRect(rnd() * w, rnd() * h, 2 + rnd() * 6, 2 + rnd() * 6); }
    const cw = w / f.cols, rh = h / f.rows;
    for (let r = 0; r < f.rows; r++) for (let q = 0; q < f.cols; q++) {
      const x = q * cw + cw * 0.14, y = r * rh + rh * 0.18, ww = cw * 0.72, hh = rh * 0.6;
      const lg = g.createLinearGradient(x, y, x + ww, y + hh); lg.addColorStop(0, f.glass); lg.addColorStop(1, '#4a5868');
      g.fillStyle = lg; g.fillRect(x, y, ww, hh);
      if (rnd() < f.lit) { const warm = rnd() < 0.8; eg.fillStyle = warm ? `rgb(${230 + rnd() * 25},${170 + rnd() * 40},${90 + rnd() * 40})` : `rgb(170,${200 + rnd() * 30},255)`; eg.fillRect(x, y, ww, hh); g.fillStyle = 'rgba(255,220,150,.25)'; g.fillRect(x, y, ww, hh); }
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let r = 0; r <= f.rows; r += 4) g.fillRect(0, r * rh - 2, w, 3);
    return { map: tex(c), emissiveMap: tex(e) };
  }
  function asphalt() {
    const s = 512, c = canvas(s, s), g = c.getContext('2d');
    g.fillStyle = '#2a2b2e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 9000; i++) { const v = 30 + rnd() * 40; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(rnd() * s, rnd() * s, 2, 2); }
    g.fillStyle = 'rgba(230,220,190,.85)'; for (let y = 0; y < s; y += 128) g.fillRect(s / 2 - 5, y, 10, 64);
    g.fillStyle = 'rgba(230,220,190,.7)'; g.fillRect(14, 0, 6, s); g.fillRect(s - 20, 0, 6, s);
    const t = tex(c, true, [1, 24]); return t;
  }

  // ---------- geometry helpers ----------
  function lumpy(geo, amt, freq = 0.12) {
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const n = Math.sin(v.x * freq * 1.7 + v.y * freq) * Math.cos(v.z * freq * 1.3 - v.y * freq * 0.7) + 0.5 * Math.sin(v.x * freq * 3.1 + v.z * freq * 2.3);
      const len = v.length() || 1; v.multiplyScalar(1 + (n * amt) / len);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals(); return geo;
  }
  const shadowed = m => { m.castShadow = true; m.receiveShadow = true; return m; };

  // ---------- the real kaiju (the "true form" of Zungura: olive scales, amber bone plates) ----------
  let SKIN, BONE, EYE, TOOTH;
  function materials() {
    if (SKIN) return;
    const sk = skinMaps([74, 90, 60]);
    SKIN = new THREE.MeshStandardMaterial({ ...sk, normalScale: new THREE.Vector2(1.6, 1.6), roughness: 0.92, metalness: 0.0, color: 0xffffff });
    BONE = new THREE.MeshStandardMaterial({ map: boneMaps(), roughness: 0.7, emissive: 0x3a1a04, emissiveIntensity: 0.4 });
    EYE = new THREE.MeshStandardMaterial({ color: 0x220800, emissive: 0xffa21a, emissiveIntensity: 4.5 });
    TOOTH = new THREE.MeshStandardMaterial({ color: 0xe8e0c8, roughness: 0.4 });
  }
  function makeKaiju() {
    materials();
    const k = new THREE.Group(), body = new THREE.Group(); k.add(body);
    const cap = (r, l, m = SKIN, amt = 1.2) => shadowed(new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(r, l, 20, 40), amt), m));
    // torso leans forward like a heavy predator
    const torso = cap(15, 34, SKIN, 1.6); torso.rotation.x = -0.5; torso.position.set(0, 58, 0); body.add(torso);
    const hips = cap(16, 6, SKIN, 1.4); hips.position.set(0, 44, 10); body.add(hips);
    const chest = cap(13.5, 14, SKIN, 1.2); chest.rotation.x = -0.9; chest.position.set(0, 66, -12); body.add(chest);
    // neck and head (low, heavy brow, long jaw)
    const neck = cap(9, 14, SKIN, 0.9); neck.rotation.x = -1.1; neck.position.set(0, 74, -24); body.add(neck);
    const head = new THREE.Group(); head.position.set(0, 79, -34); body.add(head);
    const skull = shadowed(new THREE.Mesh(lumpy(new THREE.SphereGeometry(9, 40, 30), 0.8), SKIN)); skull.scale.set(1, 0.85, 1.55); head.add(skull);
    const brow = shadowed(new THREE.Mesh(lumpy(new THREE.SphereGeometry(5, 24, 16), 0.5), SKIN)); brow.scale.set(2.1, 0.55, 0.9); brow.position.set(0, 4.2, -6); head.add(brow);
    const jaw = new THREE.Group(); jaw.position.set(0, -3, 2); head.add(jaw);
    const jawM = shadowed(new THREE.Mesh(lumpy(new THREE.SphereGeometry(7.5, 32, 20), 0.6), SKIN)); jawM.scale.set(0.95, 0.5, 1.6); jawM.position.set(0, -1.5, -7); jaw.add(jawM);
    for (let i = 0; i < 9; i++) for (const sx of [-1, 1]) {
      const t = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.7, 2.6, 6), TOOTH));
      t.position.set(sx * (5.2 - i * 0.3), -0.2, -4 - i * 1.5); t.rotation.x = Math.PI; head.add(t);
      const b2 = t.clone(); b2.position.set(sx * (4.8 - i * 0.3), 0.6, -4.5 - i * 1.4); b2.rotation.x = 0; jaw.add(b2);
    }
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), EYE); e.position.set(sx * 5.6, 2.8, -7.4); head.add(e); }
    // arms: short, thick, three claws
    const arms = [];
    for (const sx of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(sx * 13, 64, -14); body.add(a);
      const up = cap(4.2, 10, SKIN, 0.5); up.rotation.x = 0.7; up.position.set(0, -4, -3); a.add(up);
      const fo = cap(3.6, 9, SKIN, 0.4); fo.rotation.x = -0.2; fo.position.set(0, -12, -8); a.add(fo);
      for (let c = -1; c <= 1; c++) { const cl = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.9, 5, 6), TOOTH)); cl.position.set(c * 1.8, -18, -10); cl.rotation.x = Math.PI * 0.85; a.add(cl); }
      arms.push(a);
    }
    // legs: massive thighs, backward-bent shins, splayed clawed feet
    const legs = [];
    for (const sx of [-1, 1]) {
      const L = new THREE.Group(); L.position.set(sx * 14, 46, 8); k.add(L);
      const th = shadowed(new THREE.Mesh(lumpy(new THREE.SphereGeometry(11, 36, 26), 1.2), SKIN)); th.scale.set(0.9, 1.3, 1.1); th.position.set(0, -8, 0); L.add(th);
      const sh = cap(6, 16, SKIN, 0.8); sh.position.set(0, -26, 5); sh.rotation.x = 0.35; L.add(sh);
      const ft = shadowed(new THREE.Mesh(lumpy(new THREE.SphereGeometry(7, 28, 18), 0.6), SKIN)); ft.scale.set(1.1, 0.45, 1.6); ft.position.set(0, -42, -2); L.add(ft);
      for (let c = -1; c <= 1; c++) { const cl = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.1, 6, 6), TOOTH)); cl.position.set(c * 3.2, -43, -13); cl.rotation.x = -Math.PI / 2; L.add(cl); }
      legs.push(L);
    }
    // tail: a long heavy chain dragging behind
    const tail = [];
    let prev = new THREE.Vector3(0, 42, 22);
    for (let i = 0; i < 12; i++) {
      const r = 12 - i * 0.9;
      const seg = shadowed(new THREE.Mesh(lumpy(new THREE.SphereGeometry(r, 28, 20), 0.8), SKIN));
      seg.scale.set(1, 0.95, 1.6);
      const p = new THREE.Vector3(0, Math.max(r * 0.7, 42 - i * 4.2), 22 + i * (r * 1.25)); seg.position.copy(p); k.add(seg); tail.push({ m: seg, base: p.clone() }); prev = p;
    }
    // dorsal plates: jagged amber bone shards along spine and tail
    const plates = [];
    const spine = [[0, 84, -24, 1.0], [0, 80, -14, 1.4], [0, 76, -4, 1.8], [0, 70, 6, 2.0], [0, 62, 14, 1.9], [0, 54, 22, 1.6]];
    tail.forEach((t, i) => { if (i % 1 === 0 && i < 11) spine.push([0, t.base.y + (12 - i * 0.9) * 0.9, t.base.z, 1.4 - i * 0.11]); });
    spine.forEach(([x, y, z, s], i) => {
      for (const off of [-1, 0, 1]) {
        if (off && s < 1.2) continue;
        const h = (9 + rnd() * 5) * s * (off ? 0.7 : 1);
        const pl = shadowed(new THREE.Mesh(new THREE.ConeGeometry(2.6 * s, h, 4 + Math.floor(rnd() * 2)), BONE));
        pl.position.set(x + off * 3.2 * s, y + h * 0.35, z); pl.rotation.set(0.35 + (rnd() - 0.5) * 0.3, rnd() * Math.PI, off * 0.35);
        k.add(pl); plates.push(pl);
      }
    });
    k.userData = { body, head, jaw, arms, legs, tail, plates, torso };
    return k;
  }
  // animate: walk 0..1, phase, breath, punchSide/punchExt, roar 0..1
  function animateKaiju(k, t, s) {
    const U = k.userData, ph = s.phase || 0, walk = s.walk || 0;
    U.body.position.y = Math.sin(t * 1.4) * 0.6 + Math.abs(Math.sin(ph)) * 2.2 * walk;
    U.body.rotation.z = Math.sin(ph) * 0.03 * walk;
    U.head.rotation.y = Math.sin(t * 0.7) * 0.12; U.head.rotation.x = -0.1 * (s.roar || 0) + Math.sin(t * 0.9) * 0.04;
    U.jaw.rotation.x = 0.08 + 0.55 * (s.roar || 0) + Math.max(0, Math.sin(t * 1.4)) * 0.03;
    U.legs[0].rotation.x = Math.sin(ph) * 0.4 * walk; U.legs[1].rotation.x = -Math.sin(ph) * 0.4 * walk;
    U.arms.forEach((a, i) => { const e = i === s.punchSide ? (s.punchExt || 0) : 0; a.rotation.x = -1.3 * e + Math.sin(t * 1.2 + i) * 0.05; a.rotation.z = (i ? -1 : 1) * 0.15 * e; });
    U.tail.forEach((sg, i) => { sg.m.position.x = sg.base.x + Math.sin(t * 0.9 - i * 0.45) * i * 0.9; });
  }
  // first-person arm: scaled forearm and a clawed hand
  function makePovArm(side) {
    materials();
    const g = new THREE.Group();
    const fo = shadowed(new THREE.Mesh(lumpy(new THREE.CapsuleGeometry(4.2, 22, 16, 28), 0.6), SKIN)); fo.rotation.x = Math.PI / 2; fo.position.z = 10; g.add(fo);
    const hand = shadowed(new THREE.Mesh(lumpy(new THREE.SphereGeometry(5.6, 28, 20), 0.5), SKIN)); hand.scale.set(1.1, 0.8, 1.2); g.add(hand);
    for (let c = -1; c <= 1; c++) { const cl = shadowed(new THREE.Mesh(new THREE.ConeGeometry(1.1, 7, 6), TOOTH)); cl.position.set(c * 2.8, 0.5, -7.5); cl.rotation.x = -Math.PI / 2 - 0.25; g.add(cl); }
    g.userData = { side };
    return g;
  }

  // ---------- a realistic night street ----------
  function makeCity(scene, o = {}) {
    const len = o.length || 1400, avenue = o.avenue || 44;
    const mats = FACADES.map(f => { const m = facade(f); return new THREE.MeshStandardMaterial({ map: m.map, emissiveMap: m.emissiveMap, emissive: 0xffffff, emissiveIntensity: o.night ? 0.5 : 0.0, roughness: 0.55, metalness: f === FACADES[1] ? 0.55 : 0.1 }); });
    const roof = new THREE.MeshStandardMaterial({ color: 0x3d3f42, roughness: 0.9 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(1600, len + 600), new THREE.MeshStandardMaterial({ color: 0x3b3c3e, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.position.z = -len / 2; ground.receiveShadow = true; scene.add(ground);
    const road = new THREE.Mesh(new THREE.PlaneGeometry(avenue, len + 400), new THREE.MeshStandardMaterial({ map: asphalt(), roughness: o.rain ? 0.35 : 0.85, metalness: o.rain ? 0.25 : 0 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.05, -len / 2); road.receiveShadow = true; scene.add(road);
    const walk = new THREE.MeshStandardMaterial({ color: 0x6b6a66, roughness: 0.9 });
    for (const sx of [-1, 1]) { const sw = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, len + 400), walk); sw.position.set(sx * (avenue / 2 + 4), 0.4, -len / 2); sw.receiveShadow = true; scene.add(sw); }
    const block = (x, z, w, d, h, mi) => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [mats[mi], mats[mi], roof, roof, mats[mi], mats[mi]]);
      // map texture by size so windows keep a real scale
      m.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * (i % 2 ? h / 70 : (w + d) / 2 / 30); });
      m.geometry.attributes.uv.needsUpdate = true;
      m.position.y = h / 2; shadowed(m); g.add(m);
      if (rnd() < 0.6) { const ac = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 3, d * 0.3), roof); ac.position.set(w * 0.15, h + 1.5, 0); shadowed(ac); g.add(ac); }
      if (rnd() < 0.3) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 14, 6), roof); ant.position.set(-w * 0.2, h + 7, 0); g.add(ant); const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2a1a })); lamp.position.set(-w * 0.2, h + 14, 0); g.add(lamp); }
      g.position.set(x, 0, z); g.userData = { w, d, h, mi }; scene.add(g); return g;
    };
    for (let z = 40; z > -len; z -= 0) {
      const d = 26 + rnd() * 22;
      for (const sx of [-1, 1]) { const w = 26 + rnd() * 26, h = 40 + rnd() * 130; block(sx * (avenue / 2 + 9 + w / 2), z - d / 2, w, d, h, Math.floor(rnd() * 4)); }
      z -= d + (rnd() < 0.25 ? 26 : 3);
    }
    // street lamps (emissive heads; a few real lights move ahead with the camera)
    const pole = new THREE.MeshStandardMaterial({ color: 0x2a2b2d, roughness: 0.6, metalness: 0.4 }), bulb = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    for (let z = 20; z > -len; z -= 40) for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 13, 8), pole); p.position.set(sx * (avenue / 2 + 2), 6.5, z); scene.add(p);
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), bulb); b.position.set(sx * (avenue / 2 - 1), 13, z); scene.add(b);
    }
    const lamps = [];
    if (o.night) for (let i = 0; i < 6; i++) { const L = new THREE.PointLight(0xffc98a, 900, 60, 2); L.position.set((i % 2 ? 1 : -1) * (avenue / 2 - 1), 12.5, 20 - Math.floor(i / 2) * 40); scene.add(L); lamps.push(L); }
    // cars with head/tail lights
    const carBody = [0x8a1a1a, 0x1e2e44, 0xd9d9d9, 0x222222, 0x3a3a3a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0.7 }));
    const head = new THREE.MeshBasicMaterial({ color: 0xfff3d8 }), tailL = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
    for (let z = 10; z > -len; z -= 30 + rnd() * 40) {
      const g = new THREE.Group(), lane = (rnd() < 0.5 ? -1 : 1) * (6 + rnd() * 10), dir = lane > 0 ? 1 : -1;
      const b = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.6, 9), carBody[Math.floor(rnd() * 5)]); b.position.y = 1.6; shadowed(b); g.add(b);
      const top = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.6, 5), new THREE.MeshStandardMaterial({ color: 0x0d1218, roughness: 0.1, metalness: 0.8 })); top.position.y = 3.6; g.add(top);
      for (const sx of [-1, 1]) { const hl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.2), dir > 0 ? head : tailL); hl.position.set(sx * 1.5, 1.8, -4.55); g.add(hl); const tl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.2), dir > 0 ? tailL : head); tl.position.set(sx * 1.5, 1.8, 4.55); g.add(tl); }
      g.position.set(lane, 0, z); scene.add(g);
    }
    return { mats, roof, lamps, block };
  }

  // ---------- rain ----------
  function makeRain(scene, n = 2600) {
    const pos = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) { const x = (rnd() - 0.5) * 200, y = rnd() * 120, z = (rnd() - 0.5) * 200; pos.set([x, y, z, x + 0.3, y - 2.6, z], i * 6); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const rain = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0.35 }));
    scene.add(rain);
    rain.userData.update = (dt, center) => {
      const p = geo.attributes.position.array;
      for (let i = 0; i < p.length; i += 6) { p[i + 1] -= dt * 160; p[i + 4] -= dt * 160; if (p[i + 1] < 0) { p[i + 1] += 120; p[i + 4] += 120; } }
      geo.attributes.position.needsUpdate = true; rain.position.set(center.x, 0, center.z);
    };
    return rain;
  }

  // ---------- debris, dust, embers, fire ----------
  function makeFx(scene) {
    const chunks = [], dusts = [], embers = [], fires = [];
    const conc = new THREE.MeshStandardMaterial({ color: 0x6d6b66, roughness: 0.95 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.5, metalness: 0.8 });
    const dustTex = (() => { const c = canvas(64, 64), g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(160,150,135,1)'); r.addColorStop(1, 'rgba(160,150,135,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return tex(c); })();
    const emberMat = new THREE.MeshBasicMaterial({ color: 0xffa040 });
    function puff(p, s, dark) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0.8, color: dark ? 0x555555 : 0xbbb2a2 })); sp.position.copy(p); sp.scale.setScalar(s); sp.userData = { life: 0, grow: 8 + rnd() * 14, vy: 3 + rnd() * 4 }; scene.add(sp); dusts.push(sp); }
    function collapse(b, push = -1) {
      const { w, d, h, mi } = b.userData, p = b.position.clone(), facadeMat = b.children[0].material;
      scene.remove(b);
      const nx = 4, ny = Math.max(6, Math.round(h / 10)), nz = 3, cw = w / nx, ch = h / ny, cd = d / nz;
      const geo = new THREE.BoxGeometry(cw * 0.94, ch * 0.94, cd * 0.94);
      for (let ix = 0; ix < nx; ix++) for (let iy = 0; iy < ny; iy++) for (let iz = 0; iz < nz; iz++) {
        const outer = ix === 0 || ix === nx - 1 || iz === 0 || iz === nz - 1;
        const m = shadowed(new THREE.Mesh(geo, outer ? facadeMat : conc));
        m.position.set(p.x - w / 2 + cw * (ix + 0.5), ch * (iy + 0.5), p.z - d / 2 + cd * (iz + 0.5));
        m.userData = { v: new THREE.Vector3((rnd() - 0.5) * 16, 2 + rnd() * 10, push * (6 + rnd() * 20) * (iy / ny + 0.2)), av: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(3), delay: (ny - iy) * 0.035, life: 0 };
        scene.add(m); chunks.push(m);
      }
      for (let i = 0; i < 14; i++) { const r = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 6 + rnd() * 8, 5), steel)); r.position.set(p.x + (rnd() - 0.5) * w, h * rnd(), p.z + (rnd() - 0.5) * d); r.userData = { v: new THREE.Vector3((rnd() - 0.5) * 20, 6 + rnd() * 12, push * rnd() * 20), av: new THREE.Vector3(rnd() * 6, rnd() * 6, rnd() * 6), delay: 0.1, life: 0 }; scene.add(r); chunks.push(r); }
      for (let i = 0; i < 34; i++) puff(new THREE.Vector3(p.x + (rnd() - 0.5) * w * 1.2, 3 + rnd() * h * 0.6, p.z + (rnd() - 0.5) * d * 1.2), 14 + rnd() * 18);
      for (let i = 0; i < 60; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 4), emberMat); e.position.set(p.x + (rnd() - 0.5) * w, rnd() * h * 0.5, p.z + (rnd() - 0.5) * d); e.userData = { v: new THREE.Vector3((rnd() - 0.5) * 30, 10 + rnd() * 30, (rnd() - 0.5) * 30), life: 0 }; scene.add(e); embers.push(e); }
      const fire = new THREE.PointLight(0xff7a2a, 4000, 120, 2); fire.position.set(p.x, 8, p.z); fire.userData = { life: 0 }; scene.add(fire); fires.push(fire);
    }
    function hit(b, at) { for (let i = 0; i < 8; i++) puff(at.clone().add(new THREE.Vector3((rnd() - 0.5) * 10, (rnd() - 0.5) * 8, 0)), 5 + rnd() * 6); for (let i = 0; i < 12; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.25, 6, 4), emberMat); e.position.copy(at); e.userData = { v: new THREE.Vector3((rnd() - 0.5) * 30, rnd() * 20, (rnd() - 0.5) * 30), life: 0 }; scene.add(e); embers.push(e); } }
    function update(dt) {
      for (const c of chunks) { const u = c.userData; if (u.delay > 0) { u.delay -= dt; continue; } u.life += dt; if (u.life > 9) continue; u.v.y -= 55 * dt; c.position.addScaledVector(u.v, dt); c.rotation.x += u.av.x * dt; c.rotation.y += u.av.y * dt; c.rotation.z += u.av.z * dt; if (c.position.y < 1) { c.position.y = 1; u.v.y *= -0.2; u.v.x *= 0.55; u.v.z *= 0.55; u.av.multiplyScalar(0.4); } }
      for (let i = dusts.length - 1; i >= 0; i--) { const d = dusts[i], u = d.userData; u.life += dt; d.scale.setScalar(d.scale.x + u.grow * dt); d.position.y += u.vy * dt; d.material.opacity = Math.max(0, 0.8 - u.life * 0.2); if (u.life > 4) { scene.remove(d); d.material.dispose(); dusts.splice(i, 1); } }
      for (let i = embers.length - 1; i >= 0; i--) { const e = embers[i], u = e.userData; u.life += dt; u.v.y -= 25 * dt; e.position.addScaledVector(u.v, dt); if (u.life > 1.6 || e.position.y < 0) { scene.remove(e); embers.splice(i, 1); } }
      for (let i = fires.length - 1; i >= 0; i--) { const f = fires[i]; f.userData.life += dt; f.intensity = Math.max(0, 4000 * (1 - f.userData.life / 4)) * (0.8 + Math.random() * 0.4); if (f.userData.life > 4) { scene.remove(f); fires.splice(i, 1); } }
    }
    return { collapse, hit, puff, update };
  }

  // ---------- cinematic post: depth of field, bloom, grain + vignette ----------
  const GrainShader = {
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, amount: { value: 0.06 }, vignette: { value: 0.9 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float amount; uniform float vignette; varying vec2 vUv;
      float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233)) + time) * 43758.5453); }
      void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb += (rand(vUv) - 0.5) * amount;
        float d = distance(vUv, vec2(0.5)); c.rgb *= mix(1.0, smoothstep(0.85, 0.25, d), vignette * 0.75); gl_FragColor = c; }`,
  };
  function makePost(renderer, scene, camera, o = {}) {
    const comp = new A.EffectComposer(renderer);
    comp.addPass(new A.RenderPass(scene, camera));
    const bokeh = new A.BokehPass(scene, camera, { focus: 80, aperture: o.aperture ?? 0.00004, maxblur: 0.006 });
    comp.addPass(bokeh);
    const bloom = new A.UnrealBloomPass(new THREE.Vector2(512, 512), o.bloom ?? 0.5, 0.45, 0.82);
    comp.addPass(bloom);
    const grain = new A.ShaderPass(GrainShader); comp.addPass(grain);
    comp.addPass(new A.OutputPass());
    return { comp, bokeh, bloom, grain };
  }

  function setupRenderer(renderer) {
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  }
  function nightLights(scene) {
    scene.background = new THREE.Color(0x0b1220);
    scene.fog = new THREE.FogExp2(0x101a2a, 0.0042);
    scene.add(new THREE.HemisphereLight(0x5a6e8c, 0x1a1612, 0.55));
    const moon = new THREE.DirectionalLight(0x9fb4ff, 1.1); moon.position.set(-80, 160, 60); moon.castShadow = true; moon.shadow.mapSize.set(1536, 1536);
    Object.assign(moon.shadow.camera, { left: -140, right: 140, top: 140, bottom: -140, near: 10, far: 500 }); moon.shadow.bias = -0.0006;
    scene.add(moon, moon.target);
    return moon;
  }

  return { makeKaiju, animateKaiju, makePovArm, makeCity, makeRain, makeFx, makePost, setupRenderer, nightLights, rnd };
}
