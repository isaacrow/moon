# Apple Store Theme - Official Apple.com Design

## Overview

The **Apple Store** theme brings the official Apple.com product showcase design to the Moon BIBFRAME Catalog System. This theme captures the clean, minimalist aesthetic of Apple's website with hero sections, gradient backgrounds, signature blue CTAs, and professional product cards.

## Theme Features

### Visual Design
- **Clean White Backgrounds** - Spacious, minimal design with breathing room
- **Apple Blue CTAs** (#0071E3) - The signature Apple blue for call-to-action buttons
- **Gradient Sections** - Light blue gradients inspired by iPad Air marketing
- **Dark Hero Sections** - Black backgrounds with glowing product showcases (MacBook Pro style)
- **Professional Shadows** - Subtle depth with carefully crafted drop shadows
- **Product Cards** - Clean cards with hover animations

### Typography
- **Hero Headlines** - Large, bold headlines (clamp 32px-56px) with tight letter spacing
- **SF Pro-inspired** - System font stack with optimized font weights
- **Responsive Text** - Fluid typography that scales beautifully across devices

### Components

#### 1. Hero Section (`.apple-hero`)
Large, centered sections perfect for introducing features:
```tsx
<section className="apple-hero">
  <div className="apple-container">
    <h1 className="apple-hero-title">Welcome to Moon</h1>
    <p className="apple-hero-subtitle">Experience cataloging like never before</p>
    <Button className="apple-cta">Get Started</Button>
  </div>
</section>
```

#### 2. Blue CTA Button (`.apple-cta`)
The signature Apple blue button with pill shape:
```tsx
<Button className="apple-cta">Buy</Button>
```

#### 3. Product Cards (`.apple-product-card`)
Clean cards with hover effects:
```tsx
<Card className="apple-product-card">
  <CardContent>
    <h3 className="apple-product-title">iPhone 16</h3>
    <p className="apple-product-description">Latest generation</p>
    <Button className="apple-cta">Learn more</Button>
  </CardContent>
</Card>
```

#### 4. Gradient Section (`.apple-gradient-section`)
Light blue gradient backgrounds like iPad Air section:
```tsx
<section className="apple-gradient-section">
  <div className="apple-container">
    {/* Your content */}
  </div>
</section>
```

#### 5. Dark Section (`.apple-dark-section`)
Black backgrounds for premium products:
```tsx
<section className="apple-dark-section">
  <div className="apple-container">
    <h2 className="apple-product-title">MacBook Pro</h2>
  </div>
</section>
```

#### 6. Product Grid (`.apple-grid`)
Responsive grid for multiple products:
```tsx
<div className="apple-grid">
  {/* Product cards */}
</div>
```

## Utility Classes

### Quick Styling
- `.apple-buy-button` - Instant Apple blue CTA
- `.apple-product` - Quick product card styling
- `.apple-heading` - Hero headline style
- `.apple-subheading` - Subtitle style
- `.apple-container` - Max-width container (1200px)
- `.apple-badge` - Blue badge/tag
- `.apple-divider` - Subtle horizontal divider

### Animations
- `.animate-fade-in` - Fade in from bottom
- `.animate-scale-in` - Scale in with fade
- `.animate-glow` - Pulsing glow effect

## Color Palette

```css
--apple-blue: #0071E3          /* Primary CTA blue */
--apple-blue-hover: #0077ED    /* Hover state */
--apple-gray: #86868B          /* Body text */
--apple-light-gray: #F5F5F7    /* Subtle backgrounds */
--apple-dark: #1D1D1F          /* Dark text */
--apple-white: #FBFBFD         /* Clean white */
```

## Spacing System

```css
--apple-spacing-xs: 8px
--apple-spacing-sm: 16px
--apple-spacing-md: 24px
--apple-spacing-lg: 48px
--apple-spacing-xl: 80px
```

## Border Radius

```css
--apple-radius-sm: 8px         /* Inputs, small elements */
--apple-radius-md: 12px        /* Cards */
--apple-radius-lg: 18px        /* Product cards */
--apple-radius-xl: 24px        /* Large sections */
```

## Responsive Behavior

### Mobile (< 768px)
- Single column grid
- Smaller hero text
- Full-width CTAs
- Reduced padding

### Tablet (769px - 1024px)
- Two column grid
- Medium spacing
- Balanced typography

### Desktop (> 1024px)
- Three+ column grid
- Large hero sections
- Enhanced hover effects
- Maximum spacing

## Dark Mode Support

The Apple Store theme fully supports dark mode:
- Automatic color inversion
- Adjusted shadows and glows
- Maintained contrast ratios
- Dark backgrounds with light text

## Usage in Moon

### Switching to Apple Store Theme

1. **Via Theme Selector** - Click the theme icon in the top navigation bar
2. **Via Theme Showcase** - Navigate to Theme Gallery and select "Apple Store"
3. **Persisted** - Your choice is saved in localStorage

### Theme-Specific Features

When Apple Store theme is active:
- All buttons get refined styling
- Cards receive clean white backgrounds
- Inputs adopt Apple-style borders
- Animations use fade-in effects
- Typography follows Apple guidelines

## Best Practices

### Do's ✅
- Use `.apple-cta` for primary actions
- Embrace white space
- Use gradient sections sparingly
- Keep typography clean and readable
- Use product cards for catalog items

### Don'ts ❌
- Don't over-style components
- Avoid cluttered layouts
- Don't use too many colors
- Avoid tiny font sizes
- Don't ignore mobile responsiveness

## Example Implementation

See `/src/app/components/AppleStoreDemo.tsx` for a complete example showcasing:
- Hero sections
- Gradient backgrounds
- Dark product showcases
- Product grids
- CTAs and navigation

## Comparison with Other Themes

| Feature | iOS 26 | macOS | Apple Store | Classic |
|---------|--------|-------|-------------|---------|
| Style | Modern, Vibrant | Professional | Product Showcase | Traditional |
| Colors | Gradients | Subtle | Blue Focus | Standard |
| Effects | Glassmorphism | Blur | Shadows | Minimal |
| Use Case | Dynamic UI | Desktop Apps | Marketing | Universal |

## Technical Details

- **CSS File**: `/src/styles/apple-themes.css`
- **Theme Class**: `.theme-apple-store`
- **Context**: `ThemeContext.tsx`
- **Type**: `'apple-store'`

## Accessibility

- WCAG AA compliant contrast ratios
- Keyboard navigation support
- Screen reader friendly
- Focus indicators maintained
- Reduced motion support

## Browser Support

- Chrome/Edge (latest)
- Safari (latest)
- Firefox (latest)
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android)

## Credits

Inspired by:
- Apple.com official website design
- iOS design guidelines
- macOS interface patterns
- Apple Human Interface Guidelines

---

**Built with ❤️ for the Moon BIBFRAME Catalog System**
