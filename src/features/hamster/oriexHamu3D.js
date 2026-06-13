/* ============================================================
 * Oriex — 3D Hamster Room engine (three.js r149)
 * ------------------------------------------------------------
 * Extracted VERBATIM from the original monolithic index.html.
 * This is hand-written, fully editable code — change it freely.
 *
 * - Assigns `window.OriexHamu3D` (consumed by the app at runtime).
 * - Requires `window.THREE`; the app prepares it through
 *   `src/services/loadThree.js` instead of an index.html sync script.
 * - Tunable params live in the `PR` (camera) and `BP` (behaviour)
 *   objects near the top of the function.
 * ============================================================ */
/* Oriex hamster room - real 3D (three.js r149). Embedded as window.OriexHamu3D */
window.OriexHamu3D = function (canvas, env) {
  var THREE = window.THREE;
  if (!THREE || !canvas) return null;
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "low-power" });
  } catch (e) { return null; }
  if (!renderer || !renderer.getContext()) return null;

  /* ---- tunable camera params ---- */
  var PR = {
    cameraMinDistance: 520,
    cameraMaxDistance: 1150,
    cameraMinPolarAngle: 0.30,   // from zenith; smaller = more top-down
    cameraMaxPolarAngle: 1.32,   // keeps camera above floor
    cameraPanLimit: 220,
    cameraPanFactor: 0.75,
    cameraZoomSpeed: 1.06,
    cameraRotateSpeed: 0.009,
    cameraBaseDist: 612,
    cameraDamping: 0.16,
    cameraTargetY: 46,
    /* --- 追加: 構図フレーミング（スマホ縦をPC表示寄りのスケール感に） ---
       基準アスペクト(refAspect=横長のPC想定)より縦長(=スマホ縦)になるほど
       カメラを引いてケージ全体が収まるようにする。横長では1.0で従来通り。 */
    framingRefAspect: 1.5,       /* この比率(w/h)を“PC表示”の基準とする */
    framingPortraitMax: 1.42,    /* narrow縦画面で最大どれだけ引くか(上限スケール) */
    framingDesktopScale: 1.0,    /* 横長時は従来の見え方を維持 */
    /* --- 追加: 3D表示修正用の調整パラメータ（既定値は従来挙動を維持） --- */
    cameraMinHeight: 14,         /* カメラ最低高さ。机/床より下に潜らせない＝床下・机下の貫通防止 */
    cameraMaxHeight: 2000,       /* カメラ最高高さ。真上へ行き過ぎ防止（実質無効＝従来通り） */
    cameraCollisionRadius: 14,   /* 衝突判定の見込み半径（将来の調整用） */
    cameraCollisionPadding: 28,  /* 障害物手前で止める余白 */
    antiAliasingLevel: 2,        /* アンチエイリアス強度の目安（DPR上限に反映。2でほぼ従来通り） */
    glassOpacity: 0.16,           /* ガラスの透明度。内部が透けすぎないよう調整 */
    uiOcclusionEnabled: true     /* ゲージ等UIの遮蔽フラグ。本シーンのゲージはHTML HUDのため常時最前面（参照用フラグ） */
  };
  var BP = {
    hamsterRadius: 22,
    hamsterMoveSpeed: 1.55,
    hamsterTurnSpeed: 0.085,
    hamsterIdleDurationMin: 1000, hamsterIdleDurationMax: 3000,
    hamsterWanderDurationMin: 2500, hamsterWanderDurationMax: 6000,
    hamsterSleepChance: 0.09,
    hamsterSleepDurationMin: 20000, hamsterSleepDurationMax: 35000,
    hamsterWheelRunChance: 0.16,
    hamsterWheelRunDurationMin: 3500, hamsterWheelRunDurationMax: 7000,
    hamsterSniffChance: 0.26,
    hamsterGroomChance: 0.1,
    hamsterShiverChance: 0.06,
    hamsterBurrowChance: 0.07,
    hamsterEatChance: 0.5,
    hamsterAvoidDistance: 8
  };

  var a = env.an, stR = env.stR, P = env.isLight !== false;
  if (a) a._spawnRoll = 1;   /* randomize hamster start once per room open (applied on first safe frame) */
  var mood0 = env.mood == null ? 60 : env.mood, sc0 = env.sc || 0.9;
  var getEdit = env.getEdit || function () { return null; };

  if (a && Math.abs(a.rot - 0.55) < 1e-6 && Math.abs(a.pit - 0.46) < 1e-6 && a.zoom === 1 && !a.panX && !a.panY) { a.rot = 0.82; a.pit = 0.53; a.th = 0.82; a.hx2 = 55; a.hz2 = 62; }
  /* AA: DPR上限。antiAliasingLevel>=2で従来通り(2)、軽量化したい場合は1.5に。モバイル負荷を抑えつつ輪郭を滑らかに保つ */
  var DPR = Math.min(PR.antiAliasingLevel >= 2 ? 2 : 1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(DPR);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(P ? 0xf2e6d2 : 0x221d17);
  scene.fog = new THREE.Fog(P ? 0xf2e6d2 : 0x221d17, 1400, 2600);

  var camera = new THREE.PerspectiveCamera(42, 1, 10, 4000);

  /* ---- lights (bright, soft natural light; tuned to avoid blowout) ---- */
  scene.add(new THREE.AmbientLight(0xffffff, P ? 0.585 : 0.37));
  var hemi = new THREE.HemisphereLight(0xfff7ea, 0xd8c2a0, P ? 0.35 : 0.22); scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff3e2, P ? 0.62 : 0.52);
  sun.position.set(380, 620, 260);
  sun.castShadow = true;
  /* 影解像度: PC(細かいポインタ)は2048で輪郭をくっきり、モバイル(coarse)は1024で軽量に保つ＝ジャギー軽減と負荷両立 */
  var _shMap = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 1024 : 2048;
  sun.shadow.mapSize.set(_shMap, _shMap);
  sun.shadow.camera.left = -560; sun.shadow.camera.right = 560;
  sun.shadow.camera.top = 460; sun.shadow.camera.bottom = -460;
  sun.shadow.camera.near = 100; sun.shadow.camera.far = 1600;
  sun.shadow.bias = -0.0008;
  sun.shadow.radius = 3;
  scene.add(sun);
  var fill = new THREE.DirectionalLight(0xeaf4ff, 0.22); fill.position.set(-320, 260, -180); scene.add(fill);

  /* ---- helpers ---- */
  var GEO = [], MAT = [];
  function gk(g) { GEO.push(g); return g; }
  function mk(c, o) {
    var m = new THREE.MeshLambertMaterial(Object.assign({ color: c }, o || {}));
    MAT.push(m); return m;
  }
  function box(w, h, d, c, o) { return new THREE.Mesh(gk(new THREE.BoxGeometry(w, h, d)), mk(c, o)); }
  function cyl(rt, rb, h, c, seg, o) { return new THREE.Mesh(gk(new THREE.CylinderGeometry(rt, rb, h, seg || 12)), mk(c, o)); }
  function sph(r, c, w, hseg, o) { return new THREE.Mesh(gk(new THREE.SphereGeometry(r, w || 26, hseg || 18)), mk(c, o)); }
  function sh(m, cast, recv) { m.castShadow = cast !== false; m.receiveShadow = recv !== false; return m; }

  /* ---- world constants (same units as old sim) ---- */
  var FLW = 462, FLD = 296.8, GW = 11, GH = 7;
  function cellX(g) { return -FLW / 2 + 21 + g * 42; }
  /* furniture half-extents [x,z] incl. roof/stand overhang; rot swaps axes */
  var EXT9 = { bed: [50, 36], wheel: [46, 36], tunnel: [25, 24], loft: [46, 26], bowl: [19, 19] };
  function placeXZ(id, L) {
    var ex = (EXT9[id] || [20, 20])[0], ez = (EXT9[id] || [20, 20])[1];
    if ((L.rot || 0) % 2) { var t9 = ex; ex = ez; ez = t9; }
    var x = cl9(cellX(L.gx), -FLW / 2 + ex + 6, FLW / 2 - ex - 6);
    var z = cl9(cellZ(L.gz), -FLD / 2 + ez + 6, FLD / 2 - ez - 6);
    return [x, z];
  }
  function cellZ(g) { return -FLD / 2 + 21.2 + g * 42.4; }
  var DEFL = { bowl: { gx: 1, gz: 5, rot: 0 }, tunnel: { gx: 7, gz: 4, rot: 0 }, loft: { gx: 3, gz: 4, rot: 0 }, bed: { gx: 4, gz: 0, rot: 0 }, wheel: { gx: 8, gz: 1, rot: 0 } };

  /* ---- room ---- */
  var room = new THREE.Group(); scene.add(room);
  var floorMat = mk(P ? 0xA98D67 : 0x4a4136);
  var floor = new THREE.Mesh(gk(new THREE.PlaneGeometry(2600, 2200)), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -150;
  floor.receiveShadow = true; room.add(floor);

  /* desk */
  var desk = new THREE.Group(); room.add(desk);
  var woodTex = null;
  try {
    var wc = document.createElement("canvas"); wc.width = 256; wc.height = 256;
    var wg2 = wc.getContext("2d");
    wg2.fillStyle = P ? "#A87D4D" : "#5d4a33"; wg2.fillRect(0, 0, 256, 256);
    function wseed(n) { return ((n * 9301 + 49297) % 233280) / 233280; }
    for (var wi9 = 0; wi9 < 46; wi9++) {
      var yy = wseed(wi9 * 7 + 3) * 256, ww = 0.8 + wseed(wi9 * 13 + 5) * 2.2, al = 0.05 + wseed(wi9 * 29 + 1) * 0.10;
      wg2.strokeStyle = (wseed(wi9 * 17) > 0.5) ? "rgba(255,238,205," + al + ")" : "rgba(74,52,30," + al + ")";
      wg2.lineWidth = ww; wg2.beginPath();
      wg2.moveTo(0, yy);
      wg2.bezierCurveTo(64, yy + (wseed(wi9 * 23) - 0.5) * 14, 192, yy + (wseed(wi9 * 31) - 0.5) * 14, 256, yy);
      wg2.stroke();
    }
    woodTex = new THREE.CanvasTexture(wc);
    woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(2.6, 1.8);
  } catch (e) { woodTex = null; }
  var topMat = woodTex ? new THREE.MeshLambertMaterial({ map: woodTex, color: 0xffffff }) : mk(P ? 0xA87D4D : 0x5d4a33);
  if (woodTex) MAT.push(topMat);
  var top = sh(new THREE.Mesh(gk(new THREE.BoxGeometry(FLW + 270, 18, FLD + 200)), topMat)); top.position.y = -21; desk.add(top);
  var rim = sh(box(FLW + 286, 6, FLD + 216, P ? 0x96703F : 0x4d3d2a), false); rim.position.y = -31; desk.add(rim);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
    var leg = sh(box(20, 120, 20, P ? 0x8a6540 : 0x473827));
    leg.position.set(s[0] * (FLW / 2 + 105), -90, s[1] * (FLD / 2 + 70)); desk.add(leg);
  });

  /* exterior props on desk */
  function plant(big) {
    var g = new THREE.Group();
    var pot = sh(cyl(big ? 17 : 13, big ? 13 : 10, big ? 22 : 16, P ? 0xC2643F : 0x7a4630, 16)); pot.position.y = (big ? 11 : 8); g.add(pot);
    var soil = sh(cyl(big ? 14 : 10, big ? 14 : 10, 3, 0x5a4630, 16), false); soil.position.y = (big ? 22 : 16); g.add(soil);
    var tr = sh(cyl(3, 3.6, big ? 34 : 24, 0x7A5230, 8)); tr.position.y = (big ? 38 : 28); g.add(tr);
    var f1 = sh(new THREE.Mesh(gk(new THREE.IcosahedronGeometry(big ? 26 : 18, 1)), mk(0x69A96E))); f1.position.y = big ? 62 : 46; g.add(f1);
    var f2 = sh(new THREE.Mesh(gk(new THREE.IcosahedronGeometry(big ? 17 : 12, 1)), mk(0x7BB981))); f2.position.y = big ? 84 : 62; g.add(f2);
    return g;
  }
  var p1 = plant(true); p1.position.set(-(FLW / 2 + 96), -12, -36); room.add(p1);
  var p2 = plant(false); p2.position.set(FLW / 2 + 100, -12, FLD / 2 + 34); room.add(p2);
  var bks = new THREE.Group();
  [[0xBC6A64, 0.16, 0], [0x6B82B4, -0.12, 12], [0xD3A75F, 0.27, 23]].forEach(function (b, i) {
    var bb = sh(box(46 - i * 4, 11, 32 - i * 2, b[0])); bb.position.y = b[2] - 6; bb.rotation.y = b[1]; bks.add(bb);
  });
  bks.position.set(FLW / 2 + 96, 0, -(FLD / 2 + 28)); room.add(bks);
  var mug = new THREE.Group();
  var mg = sh(cyl(10, 9, 22, P ? 0xE8E2D8 : 0x8d8779, 22)); mg.position.y = 11 - 12; mug.add(mg);
  var cof = sh(cyl(8, 8, 2, 0x6b4a2f, 22), false); cof.position.y = 21 - 12; mug.add(cof);
  var hd = new THREE.Mesh(gk(new THREE.TorusGeometry(6, 2, 8, 18)), mk(P ? 0xE8E2D8 : 0x8d8779));
  hd.position.set(11, -1, 0); mug.add(sh(hd));
  mug.position.set(-(FLW / 2 + 86), 0, FLD / 2 + 42); room.add(mug);
  /* small leaning picture frame */
  var pframe = new THREE.Group();
  var ffr = sh(box(30, 38, 3.5, P ? 0x8A6A46 : 0x4d3d2a)); ffr.position.y = 19; pframe.add(ffr);
  var fim = sh(box(23, 30, 1.6, P ? 0xF4E6CC : 0x7a715f), false); fim.position.set(0, 19, 2.3); pframe.add(fim);
  var fdot = sh(sph(5.5, P ? 0xE0975A : 0x8d7148, 8, 6), false); fdot.scale.set(1, 1, 0.25); fdot.position.set(0, 21, 3.2); pframe.add(fdot);
  pframe.rotation.set(-0.12, -0.5, 0); pframe.position.set(FLW / 2 + 132, -12, -(FLD / 2 - 36)); room.add(pframe);

  /* ---- cage ---- */
  var cage = new THREE.Group(); scene.add(cage);
  var bedFloor = sh(box(FLW + 16, 12, FLD + 16, P ? 0xE9D2A0 : 0x6f604a), false, true);
  bedFloor.position.y = -6; cage.add(bedFloor);
  /* bedding: instanced wood chips (cheap: 1 draw call per shape).
     Denser + 6 light-beige tones + random size/rotation/tilt; kept LOW (y<=1.7,
     flat scale) so the hamster body and props never get buried. */
  (function () {
    var tones = P ? [0xF9ECC8, 0xF1DCAC, 0xE5C98E, 0xD9B677, 0xC9A062, 0xB88F54]
                  : [0x8b7c62, 0x83745b, 0x77684f, 0x6d5f49, 0x655842, 0x5d5040];
    function seed(n) { return ((n * 9301 + 49297) % 233280) / 233280; }
    var Eu = new THREE.Euler();
    function fill(geo, count, off, sMin, sMax, flat, tilt) {
      var im = new THREE.InstancedMesh(gk(geo), new THREE.MeshLambertMaterial({ color: 0xffffff }), count);
      MAT.push(im.material);
      im.receiveShadow = true;
      var M = new THREE.Matrix4(), Pq = new THREE.Quaternion(), Vp = new THREE.Vector3(), Vs = new THREE.Vector3();
      var col = new THREE.Color();
      for (var i = 0; i < count; i++) {
        var r1x = seed(i * 7 + off), r2 = seed(i * 13 + off + 5), r3 = seed(i * 29 + off + 11), r4 = seed(i * 17 + off + 3), r5 = seed(i * 23 + off + 7);
        Vp.set((r1x - 0.5) * (FLW - 44), 0.55 + r4 * 1.0, (r2 - 0.5) * (FLD - 40));
        Eu.set((r5 - 0.5) * (tilt || 0), r3 * Math.PI * 2, (r4 - 0.5) * (tilt || 0));
        Pq.setFromEuler(Eu);
        var s9 = sMin + r4 * (sMax - sMin);
        Vs.set(s9, flat ? s9 * 0.26 : s9 * 0.4, s9 * (0.6 + r3 * 0.5));
        M.compose(Vp, Pq, Vs);
        im.setMatrixAt(i, M);
        im.setColorAt(i, col.setHex(tones[Math.floor(r5 * 6) % 6]));
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      cage.add(im);
    }
    var BQ = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ? 0.78 : 1; /* mobile keeps it light */
    function bq(n) { return Math.round(n * BQ); }
    fill(new THREE.SphereGeometry(4, 7, 6), bq(400), 1, 0.8, 1.8, true, 0);          /* rounded flakes */
    fill(new THREE.BoxGeometry(7, 1.8, 3), bq(430), 99, 0.75, 1.7, false, 0.3);      /* short slivers */
    fill(new THREE.BoxGeometry(12, 1.4, 2.4), bq(280), 53, 0.75, 1.5, false, 0.24);  /* long shaved strips */
    fill(new THREE.BoxGeometry(4.5, 1.6, 4.5), bq(180), 17, 0.7, 1.4, false, 0.4);   /* small square bits */
    fill(new THREE.TorusGeometry(3.4, 1.0, 5, 9, 4.2), bq(160), 31, 0.6, 1.1, false, 0.5); /* curled shavings */
    fill(new THREE.TorusGeometry(2.4, 0.7, 5, 8, 3.4), bq(120), 71, 0.55, 1.0, false, 0.55); /* fine curls */
  })();
  var FRC = P ? 0x7C766B : 0x625d54;   /* slightly lighter, less bulky frame */
  var WALL_H = 150, WALL_Y = WALL_H / 2;
  /* frame: corner posts + top/bottom rims */
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
    var p = sh(box(7.5, WALL_H + 14, 7.5, FRC));
    p.position.set(s[0] * FLW / 2, WALL_Y, s[1] * FLD / 2); cage.add(p);
  });
  [-1, 1].forEach(function (s) {
    var t1 = sh(box(FLW + 12, 7, 8, FRC)); t1.position.set(0, WALL_H + 4, s * FLD / 2); cage.add(t1);
    var b1 = sh(box(FLW + 12, 8, 8, FRC), false); b1.position.set(0, 2, s * FLD / 2); cage.add(b1);
    var t2 = sh(box(8, 7, FLD + 12, FRC)); t2.position.set(s * FLW / 2, WALL_H + 4, 0); cage.add(t2);
    var b2 = sh(box(8, 8, FLD + 12, FRC), false); b2.position.set(s * FLW / 2, 2, 0); cage.add(b2);
  });
  /* glass: 深度テスト付き透明。depthWrite:false は内部オブジェクトの並び順を正しく保つため維持。透明度は調整値化 */
  var glassMat = new THREE.MeshPhongMaterial({
    color: P ? 0xbfe0f0 : 0x9cc4da, transparent: true, opacity: PR.glassOpacity,
    depthWrite: false, side: THREE.DoubleSide, shininess: 170, specular: 0xd6f0fa
  }); MAT.push(glassMat);
  function glass(w, h) { var m = new THREE.Mesh(gk(new THREE.PlaneGeometry(w, h)), glassMat); m.renderOrder = 5; return m; }
  var gN = glass(FLW, WALL_H); gN.position.set(0, WALL_Y, -FLD / 2); cage.add(gN);
  var gS = glass(FLW, WALL_H); gS.position.set(0, WALL_Y, FLD / 2); cage.add(gS);
  var gW = glass(FLD, WALL_H); gW.rotation.y = Math.PI / 2; gW.position.set(-FLW / 2, WALL_Y, 0); cage.add(gW);
  var gE = glass(FLD, WALL_H); gE.rotation.y = Math.PI / 2; gE.position.set(FLW / 2, WALL_Y, 0); cage.add(gE);
  /* subtle top highlight strips on glass */
  var hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }); MAT.push(hlMat);
  function gstrip(w) { var m = new THREE.Mesh(gk(new THREE.PlaneGeometry(w, 5)), hlMat); m.renderOrder = 6; return m; }
  var h1 = gstrip(FLW - 26); h1.position.set(0, WALL_H - 17, -FLD / 2 + 0.6); cage.add(h1);
  var h2 = gstrip(FLD - 26); h2.rotation.y = Math.PI / 2; h2.position.set(FLW / 2 - 0.6, WALL_H - 17, 0); cage.add(h2);
  var h3 = gstrip(FLW - 26); h3.position.set(0, WALL_H - 34, FLD / 2 - 0.6); h3.material = hlMat; cage.add(h3);
  var h4 = gstrip(FLD - 26); h4.rotation.y = Math.PI / 2; h4.position.set(-FLW / 2 + 0.6, WALL_H - 30, 0); cage.add(h4);

  /* water bottle: blue translucent body + inner water level + cap + wall-mount
     bands against the glass + angled metal spout (left of north glass) */
  var bot = new THREE.Group();
  var bwMat = new THREE.MeshLambertMaterial({ color: P ? 0xB4DCF2 : 0x6f9cba, transparent: true, opacity: 0.4 }); MAT.push(bwMat);
  var bw = new THREE.Mesh(gk(new THREE.CylinderGeometry(9, 9, 38, 22)), bwMat); bw.castShadow = true; bw.position.y = 66; bot.add(bw);
  var wlMat = new THREE.MeshLambertMaterial({ color: P ? 0x63AEE2 : 0x4f86ad, transparent: true, opacity: 0.6 }); MAT.push(wlMat);
  var wl = new THREE.Mesh(gk(new THREE.CylinderGeometry(7.6, 7.6, 24, 18)), wlMat); wl.position.y = 59; bot.add(wl);
  var cap = sh(cyl(9.6, 9.6, 7, P ? 0x5E9BD8 : 0x4a7aa8, 18), false); cap.position.y = 88; bot.add(cap);
  var shMat9 = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false }); MAT.push(shMat9);
  var sheen = new THREE.Mesh(gk(new THREE.PlaneGeometry(2.6, 28)), shMat9); sheen.position.set(5.6, 66, 7.2); sheen.rotation.y = 0.55; bot.add(sheen);
  /* wall mount: two slim bands + back plate hugging the glass */
  var MTC = P ? 0x5E9BD8 : 0x4a7aa8;
  var band1 = sh(box(21, 4, 4.5, MTC), false); band1.position.set(0, 78, -6); bot.add(band1);
  var band2 = sh(box(21, 4, 4.5, MTC), false); band2.position.set(0, 56, -6); bot.add(band2);
  var bplate = sh(box(7, 40, 2.4, MTC), false); bplate.position.set(0, 67, -9.2); bot.add(bplate);
  var bn = sh(cyl(2.6, 2.6, 24, P ? 0xD2D6DB : 0x8d949c, 14)); bn.rotation.x = 2.45;
  bn.position.set(0, 39, 8); bot.add(bn);
  var tip = sh(sph(3, P ? 0xBFC4CB : 0x7d848c, 12, 9), false); tip.position.set(0, 29.5, 15.5); bot.add(tip);
  bot.position.set(-150, 0, -FLD / 2 + 13); cage.add(bot);

  /* ---- furniture (rebuilt on layout change) ---- */
  var props = new THREE.Group(); cage.add(props);
  var wheelSpin = null, editRing = null, lastSig = "";
  function buildProps(s0, LAY) {
    while (props.children.length) {
      props.remove(props.children[0]);
    }
    wheelSpin = null;
    function place(g, id) {
      var L = LAY[id], pxz = placeXZ(id, L);
      g.position.set(pxz[0], 0, pxz[1]);
      g.rotation.y = -(L.rot || 0) * Math.PI / 2; props.add(g); return g;
    }
    /* house: wooden cabin, gable red roof, round front door */
    if (s0.own && s0.own.bed) {
      var hg = new THREE.Group();
      var WOODH = P ? 0xC79B62 : 0x8a6a46, WOODD = P ? 0xA87844 : 0x74573a;
      var body = sh(box(86, 44, 64, WOODH)); body.position.y = 22; hg.add(body);
      /* plank lines (thin darker strips, evenly spaced) */
      for (var pl = 0; pl < 3; pl++) {
        var strip = sh(box(86.8, 2.1, 64.8, WOODD), false, false);
        strip.position.y = 11 + pl * 11; hg.add(strip);
      }
      /* corner posts for a board-built look */
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (cs) {
        var post = sh(box(4, 45, 4, WOODD), false, false);
        post.position.set(cs[0] * 42.5, 22, cs[1] * 31.5); hg.add(post);
      });
      /* gable roof: single triangular prism (apex up, ridge along x) */
      var ROOFC = P ? 0xD0685C : 0x80403c;
      var roofGeo = new THREE.CylinderGeometry(20, 20, 96, 3, 1);
      roofGeo.rotateZ(Math.PI / 2); roofGeo.rotateX(-Math.PI / 2);
      var roof = sh(new THREE.Mesh(gk(roofGeo), mk(ROOFC)));
      roof.scale.z = 1.9; roof.position.y = 53; hg.add(roof);
      var ridge = sh(box(98, 3.2, 7, P ? 0xB8584E : 0x6e3733), false, false); ridge.position.y = 72.5; hg.add(ridge);
      var eaveF = sh(box(98, 2.6, 4, WOODD), false, false); eaveF.position.set(0, 43.5, 34.5); hg.add(eaveF);
      var eaveB = eaveF.clone(); eaveB.position.z = -34.5; hg.add(eaveB);
      /* round front door: soft dark opening + wooden frame ring */
      var door = sh(cyl(14, 14, 4, P ? 0x4a3522 : 0x3a2c18, 22), false); door.rotation.x = Math.PI / 2;
      door.position.set(0, 15, 32.5); hg.add(door);
      var dring = sh(new THREE.Mesh(gk(new THREE.TorusGeometry(14.4, 1.8, 8, 26)), mk(WOODD)), false, false);
      var dcore = sh(cyl(10.5, 10.5, 1.6, P ? 0x35261a : 0x2a2012, 18), false, false); dcore.rotation.x = Math.PI / 2; dcore.position.set(0, 15, 33.6); hg.add(dcore);
      dring.position.set(0, 15, 34.4); hg.add(dring);
      /* small round side window */
      var win = sh(cyl(5, 5, 2.4, P ? 0x5a4326 : 0x3a2c18, 16), false, false);
      win.rotation.z = Math.PI / 2; win.position.set(43.2, 30, -12); hg.add(win);
      place(hg, "bed");
    }
    /* wheel: wheelRoot = wheelSpinGroup(rims+track+spokes+hub) + wheelStandGroup(axle+legs+base).
       Stand supports from BEHIND (local -z); opening faces local +z so the inside stays clear. */
    if (s0.own && s0.own.wheel) {
      var wg = new THREE.Group();                 /* wheelRoot */
      var spinner = new THREE.Group();            /* wheelSpinGroup: only this rotates */
      var ORN = P ? 0xD6964F : 0xa07a42;
      var WD = 20;                                /* wheelDepth: light, not a drum */
      var rimF = sh(new THREE.Mesh(gk(new THREE.TorusGeometry(40, 3.6, 14, 48)), mk(ORN)));
      rimF.position.z = WD / 2; spinner.add(rimF);
      var rimB = sh(new THREE.Mesh(gk(new THREE.TorusGeometry(40, 3.6, 14, 48)), mk(ORN)));
      rimB.position.z = -WD / 2; spinner.add(rimB);
      var surf = sh(new THREE.Mesh(gk(new THREE.CylinderGeometry(37.5, 37.5, WD, 48, 1, true)), mk(P ? 0xF2DFC0 : 0x8f7d62, { side: THREE.DoubleSide })));
      surf.rotation.x = Math.PI / 2; spinner.add(surf);
      for (var ti9 = 0; ti9 < 16; ti9++) {
        var slat = sh(box(3.2, 2.0, WD - 3, P ? 0xD9BC8C : 0x7a6a50), false);
        var aa = ti9 * Math.PI / 8;
        slat.position.set(Math.cos(aa) * 35.3, Math.sin(aa) * 35.3, 0);
        slat.rotation.z = aa + Math.PI / 2; spinner.add(slat);
      }
      for (var si = 0; si < 6; si++) {
        var spoke = sh(cyl(1.55, 1.55, 72, P ? 0xEBD8B4 : 0x6e5436, 10), false);
        spoke.rotation.z = si * Math.PI / 6; spoke.position.z = -WD / 2; spinner.add(spoke);
      }
      var hub = sh(cyl(5.8, 5.8, 7.5, P ? 0xE3B85E : 0x7a6648, 18), false);
      hub.rotation.x = Math.PI / 2; hub.position.z = -WD / 2; spinner.add(hub);
      var hubCap = sh(sph(3.0, P ? 0xD2A648 : 0x6e5a3e, 12, 9), false);
      hubCap.position.z = -WD / 2 + 4.2; spinner.add(hubCap);
      spinner.position.set(0, 50, 0); wg.add(spinner);
      var stand = new THREE.Group();              /* wheelStandGroup: never rotates */
      var STD = P ? 0xD9C7A4 : 0x6f6757;
      var axle = sh(cyl(2.6, 2.6, 14, P ? 0xB3A78E : 0x6b4a2f, 12), false);
      axle.rotation.x = Math.PI / 2; axle.position.set(0, 50, -WD / 2 - 7); stand.add(axle);
      var legA = sh(box(5.5, 56, 5.5, STD)); legA.rotation.x = 0.22; legA.position.set(-12, 26, -WD / 2 - 13); stand.add(legA);
      var legB = sh(box(5.5, 56, 5.5, STD)); legB.rotation.x = 0.22; legB.position.set(12, 26, -WD / 2 - 13); stand.add(legB);
      var brace = sh(box(28, 4.5, 5, STD), false); brace.position.set(0, 48, -WD / 2 - 10); stand.add(brace);
      var base = sh(box(48, 6, 22, STD), false); base.position.set(0, 3, -WD / 2 - 17); stand.add(base);
      wg.add(stand);
      wheelSpin = spinner;
      place(wg, "wheel");
    }
    /* tunnel: pastel green arch (half tube) with shaded inner shell */
    (function () {
      var tg = new THREE.Group();
      var GRN = P ? 0xA9D6BB : 0x5f86a3;
      var archGeo = new THREE.CylinderGeometry(21, 21, 44, 30, 1, true, 0, Math.PI);
      archGeo.rotateX(Math.PI / 2); archGeo.rotateZ(Math.PI / 2);
      var arch = sh(new THREE.Mesh(gk(archGeo), mk(GRN, { side: THREE.DoubleSide })));
      arch.position.y = 0; tg.add(arch);
      var inGeo = new THREE.CylinderGeometry(19.8, 19.8, 43, 30, 1, true, 0, Math.PI);
      inGeo.rotateX(Math.PI / 2); inGeo.rotateZ(Math.PI / 2);
      var inner = new THREE.Mesh(gk(inGeo), mk(P ? 0x7FB196 : 0x4a6e85, { side: THREE.DoubleSide }));
      inner.castShadow = false; inner.receiveShadow = true; tg.add(inner);
      var rimA = sh(new THREE.Mesh(gk(new THREE.TorusGeometry(21, 2.0, 8, 26, Math.PI)), mk(P ? 0x8FC2A4 : 0x537a92)), false);
      rimA.position.set(0, 0, 22); tg.add(rimA);
      var rimB = rimA.clone(); rimB.position.z = -22; tg.add(rimB);
      place(tg, "tunnel");
    })();
    /* loft slot -> wooden log pile (hamster-scale; replaces desk-like loft) */
    (function () {
      var lg = new THREE.Group();
      var LOG = P ? 0xC79B62 : 0x8d7148, LOG2 = P ? 0xB0824C : 0x7a5c3c, LOG3 = P ? 0xBD8F58 : 0x836844;
      function log9(x, y, z, r, len, c) {
        var m = sh(cyl(r, r, len, c, 16)); m.rotation.z = Math.PI / 2;
        m.position.set(x, y, z); lg.add(m);
        [1, -1].forEach(function (sd) {
          var e2 = sh(cyl(r * 0.8, r * 0.8, 0.9, P ? 0xD6B886 : 0x8f7a58, 16), false, false);
          e2.rotation.z = Math.PI / 2; e2.position.set(x + sd * (len / 2 + 0.1), y, z); lg.add(e2);
          var e1 = sh(cyl(r * 0.56, r * 0.56, 1.5, P ? 0xEBD6B0 : 0xa08b66, 14), false, false);
          e1.rotation.z = Math.PI / 2; e1.position.set(x + sd * (len / 2 + 0.4), y, z); lg.add(e1);
          var e0 = sh(cyl(r * 0.26, r * 0.26, 1.9, P ? 0xC9A578 : 0x8a7350, 10), false, false);
          e0.rotation.z = Math.PI / 2; e0.position.set(x + sd * (len / 2 + 0.6), y, z); lg.add(e0);
        });
      }
      log9(0, 7, -12, 7.2, 86, LOG);
      log9(0, 7, 2, 6.8, 86, LOG2);
      log9(0, 7, 16, 7.1, 86, LOG3);
      log9(0, 19, -5, 6.9, 78, LOG2);
      log9(0, 19, 9, 7.2, 78, LOG);
      place(lg, "loft");
    })();
    /* bowl */
    (function () {
      var bg = new THREE.Group();
      var b1 = sh(cyl(17, 14, 9, P ? 0x8AC4B8 : 0x5d8c84, 28)); b1.position.y = 4.5; bg.add(b1);
      var blip = sh(cyl(17.3, 17.3, 1.8, P ? 0x79B5A9 : 0x52817a, 28), false, false); blip.position.y = 9; bg.add(blip);
      var b2 = sh(cyl(13, 13, 3, P ? 0xC9963F : 0x8a6a2e, 28), false); b2.position.y = 8.5; bg.add(b2);
      var PELC = [0xA8631F, 0x90551E, 0xBF7A33, 0xB06A28];
      for (var fi = 0; fi < 9; fi++) {
        var pr9 = 3.1 + ((fi * 37) % 5) * 0.28;
        var pel = sh(sph(pr9, PELC[fi % 4], 10, 8), false);
        pel.scale.set(1, 0.82 + ((fi * 13) % 4) * 0.07, 1.06);
        pel.position.set(((fi % 3) - 1) * 5.4 + ((fi * 29) % 3 - 1) * 1.1, 10.3 + (fi > 4 ? 3.1 : 0), ((fi % 2) * 5 - 2.5) + ((fi * 17) % 3 - 1) * 1.0);
        pel.rotation.y = fi * 0.9; bg.add(pel);
      }
      for (var si9 = 0; si9 < 3; si9++) {
        var sd9 = sh(sph(1.9, 0x7d5a33, 6, 5), false); sd9.scale.set(1, 0.6, 1.5);
        sd9.position.set(si9 * 4 - 4, 10.6, si9 * 3 - 4 + 2); sd9.rotation.y = si9 * 1.3; bg.add(sd9);
      }
      place(bg, "bowl");
    })();
    /* toy ball (fixed) */
    var ball = new THREE.Group();
    var bl = sh(sph(11, P ? 0xE48E8B : 0x9c5f5d)); bl.position.y = 11; ball.add(bl);
    var bw2 = sh(sph(5.5, 0xFFF6EA, 10, 8), false); bw2.position.set(0, 18, 4); ball.add(bw2);
    var bw3 = sh(sph(4, 0xFFF6EA, 8, 6), false); bw3.position.set(7, 6, -5); ball.add(bw3);
    ball.position.set(cellX(5), 0, cellZ(6 - 1)); props.add(ball);
    /* poops */
    var n = s0.poops || 0;
    var pp = [[-170, 118], [196, -16], [-18, 128]];
    for (var pi = 0; pi < n; pi++) {
      var po = sh(sph(4.5, 0x7d5436, 8, 6), false);
      po.position.set((pp[pi] || [0, 0])[0], 4, (pp[pi] || [0, 0])[1]); props.add(po);
    }
    /* edit highlight ring */
    editRing = new THREE.Mesh(gk(new THREE.TorusGeometry(26, 3, 8, 24)), mk(0xFFA53C, { transparent: true, opacity: 0.9 }));
    editRing.rotation.x = -Math.PI / 2; editRing.position.y = 2; editRing.visible = false; props.add(editRing);
  }

  /* ---- hamster ---- */
  var ham = new THREE.Group(); cage.add(ham);
  var BO = 0xDC7F22, BO2 = 0xCD751E, CR = 0xFFFEF8, PK = 0xF08A7E, EA = 0xB06A26;
  var S3 = sc0 * 1.38;
  function hp(x, y, z, r, c, wseg, hseg) { var m = sh(sph(r, c, wseg, hseg)); m.position.set(x, y, z); ham.add(m); return m; }
  /* squat, wide body (rump slightly darker for depth; keeps it from melting into bedding) */
  var body = hp(-3, 14, 0, 17, BO); body.scale.set(1.38, 0.93, 1.2);
  var rump = hp(-16, 13.5, 0, 13.5, BO2); rump.scale.set(1, 0.95, 1.08);
  /* clean cream belly */
  var belly = hp(3.5, 8.8, 0, 12, CR, 22, 16); belly.scale.set(1.38, 0.84, 1.12); belly.castShadow = false;
  var blend = hp(2.6, 10.6, 0, 12.6, 0xEFB36B, 20, 14); blend.scale.set(1.36, 0.78, 1.13); blend.castShadow = false;
  /* head: bigger, more frontal */
  var head = hp(15, 20, 0, 12.5, BO); head.scale.set(1.05, 0.98, 1.0);
  var cheekL = hp(20.2, 15.1, -7.9, 5.8, CR, 18, 14); cheekL.scale.set(1.02, 0.94, 1.0); cheekL.castShadow = false;
  var cheekR = hp(20.2, 15.1, 7.9, 5.8, CR, 18, 14); cheekR.scale.set(1.02, 0.94, 1.0); cheekR.castShadow = false;
  var muzzle = hp(24.5, 16.4, 0, 7.8, CR, 22, 16); muzzle.scale.set(1.02, 0.92, 1.08); muzzle.castShadow = false;
  var nose = hp(31.6, 17.8, 0, 2.7, PK, 12, 10); nose.castShadow = false;
  var mouth = hp(30.4, 15.4, 0, 1.15, 0xC97B5E, 8, 6); mouth.scale.set(0.8, 1.1, 1.25); mouth.castShadow = false;
  /* small round ears on top, soft pink inner */
  var earL = hp(9.5, 31.4, -6.6, 4.6, EA, 16, 12); earL.scale.set(1, 1, 0.62);
  var earR = hp(9.5, 31.4, 6.6, 4.6, EA, 16, 12); earR.scale.set(1, 1, 0.62);
  var einL = hp(10.4, 31.5, -6.8, 2.6, 0xF8CFA8, 12, 9); einL.scale.copy(earL.scale); einL.castShadow = false;
  var einR = hp(10.4, 31.5, 6.8, 2.6, 0xF8CFA8, 12, 9); einR.scale.copy(earR.scale); einR.castShadow = false;
  /* bigger, clearer eyes + main and tiny secondary highlights */
  var eyeL = hp(23.7, 22.9, -5.9, 4.05, 0x201710, 16, 12); eyeL.castShadow = false;
  var eyeR = hp(23.7, 22.9, 5.9, 4.05, 0x201710, 16, 12); eyeR.castShadow = false;
  var glL = hp(25.8, 24.8, -6.8, 2.3, 0xffffff, 10, 8); glL.castShadow = false;
  var glR = hp(25.8, 24.8, 6.8, 2.3, 0xffffff, 10, 8); glR.castShadow = false;
  var gl2L = hp(24.8, 21.4, -5.0, 1.0, 0xffffff, 5, 4); gl2L.castShadow = false;
  var gl2R = hp(24.8, 21.4, 5.0, 1.0, 0xffffff, 5, 4); gl2R.castShadow = false;
  /* short small limbs, a touch warmer so paws read against the bedding */
  var FT = 0xF7E9D4;
  var fFL = hp(10, 2.8, -6.6, 3.3, FT, 12, 9), fFR = hp(10, 2.8, 6.6, 3.3, FT, 12, 9);
  var toeL = hp(13.3, 2.4, -6.6, 1.7, 0xFFF3DF, 8, 6); toeL.castShadow = false;
  var toeR = hp(13.3, 2.4, 6.6, 1.7, 0xFFF3DF, 8, 6); toeR.castShadow = false;
  var fBL = hp(-14, 2.8, -7.4, 3.7, FT, 12, 9), fBR = hp(-14, 2.8, 7.4, 3.7, FT, 12, 9);
  /* subtle tail */
  var tail = hp(-27, 12, 0, 2.0, 0xF3B2AC, 8, 6); tail.castShadow = false;
  ham.scale.setScalar(S3);
  /* crumb (eating) */
  var crumbMat = mk(0xC9893F); var crumb = sh(sph(3.2, 0xC9893F, 8, 6), false); crumb.material = crumbMat;
  crumb.visible = false; cage.add(crumb); MAT.push(crumbMat);
  /* hearts */
  var heartG = (function () {
    var s = new THREE.Shape();
    s.moveTo(0, 4); s.bezierCurveTo(0, 7, -6, 9, -6, 3.5); s.bezierCurveTo(-6, 0, -2, -1.5, 0, -5);
    s.bezierCurveTo(2, -1.5, 6, 0, 6, 3.5); s.bezierCurveTo(6, 9, 0, 7, 0, 4);
    return gk(new THREE.ExtrudeGeometry(s, { depth: 2, bevelEnabled: false }));
  })();
  var hearts = [];
  for (var hi = 0; hi < 4; hi++) {
    var hm = new THREE.Mesh(heartG, mk(0xF26D8F, { transparent: true, opacity: 0.95 }));
    hm.visible = false; hm.scale.setScalar(2.0); scene.add(hm); hearts.push({ m: hm, t0: 0 });
  }
  var zzz = [];
  for (var zi = 0; zi < 3; zi++) {
    var zm = new THREE.Mesh(gk(new THREE.SphereGeometry(3.2 + zi * 1.4, 6, 5)), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    MAT.push(zm.material); zm.visible = false; scene.add(zm); zzz.push(zm);
  }

  /* ---- input (same gestures) ---- */
  function cl9(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pd(e) {
    a.PTS[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (e.pointerType === "mouse" && (e.button === 2 || e.shiftKey)) {
      a.drag = null;
      a.mpan = { x: e.clientX, y: e.clientY, px: a.panX || 0, py: a.panY || 0 };
      return;
    }
    var ks = Object.keys(a.PTS);
    if (ks.length === 2) {
      var q1 = a.PTS[ks[0]], q2 = a.PTS[ks[1]];
      a.pz = { ld: Math.hypot(q1.x - q2.x, q1.y - q2.y), lx: (q1.x + q2.x) / 2, ly: (q1.y + q2.y) / 2 };
      a.drag = null;
    } else a.drag = { x: e.clientX, y: e.clientY, r: a.rot, p: a.pit };
  }
  function pm(e) {
    if (a.PTS[e.pointerId]) a.PTS[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (a.mpan) {
      var yaw0 = a.rot, k0 = 0.55;
      var dx0 = (e.clientX - a.mpan.x) * k0, dy0 = (e.clientY - a.mpan.y) * k0;
      a.panX = cl9(a.mpan.px - (dx0 * Math.cos(yaw0) - dy0 * Math.sin(yaw0)), -PR.cameraPanLimit, PR.cameraPanLimit);
      a.panY = cl9(a.mpan.py - (dx0 * Math.sin(yaw0) + dy0 * Math.cos(yaw0)), -PR.cameraPanLimit, PR.cameraPanLimit);
      return;
    }
    var ks = Object.keys(a.PTS);
    if (ks.length === 2 && a.pz) {
      /* pinch zoom + two-finger pan together, incremental (center/dist deltas) */
      if (e.cancelable) e.preventDefault();
      var q1 = a.PTS[ks[0]], q2 = a.PTS[ks[1]];
      var cx = (q1.x + q2.x) / 2, cy = (q1.y + q2.y) / 2;
      var dd = Math.hypot(q1.x - q2.x, q1.y - q2.y);
      a.zoom = cl9(a.zoom * (dd / Math.max(1, a.pz.ld)), 0.6, 2.2);
      var dCx = cx - a.pz.lx, dCy = cy - a.pz.ly;
      var dist3 = cl9(PR.cameraBaseDist / (a.zoom || 1), PR.cameraMinDistance, PR.cameraMaxDistance);
      var ps = dist3 * 0.0012 * PR.cameraPanFactor;
      var c0 = Math.cos(a.rot), s0p = Math.sin(a.rot);
      /* content follows fingers: right=(s,0,-c), forward=(-c,0,-s) */
      a.panX = cl9((a.panX || 0) + (-dCx * s0p + dCy * c0) * ps, -PR.cameraPanLimit, PR.cameraPanLimit);
      a.panY = cl9((a.panY || 0) + (dCx * c0 + dCy * s0p) * ps, -PR.cameraPanLimit, PR.cameraPanLimit);
      a.pz.ld = dd; a.pz.lx = cx; a.pz.ly = cy;
      return;
    }
    var d = a.drag;
    if (d) {
      a.rot = d.r + (e.clientX - d.x) * PR.cameraRotateSpeed;
      a.pit = cl9(d.p + (e.clientY - d.y) * 0.0048, Math.PI / 2 - PR.cameraMaxPolarAngle, Math.PI / 2 - PR.cameraMinPolarAngle);
    }
  }
  function pu(e) { delete a.PTS[e.pointerId]; if (Object.keys(a.PTS).length < 2) a.pz = null; a.drag = null; a.mpan = null; }
  function wh(e) { e.preventDefault(); a.zoom = cl9(a.zoom * (e.deltaY < 0 ? PR.cameraZoomSpeed : 1 / PR.cameraZoomSpeed), 0.6, 2.2); }
  var _prevTA = canvas.style.touchAction;
  canvas.style.touchAction = "none";
  canvas.addEventListener("pointerdown", pd);
  window.addEventListener("pointermove", pm);
  window.addEventListener("pointerup", pu);
  window.addEventListener("pointercancel", pu);
  canvas.addEventListener("wheel", wh, { passive: false });
  function cm(e) { e.preventDefault(); }
  canvas.addEventListener("contextmenu", cm);

  /* ---- resize ---- */
  var _fitScale = 1;
  function _computeFit(w, h) {
    /* aspect = w/h。PC想定(refAspect)以上に横長なら1.0。
       縦長になるほど 1→framingPortraitMax へ滑らかに引く。
       縦の見える範囲は概ね aspect に反比例するので、ref/aspect を基準に補間する。 */
    var aspect = w / Math.max(1, h);
    var s = PR.framingRefAspect / Math.max(0.01, aspect);
    if (s < 1) s = 1;                 /* 横長(PC)では引かない */
    if (s > PR.framingPortraitMax) s = PR.framingPortraitMax;
    /* やり過ぎ防止: 縦画面のみ効かせ、横長はdesktopScale固定 */
    if (aspect >= PR.framingRefAspect) s = PR.framingDesktopScale;
    _fitScale = s;
  }
  function rs() {
    var r = canvas.getBoundingClientRect();
    var w = Math.max(2, Math.round(r.width)), h = Math.max(2, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    _computeFit(w, h);
  }
  rs(); window.addEventListener("resize", rs);

  /* ---- sim + render loop ---- */
  var raf = 0, disposed = false;
  var cam = { d: 0, pol: 1, rot: 0, tx: 0, tz: 0 };
  /* カメラ貫通防止用: 注視点→カメラ間を遮る不透明な障害物だけを対象にする。
     ガラス/ケージ枠と床とハムスターは除外（除外しないとカメラがケージ内に閉じ込められ見た目が大きく変わるため）。
     対象は机(desk)と卓上の植木・本・マグ・写真立てなど room 内の不透明メッシュのみ。 */
  var camRay = new THREE.Raycaster();
  var camObstacles = [];
  room.traverse(function (o) { if (o.isMesh && o !== floor) camObstacles.push(o); });
  function frame(t) {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    var s0 = stR.current || {}, ts = t / 1000;

    /* layout signature -> rebuild furniture */
    var LAY = {};
    Object.keys(DEFL).forEach(function (k) {
      var u = (s0.layout || {})[k];
      LAY[k] = u ? { gx: Math.max(0, Math.min(GW - 1, u.gx | 0)), gz: Math.max(0, Math.min(GH - 1, u.gz | 0)), rot: (u.rot | 0) % 4 } : DEFL[k];
    });
    var sig = JSON.stringify(LAY) + "|" + !!(s0.own && s0.own.bed) + !!(s0.own && s0.own.wheel) + "|" + (s0.poops || 0) + "|" + (P ? 1 : 0);
    if (sig !== lastSig) { lastSig = sig; buildProps(s0, LAY); }

    /* blink */
    if (t > a.blinkT) { a.blink = t; a.blinkT = t + 1700 + Math.random() * 2800; }
    var bf = (t - a.blink < 130) ? 0.15 : 1;
    eyeL.scale.set(1, bf, 1); eyeR.scale.set(1, bf, 1);
    glL.visible = glR.visible = gl2L.visible = gl2R.visible = bf > 0.5;

    /* eating */
    var eel = t - a.eat, eating = a.eat > 0 && eel < 1400;
    var chew = (eating && eel > 300) ? Math.abs(Math.sin(ts * 16)) * 1.6 : 0;
    muzzle.position.y = 16.4 - chew * 0.5; nose.position.y = 17.6 - chew * 0.5;
    var chk = (eating && eel > 280) ? 1.28 : 1;
    cheekL.scale.setScalar(chk); cheekR.scale.setScalar(chk);
    if (eating && eel < 300) {
      crumb.visible = true;
      if (a.eatCol) crumbMat.color.set(a.eatCol);
      var fr = eel / 300;
      crumb.position.set(ham.position.x + Math.cos(a.th || 0) * 30 * S3, (120 - fr * 100), ham.position.z + Math.sin(a.th || 0) * 30 * S3);
    } else crumb.visible = false;

    /* ---- behavior FSM + collision ---- */
    var HM = BP.hamsterRadius * sc0 / 0.9, HMT = 10 * sc0;
    var mX9 = FLW / 2 - 28, mZ9 = FLD / 2 - 26;
    /* collision world (rebuilt per frame from LAY) */
    var CC = [];
    var wheelC = null, wheelR = 0;
    if (s0.own && s0.own.wheel) {
      var Lw = LAY.wheel; wheelC = placeXZ("wheel", Lw); wheelR = (Lw.rot || 0) * Math.PI / 2;
      CC.push([wheelC[0], wheelC[1], 26 + HM, "wheel"]);
    }
    var Lb = LAY.bowl, bowlC = placeXZ("bowl", Lb);
    CC.push([bowlC[0], bowlC[1], 22 + HM, "bowl"]);
    var Ll = LAY.loft, Rl = (Ll.rot || 0) * Math.PI / 2, cRl = Math.cos(Rl), sRl = Math.sin(Rl), lC = placeXZ("loft", Ll);
    [[-30, 0], [0, 0], [30, 0]].forEach(function (o) {
      CC.push([lC[0] + o[0] * cRl - o[1] * sRl, lC[1] + o[0] * sRl + o[1] * cRl, 26 + 14 * sc0, "loft"]);
    });
    var Lt = LAY.tunnel, Rt = (Lt.rot || 0) * Math.PI / 2, cRt = Math.cos(Rt), sRt = Math.sin(Rt), tC = placeXZ("tunnel", Lt);
    [[-16, -15], [16, -15], [-16, 15], [16, 15], [0, -15], [0, 15]].forEach(function (o) {
      CC.push([tC[0] + o[0] * cRt - o[1] * sRt, tC[1] + o[0] * sRt + o[1] * cRt, 8 + HMT, "tunnel"]);
    });
    CC.push([cellX(5), cellZ(5), 12 + HM * 0.6, "ball"]);
    var bedBox = null;
    if (s0.own && s0.own.bed) {
      var Lbe = LAY.bed, Rb = (Lbe.rot || 0) * Math.PI / 2, bC = placeXZ("bed", Lbe);
      bedBox = { x: bC[0], z: bC[1], c: Math.cos(Rb), s: Math.sin(Rb), ex: 52 + HM, ez: 44 + HM, R: Rb };
    }
    function ptFree(x, z, skipWheel) {
      if (x < -mX9 || x > mX9 || z < -mZ9 || z > mZ9) return false;
      for (var q = 0; q < CC.length; q++) {
        if (skipWheel && CC[q][3] === "wheel") continue;
        var dq = Math.hypot(x - CC[q][0], z - CC[q][1]);
        if (dq < CC[q][2] - 1) return false;
      }
      if (bedBox) {
        var dx = x - bedBox.x, dz = z - bedBox.z;
        var lx = dx * bedBox.c + dz * bedBox.s, lz = -dx * bedBox.s + dz * bedBox.c;
        if (Math.abs(lx) < bedBox.ex - 1 && Math.abs(lz) < bedBox.ez - 1) return false;
      }
      return true;
    }
    function pickFree() {
      for (var q = 0; q < 8; q++) {
        var px9 = (Math.random() * 2 - 1) * (mX9 - 20), pz9 = (Math.random() * 2 - 1) * (mZ9 - 20);
        if (ptFree(px9, pz9, false)) return [px9, pz9];
      }
      return [0, 0];
    }
    if (a.pw === void 0) { a.pw = 0; a.hx2 = 0; a.hz2 = 0; a.th = 0; a.gd = 0; }
    if (!a.bst) { a.bst = "idle"; a.bt = t + 1500; a.btgt = null; a.blk = 0; a.blkT = 0; a.avd = 0; a.slp = 0; a.wlock = 0; a.playLock = 0; a.wexit = null; }
    /* one-shot random spawn: only at room open, only when not in wheel/play; never during FSM/render churn */
    if (a._spawnRoll && !a.wlock && !a.playLock && a.bst !== "wheelRun" && a.bst !== "wheelGo") {
      var SPN = [[0, 8, -0.3], [-52, 30, 0.6], [54, 26, -0.7], [-30, -34, 2.1], [34, -28, 2.6], [-92, 58, 0.4], [92, 52, -1.4], [0, -54, 1.4], [-70, -10, 1.9], [70, 12, 3.0]];
      var ok9 = [];
      for (var sp9 = 0; sp9 < SPN.length; sp9++) { if (ptFree(SPN[sp9][0], SPN[sp9][1], false)) ok9.push(SPN[sp9]); }
      var pk9 = ok9.length ? ok9[Math.floor(Math.random() * ok9.length)] : (function () { var f9 = pickFree(); return [f9[0], f9[1], Math.random() * Math.PI * 2 - Math.PI]; })();
      a.hx2 = pk9[0]; a.hz2 = pk9[1]; a.th = pk9[2]; a.gd = pk9[2];
      var rr9 = Math.random();
      if (rr9 < 0.58) { a.bst = "idle"; a.bt = t + 900 + Math.random() * 1500; }
      else if (rr9 < 0.82) { a.bst = "sniff"; a.bt = t + 900 + Math.random() * 800; }
      else { a.bst = "wander"; a.btgt = pickFree(); a.bt = t + 2500 + Math.random() * 3000; a.blk = 0; a.blkT = 0; a.avd = 0; }
      a._spawnRoll = 0;
    }
    var dtF = cl9((t - (a.pT || t - 16.7)) / 16.7, 0.4, 4); a.pT = t;
    var paused = a.drag || t < a.spin || eating;
    var rnd = Math.random;
    function dur(lo, hi) { return lo + rnd() * (hi - lo); }
    function toIdle() { a.bst = "idle"; a.bt = t + dur(BP.hamsterIdleDurationMin, BP.hamsterIdleDurationMax); }
    function toWander() { a.bst = "wander"; a.btgt = pickFree(); a.bt = t + dur(BP.hamsterWanderDurationMin, BP.hamsterWanderDurationMax); a.blk = 0; a.blkT = 0; a.avd = 0; }
    /* wheelEntryPoint: opening side (local +z), follows wheelRoot rotation; never on stand side */
    function wheelEntry() {
      var d0 = 26 + HM + 14;
      var ex = cl9(wheelC[0] - Math.sin(wheelR) * d0, -mX9 + 4, mX9 - 4);
      var ez = cl9(wheelC[1] + Math.cos(wheelR) * d0, -mZ9 + 4, mZ9 - 4);
      if (ptFree(ex, ez, true)) return [ex, ez];
      var px = Math.cos(wheelR), pz = Math.sin(wheelR);   /* sideways along the opening */
      for (var k9 = 1; k9 <= 6; k9++) {
        var sft = (k9 % 2 ? 1 : -1) * Math.ceil(k9 / 2) * 14;
        var qx = cl9(ex + px * sft, -mX9 + 4, mX9 - 4), qz = cl9(ez + pz * sft, -mZ9 + 4, mZ9 - 4);
        if (ptFree(qx, qz, true)) return [qx, qz];
      }
      return [ex, ez];
    }
    /* snap onto the inner running surface; remember a safe exit spot */
    function enterWheelRun() {
      a.bst = "wheelRun"; a.wlock = 1;
      a.bt = t + (a.playLock ? dur(5000, 10000) : dur(BP.hamsterWheelRunDurationMin, BP.hamsterWheelRunDurationMax));
      a.wexit = wheelEntry(); a.btgt = a.wexit;
      a.blk = 0; a.blkT = 0; a.avd = 0;
    }
    /* "あそぶ" pressed -> interrupt anything (incl. sleep) and head to the wheel */
    if (a.playReq && !paused) {
      if (wheelC) {
        a.playLock = 1; a.bst = "wheelGo"; a.btgt = wheelEntry();
        a.bt = t + 6000;                      /* hard cap: snaps to wheelRun on timeout */
        a.blk = 0; a.blkT = 0; a.avd = 0; a.slp = Math.min(a.slp || 0, 0.4);
      }
      a.playReq = 0;
    } else if (a.playReq && t - a.playReq > 6000) { a.playReq = 0; }
    /* state transitions on timeout */
    if (!paused && t >= a.bt) {
      if (a.bst === "idle") {
        var r9 = rnd();
        var nearBowl = Math.hypot(a.hx2 - bowlC[0], a.hz2 - bowlC[1]) < 150;
        if (mood0 < 30) { a.bst = "sleep"; a.bt = t + dur(BP.hamsterSleepDurationMin, BP.hamsterSleepDurationMax); }
        else if (r9 < BP.hamsterSleepChance) { a.bst = "sleepGo"; a.btgt = bedBox ? [bedBox.x - bedBox.s * (bedBox.ez + 8), bedBox.z + bedBox.c * (bedBox.ez + 8)] : [a.hx2, a.hz2]; a.bt = t + 5000; a.blk = 0; }
        else if (wheelC && r9 < BP.hamsterSleepChance + BP.hamsterWheelRunChance) { a.bst = "wheelGo"; a.btgt = wheelEntry(); a.bt = t + 5000; a.blk = 0; a.blkT = 0; a.avd = 0; }
        else if (nearBowl && r9 < BP.hamsterSleepChance + BP.hamsterWheelRunChance + 0.2 && rnd() < BP.hamsterEatChance) { a.bst = "eatGo"; a.bt = t + 4000; a.blk = 0; }
        else if (r9 < 0.42 + BP.hamsterShiverChance) { a.bst = "shiver"; a.bt = t + dur(900, 1500); }
        else if (r9 < 0.42 + BP.hamsterShiverChance + BP.hamsterBurrowChance) { a.bst = "burrow"; a.bt = t + dur(3500, 6500); }
        else if (r9 < 0.5 + BP.hamsterShiverChance + BP.hamsterBurrowChance + BP.hamsterSniffChance) { a.bst = "sniff"; a.bt = t + dur(900, 1700); }
        else if (r9 < 0.5 + BP.hamsterSniffChance + BP.hamsterGroomChance) { a.bst = "groom"; a.bt = t + dur(1400, 2200); }
        else toWander();
      } else if (a.bst === "sniff" || a.bst === "groom" || a.bst === "shiver") { rnd() < 0.5 ? toIdle() : toWander(); }
      else if (a.bst === "burrow") { toIdle(); }
      else if (a.bst === "wander") { rnd() < 0.6 ? toIdle() : (a.bst = "sniff", a.bt = t + dur(900, 1700)); }
      else if (a.bst === "sleepGo") { a.bst = "sleep"; a.bt = t + dur(BP.hamsterSleepDurationMin, BP.hamsterSleepDurationMax); }
      else if (a.bst === "sleep") { toIdle(); }
      else if (a.bst === "wheelGo") { if (a.playLock && wheelC) { enterWheelRun(); } else { toIdle(); } }
      else if (a.bst === "wheelRun") {
        a.bst = "idle"; a.bt = t + 800; a.wlock = 0; a.playLock = 0;
        var ex9 = a.wexit || a.btgt;
        if (!ex9 || !ptFree(ex9[0], ex9[1], true)) ex9 = pickFree();
        a.hx2 = ex9[0]; a.hz2 = ex9[1]; a.wexit = null;
      }
      else if (a.bst === "eatGo") { toIdle(); }
      else if (a.bst === "eatHold") { toIdle(); }
      else toIdle();
    }
    /* arrivals */
    var moving = (a.bst === "wander" || a.bst === "sleepGo" || a.bst === "wheelGo" || a.bst === "eatGo");
    if (a.bst === "eatGo" && !a.btgt) {
      var bd = Math.hypot(a.hx2 - bowlC[0], a.hz2 - bowlC[1]) || 1;
      a.btgt = [bowlC[0] + (a.hx2 - bowlC[0]) / bd * (22 + HM + 2), bowlC[1] + (a.hz2 - bowlC[1]) / bd * (22 + HM + 2)];
    }
    if (moving && a.btgt) {
      var adx = a.btgt[0] - a.hx2, adz = a.btgt[1] - a.hz2, adl = Math.hypot(adx, adz);
      if (adl < (a.bst === "wheelGo" ? 20 : 16)) {
        if (a.bst === "wander") { rnd() < 0.6 ? toIdle() : (a.bst = "sniff", a.bt = t + dur(900, 1700)); }
        else if (a.bst === "sleepGo") { a.bst = "sleep"; a.bt = t + dur(BP.hamsterSleepDurationMin, BP.hamsterSleepDurationMax); a.th = bedBox ? bedBox.R + Math.PI / 2 : a.th; }
        else if (a.bst === "wheelGo") { enterWheelRun(); }
        else if (a.bst === "eatGo") { a.bst = "eatHold"; a.bt = t + 1500; a.eat = t; a.eatCol = ""; var ba = Math.atan2(bowlC[1] - a.hz2, bowlC[0] - a.hx2); a.th = ba; }
      }
    }
    /* movement */
    var wantWalk = !paused && moving && a.bst !== "wheelRun" && mood0 >= 20;
    a.pw += ((wantWalk ? 1 : 0) - a.pw) * Math.min(1, 0.08 * dtF);
    var pw = a.pw;
    if (wantWalk && a.btgt && pw > 0.05) {
      var ddx = a.btgt[0] - a.hx2, ddz = a.btgt[1] - a.hz2;
      var dth = Math.atan2(ddz, ddx) - a.th;
      while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
      a.th += cl9(dth, -BP.hamsterTurnSpeed * dtF, BP.hamsterTurnSpeed * dtF);
      var stp = BP.hamsterMoveSpeed * pw * dtF;
      var nx9 = a.hx2 + Math.cos(a.th) * stp, nz9 = a.hz2 + Math.sin(a.th) * stp;
      var noseX = nx9 + Math.cos(a.th) * BP.hamsterAvoidDistance, noseZ = nz9 + Math.sin(a.th) * BP.hamsterAvoidDistance;
      if (ptFree(nx9, nz9, false) && ptFree(noseX, noseZ, false)) {
        a.hx2 = nx9; a.hz2 = nz9; a.gd += stp; a.blk = 0; a.blkT = 0; a.avd = 0;
      } else {
        /* blocked: steady turn in ONE committed direction (no per-frame flip-flop = no shaking) */
        if (!a.avd) a.avd = rnd() < 0.5 ? 1 : -1;
        a.blkT = (a.blkT || 0) + dtF * 16.7;
        a.th += 0.055 * dtF * a.avd;
        if (a.blkT > 400) {                       /* stuck too long -> re-decide */
          if (a.bst === "wheelGo" && wheelC) {
            if (a.playLock && Math.hypot(a.hx2 - wheelC[0], a.hz2 - wheelC[1]) < 26 + HM + 36) { enterWheelRun(); }
            else { a.btgt = wheelEntry(); }
          } else {
            a.btgt = pickFree();
            if (a.bst !== "wander") { a.bst = "wander"; a.bt = t + dur(BP.hamsterWanderDurationMin, BP.hamsterWanderDurationMax); }
          }
          a.blkT = 0; a.blk = 0; a.avd = 0;
        }
      }
    }
    /* wheelRun lock */
    if (a.bst === "wheelRun" && wheelC) {
      a.hx2 = wheelC[0];
      a.hz2 = wheelC[1];
      a.th = wheelR;
      a.gd += 1.5 * dtF;
      pw = 1;
    } else if (a.bst === "wheelRun") { toIdle(); a.wlock = 0; a.playLock = 0; }
    /* sleep pose factor */
    a.slp = (a.slp || 0) + (((a.bst === "sleep" && !paused) ? 1 : 0) - (a.slp || 0)) * Math.min(1, 0.06 * dtF);
    a.brw = (a.brw || 0) + (((a.bst === "burrow" && !paused) ? 1 : 0) - (a.brw || 0)) * Math.min(1, 0.07 * dtF);
    /* push-out safety (skip wheel circle while locked) */
    (function () {
      if (a.bst === "wheelRun") return;
      if (bedBox) {
        var dx = a.hx2 - bedBox.x, dz = a.hz2 - bedBox.z;
        var lx = dx * bedBox.c + dz * bedBox.s, lz = -dx * bedBox.s + dz * bedBox.c;
        if (Math.abs(lx) < bedBox.ex && Math.abs(lz) < bedBox.ez) {
          var px = bedBox.ex - Math.abs(lx), pz = bedBox.ez - Math.abs(lz);
          if (px < pz) lx = (lx < 0 ? -1 : 1) * bedBox.ex; else lz = (lz < 0 ? -1 : 1) * bedBox.ez;
          a.hx2 = bedBox.x + lx * bedBox.c - lz * bedBox.s; a.hz2 = bedBox.z + lx * bedBox.s + lz * bedBox.c;
        }
      }
      for (var s9 = 0; s9 < 2; s9++) {
        CC.forEach(function (c9) {
          var dx = a.hx2 - c9[0], dz = a.hz2 - c9[1], dl = Math.hypot(dx, dz), rr = c9[2];
          if (dl < rr && dl > 0.01) { a.hx2 = c9[0] + dx / dl * (rr + 0.6); a.hz2 = c9[1] + dz / dl * (rr + 0.6); }
        });
      }
      a.hx2 = cl9(a.hx2, -mX9, mX9); a.hz2 = cl9(a.hz2, -mZ9, mZ9);
      /* deep-stuck rescue: furniture moved onto the hamster etc. */
      if (!ptFree(a.hx2, a.hz2, true)) {
        a.stkT = (a.stkT || 0) + dtF * 16.7;
        if (a.stkT > 900) { var fr9 = pickFree(); a.hx2 = fr9[0]; a.hz2 = fr9[1]; a.stkT = 0; a.blkT = 0; a.avd = 0; if (a.bst === "wander" || a.bst === "sleepGo" || a.bst === "eatGo") a.btgt = pickFree(); }
      } else a.stkT = 0;
    })();

    /* hamster pose */
    var onWheel = (a.bst === "wheelRun" && wheelC);
    var runPh = onWheel ? a.gd * 0.9 : a.gd * 0.5;
    var lift1 = (onWheel ? 1 : pw) * Math.max(0, Math.sin(runPh)) * (onWheel ? 6 : 4.5);
    var lift2 = (onWheel ? 1 : pw) * Math.max(0, Math.sin(runPh + Math.PI)) * (onWheel ? 6 : 4.5);
    var hop = (t < a.spin) ? Math.abs(Math.sin(ts * 9)) * 14 : 0;
    var bob = onWheel ? Math.abs(Math.sin(runPh)) * 1.6 : pw * Math.abs(Math.sin(runPh)) * 1.3 + (1 - pw) * Math.sin(ts * 1.8) * 0.9;
    var slp = a.slp || 0, brw = a.brw || 0;
    var shiv = (a.bst === "shiver" && !paused) ? Math.sin(ts * 38) * 1.4 : 0;
    var baseY = onWheel ? 15.5 : 2.2;   /* 2.2 = bedding surface; 15.5 = inner running surface adjusted for 0.84x wheelRun scale */
    ham.position.set(a.hx2 + shiv * 0.6, baseY + hop + bob - slp * 1.0 - brw * 5, a.hz2);
    ham.rotation.y = -a.th;
    ham.rotation.z = onWheel ? 0.16 : shiv * 0.02;
    /* wheelRun中だけ少し縮小(0.84)して外周リングから飛び出さないようにする。通常時はS3のまま */
    var wsc = onWheel ? 0.84 : 1;
    ham.scale.set(S3 * wsc * (1 + slp * 0.06 + brw * 0.04), S3 * wsc * (1 - slp * 0.2 - brw * 0.18), S3 * wsc * (1 + slp * 0.06 + brw * 0.04));
    /* sniff: nose/head wiggle ; groom: body sway */
    var sniffW = (a.bst === "sniff" && !paused) ? Math.sin(ts * 11) * 0.8 : 0;
    nose.position.x = 31 + sniffW; muzzle.position.x = 24.5 + sniffW * 0.5;
    head.rotation.z = (a.bst === "groom" && !paused) ? Math.sin(ts * 6) * 0.18 : 0;
    fFL.position.y = 2.8 + lift1; fFR.position.y = 2.8 + lift2;
    fBL.position.y = 2.8 + lift2; fBR.position.y = 2.8 + lift1;
    /* sleeping eyes + Zzz */
    var asleep = slp > 0.5;
    if (asleep) { eyeL.scale.y = 0.1; eyeR.scale.y = 0.1; glL.visible = glR.visible = gl2L.visible = gl2R.visible = false; }
    for (var z9 = 0; z9 < zzz.length; z9++) {
      var zb = zzz[z9];
      if (asleep) {
        var zp = ((ts * 0.6 + z9 * 0.33) % 1);
        zb.visible = true;
        zb.position.set(a.hx2 + 14 + z9 * 5, 42 + zp * 34 + z9 * 7, a.hz2 - 6);
        zb.material.opacity = 0.8 * (1 - zp);
        zb.scale.setScalar(0.7 + zp * 0.6);
      } else zb.visible = false;
    }

    /* wheel spin */
    if (wheelSpin) wheelSpin.rotation.z -= (onWheel ? 0.22 : t < a.spin ? 0.16 : 0.006) * dtF;

    /* hearts */
    if (a.hearts && a.hearts.length) {
      a.hearts.length = 0;
      var now = t;
      for (var hi2 = 0; hi2 < 3; hi2++) {
        var slot = hearts[hi2 % hearts.length];
        slot.t0 = now + hi2 * 130; slot.m.visible = false;
      }
    }
    hearts.forEach(function (hh, idx) {
      if (!hh.t0) return;
      var e2 = t - hh.t0;
      if (e2 < 0) return;
      if (e2 > 1100) { hh.m.visible = false; hh.t0 = 0; return; }
      hh.m.visible = true;
      hh.m.position.set(a.hx2 + (idx - 1) * 16, 56 * S3 + e2 * 0.05, a.hz2);
      hh.m.material.opacity = 1 - e2 / 1100;
      hh.m.quaternion.copy(camera.quaternion);
    });

    /* edit highlight */
    var eid = getEdit();
    if (editRing) {
      if (eid && LAY[eid]) {
        editRing.visible = true;
        var _exz = placeXZ(eid, LAY[eid]); editRing.position.set(_exz[0], 3, _exz[1]);
        var pls = 1 + Math.sin(ts * 6) * 0.12;
        editRing.scale.setScalar(pls);
      } else editRing.visible = false;
    }

    /* camera (damped) — _fitScale で縦画面をPC表示寄りのスケールに引く */
    var _fs = _fitScale || 1;
    var dT = cl9(PR.cameraBaseDist * _fs / (a.zoom || 1),
                 PR.cameraMinDistance * _fs, PR.cameraMaxDistance * _fs);
    var pT = cl9(Math.PI / 2 - a.pit, PR.cameraMinPolarAngle, PR.cameraMaxPolarAngle);
    var txT = cl9((a.panX || 0) + a.hx2 * 0.2, -PR.cameraPanLimit, PR.cameraPanLimit);
    var tzT = cl9((a.panY || 0) + a.hz2 * 0.2, -PR.cameraPanLimit, PR.cameraPanLimit);
    if (cam.d === 0) { cam.d = dT; cam.pol = pT; cam.rot = a.rot; cam.tx = txT; cam.tz = tzT; }
    var K = PR.cameraDamping;
    cam.d += (dT - cam.d) * K; cam.pol += (pT - cam.pol) * K; cam.rot += (a.rot - cam.rot) * (K + 0.08);
    cam.tx += (txT - cam.tx) * K; cam.tz += (tzT - cam.tz) * K;
    var dist = cam.d, pol = cam.pol;
    var tgt = new THREE.Vector3(cam.tx, PR.cameraTargetY, cam.tz);
    camera.position.set(
      tgt.x + dist * Math.sin(pol) * Math.cos(cam.rot),
      tgt.y + dist * Math.cos(pol),
      tgt.z + dist * Math.sin(pol) * Math.sin(cam.rot)
    );
    /* --- カメラ貫通防止(1): 高さクランプ。床下・机下に潜らせない --- */
    camera.position.y = cl9(camera.position.y, PR.cameraMinHeight, PR.cameraMaxHeight);
    /* --- カメラ貫通防止(2): 注視点→カメラ間に不透明な障害物(机/卓上の植木等)があればカメラを手前へ補正 ---
       ガラス・ケージ枠・床・ハムスターは camObstacles に含めないため、ケージ内に閉じ込められず現状の見た目を維持する。 */
    if (camObstacles.length) {
      var _dir = camera.position.clone().sub(tgt);
      var _len = _dir.length();
      if (_len > 1) {
        _dir.multiplyScalar(1 / _len);
        camRay.set(tgt, _dir);
        camRay.far = _len;
        var _hit = camRay.intersectObjects(camObstacles, true);
        if (_hit.length) {
          var _d = _hit[0].distance - PR.cameraCollisionPadding;   /* 障害物の手前で止める */
          var _minD = PR.cameraMinDistance * 0.5;                  /* 近づきすぎ防止の下限 */
          if (_d < _minD) _d = _minD;
          if (_d < _len) {
            camera.position.copy(tgt).addScaledVector(_dir, _d);
            camera.position.y = cl9(camera.position.y, PR.cameraMinHeight, PR.cameraMaxHeight);
          }
        }
      }
    }
    camera.lookAt(tgt);

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  return {
    dispose: function () {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointerdown", pd);
      window.removeEventListener("pointermove", pm);
      window.removeEventListener("pointerup", pu);
      window.removeEventListener("pointercancel", pu);
      canvas.removeEventListener("wheel", wh);
      canvas.removeEventListener("contextmenu", cm);
      canvas.style.touchAction = _prevTA;
      window.removeEventListener("resize", rs);
      GEO.forEach(function (g) { g.dispose(); });
      if (woodTex) woodTex.dispose();
      MAT.forEach(function (m) { m.dispose(); });
      renderer.dispose();
    }
  };
};
