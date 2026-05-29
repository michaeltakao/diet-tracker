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

  // ── Enforce the HttpClient wrapper for internal API calls ─────
  // Raw fetch() in UI code must go through postJson() (lib/httpClient.ts),
  // which centralizes JSON handling + HttpError. Scoped to app/ and
  // components/ so the wrapper itself (lib/httpClient.ts) and the service
  // worker (public/sw.js, not linted) remain free to call fetch directly.
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": ["error", {
        name: "fetch",
        message:
          "Use postJson() from '@/lib/httpClient' for internal API calls instead of raw fetch().",
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
