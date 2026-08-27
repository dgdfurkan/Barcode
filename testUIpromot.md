<reference-prompt>
# Summary

The Synapse design system is a futuristic, dark-themed interface that combines large-scale editorial typography with intricate micro-interactions, floating ambient orbs, and high-contrast color accents to create a premium, high-tech user experience.

# Style

The style essence relies on a 'Vantablack' foundation with layers of transparency and glowing blurs. Typography pairings utilize 'Instrument Serif' for high-impact headings and 'Inter' for crisp readability. Motion is central, featuring infinite tickers, floating orbs, and subtle bounce animations.

## Spec

### Visual Theme
- **Base Background:** #030303 (Solid Black).
- **Accent Colors:** Violet (#8B5CF6), Cyan (#06B6D4), Emerald (#10B981 for status).
- **Typography:** 
  - Headings: 'Instrument Serif', Weight: 400-500, Tracking: -0.02em to -0.05em.
  - Body/UI: 'Inter', Weights: 300, 400, 600. 
  - Data/Metrics: 'Inter' or Monospace, Tracking: Widest (0.2em) for labels.
- **Gradients:** 
  - Violet Glow: `rgba(139, 92, 246, 0.4)` blur(40px to 120px).
  - Cyan Glow: `rgba(6, 182, 212, 0.4)` blur(40px to 120px).
  - Text Shimmer: Linear gradient (90deg, #a78bfa 0%, #ffffff 40%, #ffffff 60%, #22d3ee 100%) background-size 200%.
- **Effects:** 
  - Glassmorphism: `rgba(10, 10, 10, 0.7)` with `backdrop-filter: blur(16px)` and `border: 1px solid rgba(255, 255, 255, 0.1)`.
  - Shadows: Violet/Cyan outer glows (`box-shadow: 0 0 20px -10px #8b5cf6`).
- **Animations:** 
  - Floating Orbs: `translateY(-20px) scale(1.05)` over 6-15s.
  - Staggered Entrances: `opacity: 0; transform: translateY(20px)` to `opacity: 1; transform: translateY(0)` with 0.2s delay increments.

# Layout & Structure

The layout follows a modular vertical stack with a centered fixed-navigation pill. It transitions from a massive centered hero to a high-density horizontal ticker, then into a grid of feature cards, followed by a dark code integration block.

## Fixed Navigation Pill

Create a floating glass navigation bar. Width: 95% max-width 672px. Position: top-6, left-1/2, -translate-x-1/2. Style: rounded-full, glass background (#0a0a0a/0.7), 1px white/10 border. Content: Left-aligned logo (4px gradient circle + 'Instrument Serif' text), center-aligned links (12px uppercase Inter, neutral-400), right-aligned CTA (White background, black text, rounded-full).

## Hero Section

Large centered hero section. Background: Radial gradient at top-center (#8b5cf6/40) and left-center (#06b6d4/0.08). Heading: Massive font-serif (text-6xl to text-9xl), leading-0.9, white text with the last word featuring a 'shimmer' animation. Subtext: Max-width 2xl, Inter font, neutral-400, text-lg. Interactive: Centered primary 'Shiny Border' button and secondary text link with 1s delay staggered entry animation.

## Metrics Ticker

Full-width infinite horizontal scroll bar. Height: ~60px. Background: #000/40, border-y 1px white/5. Content: Pairs of labels (text-10px mono, uppercase, neutral-500) and values (text-base mono, white or accent colors). Speed: 40s linear loop.

## Feature Grid

3-column grid of cards. Cards: Border #ffffff/5, Background #ffffff/2, padding 40px, rounded-3xl. Hover State: Lift translateY(-12px), border-color violet/40, background intensity increase. Layout: Top icon in a 48px square tinted box, font-serif title, neutral-400 body text.

## Code Integration Block

Dark IDE-style window. Background: #080808/80, 1px white/10 border, 24px border-radius. Toolbar: Top bar with 3 decorative window controls (red/yellow/green low-opacity), file name in mono font, and copy icon. Code: Monospaced font with syntax highlighting (Violet for imports/const, Cyan for classes, Emerald for strings, Grey for comments).

## Footer

Background #050505, top border white/5. Layout: 4-column grid. Branding: Large font-serif logo. Content: Category headings in 10px uppercase tracking-widest Inter. Bottom Bar: copyright on left, 'All Systems Operational' emerald status indicator with pulsing dot on right.

# Special Components

## Shiny Border Button

A button with a continuously spinning conic gradient border that creates a thin neon line effect.

Outer container: `padding: 1px`, `border-radius: 9999px`, `overflow: hidden`. Inner Content: `background: #0a0a0a`, `padding: 16px 40px`, `z-index: 1`. Animation: A pseudo-element `::before` with `background: conic-gradient(from 0deg, transparent 0%, #8b5cf6 40%, #06b6d4 50%, transparent 60%)`, sizing 200%x200%, rotating infinitely at 4s per loop.

## Interactive Feature Card

Reveal-on-scroll card with floating iconography.

Style: Rounded-3xl (24px+), `border: 1px solid rgba(255,255,255,0.05)`, `background: rgba(255,255,255,0.02)`. Interaction: On scroll, fade in and translate from Y=30px to Y=0. On hover, apply a violet glow shadow `0 0 20px -10px rgba(139,92,246,0.4)` and scale the internal icon 1.1x with a slight rotation.

# Special Notes

MUST: Maintain extreme contrast between the black background and white/neon elements. MUST: Use 'Instrument Serif' only for large headings (32px+) or brand elements. MUST: Ensure the 'glass' effects have high blur values (at least 16px) to maintain readability over background orbs. DO NOT: Use standard 0.5s transitions for everything; use `cubic-bezier(0.23, 1, 0.32, 1)` for a more technical, 'snappy' feel. DO NOT: Use pure greys for borders; always use low-opacity white (e.g., `white/5` or `white/10`).
</reference-prompt>

Above is a design reference that I want to adopt for my own product;
Confirm with me how I want to adopt this, and if I want to design multiple versions on superdesign.dev, if so read https://superdesign.dev/INSTALL.md and follow every step to install the Superdesign skill, then proceed.

If not, just use the style above and implement directly