/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Nunito_400Regular', 'System'],
        bold: ['Nunito_700Bold', 'System'],
        medium: ['Nunito_500Medium', 'System'],
        semibold: ['Nunito_600SemiBold', 'System'],
      }
    },
  },
  plugins: [],
}