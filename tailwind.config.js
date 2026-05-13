/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark surface tones. Names kept as "sand" so existing component
        // classes still apply.
        sand: {
          50: '#0f1119',   // page background
          100: '#181c28',  // card / panel surface
          200: '#252b3c',  // borders, separators
          300: '#33394e',  // raised border / hover
        },
        ink: {
          300: '#5a5d68',
          400: '#8a8e99',
          500: '#aeb1bc',
          700: '#dadce4',
          900: '#f2f3f8',
        },
        // "sage" — repurposed as PASTEL PINK. The primary brand highlight,
        // used for the logo, send button, focus rings, "today" indicator,
        // capacity bars, etc. Name kept for backwards-compat with existing
        // class strings.
        sage: {
          50: '#3a1d2c',
          100: '#4a2538',
          200: '#6e3a52',
          300: '#9c5577',
          400: '#ff9ec7',
          500: '#ffb8d4',  // pastel pink — main highlight
          600: '#ffcde0',
          700: '#ffe0eb',
        },
        // "clay" — repurposed as BERRY. Non-negotiable tasks (deep, saturated
        // raspberry — clearly distinct from the soft pink highlight).
        clay: {
          100: '#3d1530',
          200: '#5a1c44',
          300: '#a02e6e',
          400: '#e84d96',  // berry accent
          500: '#f070ad',
        },
        // Pastel coral — gentle alerts.
        rose: {
          100: '#3a1d24',
          200: '#572b34',
          300: '#a85060',
          400: '#ff9eb1',
          500: '#ffb8c8',
        },
        // Lavender — clearly purple.  Used for EVENTS.
        lavender: {
          100: '#291846',
          200: '#3d2870',
          300: '#6a4cae',
          400: '#a880f0',
          500: '#c4a8ff',  // pastel purple
          600: '#dac8ff',
        },
        // Sky — light blue.  Used for NEGOTIABLE tasks.
        sky: {
          100: '#1a2a4a',
          200: '#244070',
          300: '#4774b8',
          400: '#8cc2ff',
          500: '#b0d8ff',  // pastel sky
          600: '#cce4ff',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"DM Serif Display"', 'ui-serif', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.25), 0 4px 16px rgba(0,0,0,0.2)',
        lift: '0 6px 24px rgba(0,0,0,0.4)',
        glow: '0 0 0 1px rgba(184,168,208,0.18), 0 8px 32px rgba(184,168,208,0.12)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
};
