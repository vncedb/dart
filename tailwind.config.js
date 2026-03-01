/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans:      ['Nunito_400Regular', 'System'],
        medium:    ['Nunito_500Medium', 'System'],
        semibold:  ['Nunito_600SemiBold', 'System'],
        bold:      ['Nunito_700Bold', 'System'],
        extrabold: ['Nunito_800ExtraBold', 'System'],
        black:     ['Nunito_900Black', 'System'],
      },
      fontSize: {
        'micro':   ['10px', { lineHeight: '14px', letterSpacing: '0.5px' }],
        'label':   ['11px', { lineHeight: '14px', letterSpacing: '0.8px' }],
        'caption': ['12px', { lineHeight: '16px', letterSpacing: '0.2px' }],
        'sm':      ['13px', { lineHeight: '18px' }],
        'base':    ['15px', { lineHeight: '22px' }],
        'h4':      ['16px', { lineHeight: '22px', letterSpacing: '-0.1px' }],
        'h3':      ['18px', { lineHeight: '24px', letterSpacing: '-0.2px' }],
        'h2':      ['22px', { lineHeight: '28px', letterSpacing: '-0.3px' }],
        'h1':      ['28px', { lineHeight: '34px', letterSpacing: '-0.5px' }],
        'display': ['34px', { lineHeight: '40px', letterSpacing: '-1px' }],
      },
    },
  },
  plugins: [],
}
