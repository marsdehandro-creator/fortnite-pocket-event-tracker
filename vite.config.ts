import { readFileSync } from "node:fs";
import { build as esbuild } from "esbuild";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

/** Emits robots.txt and sitemap.xml using the single VITE_SITE_URL setting. */
function seoFiles(siteUrl: string): Plugin {
  return {
    name: "seo-files",
    generateBundle() {
      const lastmod = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source:
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          `  <url><loc>${siteUrl}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>\n` +
          `</urlset>\n`,
      });
    },
  };
}

/**
 * Alert service worker: bundles src/sw/sw.ts into a single classic script at ./sw.js (module service workers
 * aren't supported everywhere yet), and publishes ./data/updates.json so background checks can read scheduled
 * updates. Served on the fly by the dev server too.
 */
function serviceWorker(): Plugin {
  // Offline caching only in real builds; the dev server's worker never caches.
  const bundleWorker = async (cache: boolean) => {
    const out = await esbuild({
      define: { __SW_CACHE__: String(cache) },
      entryPoints: ["src/sw/sw.ts"],
      bundle: true,
      format: "iife",
      target: "es2020",
      minify: true,
      write: false,
      logLevel: "silent",
    });
    return out.outputFiles[0].text;
  };
  const updatesJson = () => readFileSync("src/data/updates.json", "utf8");
  return {
    name: "service-worker",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split("?")[0];
        if (path === "/sw.js") {
          res.setHeader("Content-Type", "text/javascript");
          res.setHeader("Cache-Control", "no-cache");
          res.end(await bundleWorker(false));
        } else if (path === "/data/updates.json") {
          res.setHeader("Content-Type", "application/json");
          res.end(updatesJson());
        } else next();
      });
    },
    async generateBundle() {
      this.emitFile({ type: "asset", fileName: "sw.js", source: await bundleWorker(true) });
      this.emitFile({ type: "asset", fileName: "data/updates.json", source: updatesJson() });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = env.VITE_SITE_URL.endsWith("/") ? env.VITE_SITE_URL : `${env.VITE_SITE_URL}/`;

  return {
    // Relative base keeps the build working at any GitHub Pages path (repo renames included).
    base: "./",
    plugins: [react(), seoFiles(siteUrl), serviceWorker()],
    test: {
      environment: "node",
    },
  };
});
