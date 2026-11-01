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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const siteUrl = env.VITE_SITE_URL.endsWith("/") ? env.VITE_SITE_URL : `${env.VITE_SITE_URL}/`;

  return {
    // Relative base keeps the build working at any GitHub Pages path (repo renames included).
    base: "./",
    plugins: [react(), seoFiles(siteUrl)],
    test: {
      environment: "node",
    },
  };
});
