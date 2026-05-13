# FeastFull Brand Design Guidelines

## 1. Brand Identity
- **App Name**: FeastFull
- **Tagline/Mission**: Menu & Feedback Solutions

## 2. Logo Assets
The official logo is a vibrant shield-shaped emblem combining a chef's hat, graduation cap, and gears, with a fork and spoon inside the plate and a stylized smiling checkmark.
- **Client Asset**: `client/public/FeastFull_LOGO.png` (Used for web app navbar, login page, and favicon)
- **Server Asset**: `server/assets/FeastFull_LOGO.png` (Used for automated PDF generation)

## 3. Color Palette
The color scheme is directly extracted from the official logo to maintain a cohesive and recognizable identity across the entire application.

### Primary Colors
- **Dark Teal**
  - **Hex**: `#16536b`
  - **Usage**: Main primary buttons, header text, active icons, layout styling. Replaces traditional indigo themes.

- **Vibrant Orange**
  - **Hex**: `#e66a20`
  - **Usage**: Secondary buttons, hover states, accents. 

### Accent Colors
- **Yellow/Gold**
  - **Hex**: `#eab308`
  - **Usage**: Warning badges, star ratings, and minor highlight accents.

- **Green**
  - **Hex**: `#22c55e`
  - **Usage**: Success states, confirmations, and positive feedback indicators.

- **Red**
  - **Hex**: `#ef4444`
  - **Usage**: Error states, destructive actions (delete buttons).

## 4. UI/UX Elements
- **Gradients**: Text gradients and background banners utilize a smooth transition between the Primary Dark Teal (`#16536b`) and Secondary Orange (`#e66a20`).
- **Typography**: Clean, sans-serif fonts (Tailwind defaults) to ensure maximum readability for students, caterers, and admins.
- **Shadows & Glassmorphism**: Interactive elements have a subtle `hover-glow` utilizing the primary Dark Teal color with low opacity for a modern feel.

## 5. CSS Implementation
Colors are implemented globally in `client/src/index.css` via Tailwind CSS v4 `@theme` configuration:

```css
@theme {
  /* Color palette */
  --color-primary: #16536b;
  --color-secondary: #e66a20;
  --color-accent: #eab308;
  --color-success: #22c55e;
  --color-warning: #fb923c;
  --color-error: #ef4444;
}
```
All UI components use these CSS variables to ensure strict adherence to the brand guidelines.
