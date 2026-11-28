// @ts-check
import { defineConfig } from 'astro/config';

// One landing page (src/pages/index.astro), served under /desk/ on liberation-data.com, the Liberation Data site, as
// GitHub Pages serves a project's site under its organization's. Its screenshots are the README's own, from
// ../docs/screenshots, so the vite server may read the repository above the site.
export default defineConfig({
    site: 'https://liberation-data.com',
    base: '/desk',
    vite: { server: { fs: { allow: ['..'] } } }
});
