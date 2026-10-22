/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eef6ff", 100: "#d9eaff", 200: "#bcdaff", 300: "#8ec2ff",
          400: "#599fff", 500: "#337bfc", 600: "#1d5cf1", 700: "#1548de",
          800: "#183cb3", 900: "#1a378d", 950: "#152356",
        },
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
