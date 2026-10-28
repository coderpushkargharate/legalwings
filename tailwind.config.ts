import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic':
          'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      // Mappingg dashboard look: soft card shadows.
      boxShadow: {
        sm: '0 1px 2px rgba(16,36,30,.04), 0 8px 24px -16px rgba(16,36,30,.22)',
        DEFAULT: '0 1px 2px rgba(16,36,30,.05), 0 10px 26px -16px rgba(16,36,30,.26)',
        md: '0 10px 30px -18px rgba(16,36,30,.4)',
        lg: '0 18px 40px -20px rgba(16,36,30,.45)',
      },
      colors: {
        // Mappingg palette: `teal` is the forest-green accent, `slate` the warm greys.
        // Every existing teal-* / slate-* class picks these up, so pages need no edits.
        teal: {
          50: '#eef7f1',
          100: '#e3f2ea',
          200: '#cfe5d8',
          300: '#a5d0b8',
          400: '#5fae8a',
          500: '#0f7a55',
          600: '#0f5c47',
          700: '#0a4535',
          800: '#08392c',
          900: '#062b22',
          950: '#031a14',
        },
        slate: {
          50: '#f5f6f2',
          100: '#eeede7',
          200: '#e6e2d8',
          300: '#d6d2c6',
          400: '#9aa29c',
          500: '#6b746e',
          600: '#4e5a54',
          700: '#34413b',
          800: '#1b2a24',
          900: '#13201b',
          950: '#0b140f',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
