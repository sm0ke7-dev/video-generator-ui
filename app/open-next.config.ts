import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Force Webpack instead of Turbopack for production builds.
// Next.js 16 defaults to Turbopack, but the opennextjs-cloudflare Turbopack
// chunk-inlining patch does not work on Windows — the `requireChunk` function
// is left as a stub that throws, causing a ChunkLoadError at runtime.
const config = defineCloudflareConfig({});

// buildCommand is a valid OpenNextConfig field but not exposed in
// CloudflareOverrides — set it directly on the returned config object.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(config as any).buildCommand = "next build --webpack";

export default config;
