import gsap from "gsap";
import {
  blurReveal,
  cameraPull,
  cameraPush,
  maskWipe,
  morph,
  rotateReveal,
  sceneHandoff,
  slide,
  staggerEntrance,
  staggerExit,
  textReveal,
} from "../composition/presets";
import {
  defineComposition,
  type CompositionContext,
} from "../composition/types";

const scenes = [
  {
    id: "brand",
    label: "Kinetic manifesto",
    start: 0,
    duration: 4.4,
    accent: "#d8ff55",
  },
  {
    id: "code",
    label: "Code becomes motion",
    start: 4.4,
    duration: 5.4,
    accent: "#8b6cff",
  },
  {
    id: "studio",
    label: "Motionly studio",
    start: 9.8,
    duration: 6.4,
    accent: "#ff705e",
  },
  {
    id: "lab",
    label: "Composition system",
    start: 16.2,
    duration: 5.5,
    accent: "#5eead4",
  },
  {
    id: "cta",
    label: "Make it move",
    start: 21.7,
    duration: 5.3,
    accent: "#d8ff55",
  },
] as const;

const filmCss = `
  .film { position:absolute; inset:0; overflow:hidden; color:#f7f5ef; background:#07070a; font-family:Inter,Arial,sans-serif; }
  .film * { box-sizing:border-box; }
  .film-bg { position:absolute; inset:-12%; background:radial-gradient(circle at 12% 18%,#33205d 0,transparent 28%),radial-gradient(circle at 86% 72%,#123f3d 0,transparent 27%),#07070a; }
  .film-grid { position:absolute; inset:0; opacity:.22; background-image:linear-gradient(#ffffff0b 1px,transparent 1px),linear-gradient(90deg,#ffffff0b 1px,transparent 1px); background-size:52px 52px; mask-image:linear-gradient(to bottom,transparent,#000 17%,#000 84%,transparent); }
  .noise { position:absolute; inset:0; opacity:.055; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.8'/%3E%3C/svg%3E"); pointer-events:none; }
  .transition-beam { position:absolute; z-index:12; top:-14%; bottom:-14%; left:32%; width:28%; opacity:0; pointer-events:none; transform:skewX(-13deg); background:linear-gradient(90deg,transparent,#8b6cff0b 25%,#e7e0ff55 50%,#d8ff5510 72%,transparent); mix-blend-mode:screen; filter:blur(2px); }
  .transition-beam i { position:absolute; left:50%; top:0; bottom:0; width:2px; background:linear-gradient(180deg,transparent,#efeaffcc,transparent); box-shadow:0 0 36px 8px #8b6cff66; }
  .film-progress { position:absolute; z-index:11; left:112px; right:112px; bottom:54px; height:1px; overflow:visible; background:#ffffff12; pointer-events:none; }
  .film-progress i { position:absolute; inset:0; transform-origin:left; background:linear-gradient(90deg,#8b6cff,#5eead4,#d8ff55); }
  .film-progress b { position:absolute; left:-5px; top:-5px; width:11px; height:11px; border:2px solid #d8ff55; border-radius:50%; background:#07070a; box-shadow:0 0 18px #d8ff5577; }
  .scene { position:absolute; inset:0; visibility:hidden; opacity:0; overflow:hidden; }
  .eyebrow { display:flex; align-items:center; gap:14px; color:#d8ff55; font-size:20px; font-weight:780; letter-spacing:.18em; text-transform:uppercase; }
  .eyebrow::before { width:38px; height:3px; border-radius:4px; background:currentColor; content:''; }
  .scene-index { position:absolute; left:112px; top:82px; z-index:8; }
  .corner-meta { position:absolute; right:110px; top:82px; color:#817f89; font:650 17px/1.4 ui-monospace,monospace; letter-spacing:.12em; text-align:right; }
  .manifesto { position:absolute; left:112px; top:210px; width:1040px; }
  .manifesto-line { height:142px; overflow:hidden; perspective:1000px; }
  .manifesto-line span { display:block; font-size:130px; line-height:1.03; font-weight:830; letter-spacing:-.062em; }
  .manifesto-line .outline { color:transparent; -webkit-text-stroke:2px #f7f5ef; }
  .manifesto-line .acid { color:#d8ff55; }
  .brand-note { position:absolute; left:122px; bottom:88px; width:580px; color:#aaa7b2; font-size:28px; line-height:1.38; }
  .brand-orbit { position:absolute; right:150px; top:190px; width:470px; height:470px; display:grid; place-items:center; }
  .orbit-ring { position:absolute; inset:0; border:1px solid #ffffff24; border-radius:50%; }
  .orbit-ring:nth-child(2) { inset:62px; border-color:#d8ff5555; }
  .orbit-ring:nth-child(3) { inset:124px; border-style:dashed; border-color:#8b6cff99; }
  .brand-orbit img { width:190px; height:190px; padding:28px; border:1px solid #ffffff2b; border-radius:46px; background:#0d0d12; box-shadow:0 40px 100px #000b,0 0 80px #8b6cff22; }
  .orbit-dot { position:absolute; width:22px; height:22px; border-radius:50%; background:#d8ff55; box-shadow:0 0 28px #d8ff55aa; }
  .orbit-dot.a { top:41px; left:92px; } .orbit-dot.b { right:28px; bottom:130px; background:#ff705e; box-shadow:0 0 28px #ff705e99; }
  .code-layout { position:absolute; inset:162px 108px 94px; display:grid; grid-template-columns:1fr 116px 1fr; gap:34px; align-items:center; }
  .code-card,.live-card { height:650px; border:1px solid #373442; border-radius:28px; background:#0c0c12e8; box-shadow:0 44px 110px #0009; overflow:hidden; }
  .window-bar { height:70px; display:flex; align-items:center; gap:9px; padding:0 24px; border-bottom:1px solid #292631; color:#858190; font:650 20px ui-monospace,monospace; }
  .window-bar i { width:11px; height:11px; border-radius:50%; background:#454050; }
  .window-bar strong { margin-left:9px; color:#bcb8c5; font-size:18px; }
  .code-body { position:relative; padding:52px 46px; font:540 26px/1.8 ui-monospace,monospace; color:#aaa5b5; }
  .code-line { position:relative; white-space:pre; }
  .code-line .kw { color:#ff8d7f; } .code-line .fn { color:#d8ff55; } .code-line .str { color:#77e8d5; } .code-line .num { color:#a98fff; }
  .code-cursor { position:absolute; left:34px; right:34px; top:91px; height:48px; border-left:3px solid #d8ff55; border-radius:4px; background:#d8ff5510; }
  .compile-rail { height:6px; position:relative; border-radius:99px; background:#2a2733; }
  .compile-rail span { position:absolute; left:0; top:0; bottom:0; width:0; border-radius:inherit; background:linear-gradient(90deg,#8b6cff,#d8ff55); }
  .compile-rail::after { position:absolute; right:-4px; top:50%; width:18px; height:18px; border-top:4px solid #d8ff55; border-right:4px solid #d8ff55; content:''; transform:translateY(-50%) rotate(45deg); }
  .live-card { padding:28px; background:linear-gradient(145deg,#11101a,#09090d); }
  .live-head { display:flex; justify-content:space-between; align-items:center; color:#aaa6b3; font-size:18px; }
  .live-dot { display:flex; align-items:center; gap:8px; color:#d8ff55; font-weight:750; letter-spacing:.12em; }
  .live-dot::before { width:8px; height:8px; border-radius:50%; background:#d8ff55; box-shadow:0 0 15px #d8ff55; content:''; }
  .visual-hero { margin-top:48px; height:250px; display:grid; place-items:center; border:1px solid #3b3746; border-radius:22px; background:radial-gradient(circle at 72% 30%,#482d78,transparent 40%),#14121c; overflow:hidden; }
  .visual-hero strong { font-size:64px; line-height:.95; letter-spacing:-.055em; text-align:center; }
  .visual-hero strong em { display:block; color:#d8ff55; font-style:normal; }
  .metric-row { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:16px; }
  .metric-tile { height:166px; display:flex; flex-direction:column; justify-content:space-between; padding:22px; border:1px solid #393543; border-radius:18px; background:#171520; }
  .metric-tile:nth-child(2) { background:#221b35; } .metric-tile:nth-child(3) { background:#172421; }
  .metric-tile b { font-size:43px; } .metric-tile span { color:#96919f; font-size:15px; font-weight:760; letter-spacing:.12em; }
  .studio-window { position:absolute; inset:112px 92px 90px; border:1px solid #3c3845; border-radius:28px; background:#0b0b10; box-shadow:0 60px 150px #000c; overflow:hidden; transform-origin:50% 54%; }
  .studio-top { height:68px; display:flex; align-items:center; gap:12px; padding:0 24px; border-bottom:1px solid #2b2831; background:#101016; }
  .studio-top img { width:35px; height:35px; } .studio-top b { font-size:20px; } .studio-top span { margin-left:auto; padding:8px 13px; border:1px solid #3a3642; border-radius:8px; color:#aaa6b2; font-size:14px; }
  .studio-body { height:calc(100% - 68px); display:grid; grid-template-columns:225px 1fr 250px; }
  .studio-side,.studio-props { padding:22px; background:#0e0e14; }
  .studio-side { border-right:1px solid #292630; } .studio-props { border-left:1px solid #292630; }
  .side-label { color:#8f8a99; font-size:14px; font-weight:780; letter-spacing:.13em; }
  .scene-thumb { height:105px; margin-top:15px; padding:16px; display:flex; align-items:flex-end; border:1px solid #383441; border-radius:15px; background:linear-gradient(145deg,#211b34,#15131d); font-size:14px; font-weight:720; }
  .studio-center { position:relative; overflow:hidden; background-image:linear-gradient(#ffffff09 1px,transparent 1px),linear-gradient(90deg,#ffffff09 1px,transparent 1px); background-size:44px 44px; }
  .artboard { position:absolute; inset:55px 70px 160px; border:1px solid #3c3745; border-radius:22px; background:radial-gradient(circle at 78% 24%,#4d2f80,transparent 38%),#121019; box-shadow:0 30px 85px #000b; overflow:hidden; }
  .artboard-copy { position:absolute; left:48px; top:60px; }
  .artboard-copy small { color:#d8ff55; font-size:17px; font-weight:780; letter-spacing:.14em; }
  .artboard-copy h3 { width:570px; margin:18px 0 0; font-size:62px; line-height:1; letter-spacing:-.05em; }
  .artboard-card { position:absolute; right:44px; bottom:40px; width:260px; height:150px; padding:22px; border:1px solid #ffffff30; border-radius:20px; background:#f7f5ef; color:#111016; transform:rotate(-4deg); }
  .artboard-card b { display:block; font-size:48px; } .artboard-card span { color:#55515e; font-size:15px; }
  .mini-timeline { position:absolute; left:36px; right:36px; bottom:36px; height:90px; padding:18px; border:1px solid #2e2b35; border-radius:14px; background:#0d0d13; }
  .mini-track { height:12px; margin:7px 0; border-radius:9px; background:linear-gradient(90deg,#8b6cff 0 36%,transparent 36% 41%,#d8ff55 41% 74%,transparent 74%); }
  .prop-field { height:42px; margin-top:14px; border:1px solid #34313b; border-radius:9px; background:#17151e; }
  .prop-field.hot { border-color:#ff705e99; background:#30201f; }
  .lab-stage { position:absolute; inset:136px 95px 84px; perspective:1200px; }
  .lab-copy { position:absolute; left:18px; top:20px; z-index:5; }
  .lab-copy h2 { margin:18px 0 0; font-size:96px; line-height:.92; letter-spacing:-.06em; }
  .lab-copy h2 span { display:block; } .lab-copy h2 .aqua { color:#5eead4; }
  .signal-card { position:absolute; right:40px; top:8px; width:630px; height:300px; padding:28px; border:1px solid #403b49; border-radius:28px; background:#111018dd; transform:rotateY(-8deg) rotateX(3deg); box-shadow:0 45px 100px #0009; }
  .signal-card header { display:flex; justify-content:space-between; color:#aaa6b3; font-size:16px; } .signal-card header b { color:#d8ff55; }
  .signal { width:100%; height:190px; margin-top:24px; overflow:visible; }
  .signal path { fill:none; stroke:#5eead4; stroke-width:5; stroke-linecap:round; filter:drop-shadow(0 0 10px #5eead466); }
  .floating-card { position:absolute; width:310px; height:190px; padding:24px; border:1px solid #403b48; border-radius:22px; background:#16141e; box-shadow:0 35px 90px #0008; }
  .floating-card b { display:block; font-size:48px; } .floating-card span { color:#9893a2; font-size:16px; }
  .floating-card.a { left:40px; bottom:20px; } .floating-card.b { left:385px; bottom:70px; background:#2a1d34; } .floating-card.c { right:54px; bottom:18px; background:#152522; }
  .export-dock { position:absolute; right:20px; top:356px; width:420px; padding:24px; border:1px solid #50495a; border-radius:22px; background:#0d0d13f2; box-shadow:0 35px 90px #000a; }
  .export-dock h3 { margin:0; font-size:23px; } .export-progress { height:8px; margin:24px 0 12px; border-radius:99px; background:#292632; overflow:hidden; } .export-progress i { display:block; width:0; height:100%; background:linear-gradient(90deg,#8b6cff,#5eead4,#d8ff55); }
  .export-facts { display:flex; justify-content:space-between; color:#85808e; font-size:14px; }
  .final-wrap { position:absolute; inset:0; display:grid; grid-template-columns:1.12fr .88fr; align-items:center; padding:0 130px; }
  .final-copy h2 { margin:0; font-size:126px; line-height:.88; letter-spacing:-.065em; }
  .final-copy h2 span { display:block; } .final-copy h2 .acid { color:#d8ff55; }
  .final-copy p { margin:34px 0 0; color:#aaa6b3; font-size:28px; }
  .final-cta { display:inline-flex; align-items:center; gap:22px; margin-top:42px; padding:20px 28px; border-radius:12px; background:#f7f5ef; color:#111016; font-size:18px; font-weight:820; letter-spacing:.08em; box-shadow:0 25px 70px #0008; }
  .final-cta i { width:42px; height:2px; position:relative; background:#111016; } .final-cta i::after { position:absolute; right:0; top:-5px; width:10px; height:10px; border-top:2px solid; border-right:2px solid; content:''; transform:rotate(45deg); }
  .final-product { position:relative; width:560px; height:560px; justify-self:end; display:grid; place-items:center; }
  .final-product::before,.final-product::after { position:absolute; border:1px solid #ffffff20; border-radius:50%; content:''; } .final-product::before { inset:0; } .final-product::after { inset:75px; border-color:#d8ff5555; }
  .final-product img { width:190px; height:190px; z-index:2; padding:28px; border:1px solid #ffffff2b; border-radius:46px; background:#0d0d12; box-shadow:0 40px 100px #000b,0 0 90px #d8ff5520; }
  .final-chip { position:absolute; padding:13px 18px; border:1px solid #403b49; border-radius:999px; background:#121118; color:#aaa6b3; font-size:15px; font-weight:720; } .final-chip.a { left:4px; top:180px; } .final-chip.b { right:0; top:125px; color:#d8ff55; } .final-chip.c { right:24px; bottom:116px; color:#5eead4; }
`;

function registerAll(context: CompositionContext): void {
  context.root
    .querySelectorAll<HTMLElement>("[data-edit]")
    .forEach((element) => {
      const id = element.dataset["edit"];
      if (id) context.register(id, element);
    });
}

function buildMarkup(root: HTMLElement): void {
  root.innerHTML = `
    <style>${filmCss}</style>
    <div class="film">
      <div class="film-bg" data-edit="film-camera"></div><div class="film-grid"></div><div class="noise"></div><div class="transition-beam"><i></i></div><div class="film-progress"><i></i><b></b></div>

      <section class="scene brand-scene" data-edit="brand">
        <div class="scene-index eyebrow" data-edit="brand-index">Motionly / New workflow</div><div class="corner-meta">CODE-FIRST<br>COMPOSITION 01</div>
        <div class="manifesto" data-edit="manifesto">
          <div class="manifesto-line"><span data-edit="manifesto-design">DESIGN</span></div><div class="manifesto-line"><span class="outline" data-edit="manifesto-motion">MOTION</span></div><div class="manifesto-line"><span class="acid" data-edit="manifesto-code">IN CODE.</span></div>
        </div>
        <p class="brand-note" data-edit="brand-note">Semantic HTML and SVG, directed by a timeline built for serious motion.</p>
        <div class="brand-orbit" data-edit="brand-orbit"><i class="orbit-ring"></i><i class="orbit-ring"></i><i class="orbit-ring"></i><i class="orbit-dot a"></i><i class="orbit-dot b"></i><img src="/logo.svg" alt="Motionly"></div>
      </section>

      <section class="scene code-scene" data-edit="code">
        <div class="scene-index eyebrow" data-edit="code-index">Code becomes canvas</div><div class="corner-meta">TYPESCRIPT + GSAP<br>COMPOSITION 02</div>
        <div class="code-layout">
          <article class="code-card" data-edit="code-card"><div class="window-bar"><i></i><i></i><i></i><strong>product-film.tsx</strong></div><div class="code-body"><div class="code-cursor"></div><div class="code-line"><span class="kw">const</span> scene = <span class="fn">compose</span>({</div><div class="code-line">  title: <span class="str">'Launch faster'</span>,</div><div class="code-line">  entrance: <span class="str">'stagger'</span>,</div><div class="code-line">  duration: <span class="num">0.64</span></div><div class="code-line">});</div><div class="code-line"></div><div class="code-line">timeline.<span class="fn">add</span>(scene, <span class="num">1.2</span>);</div></div></article>
          <div class="compile-rail" data-edit="compile-rail"><span></span></div>
          <article class="live-card" data-edit="live-card"><div class="live-head"><b>LIVE OUTPUT</b><span class="live-dot">SYNCED</span></div><div class="visual-hero" data-edit="visual-hero"><strong><span data-edit="visual-title">Launch</span><em data-edit="visual-subtitle">with rhythm.</em></strong></div><div class="metric-row"><div class="metric-tile" data-edit="metric-fps"><b>60</b><span>FPS PREVIEW</span></div><div class="metric-tile" data-edit="metric-timeline"><b>GSAP</b><span>ONE TIMELINE</span></div><div class="metric-tile" data-edit="metric-dom"><b>DOM</b><span>HTML / SVG</span></div></div></article>
        </div>
      </section>

      <section class="scene studio-scene" data-edit="studio">
        <div class="scene-index eyebrow" data-edit="studio-index">Direct the whole composition</div>
        <article class="studio-window" data-edit="studio-window"><div class="studio-top"><img src="/logo.svg" alt=""><b>Motionly</b><span>product-film.ts</span><span>Preview 60 FPS</span></div><div class="studio-body"><aside class="studio-side"><div class="side-label">SCENES</div><div class="scene-thumb" data-edit="scene-thumb-1">01 / Manifesto</div><div class="scene-thumb" data-edit="scene-thumb-2">02 / Product</div><div class="scene-thumb" data-edit="scene-thumb-3">03 / Finish</div></aside><main class="studio-center"><div class="artboard" data-edit="artboard"><div class="artboard-copy"><small>BUILD THE MOMENT</small><h3 data-edit="artboard-headline">Professional motion, without leaving code.</h3></div><div class="artboard-card" data-edit="artboard-card"><b>27s</b><span>Product film</span></div></div><div class="mini-timeline" data-edit="mini-timeline"><div class="mini-track"></div><div class="mini-track"></div><div class="mini-track"></div></div></main><aside class="studio-props"><div class="side-label">PROPERTIES</div><div class="prop-field"></div><div class="prop-field"></div><div class="prop-field hot"></div><div class="prop-field"></div><div class="prop-field"></div></aside></div></article>
      </section>

      <section class="scene lab-scene" data-edit="lab">
        <div class="scene-index eyebrow" data-edit="lab-index">Every layer stays alive</div><div class="corner-meta">NESTED TIMELINES<br>COMPOSITION 04</div>
        <div class="lab-stage" data-edit="lab-stage"><div class="lab-copy"><span class="eyebrow">ONE SOURCE</span><h2><span data-edit="lab-one">ONE</span><span class="aqua" data-edit="lab-timeline">TIMELINE.</span></h2></div><article class="signal-card" data-edit="signal-card"><header><span>MOTION CURVE / CAMERA</span><b>POWER3.INOUT</b></header><svg class="signal" viewBox="0 0 580 190"><path data-edit="signal-path" d="M8 154 C94 154 88 36 178 36 S264 154 350 154 S438 60 572 60" /></svg></article><article class="floating-card a" data-edit="layer-type"><b>TYPE</b><span>Character-level control</span></article><article class="floating-card b" data-edit="layer-layout"><b>LAYOUT</b><span>Shared transforms</span></article><article class="floating-card c" data-edit="layer-camera"><b>CAMERA</b><span>Push · pull · pan</span></article><aside class="export-dock" data-edit="export-dock"><h3>Rendering product-film.webm</h3><div class="export-progress"><i></i></div><div class="export-facts"><span>1920 × 1080</span><span>60 FPS</span><span>00:27</span></div></aside></div>
      </section>

      <section class="scene cta-scene" data-edit="cta">
        <div class="final-wrap"><div class="final-copy"><div class="eyebrow" data-edit="final-index">Motionly</div><h2 data-edit="final-title"><span data-edit="final-line-one">MAKE IT</span><span class="acid" data-edit="final-line-two">MOVE.</span></h2><p data-edit="final-subtitle">Code-first motion graphics for product teams.</p><div class="final-cta" data-edit="final-cta"><span data-edit="final-cta-label">START CREATING</span><i></i></div></div><div class="final-product" data-edit="final-product"><span class="final-chip a">HTML / SVG</span><span class="final-chip b">GSAP TIMELINE</span><span class="final-chip c">FRAME ACCURATE</span><img src="/logo.svg" alt="Motionly"></div></div>
      </section>
    </div>`;
}

function scene(context: CompositionContext, id: string): HTMLElement {
  const element = context.root.querySelector<HTMLElement>(
    `[data-edit="${id}"]`,
  );
  if (!element) throw new Error(`Missing composition element: ${id}`);
  return element;
}

function buildDemo(context: CompositionContext): void {
  buildMarkup(context.root);
  registerAll(context);
  const { root, timeline } = context;
  const brand = scene(context, "brand");
  const code = scene(context, "code");
  const studio = scene(context, "studio");
  const lab = scene(context, "lab");
  const cta = scene(context, "cta");
  timeline.set([brand, code, studio, lab, cta], { autoAlpha: 0 }, 0);
  timeline.set(brand, { autoAlpha: 1 }, 0);
  timeline.to(
    root.querySelector(".film-bg"),
    { x: -66, y: 34, scale: 1.08, duration: 27, ease: "none" },
    0,
  );
  timeline.to(
    root.querySelector(".film-grid"),
    { backgroundPosition: "52px 26px", duration: 27, ease: "none" },
    0,
  );
  timeline.fromTo(
    root.querySelector(".film-progress i"),
    { scaleX: 0 },
    { scaleX: 1, duration: 27, ease: "none" },
    0,
  );
  timeline.to(
    root.querySelector(".film-progress b"),
    { x: 1685, duration: 27, ease: "none" },
    0,
  );

  const transitionSweep = (at: number, reverse = false): void => {
    timeline
      .fromTo(
        root.querySelector(".transition-beam"),
        { xPercent: reverse ? 125 : -125, autoAlpha: 0 },
        {
          xPercent: reverse ? -125 : 125,
          autoAlpha: 0.82,
          duration: 0.78,
          ease: "power3.inOut",
        },
        at,
      )
      .to(
        root.querySelector(".transition-beam"),
        { autoAlpha: 0, duration: 0.16, ease: "power2.in" },
        at + 0.62,
      );
  };

  const brandTl = gsap.timeline();
  slide(brandTl, scene(context, "brand-index"), {
    direction: "right",
    distance: 36,
    duration: 0.52,
    at: 0.08,
  });
  brandTl.from(
    root.querySelector(".brand-scene .corner-meta"),
    { y: -18, opacity: 0, duration: 0.5, ease: "power3.out" },
    0.18,
  );
  brandTl.fromTo(
    root.querySelectorAll(".manifesto-line span"),
    { yPercent: 118, rotateX: -18 },
    {
      yPercent: 0,
      rotateX: 0,
      duration: 0.76,
      stagger: 0.11,
      ease: "power4.out",
    },
    0.28,
  );
  rotateReveal(brandTl, scene(context, "brand-orbit"), {
    duration: 0.85,
    at: 0.48,
  });
  brandTl.from(
    root.querySelectorAll(".orbit-ring"),
    { scale: 0.6, opacity: 0, duration: 0.8, stagger: 0.09, ease: "expo.out" },
    0.68,
  );
  brandTl.from(
    root.querySelectorAll(".orbit-dot"),
    { scale: 0, duration: 0.48, stagger: 0.1, ease: "back.out(1.6)" },
    1.02,
  );
  blurReveal(brandTl, scene(context, "brand-note"), {
    duration: 0.62,
    at: 1.22,
  });
  brandTl.to(
    root.querySelectorAll(".orbit-ring"),
    { rotation: 16, duration: 2.4, ease: "none", stagger: 0.12 },
    1.2,
  );
  cameraPush(brandTl, scene(context, "manifesto"), {
    scale: 1.035,
    x: 18,
    duration: 1.2,
    at: 2.55,
  });
  staggerExit(brandTl, root.querySelectorAll(".manifesto-line span"), {
    distance: 54,
    duration: 0.42,
    stagger: 0.045,
    at: 3.42,
  });
  brandTl.to(
    [scene(context, "brand-note"), scene(context, "brand-orbit")],
    { x: -76, opacity: 0, duration: 0.52, stagger: 0.04, ease: "power3.in" },
    3.5,
  );
  timeline.add(brandTl, 0);

  sceneHandoff(timeline, brand, code, {
    at: 3.82,
    direction: "left",
    duration: 0.82,
  });
  transitionSweep(3.68);
  const codeTl = gsap.timeline();
  slide(codeTl, scene(context, "code-index"), {
    direction: "right",
    distance: 36,
    at: 0.05,
  });
  codeTl.from(
    root.querySelector(".code-scene .corner-meta"),
    { y: -18, opacity: 0, duration: 0.5, ease: "power3.out" },
    0.16,
  );
  maskWipe(codeTl, scene(context, "code-card"), {
    direction: "right",
    duration: 0.72,
    at: 0.18,
  });
  codeTl.from(
    root.querySelectorAll(".code-line"),
    { y: 20, opacity: 0, duration: 0.42, stagger: 0.075, ease: "power3.out" },
    0.52,
  );
  codeTl.to(
    root.querySelector(".code-cursor"),
    { y: 278, duration: 1.45, ease: "power2.inOut" },
    0.72,
  );
  codeTl.to(
    root.querySelector(".compile-rail span"),
    { width: "100%", duration: 0.9, ease: "expo.inOut" },
    1.25,
  );
  rotateReveal(codeTl, scene(context, "live-card"), {
    duration: 0.72,
    at: 1.62,
  });
  maskWipe(codeTl, scene(context, "visual-hero"), {
    direction: "up",
    duration: 0.66,
    at: 1.92,
  });
  staggerEntrance(codeTl, root.querySelectorAll(".metric-tile"), {
    distance: 45,
    duration: 0.56,
    stagger: 0.085,
    at: 2.25,
  });
  codeTl.to(
    root.querySelector(".visual-hero strong"),
    { scale: 1.05, duration: 1.2, ease: "power2.inOut" },
    3.15,
  );
  codeTl.to(
    root.querySelector(".code-layout"),
    { scale: 1.035, x: -26, duration: 1.05, ease: "power3.inOut" },
    3.28,
  );
  codeTl.to(
    scene(context, "live-card"),
    { x: -40, scale: 1.06, duration: 0.85, ease: "power3.inOut" },
    4.35,
  );
  codeTl
    .to(
      [
        scene(context, "code-index"),
        root.querySelector(".code-scene .corner-meta"),
      ],
      { y: -24, opacity: 0, duration: 0.36, stagger: 0.04, ease: "power3.in" },
      4.62,
    )
    .to(
      scene(context, "code-card"),
      { x: -130, scale: 0.95, duration: 0.58, ease: "power3.in" },
      4.68,
    )
    .to(
      scene(context, "live-card"),
      { x: -190, scale: 1.16, duration: 0.66, ease: "power3.inOut" },
      4.7,
    );
  timeline.add(codeTl, 4.02);

  sceneHandoff(timeline, code, studio, {
    at: 9.18,
    direction: "up",
    duration: 0.82,
  });
  const studioTl = gsap.timeline();
  slide(studioTl, scene(context, "studio-index"), {
    direction: "right",
    distance: 36,
    at: 0.04,
  });
  studioTl.fromTo(
    scene(context, "studio-window"),
    { clipPath: "inset(48% 8% 48% 8% round 28px)", scale: 0.94 },
    {
      clipPath: "inset(0% 0% 0% 0% round 28px)",
      scale: 1,
      duration: 0.88,
      ease: "expo.inOut",
    },
    0.18,
  );
  staggerEntrance(studioTl, root.querySelectorAll(".scene-thumb"), {
    distance: 32,
    duration: 0.52,
    stagger: 0.08,
    at: 0.62,
  });
  blurReveal(studioTl, scene(context, "artboard"), { duration: 0.7, at: 0.72 });
  textReveal(
    studioTl,
    root.querySelector<HTMLElement>(".artboard-copy h3") ??
      scene(context, "artboard"),
    { unit: "words", duration: 0.55, stagger: 0.04, at: 0.94 },
  );
  rotateReveal(studioTl, scene(context, "artboard-card"), {
    duration: 0.68,
    at: 1.08,
  });
  studioTl.from(
    root.querySelectorAll(".prop-field"),
    { x: 30, opacity: 0, duration: 0.42, stagger: 0.06, ease: "power3.out" },
    1.02,
  );
  maskWipe(studioTl, scene(context, "mini-timeline"), {
    direction: "right",
    duration: 0.72,
    at: 1.38,
  });
  studioTl.fromTo(
    root.querySelectorAll(".mini-track"),
    { scaleX: 0, transformOrigin: "left" },
    { scaleX: 1, duration: 0.72, stagger: 0.08, ease: "expo.out" },
    1.62,
  );
  studioTl
    .to(
      root.querySelectorAll(".scene-thumb"),
      {
        backgroundColor: (index) =>
          ["#211b34", "#30201f", "#172421"][index] ?? "#211b34",
        borderColor: (index) =>
          ["#514569", "#ff705e99", "#3f6d61"][index] ?? "#514569",
        duration: 0.42,
        stagger: 0.34,
        ease: "power2.inOut",
      },
      2.0,
    )
    .to(
      root.querySelector(".prop-field.hot"),
      {
        x: -6,
        boxShadow: "0 0 24px #ff705e33",
        duration: 0.34,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
      },
      2.28,
    );
  cameraPush(studioTl, scene(context, "studio-window"), {
    scale: 1.2,
    x: -82,
    y: 20,
    duration: 1.35,
    at: 2.35,
  });
  morph(
    studioTl,
    scene(context, "artboard-card"),
    { rotation: 3, x: -36, y: -24 },
    { duration: 0.9, at: 3.42 },
  );
  cameraPull(studioTl, scene(context, "studio-window"), {
    scale: 1.1,
    x: 72,
    y: -14,
    duration: 1.25,
    at: 4.05,
  });
  studioTl
    .to(
      scene(context, "studio-index"),
      { x: -48, opacity: 0, duration: 0.38, ease: "power3.in" },
      5.34,
    )
    .to(
      scene(context, "studio-window"),
      { x: -180, scale: 1.22, duration: 0.72, ease: "power3.inOut" },
      5.34,
    );
  timeline.add(studioTl, 9.38);

  sceneHandoff(timeline, studio, lab, {
    at: 15.48,
    direction: "left",
    duration: 0.84,
  });
  transitionSweep(15.36, true);
  const labTl = gsap.timeline();
  slide(labTl, scene(context, "lab-index"), {
    direction: "right",
    distance: 36,
    at: 0.05,
  });
  labTl.from(
    root.querySelector(".lab-scene .corner-meta"),
    { y: -18, opacity: 0, duration: 0.5, ease: "power3.out" },
    0.16,
  );
  root
    .querySelectorAll<HTMLElement>(".lab-copy h2 span")
    .forEach((line, index) => {
      textReveal(labTl, line, {
        unit: "chars",
        duration: 0.58,
        stagger: 0.025,
        at: 0.18 + index * 0.12,
      });
    });
  rotateReveal(labTl, scene(context, "signal-card"), {
    duration: 0.78,
    at: 0.4,
  });
  const signalPath = scene(context, "signal-path") as unknown as SVGPathElement;
  const length =
    typeof signalPath.getTotalLength === "function"
      ? signalPath.getTotalLength()
      : 720;
  labTl
    .set(signalPath, { strokeDasharray: length, strokeDashoffset: length }, 0.5)
    .to(
      signalPath,
      { strokeDashoffset: 0, duration: 1.45, ease: "power2.inOut" },
      0.62,
    );
  staggerEntrance(labTl, root.querySelectorAll(".floating-card"), {
    distance: 70,
    duration: 0.66,
    stagger: 0.1,
    at: 1.12,
  });
  slide(labTl, scene(context, "export-dock"), {
    direction: "left",
    distance: 60,
    duration: 0.68,
    at: 1.8,
  });
  labTl.to(
    root.querySelector(".export-progress i"),
    { width: "100%", duration: 2.1, ease: "power2.inOut" },
    2.05,
  );
  labTl.to(
    scene(context, "lab-stage"),
    { x: -74, scale: 1.06, duration: 1.4, ease: "power3.inOut" },
    2.08,
  );
  labTl.to(
    root.querySelectorAll(".floating-card"),
    {
      y: (index) => [-24, 18, -14][index] ?? 0,
      rotation: (index) => [-2, 2, -1][index] ?? 0,
      duration: 1.25,
      stagger: 0.06,
      ease: "power2.inOut",
    },
    3.18,
  );
  labTl
    .to(
      scene(context, "signal-card"),
      { x: -54, y: 22, scale: 1.08, duration: 0.82, ease: "power3.inOut" },
      3.1,
    )
    .to(
      [
        root.querySelector(".lab-copy"),
        root.querySelector(".lab-scene .corner-meta"),
      ],
      { x: -64, opacity: 0, duration: 0.42, stagger: 0.04, ease: "power3.in" },
      4.62,
    )
    .to(
      root.querySelectorAll(".floating-card"),
      {
        x: (index) => [-100, -20, 110][index] ?? 0,
        y: (index) => [80, 130, 70][index] ?? 0,
        scale: 0.88,
        duration: 0.62,
        stagger: 0.04,
        ease: "power3.inOut",
      },
      4.58,
    );
  timeline.add(labTl, 15.68);

  sceneHandoff(timeline, lab, cta, {
    at: 20.96,
    direction: "up",
    duration: 0.86,
  });
  transitionSweep(20.84);
  const ctaTl = gsap.timeline();
  slide(ctaTl, scene(context, "final-index"), {
    direction: "right",
    distance: 36,
    at: 0.08,
  });
  root
    .querySelectorAll<HTMLElement>(".final-copy h2 span")
    .forEach((line, index) => {
      textReveal(ctaTl, line, {
        unit: "chars",
        duration: 0.66,
        stagger: 0.035,
        at: 0.22 + index * 0.14,
      });
    });
  blurReveal(ctaTl, scene(context, "final-subtitle"), {
    duration: 0.62,
    at: 0.9,
  });
  slide(ctaTl, scene(context, "final-cta"), {
    direction: "up",
    distance: 34,
    duration: 0.58,
    at: 1.2,
  });
  rotateReveal(ctaTl, scene(context, "final-product"), {
    duration: 0.86,
    at: 0.42,
  });
  staggerEntrance(ctaTl, root.querySelectorAll(".final-chip"), {
    distance: 28,
    duration: 0.52,
    stagger: 0.09,
    at: 1.18,
  });
  ctaTl.to(
    root.querySelectorAll(".final-chip"),
    {
      rotation: (index) => [-2, 2, -1][index] ?? 0,
      duration: 1.4,
      stagger: 0.06,
      ease: "power2.inOut",
    },
    1.5,
  );
  ctaTl.to(
    scene(context, "final-product"),
    { scale: 1.035, duration: 1.7, ease: "sine.inOut" },
    2.6,
  );
  ctaTl.to(
    scene(context, "final-cta"),
    {
      x: 10,
      boxShadow: "0 30px 80px #d8ff5526",
      duration: 0.7,
      ease: "power2.inOut",
    },
    3.55,
  );
  timeline.add(ctaTl, 21.12);
}

export const demoComposition = defineComposition({
  id: "motionly-product-promo",
  title: "Motionly — Make it move",
  description:
    "A 27-second kinetic product film authored directly with HTML, SVG, and nested GSAP timelines.",
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 27,
  scenes,
  sourcePreview: `import gsap from 'gsap';
import { defineComposition } from '../composition/types';
import { textReveal, staggerEntrance, cameraPush } from '../composition/presets';

export const composition = defineComposition({
  id: 'motionly-product-promo',
  width: 1920,
  height: 1080,
  fps: 60,
  scenes: [manifesto, codeToCanvas, studio, compositionLab, finalCta],
  build: ({ root, timeline }) => {
    const intro = gsap.timeline();
    textReveal(intro, root.querySelector('.manifesto'), { unit: 'chars' });
    staggerEntrance(intro, root.querySelectorAll('.metric'), { stagger: 0.08 });
    cameraPush(intro, root.querySelector('.studio'), { scale: 1.17, at: 3.1 });
    timeline.add(intro, 0);
  },
});`,
  build: buildDemo,
});
