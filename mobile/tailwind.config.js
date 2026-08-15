/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./context/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: { brand: "#4fd6be", ink: "#07110f", panel: "#10221e" },
    },
  },
  plugins: [],
};
