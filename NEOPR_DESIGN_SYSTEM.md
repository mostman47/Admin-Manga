# NeoP Restaurant Design System

## Overview

This document outlines the design system for the NeoP Restaurant application, including typography styles, color palette, and design specifications. This serves as the foundation for consistent visual design across all digital touchpoints.

---

## Typography

### Primary Typeface: Inter Display

**Usage:** Headlines and large display text

- **Font Family:** Inter Display
- **Weight:** Bold/Semi-bold
- **Character Set:** Full alphabet, numbers, and special characters
- **Purpose:** Prominent headings and key messaging

### Secondary Typeface: Montserrat

**Usage:** Body text and UI labels

- **Font Family:** Montserrat
- **Weight:** Regular/Medium
- **Character Set:** Complete character support
- **Purpose:** Primary body copy and interface elements

### Tertiary Typeface: Inter Display (Italic)

**Usage:** Emphasis and secondary messaging

- **Font Family:** Inter Display
- **Style:** Italic
- **Character Set:** Full alphabet support
- **Purpose:** Decorative headers and emphasized text

---

## Color Palette

### Primary Colors

#### 1. NEOP Beige
- **Hex Code:** `#D3CFBF`
- **RGB:** rgb(211, 207, 191)
- **Use Case:** Background, accents, and neutral elements
- **Description:** Warm, earthy beige tone that provides a sophisticated neutral backdrop

#### 2. Deep Red
- **Hex Code:** `#63161C`
- **RGB:** rgb(99, 22, 28)
- **Use Case:** Primary action buttons, important highlights, and branding
- **Description:** Rich, dark red that commands attention and conveys premium dining experience

#### 3. Black
- **Hex Code:** `#131313`
- **RGB:** rgb(19, 19, 19)
- **Use Case:** Text, borders, and structural elements
- **Description:** Nearly pure black for maximum contrast and readability

#### 4. Light Gray
- **Hex Code:** `#D3D3D3`
- **RGB:** rgb(211, 211, 211)
- **Use Case:** Borders, dividers, and secondary backgrounds
- **Description:** Soft gray for subtle separation and visual hierarchy

---

## Design Guidelines

### Color Usage Principles

- **Hierarchy:** Use Deep Red for primary CTAs and important elements
- **Readability:** Ensure sufficient contrast between text and background colors
- **Consistency:** Apply colors consistently across all pages and components
- **Accessibility:** Test color combinations for WCAG compliance

### Typography Guidelines

- **Scale:** Maintain consistent sizing across similar components
- **Weight:** Use font weights strategically to establish visual hierarchy
- **Line Height:** Ensure adequate line spacing for readability (1.4x - 1.6x)
- **Kerning:** Respect default font kerning; adjust only when necessary

### Spacing & Layout

- Follow established grid systems for consistent alignment
- Maintain consistent padding and margins throughout the interface
- Use the defined color palette to create visual depth and separation

---

## Implementation Notes

### Web (React/TypeScript)

Use CSS variables for consistent color application:

```css
--color-primary-beige: #D3CFBF;
--color-primary-red: #63161C;
--color-black: #131313;
--color-light-gray: #D3D3D3;

--font-primary-display: 'Inter Display', sans-serif;
--font-secondary: 'Montserrat', sans-serif;
--font-tertiary-italic: 'Inter Display', sans-serif; /* with font-style: italic */
```

### Responsive Considerations

- Scale typography proportionally on mobile devices
- Maintain color contrast ratios across all screen sizes
- Test color visibility on various display types and light conditions

---

## Figma Reference

**File:** NeoP - Restaurant Food  
**Node ID:** 463-79  
**Section:** System

This design system document should be updated whenever changes are made to the typography or color specifications in Figma.

---

*Last Updated: April 2026*
