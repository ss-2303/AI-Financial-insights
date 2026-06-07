---
name: Ethos Finance
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#45464d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#171c1f'
  on-tertiary-container: '#808488'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#dfe3e7'
  tertiary-fixed-dim: '#c3c7cb'
  on-tertiary-fixed: '#171c1f'
  on-tertiary-fixed-variant: '#43474b'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-max-width: 1280px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 40px
  stack-sm: 8px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style

The design system is built for a light, professional banking and financial insight platform. The core personality is **Minimalist and Trustworthy**, prioritizing clarity of information over decorative flair. It aims to evoke a sense of calm, stability, and intellectual honesty, ensuring users feel in control of their financial data.

The style leverages **Minimalism** with a focus on high-quality typography and generous whitespace. To differentiate from cold, institutional banking, the system introduces **approachable human touches** through subtle, hand-drawn doodles used as secondary decorative accents. These are used sparingly to soften the professional edge without compromising the app's reliability.

## Colors

The palette is anchored in a professional, high-contrast foundation to ensure legibility and a premium feel.

- **Primary (Slate/Navy):** Used for primary text, headings, and high-importance UI elements to convey authority.
- **Secondary (Professional Blue):** Reserved for primary actions, progress indicators, and interactive states.
- **Tertiary/Neutral Grays:** Used for background surfaces, borders, and secondary text to create a soft, tiered visual hierarchy.
- **Fraud/Alert Red:** A subtle yet urgent red used exclusively for security alerts and critical financial warnings.
- **Background:** Crisp white is the primary surface color to maximize the sense of space and cleanliness.

## Typography

This design system utilizes **Inter** across all levels for its exceptional legibility and systematic feel. 

- **Headlines:** Use tighter letter spacing and semi-bold weights to create a strong visual anchor for data sections.
- **Body Text:** Standard weight with generous line heights (1.5x+) to facilitate easy reading of financial statements and insights.
- **Labels:** Used for data headers and metadata; uppercase is reserved for the smallest labels to maintain a professional, organized structure.
- **Mobile Scaling:** Large headlines scale down significantly on mobile to ensure financial dashboard metrics remain visible above the fold.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy on desktop to maintain a structured, editorial feel for financial reports, transitioning to a fluid model on smaller devices.

- **Desktop:** 12-column grid with a 1280px max-width.
- **Tablet:** 8-column grid with 24px gutters.
- **Mobile:** 4-column grid with 16px margins.

Spacing is based on a **4px baseline shift**, but primary components should favor larger increments (16px, 24px, 32px) to achieve the "generous whitespace" required for a minimalist aesthetic. Horizontal "Stack" spacing is used to group related financial metrics, while larger vertical gaps separate distinct logical sections like "Account Summary" and "Recent Transactions."

## Elevation & Depth

Visual hierarchy is achieved through **Tonal Layers** and **Ambient Shadows**. 

1.  **Base Layer:** White background (`#FFFFFF`).
2.  **Surface Layer:** Soft gray (`#F8FAFC`) used for card backgrounds or secondary sections to create subtle contrast without harsh lines.
3.  **Shadows:** Use extremely diffused, low-opacity shadows (e.g., `0px 4px 20px rgba(15, 23, 42, 0.05)`) to lift interactive cards and modals. Shadows should feel like a soft glow rather than a hard drop.
4.  **Outlines:** Use 1px low-contrast borders (`#E2E8F0`) for input fields and static containers where shadows would create too much visual noise.

## Shapes

The shape language is defined by **Rounded** geometry to balance the professional tone with approachability.

- **Standard Components:** Buttons, input fields, and small cards use a **0.5rem (8px)** corner radius.
- **Large Containers:** Dashboard widgets and main content cards use a **1rem (16px)** radius to soften the layout.
- **Icons:** Minimalist line icons with slightly rounded caps and joins to match the UI's geometric rhythm.
- **Doodles:** Hand-drawn decorative accents should have organic, imperfect lines to contrast against the rigid grid of the financial data.

## Components

- **Buttons:** Primary buttons are solid Slate/Navy with white text. Secondary buttons use a Professional Blue outline. All buttons have 8px rounded corners and 12px vertical padding.
- **Input Fields:** Minimalist design with a light gray border. Focus state uses a 2px Professional Blue border with a soft blue outer glow (halo).
- **Cards:** White background with a 1px gray border or a very soft ambient shadow. Used to encapsulate specific financial insights or account totals.
- **Chips/Status:** Used for transaction categories (e.g., "Food", "Rent"). Low-saturation background tints with high-saturation text for readability.
- **Lists:** Transaction lists should be clean with no vertical dividers; use ample white space and subtle horizontal lines to separate entries.
- **Data Visualization:** Charts should use thin lines, Professional Blue for growth, and Slate for neutral trends. Avoid heavy fills; prefer light gradients or outlines.
- **Hand-Drawn Accents:** Small, 1px stroke-width doodles (like a small star or a soft underline) used near empty states or "Insight" headers to provide a premium, bespoke feel.