/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
      },
      boxShadow: {
        premium:
          "0 2px 8px rgba(15, 23, 42, 0.04), 0 20px 50px rgba(49, 46, 129, 0.08)",
        nav: "0 1px 0 rgba(15, 23, 42, 0.06), 0 4px 24px rgba(15, 23, 42, 0.04)",
      },
      colors: {
        primary: {
          DEFAULT: "var(--color-primary)",
          500: "var(--color-primary)",
          600: "var(--color-primary)",
        },
        accent: {
          DEFAULT: "var(--color-secondary)",
          500: "var(--color-secondary)",
        },
      },
      backgroundImage: {
        "mesh-app":
          "radial-gradient(ellipse 100% 80% at 0% -30%, rgba(99, 102, 241, 0.09), transparent 55%), radial-gradient(ellipse 80% 50% at 100% 0%, rgba(139, 92, 246, 0.07), transparent 50%), radial-gradient(ellipse 60% 40% at 50% 100%, rgba(120, 113, 108, 0.04), transparent 50%)",
      },
    },
  },
  plugins: [],
};
