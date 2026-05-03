# WebAI Pilot Design Documentation

**Source:** [Figma Design File](https://www.figma.com/design/DzknMU6pngIfcARtcTz6CZ/%E2%9C%85-WebAI-Pilot-Design?node-id=235-19941&m=dev)

---

## 📋 Overview

This is a comprehensive design documentation for the **WebAI Pilot** landing page. The design features a modern, gradient-heavy aesthetic with purple/blue color schemes and includes various AI-powered tool learning features.

**Page Dimensions:** 1920x10113px (responsive)

---

## 🎨 Design Tokens

### Color Palette

| Token | Color | Usage |
|-------|-------|-------|
| **Primary/04/100%** | `#EAEDFF` | Navigation text, light accents |
| **Neutral/White** | `#FFFFFF` | Text, primary content |
| **Black** | `#010314` | Dark backgrounds, buttons |
| **Paragraph/Gray** | `#77798F` | Secondary text, descriptions |
| **Stock** | `#2A2B3A` | Borders, subtle elements |
| **Purple Primary** | `#6938EF` | Accent, buttons |
| **Light Purple** | `#775BE4` | Caption text |
| **Light Blue Gradient** | `#B8ACFF` to `#FFFFFF` | Heading gradients |

### Typography

| Type | Font Family | Weight | Size | Line Height | Letter Spacing |
|------|-------------|--------|------|-------------|-----------------|
| **Base Bold** | Poppins | Bold (700) | 16px | 24px | -0.32px |
| **Heading XL** | Montserrat | Extra Bold (800) | 50px | 1.2 | - |
| **Body** | Montserrat | Regular | 18px | 1.6 | - |
| **Caption** | Inter | Regular | 12px | 1.6 | 0.84px |
| **Button** | Inter | Regular | 13.5px | Normal | - |
| **Flying Card** | Inter | Medium | 14px | 21px | - |

---

## 📐 Layout Structure

### Header/Navigation (1920x64px)

Located at the top of the page, the navigation includes:

#### Components:
- **Logo Section** (250px wide)
  - WebAI Pilot branding with icon
  - Logo text: "WebAI Pilot" in bold

- **Left Navigation Items** (345px)
  - Live Demo
  - Features
  - FAQ
  - Pricing
  - Font: Poppins Bold, 16px, `#EAEDFF`

- **Right Section** (345px)
  - "LOG IN" button
  - Gradient background: `#3D2877` to `#2E1A65`
  - Border: 2px solid `#4B397F`
  - Shadow: `0px 16px 24px rgba(0,0,0,0.25), 0px -14px 48px rgba(105,56,239,0.2)`
  - Includes zap icon

---

### Hero Section (1124x810px)

The main hero area features:

#### Background
- Radial gradient with purple-to-white color progression
- Looping polygon animation pattern in background
- Rounded corners: 37.5px

#### Main Content
- **Badge/Caption**
  - Text: "EMBRACE NEXT-GENERATION TOOL LEARNING WITH WEBAI PILOT"
  - Color: `#775BE4` (light purple)
  - Size: 12px uppercase with letter spacing

- **Headline**
  - Text: "Interact Intelligently: Tool Learning-Enhanced Dialogues at Your Command."
  - Font: Montserrat Extra Bold, 50px
  - Gradient fill: White to light white gradient
  - Centered, multi-line

- **Subheadline**
  - Text: "Advancing Tool Proficiency, Enriching Collaborative Engagement"
  - Font: Montserrat Regular, 18px
  - Color: `#77798F` (paragraph gray)
  - Centered

#### Call-to-Action Buttons
Located 30px below subheadline:

**Button 1: Request A Demo** (Primary)
- Background: `#010314` (black)
- Border: 1.125px solid `#A189FF` (light purple)
- Padding: 30px horizontal, 16.5px vertical
- Border radius: 30px
- Shadow: `0px 0px 7.5px rgba(119,68,255,0.7)`
- Text color: White, 13.5px

**Button 2: Watch Video** (Secondary)
- Background: `#010314` (black)
- Border: 1.125px solid `#2A2B3A` (stock)
- Padding: 30px horizontal, 16.5px vertical
- Border radius: 30px
- Play icon (rotated 90°)
- Text color: White, 13.5px

#### Flying Feature Cards
Positioned absolutely around the hero content:

**Left Side Cards:**
1. **Emotion Insight Processing**
   - Position: Floating at xy position
   - Backdrop blur: 9.879px
   - Background: `rgba(89,37,220,0.6)` with opacity 90%
   - Border: 1.235px solid `rgba(255,255,255,0.38)`
   - Font: Inter Medium, 13px

2. **Query Resolution Intelligence**
   - Backdrop blur: 12px
   - Background: `rgba(89,37,220,0.6)` with opacity 80%
   - Border: 1.5px solid `rgba(255,255,255,0.38)`
   - Font: Inter Medium, 14px

3. **Directive Compliance Enhancement**
   - Backdrop blur: 10.909px
   - Background: `rgba(89,37,220,0.6)` with opacity 80%
   - Border: 1.364px solid `rgba(255,255,255,0.38)`
   - Font: Inter Medium, 14px

**Right Side Cards:**
1. **Visual Context Narration**
   - Backdrop blur: 12px
   - Font: Inter Medium, 14px

2. **Knowledge Harvesting System**
   - Backdrop blur: 10.638px
   - Opacity: 80%
   - Font: Inter Medium, 13px

3. **Visual Identification Dynamics**
   - Backdrop blur: 13.6px
   - Opacity: 70%
   - Font: Inter Medium, 15px

Each card includes:
- Small icon (Union SVG)
- Feature name
- Glassmorphic effect with blur and transparency

#### Analytics Dashboard Preview
- Central image mask showing analytics dashboard
- Displays mock data:
  - Total User Chats: 1,210
  - Average Session Duration: 6.1 min
  - Current Active Users: 36
- Charts and graphs with gradient backgrounds

---

## 🖼️ Assets

All assets are stored as remote URLs (valid for 7 days):

| Asset | Purpose | URL |
|-------|---------|-----|
| WebAI Pilot Logo | Header branding | - |
| Zap Icon | Login button icon | - |
| Looper Background | Hero background animated pattern | - |
| Analytics Dashboard Image | Hero preview | - |
| Feature Icons | Flying cards (Union SVGs) | Multiple |

---

## 🎯 Component Breakdown

### 1. Navigation Component
- **Props:** None (static)
- **Children:**
  - Logo/Branding
  - Navigation links
  - Login button
- **Responsive:** Desktop-first, 1920x64px

### 2. Hero Section Component
- **Props:** 
  - Optional: `onDemoClick()`, `onVideoClick()`
- **Children:**
  - Badge/Caption
  - Headline text
  - Subheadline text
  - CTA buttons
  - Flying feature cards
  - Analytics dashboard preview
- **Background:** Gradient + animated polygons
- **Size:** 1124x810px

### 3. Flying Card Component
- **Props:**
  - `title: string` (feature name)
  - `icon: SVG | string` (icon asset)
  - `position: {x, y}` (absolute positioning)
  - `blur: number` (backdrop blur value)
  - `opacity: number` (0-1)
- **Styling:**
  - Glassmorphic effect
  - Rounded corners
  - Border with transparency
  - Flex layout

---

## 📱 Responsive Behavior

- **Desktop (1920px):** Full hero section visible with animations
- **Tablet (768px):** Stack elements, adjust hero dimensions
- **Mobile (375px):** Single column, simplified hero

*Note: This documentation currently reflects the 1920px desktop view. For responsive implementation, consider breakpoints at 768px and 375px.*

---

## 🎬 Animations & Effects

### Background
- Looping polygon pattern (rotating animated background)
- Radial gradient from blue to white

### Hero Headline
- Gradient text effect (white with subtle transparency shifts)

### Flying Cards
- Positioned absolutely with staggered positioning
- Can be enhanced with:
  - Floating animations (up/down motion)
  - Entrance animations (fade-in, slide)
  - Parallax effects on scroll

---

## 💻 Implementation Notes

### CSS-in-JS Approach
```typescript
// Example Tailwind classes used:
- "rounded-[37.5px]" - Custom border radius
- "bg-gradient-to-b" - Gradient backgrounds
- "backdrop-blur-[12px]" - Glassmorphic effect
- "bg-clip-text" - Text gradient clipping
- "shadow-[0px_16px_24px_...]" - Custom shadows
```

### Key Design Characteristics
✨ **Glassmorphic Design** - Frosted glass effect on cards
🎨 **Gradient Rich** - Multiple gradient layers and effects
📱 **Modern UI** - Rounded corners, smooth transitions
🔮 **Premium Feel** - Shadows, blur effects, layering

---

## 🔄 Variant States

### CTA Buttons
- **Hover:** Brightness increase, shadow enhancement
- **Active:** Scale down (0.98) with shadow reduction
- **Focus:** Outline or glow effect

### Navigation Links
- **Active:** Underline or highlight
- **Hover:** Color brightening

### Flying Cards
- **Hover:** Scale up, blur reduction
- **Active:** Glow effect, brightness

---

## 📝 Usage Instructions

### For Web Implementation:
1. Extract SVG assets from Figma (7-day expiration)
2. Download or optimize images
3. Convert Tailwind classes to your CSS framework
4. Implement responsive design with media queries
5. Add interactivity to buttons and cards
6. Optimize animation performance

### File Structure Suggestion:
```
components/
├── Header/
│   ├── Navigation.tsx
│   └── Navigation.css
├── Hero/
│   ├── HeroSection.tsx
│   ├── HeroSection.css
│   ├── FlyingCard.tsx
│   └── Analytics.tsx
└── shared/
    ├── buttons.css
    └── variables.css
```

---

## 🔗 Related Resources

- [Figma Design Link](https://www.figma.com/design/DzknMU6pngIfcARtcTz6CZ/%E2%9C%85-WebAI-Pilot-Design?node-id=235-19941&m=dev)
- Asset URLs (see Assets section above)

---

**Last Updated:** April 11, 2026  
**Design Version:** 1.0  
**Status:** Ready for Implementation
