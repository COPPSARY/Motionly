# Animation Preset Development Guide

## Overview

This guide provides standards for creating professional-quality animation presets in Motionly.

## Philosophy

> **Prefer excellence over quantity.** It's better to have 10 polished presets than 100 mediocre effects.

Motionly presets should embody motion design knowledge, allowing beginners to create professional animations while giving advanced users full control.

---

## Development Process

### 1. Research Phase

**Study professional examples**:
- Watch Apple product reveals (iPhone, MacBook, Vision Pro)
- Analyze WWDC presentation animations
- Study Linear's product interface
- Review Framer Motion showcases
- Examine GSAP professional demos

**Questions to answer**:
- How do professionals achieve this effect?
- What timing feels natural?
- What easing curves are used?
- How much is too much? (overshoot, blur, rotation)
- What makes it feel polished vs flashy?

### 2. Principle Identification

**Identify the core motion principles**:
- **Timing**: How long should it take?
- **Easing**: What curve creates the right feel?
- **Spacing**: How much movement is appropriate?
- **Sequencing**: What order do elements animate?
- **Emphasis**: What draws the eye?

**Example** (Hero Logo):
- Principle: Create anticipation through slight scale-down
- Timing: 1.4-1.6s (hero moment deserves time)
- Easing: Soft spring (Apple-style subtle overshoot)
- Scale: 0.92 → 1.0 → 1.02 → 1.0
- Blur: 3px → 0 (subtle depth)
- Rotation: -2° → 0° (anticipation)

### 3. Parameter Design

**Define what should be customizable**:
- Duration (with sensible default)
- Delay (default: 0)
- Easing (with recommended default)
- Direction (if applicable)
- Amount/intensity (with safe limits)

**Keep it simple**:
- Max 5-7 parameters per preset
- All parameters should have excellent defaults
- Users should rarely need to adjust anything

**Example parameters** (Text Reveal):
```typescript
interface TextRevealOptions {
  split?: 'words' | 'chars' | 'lines';  // Default: words
  stagger?: number;                       // Default: 90ms
  duration?: number;                      // Default: 1.2s
  ease?: string;                          // Default: power3.out
  delay?: number;                         // Default: 0
  blur?: number;                          // Default: 6px
  direction?: 'up' | 'down' | 'none';    // Default: up
}
```

### 4. Choose Defaults

**Professional defaults from research**:
- Reference `motion-defaults.ts` for standards
- Apple-style: power3.out, 1.2-1.6s, soft springs
- GSAP-style: power2.out, 0.8-1.2s
- Linear-style: Very subtle, fast (0.3-0.6s)

**Testing defaults**:
- Does it look good with NO customization?
- Can a beginner use it successfully?
- Does it work at different scales?
- Does it feel professional, not flashy?

### 5. Implementation

**Code structure**:
```typescript
export function textRevealPreset(options: TextRevealOptions = {}): Animation[] {
  // 1. Apply defaults
  const {
    split = 'words',
    stagger = MOTION_DEFAULTS.stagger.words,
    duration = MOTION_DEFAULTS.duration.textReveal,
    ease = MOTION_DEFAULTS.easing.text,
    delay = 0,
    blur = 6,
    direction = 'up',
  } = options;
  
  // 2. Generate animations
  // 3. Return animation array
}
```

**Best practices**:
- Use constants from `motion-defaults.ts`
- Validate parameter ranges
- Clamp values to safe limits
- Add JSDoc comments
- Include usage examples

### 6. Visual Testing

**Test checklist**:
- [ ] Preview at 1080p
- [ ] Preview at 4K
- [ ] Test with short text (3 words)
- [ ] Test with long text (20+ words)
- [ ] Test at different font sizes
- [ ] Verify timing feels natural
- [ ] Check that motion is smooth (no jarring)
- [ ] Ensure it works with other presets
- [ ] Test on different backgrounds
- [ ] Verify performance (60fps maintained)

**Red flags** (indicates preset needs work):
- Motion feels robotic
- Timing feels too fast or too slow
- Elements pop instead of flow
- Overshoot is distracting
- Blur is excessive
- Rotation looks unnatural
- Stagger rhythm is off

### 7. Iteration

**Refinement process**:
- Show it to others (fresh eyes)
- Compare side-by-side with professional work
- Adjust one parameter at a time
- Test small changes (0.1s duration, 10ms stagger)
- Record before/after videos
- Sleep on it, review with fresh eyes

**Questions to ask**:
- Does this feel premium?
- Would Apple use this?
- Is it subtle enough?
- Does it guide attention effectively?
- Does it enhance or distract?

---

## Quality Checklist

Use this before marking a preset "complete":

### Motion Quality
- [ ] Uses professional easing curves (power3.out, springs)
- [ ] Duration follows research-backed timing
- [ ] Stagger rhythm creates smooth flow
- [ ] No jarring or robotic motion
- [ ] Respects motion constraints (blur, scale, rotation limits)
- [ ] Feels intentional, not random

### Technical Quality
- [ ] Works consistently across projects
- [ ] Handles edge cases gracefully
- [ ] Performance: maintains 60fps
- [ ] No magic numbers (uses constants)
- [ ] TypeScript strict mode compliant
- [ ] Proper error handling

### User Experience
- [ ] Defaults produce excellent results
- [ ] Customizable for advanced users
- [ ] Parameters are intuitive
- [ ] Works at different scales
- [ ] Composable with other presets
- [ ] Predictable behavior

### Documentation
- [ ] JSDoc comment with description
- [ ] Usage example in comments
- [ ] Parameter descriptions
- [ ] Default values documented
- [ ] Added to preset catalog
- [ ] Added to .motion language docs

### Testing
- [ ] Unit tests for parameter handling
- [ ] Visual regression tests
- [ ] Tested with sample .motion files
- [ ] Verified in showcase animation
- [ ] Performance benchmarked

---

## Preset Categories

### Text Presets

**Keynote Text** (Apple-style):
- Split by words
- 90ms stagger
- Blur + fade + slight Y-offset
- Power3.out easing

**Character Cascade**:
- Split by characters
- 35ms stagger
- Scale + fade
- Spring easing for last few chars

**Typewriter**:
- Split by characters
- 60ms stagger (slower, readable)
- Instant reveal per character
- Optional cursor

### Logo Presets

**Hero Logo** (Premium entrance):
- Scale: 0.92 → 1.0 (with overshoot)
- Rotation: -2° → 0°
- Blur: 3px → 0
- Soft spring easing
- 1.4-1.6s duration

**Logo Float** (Ambient loop):
- Y-offset: 0 → -10px → 0
- 3s duration
- Sine.inOut easing
- Loop: infinite

### Product Presets

**Product Reveal** (Showcase):
- Camera push: 1.0 → 1.12
- Product opacity: 0 → 1
- Product scale: 0.95 → 1.0
- Coordinated timing
- 2.0s duration

**Card Reveal**:
- Y-offset: +50px → 0
- Opacity: 0 → 1
- Scale: 0.96 → 1.0
- Shadow: none → strong
- 0.8s duration

### Camera Presets

**Cinematic Push** (Apple-style):
- Zoom: 1.0 → 1.08
- Y-offset: 0 → -20px
- 2.5s duration
- Soft spring easing

**Dolly Pan**:
- X-movement: smooth path
- 3.0s duration
- Sine.inOut easing

### Background Presets

**Gradient Motion**:
- Animated gradient positions
- 8s duration (slow, ambient)
- Loop: infinite
- Subtle color shifts

**Subtle Noise**:
- 10-20% opacity
- Animated seed
- Creates depth and texture
- Film grain aesthetic

---

## Anti-Patterns

### ❌ Avoid These

**Over-animation**:
- Too many elements moving at once
- Excessive overshoot (>8%)
- Too much rotation
- Extreme blur
- Chaotic stagger

**Poor timing**:
- Too fast (feels rushed)
- Too slow (feels sluggish)
- Inconsistent rhythm
- Overlapping without purpose

**Technical issues**:
- Magic numbers everywhere
- No default values
- Too many required parameters
- Breaking changes between versions
- Undocumented behavior

**Wrong easing**:
- Linear easing (robotic)
- Ease-in for UI (feels delayed)
- Aggressive curves (jarring)
- Inconsistent easing across preset

---

## Examples of Excellence

### Apple
- Soft springs with subtle overshoot
- Generous timing (1.4-2.5s for heroes)
- Power3.out as default
- Coordinated camera + element motion

### Linear
- Very subtle, fast transitions (0.3-0.5s)
- Minimal movement
- Focus on smoothness
- Never distracting

### GSAP Showcase
- Power curves (power2/power3)
- Stagger choreography
- Coordinated sequences
- Performance-optimized

---

## Preset Lifecycle

1. **Draft**: Initial implementation, basic testing
2. **Review**: Team feedback, iteration
3. **Polish**: Final refinements, documentation
4. **Release**: Added to preset library
5. **Maintain**: Bug fixes, improvements based on usage

---

## Conclusion

Creating professional presets is an iterative process. Study the best, identify principles, implement carefully, test thoroughly, and refine relentlessly.

The goal is not to create every possible animation, but to provide a curated set of excellent, reusable motion systems that embody professional motion design knowledge.

---

**Remember**: Polished over flashy. Purposeful over random. Professional over complex.
