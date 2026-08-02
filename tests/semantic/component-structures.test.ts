import { describe, expect, it } from 'vitest';
import { evaluateScene } from '../../src/animation/evaluator';
import { parseMotion } from '../../src/language/parser';
import { serializeProgram } from '../../src/language/serializer';
import { buildSceneGraph } from '../../src/scene/scene-graph';

const childIds = (source: string, component: string) =>
  buildSceneGraph(parseMotion(source)).components.find((item) => item.id === component)!
    .childElementIds;

describe('structured semantic components', () => {
  it('compiles a dashboard into a structured interface, not one rectangle', () => {
    const source = `
      canvas { duration 8s }
      component metrics {
        type dashboard
        role main
        label "Overview"
        values "$84.9k  12,480  99.98%"
        labels "Revenue  Users  Uptime"
        x 0
        y 0
        width 560
      }
    `;
    const ids = childIds(source, 'metrics');
    expect(ids).toContain('metrics__frame');
    expect(ids).toContain('metrics__card0');
    expect(ids).toContain('metrics__card2');
    expect(ids).toContain('metrics__value0');
    expect(ids).toContain('metrics__caption2');
    expect(ids).toContain('metrics__chartline');
    const scene = buildSceneGraph(parseMotion(source));
    const value = scene.elements.find((element) => element.id === 'metrics__value0')!;
    expect(value.properties.value).toBe('$84.9k');
    const caption = scene.elements.find((element) => element.id === 'metrics__caption1')!;
    expect(caption.properties.value).toBe('Users');
    // Cards stagger after the frame; labels land with their cards.
    const frameEntrance = scene.animations.find(
      (animation) => animation.target === 'metrics__frame'
    )!;
    const card2Entrance = scene.animations.find(
      (animation) => animation.target === 'metrics__card2'
    )!;
    expect(card2Entrance.delay).toBeGreaterThan(frameEntrance.delay);
  });

  it('gives component roots their real bounds for selection and transitions', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 4s }
        component login {
          type form
          width 460
        }
      `)
    );
    const root = scene.elements.find((element) => element.id === 'login')!;
    expect(root.properties.width).toBe(460);
    expect(root.properties.height).toBe(520);
  });

  it('gives buttons a surface, a label, and a click compression', () => {
    const source = `
      canvas { duration 6s }
      component cta {
        type button
        label "Start free"
        clickAt 2s
        color #D97757
        accent #FFB380
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const label = scene.elements.find((element) => element.id === 'cta__label')!;
    expect(label.properties.value).toBe('Start free');
    const compression = scene.animations.find(
      (animation) => animation.target === 'cta' && animation.keyframes.length > 0
    )!;
    expect(compression.delay).toBeCloseTo(2);
    const scales = compression.keyframes.map((frame) => Number(frame.properties['scale']));
    expect(Math.min(...scales)).toBeLessThan(1);
  });

  it('moves a cursor to its clicked control and compresses the target', () => {
    const source = `
      canvas { duration 8s }
      component cta {
        type button
        label "Deploy"
        x 120
        y 40
      }
      component pointer {
        type cursor
        clicks cta
        clickAt 3s
      }
      component toast {
        type notification
        reactsTo cta
        label "Deployed"
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const move = scene.animations.find(
      (animation) => animation.target === 'pointer' && animation.from['x'] !== undefined
    )!;
    expect(move.delay + move.duration).toBeCloseTo(3, 1);
    expect(Number(move.to['x'])).toBeGreaterThan(120);
    const compression = scene.animations.find(
      (animation) => animation.target === 'cta' && animation.keyframes.length > 0
    )!;
    expect(compression.delay).toBeCloseTo(3);
    expect(
      evaluateScene(scene, 1).elements.find((element) => element.id === 'pointer__ripple')!.render
        .opacity
    ).toBe(0);
    expect(
      evaluateScene(scene, 1).elements.find((element) => element.id === 'cta__ripple')!.render
        .opacity
    ).toBe(0);
    // The notification enters as a consequence of the click.
    const toastEntrance = scene.animations.find((animation) => animation.target === 'toast')!;
    expect(toastEntrance.delay).toBeGreaterThan(3);
    expect(toastEntrance.delay).toBeLessThan(4);
  });

  it('keeps every structured child hidden before the component delay', () => {
    const source = `
      canvas { duration 10s }
      component metrics {
        type dashboard
        delay 3s
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const frame = evaluateScene(scene, 1.5);
    const structured = frame.elements.filter((element) => element.id.startsWith('metrics__'));
    expect(structured.length).toBeGreaterThan(5);
    for (const element of structured) {
      expect(Number(element.render.opacity ?? 1)).toBe(0);
    }
    const later = evaluateScene(scene, 6);
    const visible = later.elements.filter(
      (element) => element.id.startsWith('metrics__') && Number(element.render.opacity ?? 0) > 0.5
    );
    expect(visible.length).toBeGreaterThan(5);
  });

  it('snaps component opacity on the first frame instead of fading arrivals', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 6s fps 60 }
        component login {
          type form
          delay 1s
        }
      `)
    );
    const entrance = scene.animations.find(
      (animation) => animation.target === 'login__panel' && animation.from['y'] !== undefined
    )!;
    expect(
      evaluateScene(scene, entrance.delay).elements.find(
        (element) => element.id === 'login__panel'
      )!.render.opacity
    ).toBe(0);
    expect(
      evaluateScene(scene, entrance.delay + 1 / 60).elements.find(
        (element) => element.id === 'login__panel'
      )!.render.opacity
    ).toBe(1);
  });

  it('hides connectors while their endpoints are outside scene windows', () => {
    const source = `
      canvas { duration 12s }
      scene later {
        start 5s
        duration 5s
      }
      component api {
        type server
        parent later
        x -300
        connects store
      }
      component store {
        type database
        parent later
        x 300
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const connectorId = scene.relationships[0]!.connectorElementId;
    const early = evaluateScene(scene, 2).elements.find((element) => element.id === connectorId);
    expect(Number(early?.render.opacity ?? 0)).toBe(0);
    const active = evaluateScene(scene, 8).elements.find((element) => element.id === connectorId);
    expect(Number(active?.render.opacity)).toBeGreaterThan(0);
  });

  it('builds terminals, pricing cards, and laptops as structured artwork', () => {
    const source = `
      canvas { duration 8s }
      component agent {
        type terminal
        label "claude"
        detail "> motionly generate launch.motion"
      }
      component plan {
        type pricingcard
        label "Pro"
        countTo 19
        cta "Start free"
        x -500
      }
      component device {
        type laptop
        headline "Ship day"
        x 500
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    expect(scene.components.map((component) => component.type)).toEqual([
      'terminal',
      'pricingcard',
      'laptop',
    ]);
    const prompt = scene.elements.find((element) => element.id === 'agent__prompt')!;
    expect(prompt.properties.value).toBe('> motionly generate launch.motion');
    const price = scene.elements.find((element) => element.id === 'plan__price')!;
    expect(price.properties['countPrefix']).toBe('$');
    const priceCount = scene.animations.find((animation) => animation.target === 'plan__price')!;
    expect(Number(priceCount.to['value'])).toBe(19);
    expect(scene.elements.some((element) => element.id === 'device__screen')).toBe(true);
    expect(scene.elements.some((element) => element.id === 'device__base')).toBe(true);
    // Component typography uses the shared display face.
    const headline = scene.elements.find((element) => element.id === 'device__headline')!;
    expect(String(headline.properties.font)).toContain('Space Grotesk');
    for (let time = 0; time <= 8; time += 0.5) {
      expect(() => evaluateScene(scene, time)).not.toThrow();
    }
  });

  it('customizes any generated part with dotted overrides from plain source', () => {
    const source = `
      canvas { duration 6s }
      component plan {
        type pricingcard
        label "Pro"
        countTo 19
        price.countPrefix "€"
        plan.color #FF88AA
        cta.fill #22C55E
      }
    `;
    const scene = buildSceneGraph(parseMotion(source));
    const price = scene.elements.find((element) => element.id === 'plan__price')!;
    expect(price.properties['countPrefix']).toBe('€');
    const planLabel = scene.elements.find((element) => element.id === 'plan__plan')!;
    expect(planLabel.properties['color']).toBe('#FF88AA');
    const cta = scene.elements.find((element) => element.id === 'plan__cta')!;
    expect(cta.properties['fill']).toBe('#22C55E');
    // Overrides never leak onto the component root.
    const root = scene.elements.find((element) => element.id === 'plan')!;
    expect(
      (root.properties as unknown as Record<string, unknown>)['price.countPrefix']
    ).toBeUndefined();
    // And they survive serialize -> reparse.
    const rebuilt = buildSceneGraph(parseMotion(serializeProgram(parseMotion(source))));
    expect(
      rebuilt.elements.find((element) => element.id === 'plan__price')!.properties['countPrefix']
    ).toBe('€');
  });

  it('rejects overrides for unknown parts with the available part names', () => {
    expect(() =>
      buildSceneGraph(
        parseMotion(`
          component plan {
            type pricingcard
            banner.fill #fff
          }
        `)
      )
    ).toThrow(/no part "banner".*Available parts:.*price/s);
  });

  it('round-trips new component types through serialize and reparse', () => {
    const source = `
      canvas { duration 8s }
      component editor {
        type codeeditor
        label "auth.ts"
      }
      component site {
        type website
        headline "Launch faster"
        cta "Start free"
      }
      component growth {
        type chart
        label "Signups"
        countTo 4820
      }
    `;
    const program = parseMotion(source);
    const reparsed = parseMotion(serializeProgram(program));
    const scene = buildSceneGraph(reparsed);
    expect(scene.components.map((component) => component.type)).toEqual([
      'codeeditor',
      'website',
      'chart',
    ]);
    expect(scene.elements.some((element) => element.id === 'editor__codeline0')).toBe(true);
    expect(scene.elements.some((element) => element.id === 'site__headline')).toBe(true);
    const total = scene.elements.find((element) => element.id === 'growth__total')!;
    expect(total.properties['countDecimals']).toBe(0);
    const count = scene.animations.find((animation) => animation.target === 'growth__total')!;
    expect(Number(count.to['value'])).toBe(4820);
    // Every frame evaluates without throwing across the timeline.
    for (let time = 0; time <= 8; time += 0.5) {
      expect(() => evaluateScene(scene, time)).not.toThrow();
    }
  });

  it('builds common UI patterns from reusable structured components', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 8s }
        component feature {
          type card
          headline "Focus mode"
          detail "One clear task at a time."
          motionPreset spring
        }
        component login {
          type form
          variant login
          labels "Email  Password"
          values "you@example.com  ••••••••"
        }
        component conversation {
          type chat
          values "Ready to ship?  Yes — checks are green.  Launch it."
        }
        component confirm {
          type modal
          label "Publish project?"
          cta "Publish"
        }
        component mobileNav {
          type navigation
          variant mobile
          labels "Home  Search  Inbox  Profile"
        }
      `)
    );

    expect(scene.components.map((component) => component.type)).toEqual([
      'card',
      'form',
      'chat',
      'modal',
      'navigation',
    ]);
    for (const id of [
      'feature__spotlight',
      'login__field1',
      'conversation__typing',
      'confirm__backdrop',
      'mobileNav__active',
    ]) {
      expect(
        scene.elements.some((element) => element.id === id),
        id
      ).toBe(true);
    }
    expect(
      scene.animations.find((animation) => animation.target === 'feature__surface')!.easing
    ).toBe('back.out(1.6)');
    for (let time = 0; time <= 8; time += 0.5) {
      expect(() => evaluateScene(scene, time)).not.toThrow();
    }
  });

  it('builds featured registry cards as distinct structures', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 4s }
        theme {
          surface #FFFFFF
          text #171717
        }
        component tilted { type tilted-card cta "CARD 07" }
        component bento { type magic-bento countTo 64 }
        component glass { type fluid-glass }
        component focus { type spotlight-card }
        component metric {
          type metric-card
          label "Conversion"
          detail "vs last week"
          countTo 42800
          cta "+12%"
        }
        component media {
          type media-card
          label "Case study"
          headline "Real product"
          detail "Replace every field"
        }
      `)
    );
    for (const id of [
      'tilted__poster',
      'tilted__stripe',
      'bento__mainTile',
      'bento__topTile',
      'glass__backplate',
      'glass__chip2',
      'focus__sun',
      'focus__footer',
      'metric__value',
      'metric__sparkline',
      'media__media',
      'media__headline',
    ]) {
      expect(
        scene.elements.some((element) => element.id === id),
        id
      ).toBe(true);
    }
    expect(
      scene.elements.find((element) => element.id === 'tilted__poster')!.properties['fill']
    ).toBe('#FFFFFF');
    expect(
      scene.elements.find((element) => element.id === 'focus__headline')!.properties['color']
    ).toBe('#FAF8F2');
    for (const [id, value] of [
      ['tilted__index', 'CARD 07'],
      ['bento__stat', 64],
      ['metric__eyebrow', 'Conversion'],
      ['metric__detail', 'vs last week'],
      ['metric__delta', '+12%'],
      ['media__headline', 'Real product'],
      ['media__detail', 'Replace every field'],
    ] as const) {
      expect(scene.elements.find((element) => element.id === id)!.properties['value']).toBe(value);
    }
  });

  it('builds published UI controls as distinct editable structures', () => {
    const scene = buildSceneGraph(
      parseMotion(`
        canvas { duration 8s }
        component side { type sidebar }
        component records { type table }
        component palette { type command-palette }
        component search { type search-bar }
        component person { type avatar label "Maya Chen" }
        component status { type badge }
        component steps { type stepper }
        component logos { type logo-grid }
        component quote { type testimonials }
        component faq { type faq-accordion }
      `)
    );
    for (const id of [
      'side__brand',
      'records__row0',
      'palette__search',
      'search__shortcut',
      'person__initials',
      'status__marker',
      'steps__step0',
      'logos__tile0',
      'quote__quote',
      'faq__rowAction0',
    ]) {
      expect(
        scene.elements.some((element) => element.id === id),
        id
      ).toBe(true);
    }
    expect(
      scene.animations.find((animation) => animation.target === 'search__surface')!.easing
    ).toBe('power4.out');
  });
});
