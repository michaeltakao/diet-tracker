import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // ── Project-specific rule overrides ───────────────────────────
  {
    rules: {
      // Our useEffect patterns (loading from localStorage, reading platform)
      // intentionally call setState synchronously — this is valid for
      // reading external state that exists outside React's lifecycle.
      "react-hooks/set-state-in-effect": "warn",

      // <img> tags used for meal photos (base64 data URLs).
      // next/image doesn't support data: URLs.
      "@next/next/no-img-element": "warn",

      // Unused vars: warn only, allow _ prefix for intentionally unused.
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },

  // ── Ignored paths ─────────────────────────────────────────────
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "supabase/**",
  ]),
]);

export default eslintConfig;
