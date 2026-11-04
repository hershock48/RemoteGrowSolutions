import type { Config } from "tailwindcss";

/**
 * Tokens inherited from the MI Gas build (migas/tailwind.config.ts), where
 * every value was read off the owner's own logo and measured for contrast.
 * Remote Grow Solutions is his product too, and until it has a mark of its own
 * it wears his: ink grounds, bone text, ember fills, flare for small accents.
 * The contrast table in that file holds here unchanged.
 *
 * Three additions for a tool rather than a brochure: `ok`, `warn` and `miss`
 * for the three severities the dashboard colours. Each measured on ink:
 *
 *   ok   #8FD17A on ink   10.9    on-target rooms, approved reports
 *   warn #F5A83C (flare)  10.3    attention
 *   miss #FF9E8C (alert)  10.3    missing submissions
 *
 * Nothing else in the app writes a colour.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: "#060403", panel: "#151010", raised: "#1E1715" },
        line: "#332621",
        edge: "#77604F",
        bone: "#F7F3EC",
        muted: "#A89C90",
        ember: { DEFAULT: "#D95E27", hot: "#F0722C", deep: "#8E2C11", core: "#5E1B0A" },
        flare: "#F5A83C",
        hot: "#FFEFA8",
        alert: "#FF9E8C",
        ok: "#8FD17A",
        warn: "#F5A83C",
        miss: "#FF9E8C",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      maxWidth: { content: "1180px" },
      borderRadius: { xl2: "18px" },
    },
  },
  plugins: [],
};
export default config;
