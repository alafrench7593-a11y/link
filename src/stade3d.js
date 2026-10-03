// LinkFoot : le match en 3D (§28 à §31, §49, §50, §53, §54 du cahier du match ; pack 3D
// du cahier design §11 dans pack3d).
//
// Un seul rendu pour deux écrans : l'écran Mon Club (three.js chargé depuis le CDN) et
// l'app téléphone (three.js de npm, dans un GLView). Il ne décide rien. Il lit les images
// que le moteur enregistre dix fois par seconde de jeu : les positions des 22 joueurs, le
// ballon et sa hauteur, le porteur, la trajectoire en cours, les joueurs au sol, le
// plongeon du gardien, le coup de pied arrêté, et les événements (but, carton, clameur).
// Ce que l'on voit est donc ce que le moteur a décidé, rien de plus.
//
// Tout est construit en géométrie, sans image ni modèle téléchargé : rien à charger, rien
// qui dépende d'un fichier tiers. Les rares textures (texte des panneaux, face du pack)
// sont peintes pixel par pixel en JavaScript pur (peintre), parce que l'app native n'a
// pas de <canvas> pour écrire du texte : le même code donne la même image dans un
// navigateur et sur téléphone.
//
//   const v = club.stade3d(THREE, { renderer, largeur, hauteur, maillot, adverse, meteo })
//   v.image(A, B, fr, evs, src)   A, B : deux images du moteur, fr entre 0 et 1 ; evs : les
//                            événements d'images sautées (avance rapide), facultatif ; src : ce
//                            que lit le rendu réel ({ imgs, t } de direct.js), facultatif
//   v.taille(l, h)           v.projeter(code) → { x, y } en pixels    v.detruire()
//   v.brancherReel(r)        de vrais corps à la place des footballeurs en géométrie : r vient de
//                            rendu/labo/reel.js, que l'écran charge (base de mouvements et
//                            personnage) ; sans lui, rien ne change
export const Stade3D = {
  stade3d(T, o) {
    o = o || {};
    const PI = Math.PI, cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const meteo = o.meteo || 'soleil', nuit = meteo === 'nocturne' || meteo === 'nuit';
    const scene = new T.Scene();
    const fond = nuit ? '#060A09' : meteo === 'pluie' ? '#1A2226' : meteo === 'neige' ? '#2A3236' : '#0B1210';
    scene.background = new T.Color(fond);
    scene.fog = new T.Fog(fond, 110, 250);
    const jetables = [];   // géométries et matériaux à libérer
    const g = (x) => { jetables.push(x); return x; };
    const mat = (c, opts) => g(new T.MeshLambertMaterial(Object.assign({ color: c }, opts || {})));
    const basique = (c, opts) => g(new T.MeshBasicMaterial(Object.assign({ color: c }, opts || {})));

    // ---- la lumière : des projecteurs, plus francs de nuit ----
    scene.add(new T.HemisphereLight(nuit ? '#A8C0D0' : '#E4F2FF', '#1C2A20', nuit ? 0.62 : 0.9));
    const cle = new T.DirectionalLight(nuit ? '#EEF4FF' : '#FFF6E2', nuit ? 1.55 : 1.9);
    cle.position.set(40, 80, 25);
    if (o.ombres) {
      cle.castShadow = true; cle.shadow.mapSize.set(1024, 1024); cle.shadow.bias = -0.0008;
      Object.assign(cle.shadow.camera, { left: -60, right: 60, top: 75, bottom: -75, near: 10, far: 220 });
    }
    scene.add(cle);
    const contre = new T.DirectionalLight('#9FD8FF', nuit ? 0.35 : 0.25); contre.position.set(-40, 50, -30); scene.add(contre);

    // ---- la pelouse : bandes tondues et lignes, en géométrie ----
    const sol = new T.Mesh(g(new T.PlaneGeometry(170, 220)), mat(nuit ? '#17361C' : '#1E4424'));
    sol.rotation.x = -PI / 2; sol.position.y = -0.03; scene.add(sol);
    const bandes = 16, LONG = 115, lb = LONG / bandes;
    const vertA = mat(nuit ? '#2E7634' : '#3B8E40'), vertB = mat(nuit ? '#286A2E' : '#337F38');
    const bandeGeo = g(new T.PlaneGeometry(78, lb));
    for (let i = 0; i < bandes; i++) {
      const m = new T.Mesh(bandeGeo, i % 2 ? vertA : vertB);
      m.rotation.x = -PI / 2; m.position.set(0, 0, -LONG / 2 + lb * (i + 0.5)); m.receiveShadow = !!o.ombres; scene.add(m);
    }
    const blanc = basique('#F4F7F2');
    const ligne = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), m = new T.Mesh(g(new T.PlaneGeometry(L, 0.16)), blanc);
      m.rotation.x = -PI / 2; m.rotation.z = -Math.atan2(z1 - z0, x1 - x0);
      m.position.set((x0 + x1) / 2, 0.012, (z0 + z1) / 2); scene.add(m);
    };
    const anneau = (x, z, r, debut, ouverture) => {
      const m = new T.Mesh(g(new T.RingGeometry(r - 0.08, r + 0.08, 64, 1, debut || 0, ouverture || PI * 2)), blanc);
      m.rotation.x = -PI / 2; m.position.set(x, 0.012, z); scene.add(m);
    };
    const point = (x, z) => { const m = new T.Mesh(g(new T.CircleGeometry(0.2, 16)), blanc); m.rotation.x = -PI / 2; m.position.set(x, 0.013, z); scene.add(m); };
    ligne(-34, -52.5, 34, -52.5); ligne(-34, 52.5, 34, 52.5); ligne(-34, -52.5, -34, 52.5); ligne(34, -52.5, 34, 52.5); ligne(-34, 0, 34, 0);
    anneau(0, 0, 9.15); point(0, 0);
    const alpha = Math.acos(5.5 / 9.15);
    [-1, 1].forEach((d) => {
      const zg = d * 52.5, zs = zg - d * 16.5, zp = zg - d * 5.5;
      ligne(-20.16, zg, -20.16, zs); ligne(20.16, zg, 20.16, zs); ligne(-20.16, zs, 20.16, zs);
      ligne(-9.16, zg, -9.16, zp); ligne(9.16, zg, 9.16, zp); ligne(-9.16, zp, 9.16, zp);
      point(0, zg - d * 11);
      // l'arc de la surface, tourné vers le centre du terrain
      anneau(0, zg - d * 11, 9.15, d < 0 ? -PI / 2 - alpha : PI / 2 - alpha, 2 * alpha);
    });
    [[-34, -52.5, 0], [34, -52.5, PI / 2], [34, 52.5, PI], [-34, 52.5, -PI / 2]].forEach(([x, z, a]) => anneau(x, z, 1, a - PI / 2, PI / 2));

    // ---- les buts et leurs filets ----
    const poteauMat = g(new T.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.4 }));
    const filetMat = g(new T.LineBasicMaterial({ color: '#E8EEF2', transparent: true, opacity: 0.55 }));
    const filets = {};
    [-1, 1].forEach((d) => {
      const but = new T.Group();
      [-3.66, 3.66].forEach((x) => { const p = new T.Mesh(g(new T.CylinderGeometry(0.07, 0.07, 2.44, 10)), poteauMat); p.position.set(x, 1.22, 0); p.castShadow = !!o.ombres; but.add(p); });
      const barre = new T.Mesh(g(new T.CylinderGeometry(0.07, 0.07, 7.46, 10)), poteauMat); barre.rotation.z = PI / 2; barre.position.set(0, 2.44, 0); but.add(barre);
      const pts = [], P = 2.2;
      for (let i = 0; i <= 14; i++) { const x = -3.66 + i * 7.32 / 14; pts.push(x, 2.44, 0, x, 1.9, d * P, x, 1.9, d * P, x, 0, d * P); }
      for (let j = 0; j <= 6; j++) { const y = j * 1.9 / 6; pts.push(-3.66, y, d * P, 3.66, y, d * P); }
      for (let j = 1; j <= 4; j++) { const z = d * P * j / 4; pts.push(-3.66, 2.44 - (2.44 - 1.9) * j / 4, z, 3.66, 2.44 - (2.44 - 1.9) * j / 4, z); }
      [-3.66, 3.66].forEach((x) => { for (let j = 0; j <= 6; j++) { const y = j * 2.44 / 6; pts.push(x, y, 0, x, Math.min(y, 1.9), d * P); } });
      const geo = g(new T.BufferGeometry()); geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      const filet = new T.LineSegments(geo, filetMat); but.add(filet); filets[d] = { filet, choc: 0 };
      but.position.z = d * 52.5; scene.add(but);
    });

    // ---- les panneaux, les tribunes, le public, les projecteurs ----
    let texPub = null;
    try { texPub = g(this.texture3d(T, this.panneauPub())); texPub.wrapS = T.RepeatWrapping; } catch (e) { texPub = null; }
    const panneau = (L, x, z, rot) => {
      let m2;
      if (texPub) { const t = texPub.clone(); t.needsUpdate = true; t.repeat.set(L / 42, 1); jetables.push(t); m2 = basique('#FFFFFF', { map: t }); }
      else m2 = basique('#2ECC71');
      const m = new T.Mesh(g(new T.BoxGeometry(L, 0.9, 0.12)), m2); m.position.set(x, 0.45, z); m.rotation.y = rot; scene.add(m);
    };
    panneau(105, -39, 0, PI / 2); panneau(105, 39, 0, -PI / 2);
    panneau(28, -21, -56.5, 0); panneau(28, 21, -56.5, 0); panneau(28, -21, 56.5, PI); panneau(28, 21, 56.5, PI);
    const gradins = mat('#1A2420'), toit = mat('#2A3530');
    const places = [];   // [x, y, z] de chaque spectateur, pour l'InstancedMesh
    const tribune = (L, rangs, axe, signe, dist) => {
      for (let k = 0; k < rangs; k++) {
        const b = new T.Mesh(g(new T.BoxGeometry(axe === 'x' ? 2.2 : L, 1.1, axe === 'x' ? L : 2.2)), gradins);
        const off = dist + k * 2.2;
        if (axe === 'x') b.position.set(signe * off, 0.55 + k * 1.1, 0); else b.position.set(0, 0.55 + k * 1.1, signe * off);
        scene.add(b);
        const n = Math.floor(L / 1.15);
        for (let i = 0; i < n; i++) {
          const u = -L / 2 + (i + 0.5) * L / n + (Math.random() - 0.5) * 0.3;
          if (axe === 'x') places.push([signe * (off - 0.3), 1.45 + k * 1.1, u]); else places.push([u, 1.45 + k * 1.1, signe * (off - 0.3)]);
        }
      }
      const t2 = new T.Mesh(g(new T.BoxGeometry(axe === 'x' ? 10 : L + 6, 0.5, axe === 'x' ? L + 6 : 10)), toit);
      if (axe === 'x') t2.position.set(signe * (dist + rangs * 2.2 - 3), 3 + rangs * 1.1 + 4, 0); else t2.position.set(0, 3 + rangs * 1.1 + 4, signe * (dist + rangs * 2.2 - 3));
      scene.add(t2);
    };
    // trois tribunes : la caméra est dans la quatrième, côté +X, comme à la télévision
    tribune(118, 7, 'x', -1, 43); tribune(80, 6, 'z', -1, 61); tribune(80, 6, 'z', 1, 61);
    const maillot = o.maillot || { c1: '#2ECC71', c2: '#0B1210' }, adverse = o.adverse || '#2F8FE0';
    const tons = [maillot.c1, maillot.c1, '#F2F4F7', adverse, '#F2C66B', '#C8D0D8', maillot.c2 || '#0B1210', '#FF6B5A'];
    const publicGeo = g(new T.BoxGeometry(0.55, 0.75, 0.45)), publicMat = g(new T.MeshLambertMaterial({ color: '#FFFFFF' }));
    const foule = new T.InstancedMesh(publicGeo, publicMat, places.length);
    const mx = new T.Matrix4(), coul = new T.Color();
    places.forEach((p, i) => { mx.makeTranslation(p[0], p[1], p[2]); foule.setMatrixAt(i, mx); coul.set(tons[(i * 7 + (i >> 3)) % tons.length]); foule.setColorAt(i, coul); });
    scene.add(foule);
    const lampe = basique('#FFFBEA');
    [[-48, -68], [48, -68], [-48, 68], [48, 68]].forEach(([x, z]) => {
      const mat2 = new T.Mesh(g(new T.CylinderGeometry(0.45, 0.7, 34, 8)), toit); mat2.position.set(x, 17, z); scene.add(mat2);
      const l = new T.Mesh(g(new T.BoxGeometry(6, 3, 0.6)), lampe); l.position.set(x, 34, z); l.lookAt(0, 0, 0); scene.add(l);
    });

    // ---- les joueurs : des footballeurs en géométrie, animés par leur vitesse ----
    const PEAUX = ['#F1C7A0', '#D9A273', '#A86F45', '#7A4A2C', '#5C3A22'], CHEV = ['#1E150F', '#0F0F0F', '#5A3A1E', '#C9A050', '#2E2118', '#7A2E1A'];
    const cyl = (r1, r2, h) => { const geo = g(new T.CylinderGeometry(r1, r2, h, 10)); geo.translate(0, -h / 2, 0); return geo; };
    const G = {
      tronc: g(new T.CylinderGeometry(0.21, 0.17, 0.6, 12)), tete: g(new T.SphereGeometry(0.14, 16, 12)),
      cheveux: g(new T.SphereGeometry(0.147, 16, 8, 0, PI * 2, 0, PI * 0.5)), cou: g(new T.CylinderGeometry(0.06, 0.07, 0.1, 8)),
      bras: cyl(0.06, 0.05, 0.3), avantBras: cyl(0.05, 0.042, 0.28), main: g(new T.SphereGeometry(0.05, 8, 6)),
      short: g(new T.BoxGeometry(0.4, 0.22, 0.25)), cuisse: cyl(0.078, 0.066, 0.42), tibia: cyl(0.062, 0.05, 0.42),
      chaussure: g(new T.BoxGeometry(0.1, 0.075, 0.25))
    };
    const lambert = {};
    const M = (c) => lambert[c] || (lambert[c] = mat(c));
    const ombreJoueur = basique('#000000', { transparent: true, opacity: 0.28, depthWrite: false });
    const ombreGeo = g(new T.CircleGeometry(0.42, 18));
    const ECH = 1.3;   // un peu plus grands que nature : lisibles sur un téléphone
    // les couleurs d'un joueur : maillot, short, chaussettes, crampons (le rendu réel les reprend)
    const couleurs = (code) => {
      const H = code < 11, i = H ? code : code - 11, gardien = i === 0;
      const tShirt = gardien ? (H ? '#F2C66B' : '#2B2F36') : H ? maillot.c1 : adverse;
      return { maillot: tShirt, manche: gardien ? tShirt : H && maillot.pat === 'manches' ? (maillot.c2 || tShirt) : tShirt,
        short: H ? (maillot.c2 && maillot.c2 !== maillot.c1 ? maillot.c2 : '#101814') : '#F2F4F7',
        chaussettes: H ? (gardien ? '#2B2F36' : maillot.c1) : adverse, chaussures: ['#141414', '#F2F4F7', '#FF4757', '#1B4DFF'][(i + (H ? 0 : 1)) % 4] };
    };
    const fabrique = (code) => {
      const H = code < 11, i = H ? code : code - 11, gardien = i === 0, cj = couleurs(code);
      const tShirt = cj.maillot, tManche = cj.manche, tShort = cj.short, tChaus = cj.chaussettes, peau = PEAUX[(i * 3 + (H ? 0 : 2)) % PEAUX.length];
      const racine = new T.Group(), corps = new T.Group(); corps.scale.setScalar(ECH); racine.add(corps);
      const hanche = new T.Group(); hanche.position.y = 0.92; corps.add(hanche);
      const jambe = (cote) => {
        const cuisse = new T.Group(); cuisse.position.set(cote * 0.1, -0.06, 0); hanche.add(cuisse);
        cuisse.add(new T.Mesh(G.cuisse, M(peau)));
        const genou = new T.Group(); genou.position.y = -0.42; cuisse.add(genou);
        const tib = new T.Mesh(G.tibia, M(tChaus)); genou.add(tib);
        const ch = new T.Mesh(G.chaussure, M(cj.chaussures)); ch.position.set(0, -0.44, 0.06); genou.add(ch);
        return { cuisse, genou };
      };
      const jg = jambe(-1), jd = jambe(1);
      const sh = new T.Mesh(G.short, M(tShort)); sh.position.y = -0.03; hanche.add(sh);
      const buste = new T.Group(); hanche.add(buste);
      const tr = new T.Mesh(G.tronc, M(tShirt)); tr.position.y = 0.3; buste.add(tr);
      const cou = new T.Mesh(G.cou, M(peau)); cou.position.y = 0.63; buste.add(cou);
      const tete = new T.Group(); tete.position.y = 0.78; buste.add(tete);
      tete.add(new T.Mesh(G.tete, M(peau)));
      const ch2 = new T.Mesh(G.cheveux, M(CHEV[(i * 5 + (H ? 1 : 3)) % CHEV.length])); ch2.position.y = 0.02; ch2.rotation.x = -0.25; tete.add(ch2);
      const bras = (cote) => {
        const ep = new T.Group(); ep.position.set(cote * 0.25, 0.56, 0); buste.add(ep);
        ep.add(new T.Mesh(G.bras, M(tManche)));
        const coude = new T.Group(); coude.position.y = -0.3; ep.add(coude);
        coude.add(new T.Mesh(G.avantBras, M(gardien ? '#F2F4F7' : peau)));
        const main = new T.Mesh(G.main, M(gardien ? '#F2F4F7' : peau)); main.position.y = -0.3; coude.add(main);
        return { ep, coude };
      };
      const bg = bras(-1), bd = bras(1);
      const ombre = new T.Mesh(ombreGeo, ombreJoueur); ombre.rotation.x = -PI / 2; ombre.position.y = 0.02; racine.add(ombre);
      racine.traverse((m) => { if (m.isMesh && m !== ombre) m.castShadow = !!o.ombres; });
      scene.add(racine);
      return { code, H, gardien, racine, corps, hanche, buste, tete, jg, jd, bg, bd, ombre, x: 0, z: 0, cap: H ? PI : 0, phase: Math.random() * 6, vit: 0, frappe: 0, fete: 0, visible: true };
    };
    const joueurs = []; for (let c = 0; c < 22; c++) joueurs.push(fabrique(c));

    // ---- le ballon, son ombre, l'anneau du porteur, la trajectoire ----
    // un icosaèdre subdivisé : les triangles qui touchent ses douze sommets d'origine font les douze pentagones noirs
    const ballonGeo = g(new T.IcosahedronGeometry(0.3, 2));
    {
      const pos = ballonGeo.attributes.position, cols = [], ico = new T.IcosahedronGeometry(1, 0), sommets = [];
      for (let k = 0; k < ico.attributes.position.count; k++) sommets.push(new T.Vector3().fromBufferAttribute(ico.attributes.position, k).normalize());
      ico.dispose();
      const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
      for (let f = 0; f < pos.count; f += 3) {
        a.fromBufferAttribute(pos, f); b.fromBufferAttribute(pos, f + 1); c.fromBufferAttribute(pos, f + 2);
        const centre = a.add(b).add(c).normalize(), noir = sommets.some((s) => s.dot(centre) > 0.95);
        for (let k = 0; k < 3; k++) cols.push(noir ? 0.07 : 0.97, noir ? 0.07 : 0.97, noir ? 0.08 : 0.95);
      }
      ballonGeo.setAttribute('color', new T.Float32BufferAttribute(cols, 3));
    }
    const ballon = new T.Mesh(ballonGeo, g(new T.MeshLambertMaterial({ vertexColors: true, flatShading: true })));
    ballon.castShadow = !!o.ombres; scene.add(ballon);
    const ombreBallon = new T.Mesh(g(new T.CircleGeometry(0.34, 18)), basique('#000000', { transparent: true, opacity: 0.38, depthWrite: false }));
    ombreBallon.rotation.x = -PI / 2; ombreBallon.position.y = 0.025; scene.add(ombreBallon);
    const anneauPorteur = new T.Mesh(g(new T.RingGeometry(0.62, 0.86, 32)), basique('#2ECC71', { transparent: true, opacity: 0.95, depthWrite: false }));
    anneauPorteur.rotation.x = -PI / 2; anneauPorteur.position.y = 0.03; scene.add(anneauPorteur);
    const trajGeo = g(new T.BufferGeometry()); trajGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
    const trajMat = g(new T.LineDashedMaterial({ color: '#FFFFFF', dashSize: 0.8, gapSize: 0.6, transparent: true, opacity: 0.6 }));
    const trajectoire = new T.Line(trajGeo, trajMat); trajectoire.visible = false; scene.add(trajectoire);
    // les cartons, au-dessus de la tête du joueur
    const cartonGeo = g(new T.PlaneGeometry(0.34, 0.48));
    const cartons = [];

    // ---- la météo (§54) : pluie et neige en particules ----
    let flocons = null;
    if (meteo === 'pluie' || meteo === 'neige') {
      const n = meteo === 'pluie' ? 1400 : 900, arr = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { arr[k * 3] = (Math.random() - 0.5) * 90; arr[k * 3 + 1] = Math.random() * 40; arr[k * 3 + 2] = (Math.random() - 0.5) * 90; }
      const geo = g(new T.BufferGeometry()); geo.setAttribute('position', new T.BufferAttribute(arr, 3));
      flocons = new T.Points(geo, g(new T.PointsMaterial({ color: meteo === 'pluie' ? '#B8D4E8' : '#FFFFFF', size: meteo === 'pluie' ? 0.12 : 0.3, transparent: true, opacity: meteo === 'pluie' ? 0.55 : 0.9, depthWrite: false })));
      scene.add(flocons);
    }

    // ---- la caméra : un plan de diffusion, sur le côté, qui suit le ballon ----
    const cam = new T.PerspectiveCamera(o.fov || 34, (o.largeur || 360) / (o.hauteur || 300), 0.5, 500);
    const C = { x: 0, z: 0, dist: 37, haut: 22, coupe: 0, cible: null, tremble: 0 };
    let W = o.largeur || 360, Hh = o.hauteur || 300;
    const vers = (x, y) => [x - 34, y - 52.5];   // moteur (0..68, 0..105) → scène

    // ---- les événements : but, carton, clameur ----
    let clameur = 0, fete = null, tJeu = 0, dernierA = null;
    const evenement = (e) => {
      if (!e) return;
      if (e.k === 'goal') {
        fete = { s: e.s, c: e.c, t: 0 }; clameur = 1; C.tremble = 0.6;
        const d = e.s === 'H' ? -1 : 1;   // le but attaqué par le camp qui marque (le domicile attaque vers y = 0)
        if (filets[d]) filets[d].choc = 1;
        if (e.c != null && joueurs[e.c]) C.cible = { code: e.c, t: 0, dur: 2.6 };   // §49 le plan serré sur le buteur
      } else if (e.k === 'card') {
        const m = new T.Mesh(cartonGeo, basique(e.col || '#FFD23F', { side: T.DoubleSide })); scene.add(m);
        cartons.push({ m, code: e.c, t: 0 });
        if (e.col === '#FF4757') clameur = Math.max(clameur, 0.6);
      } else if (e.k === 'roar') clameur = Math.max(clameur, e.v || 0.5);
    };

    // ---- le rendu réel (rendu/labo/reel.js), quand l'écran l'a branché : de vrais corps animés par
    // de vraies captures prennent la place des footballeurs en géométrie. Ils lisent les mêmes
    // images du moteur ; ce rendu-ci garde le terrain, le public, la caméra, le ballon et les signes
    // (anneau du porteur, trajectoire, cartons). Tant qu'il n'a rien à montrer, les footballeurs en
    // géométrie restent.
    let reel = null, reelVu = null;

    // ---- une image ----
    const v3 = new T.Vector3();
    const image = (A, B, fr, evs, src) => {
      if (!A) { o.renderer.render(scene, cam); return; }
      B = B || A; fr = cl(fr || 0, 0, 1);
      if (A !== dernierA) {
        if (evs) evs.forEach(evenement);
        if (A.ev) A.ev.forEach(evenement);
        // la frappe : le joueur d'où part la trajectoire lève la jambe
        if (A.fl && (!dernierA || !dernierA.fl || dernierA.fl[0] !== A.fl[0] || dernierA.fl[1] !== A.fl[1])) {
          let best = null, bd = 2.8;
          for (const j of joueurs) { const dd = Math.hypot(A.P[j.code * 2] - A.fl[0], A.P[j.code * 2 + 1] - A.fl[1]); if (dd < bd) { bd = dd; best = j; } }
          if (best) best.frappe = 0.0001;
        }
        dernierA = A;
      }
      const t = A.t + ((B.t != null ? B.t : A.t) - A.t) * fr;
      const dt = cl(t - tJeu, 0, 0.5); tJeu = t;
      const bx = A.b[0] + (B.b[0] - A.b[0]) * fr, by = A.b[1] + (B.b[1] - A.b[1]) * fr, bz = A.b[2] + (B.b[2] - A.b[2]) * fr;
      const [BX, BZ] = vers(bx, by);
      // les joueurs
      const fa = A.fa || [], dv = A.dv;
      for (const j of joueurs) {
        const ax = A.P[j.code * 2], ay = A.P[j.code * 2 + 1], qx = B.P[j.code * 2], qy = B.P[j.code * 2 + 1];
        if (ax < -5) { j.racine.visible = false; continue; }   // expulsé
        j.racine.visible = true;
        const px = qx < -5 ? ax : ax + (qx - ax) * fr, py = qx < -5 ? ay : ay + (qy - ay) * fr;
        const [X, Z] = vers(px, py);
        const vx = qx < -5 ? 0 : (qx - ax) * 10, vz = qx < -5 ? 0 : (qy - ay) * 10, vit = Math.hypot(vx, vz);
        j.vit += (vit - j.vit) * cl(dt * 6, 0, 1);
        const capVise = j.vit > 0.7 ? Math.atan2(vx, vz) : Math.atan2(BX - X, BZ - Z);
        let dA = capVise - j.cap; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); j.cap += dA * cl(dt * 7, 0, 1);
        let dx = 0, y = 0, rotZ = 0, rotX = 0;
        // la course : foulée et bras selon la vitesse (§28)
        const amp = cl(j.vit / 7, 0, 1);
        j.phase += dt * (2 * PI) * (0.9 + j.vit * 0.22);
        const s = Math.sin(j.phase);
        j.jg.cuisse.rotation.x = s * amp * 0.85; j.jd.cuisse.rotation.x = -s * amp * 0.85;
        j.jg.genou.rotation.x = Math.max(0, -Math.cos(j.phase)) * amp * 1.2; j.jd.genou.rotation.x = Math.max(0, Math.cos(j.phase)) * amp * 1.2;
        j.bg.ep.rotation.set(-s * amp * 0.7, 0, -0.12); j.bd.ep.rotation.set(s * amp * 0.7, 0, 0.12);
        j.bg.coude.rotation.x = -0.5 * amp - 0.15; j.bd.coude.rotation.x = -0.5 * amp - 0.15;
        j.buste.rotation.x = amp * 0.22; y = Math.abs(Math.cos(j.phase)) * amp * 0.06;
        // la frappe
        if (j.frappe > 0) {
          j.frappe += dt / 0.4; const u = j.frappe;
          if (u >= 1) j.frappe = 0;
          // l'élan : la jambe part en arrière, puis fouette vers l'avant (rotation positive = vers l'arrière)
          else { j.jd.cuisse.rotation.x = u < 0.4 ? 0.7 * (u / 0.4) : 0.7 - 2.1 * ((u - 0.4) / 0.6); j.jd.genou.rotation.x = u < 0.4 ? 1.2 * (u / 0.4) : 1.2 * (1 - (u - 0.4) / 0.6); j.bg.ep.rotation.z = -0.8; j.bd.ep.rotation.z = 0.5; }
        }
        // le plongeon du gardien
        if (dv && dv[0] === j.code) {
          // le roulis se fait dans le repère du joueur : on le corrige selon qu'il regarde vers +Z ou -Z
          const e = Math.min(1, dv[2] * 1.5), sens = Math.cos(j.cap) >= 0 ? 1 : -1;
          rotZ = -dv[1] * 1.35 * e * sens; y = Math.sin(Math.min(1, dv[2]) * PI) * 0.55; dx = dv[1] * e * 1.7;
          j.bg.ep.rotation.set(0, 0, -2.6); j.bd.ep.rotation.set(0, 0, 2.6);
        }
        // au sol
        if (fa.includes(j.code)) { rotX = -1.35; y = 0.12; }
        // §50 la célébration : le camp qui marque saute, l'autre baisse la tête
        if (fete && fete.t < 4) {
          if ((j.H ? 'H' : 'A') === fete.s) {
            const prs = j.code === fete.c ? 1 : 0.7;
            y += Math.abs(Math.sin(fete.t * 5 + j.code)) * 0.45 * prs; j.bg.ep.rotation.set(0, 0, -2.5); j.bd.ep.rotation.set(0, 0, 2.5);
          } else { j.tete.rotation.x = 0.6; j.buste.rotation.x = 0.3; }
        } else j.tete.rotation.x = 0;
        j.racine.position.set(X + dx, 0, Z);
        j.racine.rotation.set(0, j.cap, 0);
        j.corps.position.y = y; j.corps.rotation.z = rotZ; j.corps.rotation.x = rotX;
        j.ombre.scale.setScalar(1 - Math.min(0.5, y * 0.6));
        j.x = X + dx; j.z = Z;
      }
      if (fete) { fete.t += dt; if (fete.t > 4.5) fete = null; }
      // le rendu réel : les corps, et le ballon qu'ils jouent ; les footballeurs en géométrie
      // s'effacent, leur ombre suit le vrai corps
      const R = reel ? (reel.image(src) || reelVu) : null;
      if (R) reelVu = R;
      for (const j of joueurs) {
        j.corps.visible = !R;
        if (!R) continue;
        const q = R.joueurs[j.code];
        if (!q || !q.present) { j.racine.visible = false; continue; }
        j.racine.visible = true; j.racine.position.set(q.x, 0, q.z); j.ombre.scale.setScalar(0.62);
        j.x = q.x; j.z = q.z;
      }
      // le ballon ; avec les vrais corps, 30 cm au lieu de 22 (encore lisible sur un téléphone),
      // posé sur l'herbe là où le rendu réel le met
      const ech = R ? 0.15 / 0.3 : 1;
      const hv = R ? Math.max(0, R.ballon.y - 0.11) : bz, hb = R ? 0.15 + hv : 0.3 + Math.max(0, bz), BXv = R ? R.ballon.x : BX, BZv = R ? R.ballon.z : BZ;
      const avant = ballon.position.clone();
      ballon.position.set(BXv, hb, BZv); ballon.scale.setScalar(ech);
      const roule = avant.distanceTo(ballon.position);
      ballon.rotation.x += roule * 2.2 / ech; ballon.rotation.z += roule * 0.5 / ech;
      ombreBallon.position.set(BXv + hv * 0.18, 0.025, BZv + hv * 0.1); ombreBallon.scale.setScalar((1 + hv * 0.08) * ech);
      ombreBallon.material.opacity = cl(0.38 - hv * 0.03, 0.08, 0.38);
      // le porteur
      const own = A.o != null && A.o >= 0 ? joueurs[A.o] : null;
      anneauPorteur.visible = !!own && own.racine.visible;
      if (own) { anneauPorteur.position.set(own.x, 0.03, own.z); anneauPorteur.material.color.set(own.H ? '#2ECC71' : '#FFFFFF'); }
      // la trajectoire d'une passe en profondeur ou d'une frappe
      const fl = A.fl;
      if (fl && (fl[4] === 'shot' || fl[4] === 'through' || fl[4] === 'cross')) {
        const [x0, z0] = vers(fl[0], fl[1]), [x1, z1] = vers(fl[2], fl[3]);
        const pos = trajGeo.attributes.position; pos.setXYZ(0, x0, 0.05, z0); pos.setXYZ(1, x1, 0.05, z1); pos.needsUpdate = true;
        trajectoire.computeLineDistances();
        trajMat.color.set(fl[4] === 'shot' ? '#FFE14D' : fl[4] === 'through' ? '#2ECC71' : '#FFFFFF');
        trajectoire.visible = true;
      } else trajectoire.visible = false;
      // les filets qui tremblent
      Object.keys(filets).forEach((k) => { const f = filets[k]; f.choc = Math.max(0, f.choc - dt * 1.2); f.filet.position.z = Number(k) * Math.sin(f.choc * PI * 4) * 0.35 * f.choc; });
      // les cartons montent au-dessus du joueur, face caméra
      for (let k = cartons.length - 1; k >= 0; k--) {
        const ca = cartons[k]; ca.t += dt; const jj = joueurs[ca.code];
        if (ca.t > 2.2 || !jj) { scene.remove(ca.m); ca.m.material.dispose(); cartons.splice(k, 1); continue; }
        ca.m.position.set(jj.x, 3.1 + Math.min(0.4, ca.t), jj.z); ca.m.quaternion.copy(cam.quaternion);
      }
      // §53 le public : il se lève sur un but, frémit sur une occasion
      clameur = Math.max(0, clameur - dt * 0.35);
      if (clameur > 0.05) {
        const n = places.length, k0 = Math.floor(tJeu * 37) % 7;
        for (let i = k0; i < n; i += 7) { const p = places[i]; mx.makeTranslation(p[0], p[1] + Math.abs(Math.sin(tJeu * 9 + i)) * 0.5 * clameur, p[2]); foule.setMatrixAt(i, mx); }
        foule.instanceMatrix.needsUpdate = true;
      }
      // la neige et la pluie suivent la caméra
      if (flocons) {
        const arr = flocons.geometry.attributes.position.array, vy = meteo === 'pluie' ? 22 : 2.2;
        for (let k = 0; k < arr.length; k += 3) {
          arr[k + 1] -= vy * Math.max(dt, 0.016) * (meteo === 'pluie' ? 1 : 0.6);
          if (meteo === 'neige') arr[k] += Math.sin(tJeu + k) * 0.01;
          if (arr[k + 1] < 0) { arr[k + 1] = 38 + Math.random() * 4; arr[k] = C.x + (Math.random() - 0.5) * 90; arr[k + 2] = C.z + (Math.random() - 0.5) * 90; }
        }
        flocons.geometry.attributes.position.needsUpdate = true;
      }
      // la caméra : elle suit le ballon avec un temps d'avance, se rapproche dans la surface
      // et sur les coups de pied arrêtés, et part en plan serré sur le buteur (§49)
      const bvx = (B.b[0] - A.b[0]) * 10, bvy = (B.b[1] - A.b[1]) * 10;
      const proche = Math.abs(BZ) > 34 || !!A.set;
      const portrait = W / Math.max(1, Hh) < 1;
      // assez près pour lire les gestes sur un téléphone ; plus près encore dans la surface ; plus
      // près aussi avec de vrais corps, à leur vraie taille
      const zoom = R ? 0.66 : 1;
      const distV = (proche ? 30 : 37) * (portrait ? 1.2 : 1) * zoom, hautV = (proche ? 18 : 22) * (portrait ? 1.12 : 1) * zoom;
      const k = cl(dt * 1.6, 0, 1);
      C.x += (cl(BX * 0.5 + bvx * 0.2, -16, 16) - C.x) * k;
      C.z += (cl(BZ + bvy * 0.35, -46, 46) - C.z) * k;
      C.dist += (distV - C.dist) * k; C.haut += (hautV - C.haut) * k;
      C.tremble = Math.max(0, C.tremble - dt);
      const tx = (Math.random() - 0.5) * C.tremble * 0.6, ty = (Math.random() - 0.5) * C.tremble * 0.6;
      if (C.cible && joueurs[C.cible.code] && C.cible.t < C.cible.dur) {
        C.cible.t += dt;
        const jj = joueurs[C.cible.code], u = Math.min(1, C.cible.t / 0.5);
        const ox = jj.x + 9 * (1 - 0.2 * u), oz = jj.z + (jj.z > 0 ? -5 : 5);
        cam.position.set(ox + tx, 3.4 + ty, oz);
        cam.lookAt(jj.x, 1.6, jj.z);
      } else {
        C.cible = null;
        cam.position.set(C.x + C.dist + tx, C.haut + ty, C.z * 0.94);
        cam.lookAt(C.x, 0, C.z);
      }
      o.renderer.render(scene, cam);
    };

    return {
      scene, camera: cam,
      image,
      evenement,
      // le rendu réel : r = creerReel(..., v.scene, { couleurs: v.couleurs, ... }) ; null le débranche
      brancherReel(r) { if (reel && reel !== r && reel.detruire) reel.detruire(); reel = r; reelVu = null; },
      couleurs,
      reelActif: () => !!reelVu,
      taille(l, h) { W = l; Hh = h; cam.aspect = l / Math.max(1, h); cam.updateProjectionMatrix(); },
      // la position d'un joueur à l'écran, en pixels : pour écrire son nom au-dessus
      projeter(code) {
        const j = joueurs[code]; if (!j || !j.racine.visible) return null;
        v3.set(j.x, reelVu ? 2.2 : 2.6 * ECH, j.z).project(cam);
        if (v3.z > 1) return null;
        return { x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * Hh };
      },
      detruire() {
        if (reel && reel.detruire) { reel.detruire(); reel = null; }
        scene.traverse((m) => { if (m.isInstancedMesh) m.dispose(); });
        jetables.forEach((x) => { try { x.dispose(); } catch (e) { /* déjà libéré */ } });
        cartons.forEach((c) => c.m.material.dispose());
      }
    };
  },

  // Le pack en 3D (cahier design §11 : « pack 3D, visuel central, glow, animation
  // d'ouverture, rareté »). Un sachet métallisé qui flotte et tourne, accroche la lumière
  // de deux projecteurs qui tournent autour, tremble à chaque toucher, puis éclate dans la
  // couleur de la rareté tirée. Même code pour Mon Club et pour l'app.
  //   const p = club.pack3d(THREE, { renderer, largeur, hauteur, couleur, nom, tirages })
  //   p.image(dt)   p.secouer(force)   p.ouvrir(couleur)   p.taille(l, h)   p.detruire()
  pack3d(T, o) {
    o = o || {};
    const jetables = [], g = (x) => { jetables.push(x); return x; };
    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(30, (o.largeur || 210) / (o.hauteur || 290), 0.1, 80);
    cam.position.set(0, 0, o.distance || 9);
    scene.add(new T.AmbientLight('#FFFFFF', 0.6));
    const cle = new T.DirectionalLight('#FFFFFF', 1.3); cle.position.set(3, 4, 7); scene.add(cle);
    // une couleur du jeu peut être un dégradé CSS (« linear-gradient(135deg, #2ECC71, #1E9E92) ») :
    // three.js ne lit que des couleurs simples, on garde donc les teintes qu'il contient
    const teintes = (c, defaut) => { const m = String(c || '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g); return m && m.length ? m : [defaut]; };
    const [coul] = teintes(o.couleur, '#2ECC71');
    const l1 = new T.PointLight(coul, 40, 22), l2 = new T.PointLight('#43E0C2', 26, 22); scene.add(l1); scene.add(l2);
    // le sachet : un rectangle aux coins arrondis, extrudé, bords biseautés
    const w = 2.1, h = 2.9, r = 0.22, f = new T.Shape();
    f.moveTo(-w / 2 + r, -h / 2); f.lineTo(w / 2 - r, -h / 2); f.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    f.lineTo(w / 2, h / 2 - r); f.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); f.lineTo(-w / 2 + r, h / 2);
    f.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); f.lineTo(-w / 2, -h / 2 + r); f.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    const geo = g(new T.ExtrudeGeometry(f, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.06, bevelSegments: 4, curveSegments: 10 }));
    geo.center();
    // la face : peinte en JavaScript pur (facePack), la même dans le navigateur et sur téléphone
    let tex = null;
    try { tex = g(this.texture3d(T, this.facePack({ couleur: o.couleur, nom: o.nom, tirages: o.tirages }))); tex.repeat.set(1 / w, 1 / h); tex.offset.set(0.5, 0.5); } catch (e) { tex = null; }
    const face = g(new T.MeshStandardMaterial({ color: tex ? '#FFFFFF' : coul, map: tex, metalness: 0.42, roughness: 0.3, transparent: true }));
    const tranche = g(new T.MeshStandardMaterial({ color: '#D7DED9', metalness: 0.92, roughness: 0.18, transparent: true }));
    const sachet = new T.Mesh(geo, [face, tranche]);
    const groupe = new T.Group(); groupe.add(sachet); scene.add(groupe);
    // l'éclat de l'ouverture : des paillettes qui partent dans toutes les directions
    const N = 180, pos = new Float32Array(N * 3), vit = [];
    for (let k = 0; k < N; k++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1), v = 2.5 + Math.random() * 4; vit.push([Math.sin(ph) * Math.cos(th) * v, Math.sin(ph) * Math.sin(th) * v, Math.cos(ph) * v]); }
    const pg = g(new T.BufferGeometry()); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pm = g(new T.PointsMaterial({ color: coul, size: 0.14, transparent: true, opacity: 0, depthWrite: false }));
    const eclat = new T.Points(pg, pm); scene.add(eclat);
    // le halo (§11 « glow ») : une lueur derrière le pack, quand l'écran n'en dessine pas déjà une
    let halo = null;
    if (o.halo) {
      try {
        const hp = this.peintre(64, 64, 1, 1);
        hp.fond((x, y, c) => { const v = Math.max(0, 1 - Math.sqrt((x - 0.5) * (x - 0.5) + (y - 0.5) * (y - 0.5)) * 2); c[0] = c[1] = c[2] = v * v; });
        const hm = g(new T.MeshBasicMaterial({ color: coul, map: g(this.texture3d(T, { data: hp.octets(), largeur: 64, hauteur: 64 }, true)),
          transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.55 }));
        halo = new T.Mesh(g(new T.PlaneGeometry(7.5, 7.5)), hm); halo.position.z = -1.4; scene.add(halo);
      } catch (e) { halo = null; }
    }
    let t = 0, choc = 0, ouv = -1;
    return {
      secouer(force) { choc = Math.max(choc, Math.min(1, force || 0.5)); },
      ouvrir(c) { if (ouv >= 0) return; ouv = 0; const k = teintes(c, null)[0]; if (k) { pm.color.set(k); l1.color.set(k); if (halo) halo.material.color.set(k); } pos.fill(0); },
      // un pack neuf prend la place de celui qu'on vient d'ouvrir
      nouveau() {
        ouv = -1; choc = 0; face.opacity = tranche.opacity = 1; groupe.scale.setScalar(1); pm.opacity = 0;
        pm.color.set(coul); l1.color.set(coul); pos.fill(0); pg.attributes.position.needsUpdate = true;
        if (halo) { halo.material.color.set(coul); halo.scale.setScalar(1); }
      },
      image(dt) {
        dt = Math.max(0, Math.min(0.1, dt || 0.016)); t += dt; choc = Math.max(0, choc - dt * 1.6);
        // au repos : il flotte et tourne lentement ; secoué : il tremble et la lumière monte
        const jx = (Math.random() - 0.5) * choc * 0.18, jy = (Math.random() - 0.5) * choc * 0.18;
        groupe.position.set(jx, Math.sin(t * 1.3) * 0.09 + jy, 0);
        groupe.rotation.set(Math.sin(t * 0.7) * 0.1, Math.sin(t * 0.8) * 0.5 + choc * Math.sin(t * 40) * 0.12, choc * Math.sin(t * 33) * 0.08);
        l1.position.set(Math.cos(t * 1.1) * 4, Math.sin(t * 0.9) * 2.5, 3.2); l2.position.set(Math.cos(t * 1.1 + Math.PI) * 4, -Math.sin(t * 0.7) * 2.5, 3.2);
        l1.intensity = 40 + choc * 60;
        if (ouv >= 0) {
          ouv += dt;
          const u = Math.min(1, ouv / 0.9);
          groupe.scale.setScalar(1 + u * 0.35); groupe.rotation.y += u * u * 9;
          face.opacity = tranche.opacity = Math.max(0, 1 - Math.max(0, u - 0.35) / 0.4);
          pm.opacity = u < 0.15 ? u / 0.15 : Math.max(0, 1 - (u - 0.15) / 0.85);
          for (let k = 0; k < N; k++) { pos[k * 3] = vit[k][0] * ouv; pos[k * 3 + 1] = vit[k][1] * ouv; pos[k * 3 + 2] = vit[k][2] * ouv; }
          pg.attributes.position.needsUpdate = true;
          l1.intensity = 120 * (1 - u) + 10;
        }
        if (halo) {
          const u = ouv >= 0 ? Math.min(1, ouv / 0.9) : 0;
          halo.material.opacity = ouv >= 0 ? Math.max(0, 1 - u) : 0.5 + Math.sin(t * 2) * 0.08 + choc * 0.4;
          halo.scale.setScalar(1 + u * 0.7 + choc * 0.12);
        }
        o.renderer.render(scene, cam);
      },
      taille(l, h2) { cam.aspect = l / Math.max(1, h2); cam.updateProjectionMatrix(); },
      detruire() { jetables.forEach((x) => { try { x.dispose(); } catch (e) { /* déjà libéré */ } }); }
    };
  },

  // ---- un petit peintre en JavaScript pur ----
  // L'app téléphone n'a pas de <canvas> pour écrire du texte dans une texture : les textures
  // sont donc peintes ici, pixel par pixel, avec des formes lissées (traits, disques,
  // polygones) et un alphabet en traits (capitales, chiffres). On dessine en unités libres
  // (uL × uH, y vers le bas) ; octets() rend les pixels RGBA, prêts pour texture3d.
  peintre(L, H, uL, uH) {
    const px = new Float32Array(L * H * 3), cov = new Float32Array(L * H);
    const sx = uL / L, sy = uH / H, ps = (sx + sy) / 2;
    const cl = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
    const rgb = (h) => {
      const m = String(h || '').match(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/);
      const f = !m ? 'FFFFFF' : m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
      return [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255);
    };
    // une couche : la couverture de plusieurs formes (le maximum, pour que deux traits qui se
    // croisent ne foncent pas le point commun), puis une seule fusion avec la couleur
    const couche = (formes, couleur, alpha) => {
      const col = rgb(couleur), al = alpha == null ? 1 : alpha;
      let i0 = L, j0 = H, i1 = -1, j1 = -1;
      formes.forEach((f) => {
        const a0 = Math.max(0, Math.floor(f.bb[0] / sx) - 1), a1 = Math.min(L - 1, Math.ceil(f.bb[2] / sx) + 1);
        const b0 = Math.max(0, Math.floor(f.bb[1] / sy) - 1), b1 = Math.min(H - 1, Math.ceil(f.bb[3] / sy) + 1);
        if (a0 < i0) i0 = a0; if (a1 > i1) i1 = a1; if (b0 < j0) j0 = b0; if (b1 > j1) j1 = b1;
        for (let j = b0; j <= b1; j++) for (let i = a0; i <= a1; i++) {
          const c = cl(0.5 - f.d((i + 0.5) * sx, (j + 0.5) * sy) / ps), q = j * L + i;
          if (c > cov[q]) cov[q] = c;
        }
      });
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const q = j * L + i; if (!cov[q]) continue;
        const a = cov[q] * al; cov[q] = 0;
        for (let c = 0; c < 3; c++) px[q * 3 + c] += (col[c] - px[q * 3 + c]) * a;
      }
    };
    // les formes : une distance signée (négative dedans) et un cadre
    const trait = (x0, y0, x1, y1, e) => {
      const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy || 1e-9, r = e / 2;
      return { bb: [Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r],
        d: (x, y) => { const t = cl(((x - x0) * dx + (y - y0) * dy) / l2), ex = x - x0 - t * dx, ey = y - y0 - t * dy; return Math.sqrt(ex * ex + ey * ey) - r; } };
    };
    const disque = (cx, cy, r) => ({ bb: [cx - r, cy - r, cx + r, cy + r], d: (x, y) => Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) - r });
    const regulier = (cx, cy, R, n, a0) => {
      const apo = R * Math.cos(Math.PI / n), N = [];
      for (let k = 0; k < n; k++) { const a = a0 + (k + 0.5) * 2 * Math.PI / n; N.push([Math.cos(a), Math.sin(a)]); }
      return { bb: [cx - R, cy - R, cx + R, cy + R],
        d: (x, y) => { let m = -1e9; for (let k = 0; k < n; k++) { const v = (x - cx) * N[k][0] + (y - cy) * N[k][1]; if (v > m) m = v; } return m - apo; } };
    };
    // l'alphabet : hauteur de capitale 6, [chasse, tracé, tracé...], un tracé = une ligne brisée
    const arc = (cx, cy, rx, ry, a0, a1, n) => { const q = []; for (let k = 0; k <= n; k++) { const t = (a0 + (a1 - a0) * k / n) * Math.PI / 180; q.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } return q; };
    const P = [[0, 6], [0, 0], [2.2, 0]].concat(arc(2.2, 1.65, 1.6, 1.65, -90, 90, 10), [[0, 3.3]]);
    const G = {
      ' ': [2.2],
      A: [4.4, [[0, 6], [2.2, 0], [4.4, 6]], [[0.85, 3.9], [3.55, 3.9]]],
      B: [3.9, [[0, 0], [0, 6]], [[0, 0], [2.1, 0]].concat(arc(2.1, 1.45, 1.45, 1.45, -90, 90, 10), [[0, 2.9]]), [[0, 2.9], [2.3, 2.9]].concat(arc(2.3, 4.45, 1.6, 1.55, -90, 90, 10), [[0, 6]])],
      C: [4.2, arc(2.2, 3, 2.2, 3, -48, -312, 18)],
      D: [4.2, [[0, 0], [0, 6], [1.6, 6]].concat(arc(1.6, 3, 2.6, 3, 90, -90, 16), [[0, 0]])],
      E: [3.6, [[3.6, 0], [0, 0], [0, 6], [3.6, 6]], [[0, 3], [3, 3]]],
      F: [3.5, [[3.5, 0], [0, 0], [0, 6]], [[0, 3], [3, 3]]],
      G: [4.4, arc(2.2, 3, 2.2, 3, -40, -360, 20).concat([[2.6, 3]])],
      H: [4.2, [[0, 0], [0, 6]], [[4.2, 0], [4.2, 6]], [[0, 3], [4.2, 3]]],
      I: [0, [[0, 0], [0, 6]]],
      J: [3.4, [[3.4, 0], [3.4, 4.3]].concat(arc(1.7, 4.3, 1.7, 1.7, 0, 160, 10))],
      K: [4, [[0, 0], [0, 6]], [[4, 0], [0, 3.8]], [[1.5, 2.4], [4, 6]]],
      L: [3.4, [[0, 0], [0, 6], [3.4, 6]]],
      M: [4.8, [[0, 6], [0, 0], [2.4, 4], [4.8, 0], [4.8, 6]]],
      N: [4.2, [[0, 6], [0, 0], [4.2, 6], [4.2, 0]]],
      O: [4.6, arc(2.3, 3, 2.3, 3, 0, 360, 24)],
      P: [3.8, P],
      Q: [4.6, arc(2.3, 3, 2.3, 3, 0, 360, 24), [[2.9, 4.4], [4.6, 6.2]]],
      R: [3.9, P, [[2.1, 3.3], [3.9, 6]]],
      S: [4, arc(2, 1.5, 1.9, 1.5, -20, -270, 14).concat(arc(2, 4.5, 2, 1.5, -90, 160, 14))],
      T: [4.2, [[0, 0], [4.2, 0]], [[2.1, 0], [2.1, 6]]],
      U: [4.2, [[0, 0]].concat(arc(2.1, 4, 2.1, 2, 180, 0, 14), [[4.2, 0]])],
      V: [4.4, [[0, 0], [2.2, 6], [4.4, 0]]],
      W: [6, [[0, 0], [1.4, 6], [3, 1.6], [4.6, 6], [6, 0]]],
      X: [4.2, [[0, 0], [4.2, 6]], [[4.2, 0], [0, 6]]],
      Y: [4.4, [[0, 0], [2.2, 3.2], [4.4, 0]], [[2.2, 3.2], [2.2, 6]]],
      Z: [4, [[0, 0], [4, 0], [0, 6], [4, 6]]],
      0: [4, arc(2, 3, 2, 3, 0, 360, 24)],
      1: [2.2, [[0, 1.3], [1.6, 0], [1.6, 6]]],
      2: [4, arc(2, 1.9, 1.9, 1.9, -160, 15, 14).concat([[0, 6], [4, 6]])],
      3: [4, arc(2, 1.5, 1.8, 1.5, -155, 90, 14).concat(arc(2, 4.5, 2, 1.5, -90, 155, 14))],
      4: [4, [[3, 6], [3, 0], [0, 4.2], [4, 4.2]]],
      5: [4, [[3.7, 0], [0.4, 0], [0.2, 2.7]].concat(arc(2, 4.1, 1.95, 1.9, -125, 150, 16))],
      6: [4, arc(2, 4.1, 1.95, 1.9, 0, 360, 20), [[0.06, 3.9], [0.8, 1.6], [2.6, 0]]],
      7: [4, [[0, 0], [4, 0], [1.4, 6]]],
      8: [4, arc(2, 1.45, 1.65, 1.45, 0, 360, 18), arc(2, 4.35, 1.95, 1.65, 0, 360, 20)],
      9: [4, arc(2, 1.95, 1.95, 1.95, 0, 360, 20), [[3.95, 2.1], [3.3, 4.3], [1.5, 6]]],
      '-': [2.4, [[0.2, 3.4], [2.2, 3.4]]],
      '.': [0, [[0, 5.9], [0, 6]]],
      '·': [0, [[0, 3], [0, 3.1]]]
    };
    const glyphes = (s) => {
      let t = String(s).toUpperCase();
      try { t = t.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* sans normalize, un accent devient un blanc */ }
      return [...t].map((c) => G[c] || G[' ']);
    };
    const mesure = (s, cap, ep) => { const gl = glyphes(s), gap = 1.4 + ep; return gl.reduce((a, g, i) => a + g[0] + (i ? gap : 0), 0) * cap / 6; };
    // un texte en capitales : x au centre (ou à gauche), yBase la ligne de base, cap la hauteur
    // des capitales, ep l'épaisseur du trait en sixièmes de capitale
    const texte = (s, x, yBase, cap, ep, couleur, alpha, aGauche) => {
      const gl = glyphes(s), k = cap / 6, gap = 1.4 + ep, larg = mesure(s, cap, ep), formes = [];
      let x0 = aGauche ? x : x - larg / 2;
      const y0 = yBase - cap;
      gl.forEach((g) => {
        for (let t = 1; t < g.length; t++) {
          const l = g[t];
          for (let m = 1; m < l.length; m++) formes.push(trait(x0 + l[m - 1][0] * k, y0 + l[m - 1][1] * k, x0 + l[m][0] * k, y0 + l[m][1] * k, ep * k));
        }
        x0 += (g[0] + gap) * k;
      });
      couche(formes, couleur, alpha);
      return larg;
    };
    // le fond : f(x, y, c) écrit la couleur du point dans c (un seul tableau pour tous les points)
    const fond = (f) => {
      const c = [0, 0, 0];
      for (let j = 0; j < H; j++) for (let i = 0; i < L; i++) {
        f((i + 0.5) * sx, (j + 0.5) * sy, c);
        const q = (j * L + i) * 3; px[q] = c[0]; px[q + 1] = c[1]; px[q + 2] = c[2];
      }
    };
    // les lignes du bas d'abord : three.js lit la ligne 0 d'une DataTexture comme le bas de l'image
    const octets = () => {
      const out = new Uint8Array(L * H * 4);
      for (let j = 0; j < H; j++) {
        const r = H - 1 - j;
        for (let i = 0; i < L; i++) {
          const q = (j * L + i) * 3, w = (r * L + i) * 4;
          out[w] = Math.round(cl(px[q]) * 255); out[w + 1] = Math.round(cl(px[q + 1]) * 255); out[w + 2] = Math.round(cl(px[q + 2]) * 255); out[w + 3] = 255;
        }
      }
      return out;
    };
    return { L, H, ps, rgb, couche, trait, disque, regulier, texte, mesure, fond, octets };
  },

  // une image peinte devient une texture three.js (simple : sans mipmaps ni sRGB, pour un masque)
  texture3d(T, img, simple) {
    const t = new T.DataTexture(img.data, img.largeur, img.hauteur, T.RGBAFormat);
    t.magFilter = T.LinearFilter;
    if (simple) t.minFilter = T.LinearFilter;
    else { t.minFilter = T.LinearMipmapLinearFilter; t.generateMipmaps = true; if (T.SRGBColorSpace) t.colorSpace = T.SRGBColorSpace; }
    t.needsUpdate = true;
    return t;
  },

  // La face du pack (2,1 × 2,9 unités) : le dégradé de la couleur du pack, les reflets en
  // biais, le ballon LinkFoot, le nom et le nombre de tirages. Peinte une fois par pack.
  facePack(o) {
    o = o || {};
    const m = String(o.couleur || '').match(/#[0-9a-fA-F]{6}\b/g) || ['#2ECC71'];
    const cle = m.join(',') + '|' + (o.nom || '') + '|' + (o.tirages || 3);
    const cache = this.__facesPack || (this.__facesPack = {});
    if (cache[cle]) return cache[cle];
    const W = 2.1, H = 2.9, p = this.peintre(512, 512, W, H);
    const pierres = [[0, m[0]]].concat(m[1] ? [[0.3, m[1]]] : [], [[0.62, '#123A24'], [1, '#0B1210']]).map((z) => [z[0], p.rgb(z[1])]);
    const nx = 0.9206, ny = 0.3905, pas = 0.3397;   // les reflets : des bandes parallèles en biais
    p.fond((x, y, c) => {
      const t = (x * W + y * H) / (W * W + H * H);
      let k = 1; while (k < pierres.length - 1 && t > pierres[k][0]) k++;
      const a = pierres[k - 1], b = pierres[k], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      const dx = x - 1.05, dy = y - 1.19, hal = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 1.23) * 0.35;
      const s = (x + 0.41) * nx + (y - 2.9) * ny, i = Math.round(s / pas);
      const ref = i >= 0 && i <= 8 ? (0.05 + (i % 3) * 0.03) * Math.max(0, Math.min(1, 0.5 - (Math.abs(s - i * pas) - 0.037) / p.ps)) : 0;
      for (let n = 0; n < 3; n++) { const v = a[1][n] + (b[1][n] - a[1][n]) * u, w = v + (1 - v) * hal; c[n] = w + (1 - w) * ref; }
    });
    p.couche([p.disque(1.05, 1.107, 0.377)], '#F2F4F7', 1);
    const taches = [0, 1, 2, 3, 4].map((k) => { const a = -Math.PI / 2 + k * 2 * Math.PI / 5; return p.disque(1.05 + Math.cos(a) * 0.328, 1.107 + Math.sin(a) * 0.328, 0.09); });
    p.couche([p.regulier(1.05, 1.107, 0.139, 5, -Math.PI / 2)].concat(taches), '#0B1210', 1);
    p.texte('LINKFOOT', 1.05, 1.925, 0.17, 1.15, '#F2F4F7', 1);
    p.texte(o.nom || 'LinkFoot Pack', 1.05, 2.13, 0.08, 1.1, '#F2F4F7', 0.85);
    p.texte((o.tirages || 3) + ' TIRAGES', 1.05, 2.457, 0.07, 1.2, m[0], 1);
    return (cache[cle] = { data: p.octets(), largeur: 512, hauteur: 512 });
  },

  // Le texte des panneaux du stade, réparti sur toute la largeur pour que la répétition
  // le long des panneaux tombe juste.
  panneauPub() {
    if (this.__panneauPub) return this.__panneauPub;
    const p = this.peintre(1024, 64, 1024, 64), mots = ['LINKFOOT', 'MON CLUB', 'DIRECTEUR SPORTIF'];
    const vert = p.rgb('#2ECC71'), larg = mots.map((t) => p.mesure(t, 24, 1.3));
    const blanc = (1024 - larg.reduce((a, b) => a + b, 0)) / mots.length;
    p.fond((x, y, c) => { c[0] = vert[0]; c[1] = vert[1]; c[2] = vert[2]; });
    let x = blanc / 2;
    mots.forEach((t, i) => { p.texte(t, x, 44, 24, 1.3, '#0B1210', 1, true); x += larg[i] + blanc; });
    return (this.__panneauPub = { data: p.octets(), largeur: 1024, hauteur: 64 });
  }
};
