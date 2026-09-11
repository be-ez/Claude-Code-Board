/** @type {import('tailwindcss').Config} */
const palette = require('tailwindcss/colors');
const plugin = require('tailwindcss/plugin');

/**
 * Theme tokens.
 *
 * Every colour below is emitted as a CSS variable (`--c-*`) with a light and a
 * dark value, and the Tailwind palette points at that variable. That keeps an
 * existing class like `text-gray-700` meaning "body text" in both themes,
 * instead of needing a `dark:` twin on all ~600 call sites.
 */
const toRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const tokens = {};
/** Register a token and return the Tailwind colour value that reads it. */
const token = (name, light, dark) => {
  tokens[name] = { light: toRgb(light), dark: toRgb(dark) };
  return `rgb(var(--c-${name}) / <alpha-value>)`;
};

// Neutral ramp. The shade number means "how much contrast against the page",
// so in dark mode the ramp runs the other way round in absolute lightness.
const GRAY = {
  50: ['#f9fafb', '#1e293b'],
  100: ['#f3f4f6', '#273449'],
  200: ['#e5e7eb', '#334155'],
  300: ['#d1d5db', '#475569'],
  400: ['#9ca3af', '#7a8798'],
  500: ['#6b7280', '#97a3b4'],
  600: ['#4b5563', '#b6c0cd'],
  700: ['#374151', '#d4dbe4'],
  800: ['#1f2937', '#e8ecf1'],
  900: ['#111827', '#f8fafc'],
};
const gray = Object.fromEntries(
  Object.entries(GRAY).map(([shade, [light, dark]]) => [shade, token(`gray-${shade}`, light, dark)])
);

// `white` is two different things here: an opaque surface (`bg-white`,
// `bg-white/50`) and a highlight edge (`border-white/40`). Only the surface
// follows the theme — `text-white` on coloured buttons stays white.
const surface = token('surface', '#ffffff', '#1e293b');
const edge = token('edge', '#ffffff', '#94a3b8');

// Accent ramps: pale tints are used as backgrounds and deep shades as text,
// so the two halves swap roles in dark mode. `slate` is deliberately excluded
// so it stays available as a fixed, always-dark scale (code, terminal output).
const ACCENTS = [
  'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky',
];
// The semantic palettes below are re-spellings of stock Tailwind ramps, so
// they follow the same rules.
const SEMANTIC = { primary: 'blue', success: 'green', warning: 'yellow', danger: 'red' };
const RAMPS = [
  ...ACCENTS.map((name) => [name, name]),
  ...Object.entries(SEMANTIC),
];
const TINT = { 50: 950, 100: 900, 200: 800, 300: 700 };
const INK = { 600: 400, 700: 300, 800: 300, 900: 200 };

const ramp = (map, suffix) =>
  Object.fromEntries(
    RAMPS.map(([name, source]) => [
      name,
      Object.fromEntries(
        Object.entries(map).map(([shade, darkShade]) => [
          shade,
          token(`${name}-${shade}-${suffix}`, palette[source][shade], palette[source][darkShade]),
        ])
      ),
    ])
  );

const tints = ramp(TINT, 'bg');
const inks = ramp(INK, 'fg');

const declarations = (variant) =>
  Object.fromEntries(Object.entries(tokens).map(([name, value]) => [`--c-${name}`, value[variant]]));

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray,
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        },
        warning: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        danger: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
        },
        glass: {
          light: 'var(--glass-bg)',
          border: 'var(--glass-border)',
          hover: 'var(--glass-bg-hover)',
        }
      },
      // Per-utility overrides: the same shade plays opposite roles depending on
      // whether it paints a surface or paints text.
      backgroundColor: { white: surface, ...tints },
      gradientColorStops: { white: surface, ...tints },
      borderColor: { white: edge, ...tints },
      ringColor: { white: edge },
      divideColor: { white: edge },
      textColor: inks,
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '24px',
        '3xl': '40px',
      },
      backdropSaturate: {
        0: '0',
        50: '.5',
        100: '1',
        150: '1.5',
        200: '2',
      },
      boxShadow: {
        'soft': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'soft-md': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'soft-lg': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'blue': '0 10px 40px -10px rgba(59, 130, 246, 0.25)',
        'purple': '0 10px 40px -10px rgba(147, 51, 234, 0.25)',
        'green': '0 10px 40px -10px rgba(34, 197, 94, 0.25)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '0.4' }
        }
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    plugin(({ addBase }) => {
      addBase({
        ':root': { 'color-scheme': 'light', ...declarations('light') },
        '.dark': { 'color-scheme': 'dark', ...declarations('dark') },
      });
    }),
  ],
}
