import type * as ThreeModule from "three";

// The landing page's 3D world: a road you travel by scrolling, past billboards for each step, towards a
// giant padlock that is the client's PayPal hold. Its five slices are the five agreed criteria. An AI
// scanner sweeps the lock, passed slices turn mint, and coins for them fly to the freelancer's pedestal.
// Everything is built from primitives and canvas textures, so there are no model files to load.

type Three = typeof ThreeModule;

export type JourneyFonts = { display: string; body: string; mono: string };

export type JourneyScene = {
  /**
   * `progress` 0..1 through the story, `time` in seconds, `pointer` -1..1 on both axes.
   * `lift` 0..1 raises and pulls the camera back into a wide aerial view, used behind the hero on arrival.
   */
  frame(progress: number, time: number, pointer: { x: number; y: number }, lift?: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
};

/** Scroll ranges (fractions of the section) for each beat of the story. */
export const PHASES = {
  lock: [0.14, 0.28],
  verify: [0.34, 0.56],
  release: [0.6, 0.78],
  agent: [0.82, 0.94],
} as const;

/** The five criteria from the top slice down. The fourth (the contact form) fails. */
export const RESULTS = [true, true, true, false, true];

export const STATIONS = [
  { title: "Agree on done", caption: "Five criteria, $200 each. The spec is frozen before money moves.", from: 0 },
  { title: "Locked on PayPal", caption: "$1,000 held on the client's own PayPal. Nothing is charged yet.", from: PHASES.lock[0] },
  { title: "AI checked", caption: "The checker tests every criterion with evidence. Four pass, one fails.", from: PHASES.verify[0] },
  { title: "Paid as agreed", caption: "PayPal captures $800 for what passed. The failed $200 stays held.", from: PHASES.release[0] - 0.02 },
  { title: "Agent ready", caption: "The client's AI agent can release the next one, inside its limits.", from: PHASES.agent[0] },
];

const COINS = RESULTS.filter(Boolean).length;
const COIN_GAP = 0.15;
const COIN_FLIGHT = 0.4;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const phase = (p: number, [a, b]: readonly [number, number]) => clamp01((p - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const bell = (p: number, a: number, b: number) => Math.sin(clamp01((p - a) / (b - a)) * Math.PI);

/** Which coin flights have finished, as a 0..1 progress per coin. */
function coinFlights(p: number) {
  const r = phase(p, PHASES.release);
  return Array.from({ length: COINS }, (_, i) => clamp01((r - i * COIN_GAP) / COIN_FLIGHT));
}

export function stationAt(p: number) {
  let s = 0;
  STATIONS.forEach((st, i) => {
    if (p >= st.from) s = i;
  });
  return s;
}

/** Money on screen at a scroll position: authorized once the lock closes, $200 released per landed coin. */
export function ledgerAt(p: number) {
  const authorized = phase(p, PHASES.lock) >= 1 ? 1000 : 0;
  const released = coinFlights(p).filter((t) => t >= 1).length * 200;
  return { held: authorized - released, released };
}

const C = {
  sky: 0x2448ff,
  ground: 0x2a4dff,
  body: 0x1a34d8,
  ink: 0x0b0c12,
  paper: 0xe9ecf7,
  white: 0xffffff,
  ice: 0x4fc8ff,
  mint: 0x22e3a0,
  flare: 0xff5c7c,
  sun: 0xffc53d,
  nova: 0xa78bff,
};

export function createJourneyScene(T: Three, canvas: HTMLCanvasElement, opts: { fonts: JourneyFonts; reduced: boolean; dpr: number }): JourneyScene {
  const { fonts, reduced } = opts;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(opts.dpr);
  const scene = new T.Scene();
  scene.background = new T.Color(C.sky);
  scene.fog = new T.Fog(C.sky, 22, 70);
  const camera = new T.PerspectiveCamera(55, 1, 0.1, 220);
  const UP = new T.Vector3(0, 1, 0);
  const textures: ThreeModule.Texture[] = [];

  // ---------- small builders ----------

  const canvasTexture = (w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    draw(c.getContext("2d")!);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.anisotropy = 4;
    if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
    textures.push(t);
    return t;
  };

  const gridTexture = (bg: string, line: string, cells = 8) =>
    canvasTexture(
      256,
      256,
      (g) => {
        g.fillStyle = bg;
        g.fillRect(0, 0, 256, 256);
        g.strokeStyle = line;
        g.lineWidth = 3;
        for (let i = 0; i <= cells; i++) {
          const v = Math.round((i * 256) / cells);
          g.beginPath();
          g.moveTo(v, 0);
          g.lineTo(v, 256);
          g.moveTo(0, v);
          g.lineTo(256, v);
          g.stroke();
        }
      },
      true,
    );

  /** Square grid lines over the six faces of a box, like a wireframe made of quads. */
  const boxGrid = (w: number, h: number, d: number, step: number) => {
    const pts: number[] = [];
    const n = (len: number) => Math.max(1, Math.round(len / step));
    const [hw, hh, hd] = [w / 2, h / 2, d / 2];
    for (const z of [-hd, hd]) {
      for (let i = 0; i <= n(w); i++) pts.push(-hw + (w * i) / n(w), -hh, z, -hw + (w * i) / n(w), hh, z);
      for (let j = 0; j <= n(h); j++) pts.push(-hw, -hh + (h * j) / n(h), z, hw, -hh + (h * j) / n(h), z);
    }
    for (const x of [-hw, hw]) {
      for (let i = 0; i <= n(d); i++) pts.push(x, -hh, -hd + (d * i) / n(d), x, hh, -hd + (d * i) / n(d));
      for (let j = 0; j <= n(h); j++) pts.push(x, -hh + (h * j) / n(h), -hd, x, -hh + (h * j) / n(h), hd);
    }
    for (const y of [-hh, hh]) {
      for (let i = 0; i <= n(w); i++) pts.push(-hw + (w * i) / n(w), y, -hd, -hw + (w * i) / n(w), y, hd);
      for (let j = 0; j <= n(d); j++) pts.push(-hw, y, -hd + (d * j) / n(d), hw, y, -hd + (d * j) / n(d));
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    return g;
  };

  // The fill sits back a little so the grid lines drawn on the same faces never flicker.
  const fillMaterial = (color: number, extra: ThreeModule.MeshBasicMaterialParameters = {}) => new T.MeshBasicMaterial({ color, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...extra });
  const lineMaterial = (color: number, opacity = 1) => new T.LineBasicMaterial({ color, transparent: opacity < 1, opacity });

  /** A solid shape with its edges drawn on top: the "wire mesh" look. */
  const meshed = (geometry: ThreeModule.BufferGeometry, fill: number, line: number, edges: ThreeModule.BufferGeometry = new T.EdgesGeometry(geometry, 6)) => {
    const group = new T.Group();
    const f = new T.Mesh(geometry, fillMaterial(fill));
    const l = new T.LineSegments(edges, lineMaterial(line));
    group.add(f, l);
    return { group, fill: f.material, line: l.material };
  };

  const fitFont = (g: CanvasRenderingContext2D, text: string, weight: string, family: string, size: number, maxWidth: number) => {
    let s = size;
    do {
      g.font = `${weight} ${s}px ${family}`;
      s -= 4;
    } while (g.measureText(text).width > maxWidth && s > 20);
  };

  /** Black billboard on two posts, Razorpay-style: condensed capitals, a mono line, lamps on top. */
  const billboard = (title: string, sub: string, w = 7.4, h = 3.9) => {
    const group = new T.Group();
    const tex = canvasTexture(1024, Math.round((1024 * h) / w), (g) => {
      const H = g.canvas.height;
      g.fillStyle = "#0b0c12";
      g.fillRect(0, 0, 1024, H);
      g.strokeStyle = "rgba(255,255,255,0.28)";
      g.lineWidth = 3;
      for (const y of [44, 62]) {
        g.beginPath();
        g.moveTo(60, y);
        g.lineTo(964, y);
        g.stroke();
      }
      g.fillStyle = "#ffffff";
      g.textBaseline = "alphabetic";
      g.fontStretch = "condensed";
      const lines = title.toUpperCase().split("\n");
      lines.forEach((line, i) => {
        fitFont(g, line, "700", fonts.display, 150, 880);
        g.fillText(line, 64, 200 + i * 142);
      });
      g.fontStretch = "normal";
      g.font = `500 34px ${fonts.mono}`;
      g.letterSpacing = "6px";
      g.fillStyle = "rgba(255,255,255,0.72)";
      g.fillText(sub.toUpperCase(), 66, H - 58);
      // A small volt badge with a tick, like a sticker on the board.
      g.fillStyle = "#2448ff";
      g.beginPath();
      g.arc(930, 128, 46, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#ffffff";
      g.lineWidth = 11;
      g.lineCap = "round";
      g.lineJoin = "round";
      g.beginPath();
      g.moveTo(908, 130);
      g.lineTo(924, 146);
      g.lineTo(954, 112);
      g.stroke();
    });
    const pole = 4.2;
    const panel = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex }));
    panel.position.y = pole + h / 2;
    const back = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: C.ink }));
    back.rotation.y = Math.PI;
    back.position.copy(panel.position);
    const strip = new T.Mesh(new T.PlaneGeometry(w, 0.55), new T.MeshBasicMaterial({ map: gridTexture("#0b0c12", "#e9ecf7", 4) }));
    (strip.material.map as ThreeModule.Texture).repeat.set(6, 1);
    strip.position.set(0, pole - 0.3, 0.02);
    group.add(panel, back, strip);
    const post = new T.BoxGeometry(0.2, pole, 0.2);
    for (const x of [-w * 0.28, w * 0.28]) {
      const m = new T.Mesh(post, new T.MeshBasicMaterial({ color: C.paper }));
      m.position.set(x, pole / 2, -0.1);
      group.add(m);
    }
    const lamp = new T.BoxGeometry(0.07, 0.55, 0.07);
    for (let i = 0; i < 4; i++) {
      const m = new T.Mesh(lamp, new T.MeshBasicMaterial({ color: C.ink }));
      m.position.set(-w * 0.36 + (i * w * 0.72) / 3, pole + h + 0.25, 0.1);
      m.rotation.x = 0.35;
      group.add(m);
    }
    return group;
  };

  /** A small floating card with a label and a value, like the tiles drifting around Razorpay's scene. */
  const floatCard = (label: string, value: string, tone: string) => {
    const tex = canvasTexture(512, 320, (g) => {
      g.fillStyle = "#e5ebff";
      g.fillRect(0, 0, 512, 320);
      g.fillStyle = tone;
      g.fillRect(0, 0, 512, 14);
      g.fillStyle = "#4a4f63";
      g.font = `500 30px ${fonts.mono}`;
      g.letterSpacing = "4px";
      g.fillText(label.toUpperCase(), 34, 92);
      g.letterSpacing = "0px";
      g.fillStyle = "#111218";
      fitFont(g, value, "700", fonts.body, 104, 450);
      g.fillText(value, 30, 230);
    });
    return new T.Mesh(new T.PlaneGeometry(2.6, 1.62), new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
  };

  // ---------- the road ----------

  const road = new T.CatmullRomCurve3([
    new T.Vector3(0, 0, 8),
    new T.Vector3(3, 0.4, -8),
    new T.Vector3(-4, 1.2, -24),
    new T.Vector3(2, 2.0, -40),
    new T.Vector3(-3, 2.8, -56),
    new T.Vector3(2, 3.4, -72),
    new T.Vector3(0, 3.8, -90),
  ]);
  const sideAt = (u: number) => new T.Vector3().crossVectors(road.getTangentAt(u), UP).normalize();
  const at = (u: number, side = 0, up = 0) => road.getPointAt(u).addScaledVector(sideAt(u), side).addScaledVector(UP, up);

  const ribbon = (width: number, drop: number, cell: number, tex: ThreeModule.Texture) => {
    const N = 360;
    const pos: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    let dist = 0;
    let prev = road.getPointAt(0);
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = road.getPointAt(u);
      dist += p.distanceTo(prev);
      prev = p;
      const s = sideAt(u);
      for (const k of [-1, 1]) {
        const v = p.clone().addScaledVector(s, (k * width) / 2).addScaledVector(UP, -drop);
        pos.push(v.x, v.y, v.z);
        uv.push(((k + 1) / 2) * (width / cell), dist / cell);
      }
      if (i < N) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return new T.Mesh(g, new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }));
  };

  scene.add(ribbon(110, 0.35, 4, gridTexture("#2a4dff", "#4766ff", 4)));
  scene.add(ribbon(7, 0, 1, gridTexture("#e9ecf7", "rgba(36,72,255,0.28)", 8)));

  // A rail of white posts on both edges, joined at the top.
  {
    const count = 140;
    const posts = new T.InstancedMesh(new T.BoxGeometry(0.09, 0.75, 0.09), new T.MeshBasicMaterial({ color: C.white }), count * 2);
    const dummy = new T.Object3D();
    const rails: number[] = [];
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1);
      for (const [k, side] of [
        [0, -3.6],
        [1, 3.6],
      ]) {
        const p = at(u, side, 0.375);
        dummy.position.copy(p);
        dummy.updateMatrix();
        posts.setMatrixAt(i * 2 + k, dummy.matrix);
        if (i > 0) {
          const a = at((i - 1) / (count - 1), side, 0.75);
          const b = at(u, side, 0.75);
          rails.push(a.x, a.y, a.z, b.x, b.y, b.z);
        }
      }
    }
    const railGeo = new T.BufferGeometry();
    railGeo.setAttribute("position", new T.Float32BufferAttribute(rails, 3));
    scene.add(posts, new T.LineSegments(railGeo, lineMaterial(C.white)));
  }

  // ---------- billboards ----------

  // Each board stands a little ahead of where the camera is during its step, so it is in view, not overhead.
  const boards: [number, number, string, string][] = [
    [0.13, 8.5, "Agree\non done", "01 · 5 criteria · $200 each"],
    [0.3, -8.5, "Locked on\nPayPal", "02 · authorized, not charged"],
    [0.47, 9, "AI\nchecked", "03 · evidence for every check"],
    [0.71, -9, "Paid as\nagreed", "04 · $800 captured"],
    [0.9, 8.5, "Agent\nready", "05 · pays within limits"],
  ];
  const boardCenters: ThreeModule.Vector3[] = [];
  for (const [u, side, title, sub] of boards) {
    const b = billboard(title, sub);
    const base = at(u, side, -0.2);
    boardCenters.push(base.clone().addScaledVector(UP, 6));
    b.position.copy(base);
    const facing = at(Math.max(0, u - 0.08), 0, base.y - road.getPointAt(Math.max(0, u - 0.08)).y);
    b.lookAt(facing.x, base.y, facing.z);
    b.rotation.z = side > 0 ? -0.04 : 0.04;
    scene.add(b);
  }

  // ---------- the padlock: the client's PayPal hold ----------

  const padlock = new T.Group();
  const W = 9;
  const SH = 1.7;
  const D = 4.6;
  const GAP = 0.2;
  const bodyTop = 5 * SH + 4 * GAP;
  const slices = RESULTS.map((_, i) => {
    const y = bodyTop - SH / 2 - i * (SH + GAP);
    const s = meshed(new T.BoxGeometry(W, SH, D), C.body, C.white, boxGrid(W, SH, D, 0.72));
    s.group.position.y = y;
    padlock.add(s.group);
    return { ...s, y };
  });
  {
    const hole = new T.Shape();
    hole.absarc(0, 0.32, 0.5, 0, Math.PI * 2, false);
    const slot = new T.Shape();
    slot.moveTo(-0.3, 0.1);
    slot.lineTo(0.3, 0.1);
    slot.lineTo(0.42, -1.05);
    slot.lineTo(-0.42, -1.05);
    slot.closePath();
    const mat = new T.MeshBasicMaterial({ color: C.ink });
    for (const shape of [hole, slot]) {
      const m = new T.Mesh(new T.ShapeGeometry(shape, 24), mat);
      m.position.set(0, slices[2].y + 0.15, D / 2 + 0.03);
      padlock.add(m);
    }
  }
  const R = 3.1;
  const LEG = 2.7;
  const shackle = new T.Group();
  const shackleArm = new T.Group();
  {
    const arc = meshed(new T.TorusGeometry(R, 0.6, 10, 28, Math.PI), C.paper, C.sky);
    arc.group.position.set(R, LEG, 0);
    shackleArm.add(arc.group);
    for (const x of [0, 2 * R]) {
      const leg = meshed(new T.CylinderGeometry(0.6, 0.6, LEG, 12, 3), C.paper, C.sky);
      leg.group.position.set(x, LEG / 2, 0);
      shackleArm.add(leg.group);
    }
  }
  shackle.position.set(-R, bodyTop - 0.7, 0);
  shackle.add(shackleArm);
  padlock.add(shackle);

  const tagTexture = (title: string, amount: string, tone: string) =>
    canvasTexture(512, 300, (g) => {
      g.fillStyle = "#0b0c12";
      g.fillRect(0, 0, 512, 300);
      g.fillStyle = tone;
      g.beginPath();
      g.arc(456, 56, 18, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.font = `500 30px ${fonts.mono}`;
      g.letterSpacing = "4px";
      g.fillText(title.toUpperCase(), 34, 70);
      g.letterSpacing = "0px";
      g.fillStyle = tone;
      g.font = `700 112px ${fonts.body}`;
      g.fillText(amount, 30, 220);
    });
  const tagHeld = tagTexture("Held on PayPal", "$1,000", "#4fc8ff");
  const tagAfter = tagTexture("Still held", "$200", "#ff5c7c");
  const tag = new T.Mesh(new T.PlaneGeometry(4.2, 2.46), new T.MeshBasicMaterial({ map: tagHeld, side: T.DoubleSide }));
  tag.position.set(W / 2 + 1.6, bodyTop + 1.6, D / 2 + 0.6);
  padlock.add(tag);

  // The AI scanner: a violet ring with a faint disc that sweeps the lock from top to bottom.
  const scanner = new T.Group();
  const ringMat = new T.MeshBasicMaterial({ color: C.nova, transparent: true });
  const discMat = new T.MeshBasicMaterial({ color: C.nova, transparent: true, opacity: 0.2, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending });
  {
    const ring = new T.Mesh(new T.TorusGeometry(6.6, 0.09, 8, 80), ringMat);
    const disc = new T.Mesh(new T.CircleGeometry(6.6, 64), discMat);
    ring.rotation.x = disc.rotation.x = Math.PI / 2;
    scanner.add(ring, disc);
  }
  padlock.add(scanner);

  // The lock is the giant of the scene, like the walking figure in Razorpay's world: big, and in view from far away.
  const PAD_SCALE = 1.35;
  const padBase = at(0.55, -21, -0.4);
  padlock.scale.setScalar(PAD_SCALE);
  padlock.position.copy(padBase);
  const roadNear = road.getPointAt(0.55);
  padlock.lookAt(roadNear.x, padBase.y, roadNear.z);
  const padYaw = padlock.rotation.y;
  scene.add(padlock);
  const padCenter = padBase.clone().addScaledVector(UP, bodyTop * 0.6 * PAD_SCALE);

  // ---------- the freelancer's pedestal and the coins ----------

  const pedestal = meshed(new T.BoxGeometry(5, 3.2, 5), C.paper, C.sky, boxGrid(5, 3.2, 5, 0.8));
  const pedBase = at(0.75, 10, 1.4);
  pedestal.group.position.copy(pedBase);
  scene.add(pedestal.group);
  const pedTop = pedBase.clone().addScaledVector(UP, 1.75);
  const pedSign = floatCard("Riya · freelancer", "PayPal", "#22e3a0");
  pedSign.position.copy(pedBase).addScaledVector(UP, 3.6);
  pedSign.lookAt(at(0.66, 0, pedSign.position.y - road.getPointAt(0.66).y));
  scene.add(pedSign);

  const coinGeo = new T.CylinderGeometry(1.25, 1.25, 0.3, 28);
  const coins = Array.from({ length: COINS }, () => {
    const c = meshed(coinGeo, C.sun, 0x9a6a00, new T.EdgesGeometry(coinGeo, 20));
    c.group.visible = false;
    scene.add(c.group);
    return c.group;
  });
  const passedSlices = RESULTS.map((ok, i) => (ok ? i : -1)).filter((i) => i >= 0);

  // ---------- the agent ----------

  const agent = new T.Group();
  {
    const ico = new T.IcosahedronGeometry(1.2, 1);
    agent.add(new T.Mesh(ico, new T.MeshBasicMaterial({ color: C.nova, transparent: true, opacity: 0.35 })));
    agent.add(new T.LineSegments(new T.EdgesGeometry(ico), lineMaterial(C.white)));
    const halo = new T.Mesh(new T.TorusGeometry(2, 0.05, 6, 64), new T.MeshBasicMaterial({ color: C.white }));
    halo.rotation.x = Math.PI / 2.4;
    agent.add(halo);
  }
  const agentBase = at(0.9, 0, 5.2);
  agent.position.copy(agentBase);
  agent.scale.setScalar(0.001);
  scene.add(agent);

  // ---------- floating cards and dust ----------

  const cards = [
    { mesh: floatCard("Spec hash", "2bdef7…", "#2448ff"), u: 0.16, side: -5, up: 6.5 },
    { mesh: floatCard("Confidence", "93%", "#a78bff"), u: 0.4, side: 4.5, up: 7.5 },
    { mesh: floatCard("Agent limit", "$1,000", "#22e3a0"), u: 0.85, side: -5, up: 7 },
  ].map((c) => {
    c.mesh.position.copy(at(c.u, c.side, c.up));
    c.mesh.lookAt(at(Math.max(0, c.u - 0.1), 0, c.up));
    scene.add(c.mesh);
    return { ...c, y: c.mesh.position.y };
  });

  const dust = (() => {
    const n = reduced ? 120 : 260;
    const pts: number[] = [];
    for (let i = 0; i < n; i++) {
      const p = at(Math.random(), (Math.random() - 0.5) * 50, 1 + Math.random() * 16);
      pts.push(p.x, p.y, p.z);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pts, 3));
    return new T.Points(g, new T.PointsMaterial({ color: C.white, size: 0.07, transparent: true, opacity: 0.7 }));
  })();
  scene.add(dust);

  // ---------- per-frame update ----------

  const white = new T.Color(C.white);
  const ice = new T.Color(C.ice);
  const body = new T.Color(C.body);
  const mint = new T.Color(C.mint);
  const flare = new T.Color(C.flare);
  const tmp = new T.Vector3();
  const look = new T.Vector3();
  const lookSmooth = new T.Vector3();
  let lookReady = false;
  const start = new T.Vector3();
  const ctrl = new T.Vector3();
  const end = new T.Vector3();

  return {
    frame(p, time, pointer, lift = 0) {
      const t = reduced ? 0 : time;
      const lockT = smooth(phase(p, PHASES.lock));
      const verT = phase(p, PHASES.verify);
      const agentT = smooth(phase(p, PHASES.agent));

      padlock.rotation.y = padYaw + Math.sin(t * 0.25) * 0.08;

      // The shackle starts open and drops shut as the client approves the hold.
      const open = 1 - lockT;
      shackle.position.y = bodyTop - 0.7 + open * 2.4;
      shackle.rotation.y = open * 1.15;

      // The scanner passes each slice; a slice takes its verdict as the ring goes by.
      const scanY = bodyTop + 0.6 - verT * (bodyTop + 1.2);
      scanner.position.y = scanY;
      scanner.visible = verT > 0 && verT < 1;
      ringMat.opacity = bell(verT, 0, 1) * 0.95 + 0.05;
      discMat.opacity = bell(verT, 0, 1) * 0.22;
      slices.forEach((s, i) => {
        const checked = clamp01((s.y + SH / 2 - scanY) / SH);
        s.fill.color.copy(body).lerp(RESULTS[i] ? mint : flare, checked);
        s.line.color.copy(white).lerp(ice, lockT * (1 - checked));
      });

      // Coins for the passed slices arc over the road to the freelancer and stack up.
      const flights = coinFlights(p);
      padlock.updateMatrixWorld();
      coins.forEach((coin, i) => {
        const f = flights[i];
        coin.visible = f > 0;
        if (!coin.visible) return;
        padlock.localToWorld(start.set(0, slices[passedSlices[i]].y, D / 2 + 0.6));
        end.copy(pedTop).addScaledVector(UP, 0.16 + i * 0.33);
        ctrl.copy(start).lerp(end, 0.5).addScaledVector(UP, 11);
        const e = smooth(f);
        const a = (1 - e) * (1 - e);
        const b = 2 * (1 - e) * e;
        const c = e * e;
        coin.position.set(a * start.x + b * ctrl.x + c * end.x, a * start.y + b * ctrl.y + c * end.y, a * start.z + b * ctrl.z + c * end.z);
        coin.rotation.set(f < 1 ? e * Math.PI * 4 : 0, 0, f < 1 ? Math.PI / 2.5 : 0);
        coin.scale.setScalar(Math.min(1, f * 6));
      });
      const landed = flights.every((f) => f >= 1);
      tag.material.map = landed ? tagAfter : tagHeld;
      tag.scale.setScalar(Math.max(0.001, lockT));

      agent.scale.setScalar(Math.max(0.001, agentT));
      agent.position.copy(agentBase).addScaledVector(UP, Math.sin(t * 1.1) * 0.35);
      agent.rotation.y = t * 0.6 + p * 6;

      cards.forEach((c, i) => {
        c.mesh.position.y = c.y + Math.sin(t * 0.9 + i * 2) * 0.25;
      });
      dust.rotation.y = Math.sin(t * 0.05) * 0.02;

      // Camera: ride the road, look a little up, and lean towards the lock while it is the story.
      const camU = 0.012 + p * 0.85;
      const side = sideAt(camU);
      // On arrival (lift 1) the camera hangs high above and behind the start of the road, drifting slowly,
      // and comes down onto the road as the hero scrolls away.
      const rise = smooth(lift);
      camera.position
        .copy(road.getPointAt(camU))
        .addScaledVector(UP, 2.1 + bell(p, 0, 1) * 1.6 + (reduced ? 0 : pointer.y * 0.35) + rise * 10)
        .addScaledVector(road.getTangentAt(camU), -rise * 16)
        .addScaledVector(side, (reduced ? 0 : pointer.x * 0.7) + rise * (reduced ? 0 : Math.sin(t * 0.25) * 2.5));
      look.copy(road.getPointAt(Math.min(1, camU + 0.07))).addScaledVector(UP, 3.6);
      // Aim above the world so it sits low in the frame, leaving the sky for the hero text.
      look.lerp(tmp.copy(padCenter).lerp(road.getPointAt(0.32), 0.45).addScaledVector(UP, 7), rise * 0.8);
      // A tall phone screen sees little to the sides, so it turns towards the current step's billboard,
      // except while coins fly, when the freelancer's pedestal matters more.
      const narrow = camera.aspect < 0.8;
      const paying = bell(p, 0.58, 0.82);
      if (narrow) look.lerp(boardCenters[stationAt(p)], 0.5 * (1 - paying));
      look.lerp(padCenter, bell(p, 0.12, 0.62) * 0.6);
      look.lerp(tmp.copy(pedTop).addScaledVector(UP, 1), paying * (narrow ? 0.65 : 0.35));
      // Glide between targets, so switching steps never snaps the view.
      if (!lookReady || reduced) lookSmooth.copy(look);
      else lookSmooth.lerp(look, 0.12);
      lookReady = true;
      camera.lookAt(lookSmooth);
      camera.rotateZ(Math.sin(p * Math.PI * 2) * 0.06);
      // The price tag always turns to the viewer, so the held amount stays readable.
      tag.lookAt(camera.position);

      renderer.render(scene, camera);
    },
    resize(width, height) {
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.8 ? 74 : 55;
      camera.updateProjectionMatrix();
    },
    dispose() {
      scene.traverse((o) => {
        const m = o as ThreeModule.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((mat) => mat.dispose());
      });
      textures.forEach((t) => t.dispose());
      renderer.dispose();
    },
  };
}
