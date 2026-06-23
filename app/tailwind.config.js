/** @type {import('tailwindcss').Config} */
// Tokens transcribed from DESIGN.md (Apple-inspired). Single blue accent, SF Pro
// type via the system stack, exactly one product shadow.
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // system-ui resolves to real SF Pro on macOS/iOS; Inter is the fallback.
        display: [
          "-apple-system",
          "system-ui",
          "SF Pro Display",
          "Inter",
          "sans-serif",
        ],
        sans: [
          "-apple-system",
          "system-ui",
          "SF Pro Text",
          "Inter",
          "sans-serif",
        ],
        mono: ["ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      colors: {
        action: "#0066cc",
        "action-focus": "#0071e3",
        "action-dark": "#2997ff",
        ink: "#1d1d1f",
        canvas: "#ffffff",
        parchment: "#f5f5f7",
        pearl: "#fafafc",
        tile1: "#272729",
        tile2: "#2a2a2c",
        tile3: "#252527",
        hairline: "#e0e0e0",
        divider: "#f0f0f0",
        muted80: "#333333",
        muted48: "#7a7a7a",
        "on-dark-muted": "#cccccc",
      },
      borderRadius: {
        xs: "5px",
        sm: "8px",
        md: "11px",
        lg: "18px",
        pill: "9999px",
      },
      spacing: {
        section: "80px",
      },
      boxShadow: {
        // the ONE shadow in the system — for the "product" only
        product: "rgba(0, 0, 0, 0.22) 3px 5px 30px 0",
      },
      letterSpacing: {
        tightest: "-0.374px",
        appletight: "-0.28px",
      },
      maxWidth: {
        content: "980px",
        grid: "1080px",
      },
    },
  },
  plugins: [],
};
