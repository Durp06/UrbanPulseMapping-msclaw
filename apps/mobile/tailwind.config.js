/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D6A4F',
          light: '#40916C',
          dark: '#1B4332',
        },
        accent: {
          DEFAULT: '#52B788',
          light: '#95D5B2',
          lightest: '#D8F3DC',
        },
        warning: '#E9C46A',
        error: '#E76F51',
        cooldown: '#ADB5BD',
        background: '#F8FAF9',
        surface: '#FFFFFF',
      },
    },
  },
  plugins: [],
};
