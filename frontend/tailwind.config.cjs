/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        baba: {
          primary: "#0B1C2D",     // Navy
          accent: "#C6A75E",      // Gold
          background: "#F8F6F1",  // Ivory
          softbg: "#EFE8DC",      // Light beige
          textdark: "#1C1C1C",    // Dark text
          border: "#E5E7EB",      // Light border
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        serif: ["Playfair Display", "serif"],
      },
      borderRadius: {
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      boxShadow: {
        premium: "0 10px 30px rgba(0,0,0,0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};