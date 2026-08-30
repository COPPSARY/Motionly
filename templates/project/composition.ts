import {
  blurReveal,
  cameraPush,
  sceneHandoff,
  slide,
  staggerEntrance,
} from "../../src/composition/presets";
import type { CompositionDefinition } from "../../src/composition/types";

function requiredElement(root: ParentNode, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Missing composition element: ${selector}`);
  return element;
}

export const composition: CompositionDefinition = {
  id: "starter",
  title: "Connected product story",
  description: "Two overlapping scenes on one caller-owned GSAP timeline.",
  width: 1920,
  height: 1080,
  fps: 60,
  duration: 6,
  sourcePreview: "templates/project/composition.ts",
  scenes: [
    {
      id: "hero",
      label: "Promise",
      start: 0,
      duration: 3.5,
      accent: "#d8ff55",
    },
    { id: "proof", label: "Proof", start: 3, duration: 3, accent: "#8b6cff" },
  ],
  build({ root, timeline, register }) {
    root.innerHTML = `
      <style>
        .starter { position:absolute; inset:0; overflow:hidden; background:radial-gradient(circle at 80% 70%,#173c39,transparent 34%),radial-gradient(circle at 14% 18%,#35225e,transparent 30%),#070910; color:white; font-family:Inter,sans-serif; }
        .starter::before { position:absolute; inset:0; opacity:.2; background-image:linear-gradient(#ffffff10 1px,transparent 1px),linear-gradient(90deg,#ffffff10 1px,transparent 1px); background-size:52px 52px; content:''; }
        .starter-scene { position:absolute; inset:0; visibility:hidden; opacity:0; overflow:hidden; }
        .starter-hero { position:absolute; left:130px; top:230px; width:1180px; transform-origin:left center; }
        .starter-hero h1 { margin:0; font-size:132px; line-height:.9; letter-spacing:-.065em; }
        .starter-hero p { margin:32px 0 0; color:#aeb3bf; font-size:34px; }
        .starter-tags { display:flex; gap:16px; margin-top:46px; }
        .starter-tags span { padding:13px 20px; border:1px solid #ffffff22; border-radius:999px; background:#12131a; color:#d8ff55; }
        .proof-layout { position:absolute; inset:150px 120px 110px; display:grid; grid-template-columns:1fr 110px 1fr; gap:30px; align-items:center; }
        .proof-card { height:620px; overflow:hidden; border:1px solid #ffffff24; border-radius:28px; background:#0c0d13; box-shadow:0 50px 120px #000a; }
        .proof-card header { height:70px; display:flex; align-items:center; padding:0 28px; border-bottom:1px solid #ffffff16; color:#8f95a3; font:18px ui-monospace,monospace; }
        .proof-code { padding:48px; color:#abb1bf; font:25px/1.8 ui-monospace,monospace; }
        .proof-code b { color:#d8ff55; }.proof-code em { color:#72e4d1; font-style:normal; }
        .proof-route { height:2px; position:relative; background:linear-gradient(90deg,#8b6cff,#d8ff55); transform-origin:left; }
        .proof-route i { position:absolute; right:-2px; top:-6px; width:14px; height:14px; border-top:3px solid #d8ff55; border-right:3px solid #d8ff55; transform:rotate(45deg); }
        .proof-output { height:100%; display:grid; place-items:center; background:radial-gradient(circle at 70% 25%,#4b307e,transparent 40%),#12121a; }
        .proof-output h2 { margin:0; font-size:76px; line-height:.95; letter-spacing:-.055em; text-align:center; }.proof-output h2 span { display:block; color:#d8ff55; }
      </style>
      <div class="starter">
        <section class="starter-scene hero-scene">
          <div class="starter-hero"><h1>Build the moment.</h1><p>Semantic HTML. One timeline. Deliberate motion.</p><div class="starter-tags"><span>Scene</span><span>Component</span><span>GSAP</span></div></div>
        </section>
        <section class="starter-scene proof-scene">
          <div class="proof-layout"><article class="proof-card proof-source"><header>product-film.ts</header><div class="proof-code"><b>timeline</b>.add(<br>&nbsp;&nbsp;<em>productReveal</em>(),<br>&nbsp;&nbsp;2.4<br>);</div></article><div class="proof-route"><i></i></div><article class="proof-card proof-output"><h2>Code becomes<span>motion.</span></h2></article></div>
        </section>
      </div>`;

    const heroScene = register(
      "hero-scene",
      requiredElement(root, ".hero-scene"),
    );
    const proofScene = register(
      "proof-scene",
      requiredElement(root, ".proof-scene"),
    );
    const hero = register("hero", requiredElement(root, ".starter-hero"));
    const proof = register(
      "proof-output",
      requiredElement(root, ".proof-output"),
    );

    timeline.set([heroScene, proofScene], { autoAlpha: 0 }, 0);
    timeline.set(heroScene, { autoAlpha: 1 }, 0);
    blurReveal(timeline, hero, { duration: 0.72, at: 0.18 });
    staggerEntrance(timeline, root.querySelectorAll(".starter-tags span"), {
      duration: 0.5,
      stagger: 0.07,
      at: 0.62,
    });
    cameraPush(timeline, hero, { scale: 1.045, x: 20, duration: 1.1, at: 1.5 });
    timeline.to(
      hero,
      { x: -90, scale: 0.94, duration: 0.55, ease: "power3.in" },
      2.48,
    );
    sceneHandoff(timeline, heroScene, proofScene, {
      direction: "left",
      duration: 0.82,
      at: 2.68,
    });
    slide(timeline, requiredElement(root, ".proof-source"), {
      direction: "right",
      distance: 50,
      at: 2.82,
    });
    timeline.fromTo(
      root.querySelector(".proof-route"),
      { scaleX: 0 },
      { scaleX: 1, duration: 0.58, ease: "expo.inOut" },
      3.22,
    );
    slide(timeline, proof, { direction: "left", distance: 54, at: 3.38 });
    cameraPush(timeline, proof, { scale: 1.06, duration: 1.2, at: 4.42 });
  },
};
