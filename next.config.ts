import type { NextConfig } from "next";

// Study build gate (vault ADR-008 P0-11): a Vercel production build without
// NEXT_PUBLIC_STUDY_BUILD=1 would ship guest mode and stamp rows
// study_build = false. Fail the build instead of deploying it. Previews and
// local builds are unaffected.
if (process.env.VERCEL_ENV === "production" && process.env.NEXT_PUBLIC_STUDY_BUILD !== "1") {
  throw new Error(
    "NEXT_PUBLIC_STUDY_BUILD must be '1' for production builds (vault ADR-008 P0-11). " +
      "Set it in Vercel → Settings → Environment Variables (Production) and redeploy.",
  );
}

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  env: {
    // Git commit of this build, inlined into the bundle: stamped on log rows
    // (lib/build-stamp.ts) and served by /api/build-info for the freeze check.
    NEXT_PUBLIC_BUILD_SHA: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  },
};

export default nextConfig;
