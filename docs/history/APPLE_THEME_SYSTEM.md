# 🎨 Moon Apple-Inspired Theme System

## Overview

The Moon application now features a comprehensive Apple-inspired theming system with three distinct design languages: **iOS 26**, **macOS**, and **Classic**. This system provides a cohesive, visually stunning experience across the entire bibliographic cataloging application.

## Theme Options

### 🌟 iOS 26 Theme
**Modern, Vibrant, Glassmorphic**

The iOS 26 theme brings the latest Apple mobile design language to Moon:

- **Glassmorphism Effects**: Frosted glass panels with backdrop blur
- **Vibrant Gradients**: Dynamic color gradients for cards and buttons
- **Bounce Animations**: Spring-like interactions that feel alive
- **Rounded Corners**: Generous 20px border radius
- **Dynamic Shadows**: Depth-aware shadow system
- **iOS-Style Transitions**: Smooth 0.35s cubic-bezier animations

**Best for**: Users who want a modern, colorful, and dynamic interface

### 💻 macOS Theme
**Clean, Spacious, Professional**

The macOS theme provides a desktop-class experience:

- **Subtle Backdrop Blur**: Professional frosted glass effect
- **Clean Typography**: San Francisco-inspired font weights
- **Spacious Layouts**: Generous padding and breathing room
- **Refined Borders**: Subtle 1px borders with low opacity
- **Professional Shadows**: Multi-layered shadow system
- **Smooth Transitions**: Fast 0.25s animations

**Best for**: Professional catalogers who prefer a clean, distraction-free workspace

### 📚 Classic Theme
**Traditional, Familiar, Universal**

The Classic theme offers a timeless design:

- **Traditional Styling**: Familiar UI patterns
- **Standard Components**: Conventional design elements
- **Consistent Spacing**: Predictable layout system
- **Simple Transitions**: Quick 0.2s ease animations
- **Universal Compatibility**: Works everywhere

**Best for**: Users who prefer traditional interfaces or have accessibility needs

## Features

### 🎯 Key Capabilities

1. **Instant Theme Switching**
   - Switch between themes in real-time from the top navigation bar
   - Themes persist across sessions via localStorage
   - Smooth transitions when switching themes

2. **Dark Mode Support**
   - All three themes fully support dark mode
   - Independent dark mode toggle in navigation bar
   - Optimized color schemes for both light and dark

3. **Bilingual Support**
   - RTL-aware layouts for Arabic
   - Theme names in both English and Arabic
   - Consistent experience in both languages

4. **Component-Aware Styling**
   - Cards, buttons, inputs automatically adapt to theme
   - Modals and dialogs themed appropriately
   - Badges, tooltips, and menus styled per theme

5. **Animation System**
   - iOS 26: Bounce animations, shimmer effects
   - macOS: Slide-in animations, fade effects
   - Classic: Standard ease transitions

## Using the Theme System

### For Users

1. **Access Theme Selector**
   - Look for the 🎨 paint brush icon in the top navigation bar
   - Click to open the theme dropdown menu

2. **Select Your Theme**
   - Choose from iOS 26, macOS, or Classic
   - Theme applies instantly across the entire app
   - Your choice is saved automatically

3. **Explore Theme Showcase**
   - Navigate to Dashboard
   - Find "🎨 Theme Gallery / معرض الثيمات" in the tools section
   - Interactive showcase with live component previews

### For Developers

#### Theme Context

```tsx
import { useTheme } from './contexts/ThemeContext';

function MyComponent() {
  const { themeStyle, setThemeStyle, darkMode, setDarkMode } = useTheme();
  
  // Current theme: 'ios26' | 'macos' | 'classic'
  console.log(themeStyle);
  
  // Switch theme
  setThemeStyle('ios26');
  
  // Toggle dark mode
  setDarkMode(!darkMode);
}
```

#### Theme-Aware Components

```tsx
// Apply theme-specific classes
const cardClass = themeStyle === 'ios26' 
  ? 'ios-card' 
  : themeStyle === 'macos' 
  ? 'macos-card' 
  : '';

<Card className={cardClass}>
  {/* Content */}
</Card>
```

#### Using Theme Variables

```css
/* iOS 26 Variables */
.theme-ios26 {
  --ios-blue: #007AFF;
  --ios-purple: #AF52DE;
  --ios-glass-bg: rgba(255, 255, 255, 0.72);
  --ios-blur: blur(20px);
  --ios-radius-lg: 20px;
  --ios-shadow-xl: 0 16px 48px rgba(0, 0, 0, 0.16);
}

/* macOS Variables */
.theme-macos {
  --macos-blue: #0071E3;
  --macos-glass-bg: rgba(245, 245, 247, 0.8);
  --macos-blur: blur(40px);
  --macos-radius-md: 12px;
  --macos-shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.08);
}
```

## CSS Classes Reference

### iOS 26 Theme Classes

| Class | Purpose |
|-------|---------|
| `.ios-navbar` | Glassmorphic navigation bar |
| `.ios-card` | Glass effect card with hover animation |
| `.ios-button` | Rounded button with active scale |
| `.ios-input` | Glass input with focus ring |
| `.ios-panel` | Large glass panel container |
| `.ios-gradient-card` | Gradient background card |

### macOS Theme Classes

| Class | Purpose |
|-------|---------|
| `.macos-navbar` | Professional navigation bar |
| `.macos-window` | Window-style container |
| `.macos-card` | Clean card with subtle shadow |
| `.macos-button` | Standard macOS button |
| `.macos-input` | Clean input field |
| `.macos-sidebar` | Sidebar with blur effect |

### Utility Classes

| Class | Purpose |
|-------|---------|
| `.glass-effect` | Apply glassmorphism to any element |
| `.loading` | Theme-aware loading animation |
| `.shimmer` | iOS shimmer effect (iOS 26 only) |
| `.bounce-in` | Bounce-in animation (iOS 26) |
| `.slide-in` | Slide-in animation (macOS) |

## Component Styling

### Automatic Styling

Many components automatically adapt to the active theme:

- **Buttons**: Border radius, font weight, transitions
- **Cards**: Background, borders, shadows, hover effects
- **Inputs**: Border radius, focus states, glass effects
- **Dialogs**: Backdrop blur, shadows, border radius
- **Badges**: Padding, border radius, font weight
- **Tooltips**: Background blur, sizing, typography
- **Menus**: Glass effects, spacing, animations
- **Tables**: Border radius, typography
- **Tabs**: Styling, transitions
- **Progress bars**: Border radius, colors
- **Checkboxes/Radios**: Border radius, transitions

### Manual Theming

For custom components, use the `useTheme()` hook:

```tsx
function CustomComponent() {
  const { themeStyle } = useTheme();
  
  return (
    <div className={`
      p-4 
      ${themeStyle === 'ios26' ? 'rounded-3xl bg-gradient-to-br from-blue-500 to-purple-500' : ''}
      ${themeStyle === 'macos' ? 'rounded-2xl bg-gray-100' : ''}
      ${themeStyle === 'classic' ? 'rounded-lg border border-gray-300' : ''}
    `}>
      {/* Content */}
    </div>
  );
}
```

## Animation System

### iOS 26 Animations

```css
/* Bounce-in (entry animation) */
.bounce-in {
  animation: ios-bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* Shimmer (loading effect) */
.shimmer {
  animation: ios-shimmer 2s infinite;
}

/* Active state */
.ios-button:active {
  transform: scale(0.96);
}
```

### macOS Animations

```css
/* Slide-in (entry animation) */
.slide-in {
  animation: macos-slide-in 0.3s ease-out;
}

/* Fade (loading effect) */
.loading {
  animation: macos-fade 1.5s ease-in-out infinite;
}

/* Hover state */
.macos-button:hover {
  transform: translateY(-1px);
}
```

## Accessibility

All themes maintain WCAG 2.1 AA compliance:

- **Color Contrast**: Minimum 4.5:1 for text
- **Focus Indicators**: Visible focus rings
- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Semantic HTML and ARIA labels
- **Motion**: Respects prefers-reduced-motion

## Performance

The theme system is optimized for performance:

- **CSS Variables**: Fast theme switching without re-rendering
- **Hardware Acceleration**: GPU-accelerated transforms
- **Lazy Loading**: Theme assets load on-demand
- **LocalStorage**: Instant theme restoration
- **Minimal Reflows**: CSS-only theme changes

## Browser Support

- **Chrome/Edge**: Full support (94+)
- **Firefox**: Full support (90+)
- **Safari**: Full support (14+)
- **iOS Safari**: Full support (14+)
- **Android Chrome**: Full support (94+)

## File Structure

```
src/
├── app/
│   ├── contexts/
│   │   └── ThemeContext.tsx        # Theme state management
│   └── components/
│       ├── ThemeSelector.tsx        # Theme dropdown in navbar
│       └── ThemeShowcase.tsx        # Interactive theme gallery
└── styles/
    └── apple-themes.css             # All theme styles
```

## Migration Guide

### From No Theming to Theme System

**Before:**
```tsx
<Card className="rounded-lg shadow-md">
  <Button className="rounded-md">Click</Button>
</Card>
```

**After:**
```tsx
const { themeStyle } = useTheme();

<Card className={themeStyle === 'ios26' ? 'ios-card' : ''}>
  <Button className={themeStyle === 'ios26' ? 'ios-button' : ''}>
    Click
  </Button>
</Card>
```

**Better (automatic):**
```tsx
// Components automatically adapt!
<Card>
  <Button>Click</Button>
</Card>
```

## Customization

### Adding a New Theme

1. Define theme in `ThemeContext.tsx`:
```tsx
export type ThemeStyle = 'ios26' | 'macos' | 'classic' | 'custom';
```

2. Add CSS variables in `apple-themes.css`:
```css
.theme-custom {
  --custom-color: #FF0000;
  --custom-radius: 8px;
}
```

3. Update `ThemeSelector.tsx` with new option

### Modifying Existing Themes

Edit variables in `apple-themes.css`:

```css
.theme-ios26 {
  /* Change primary blue */
  --ios-blue: #0066CC; /* was #007AFF */
  
  /* Adjust border radius */
  --ios-radius-lg: 24px; /* was 20px */
}
```

## Best Practices

1. **Use Theme Variables**: Prefer CSS variables over hardcoded values
2. **Respect Theme Choice**: Let components adapt automatically
3. **Test All Themes**: Verify components in all three themes
4. **Consider Dark Mode**: Always test both light and dark modes
5. **Smooth Transitions**: Use theme-appropriate animation speeds
6. **Accessibility First**: Maintain contrast and focus states
7. **Performance**: Avoid JavaScript-heavy theme changes

## Troubleshooting

### Theme Not Applying

1. Check if ThemeProvider wraps your app
2. Verify theme class on `<html>` element
3. Clear localStorage and try again
4. Check browser console for errors

### Animations Not Working

1. Verify CSS file is imported
2. Check for CSS conflicts
3. Ensure class names match exactly
4. Test in different browser

### Dark Mode Issues

1. Verify dark mode toggle updates context
2. Check dark: prefixes in Tailwind classes
3. Test theme-specific dark mode variables
4. Clear browser cache

## Future Enhancements

Planned features for the theme system:

- [ ] Custom theme creator
- [ ] Theme presets (Sunset, Ocean, Forest)
- [ ] Per-component theme overrides
- [ ] Theme scheduling (auto dark mode)
- [ ] Export/import theme configurations
- [ ] Community theme gallery
- [ ] A11y theme (high contrast)
- [ ] Print-optimized theme

## Credits

Inspired by:
- Apple iOS 18+ Design System
- Apple macOS Sonoma+ Design Language
- Apple Human Interface Guidelines
- Material Design 3
- Fluent Design System

## License

Part of the Moon BIBFRAME Cataloging System
© 2026 Moon Project

---

**Quick Links:**
- [Dashboard](#) → Access Theme Showcase
- [ThemeSelector Component](../src/app/components/ThemeSelector.tsx)
- [ThemeContext](../src/app/contexts/ThemeContext.tsx)
- [Theme Styles](../src/styles/apple-themes.css)
