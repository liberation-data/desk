# The Desk website

The landing page at [liberation-data.com/desk](https://liberation-data.com/desk/): one Astro page,
`src/pages/index.astro`, styles and scripts included.

```bash
cd website
npm ci
npm run dev       # http://localhost:4321/desk/
npm run build     # dist/
```

`.github/workflows/website.yml` builds it on every pull request that touches it and publishes it to GitHub
Pages from `main` (the repository's Pages source must be set to GitHub Actions).

A project's Pages site takes the custom domain of its organization's `liberation-data.github.io` repository.
liberation-data.com is served from `liberation-data/website` instead, so until that repository is renamed
`liberation-data.github.io` the site is at [liberation-data.github.io/desk](https://liberation-data.github.io/desk/),
and its canonical and Open Graph links, which name liberation-data.com, point at a page that is not there yet.

- **Screenshots** are the README's own, imported from `../docs/screenshots`. Retake them there
  (`npm run screenshots` at the repository root) and the site follows on its next build.
- **The sky** (`src/assets/sky.png`) was generated for the site.
- **The elements strip** at the foot of the page — Liberation Data's projects as the four elements of
  Embabel Worlds — is shared with [fornax4j.org](https://fornax4j.org) and [drivine.org](https://drivine.org).
  Keep the three in step, apart from the colours and which element is lit.
