# Releasing

Desk is released by CI, from a merge. Nothing is published from a laptop, and there is no version to bump by hand.

## The process

1. **Merge.** A merge to `main` that changes what the package ships (`src/`, the README, `llms.txt`, `package.json`
   and the few files that build it) starts the Release workflow (`.github/workflows/publish.yml`). It runs CI and a
   dry run of the package, then waits for approval in the `release` environment.
2. **Approve when you want it out.** Merge as many pull requests as you like first: only one release waits at a time,
   and approving it releases what `main` holds then. More merged while one waits queues one more release behind it;
   once the first has released everything, that one finds nothing new and does nothing, so reject it or let it run.
3. **CI releases.** Approved, the job plans the version from `main`, runs `npm run check`, packs and checks the
   package, installs it alone and loads it, and publishes it with provenance. Then it commits the version to `main`
   ("Release vX.Y.Z", changing only `package.json` and `package-lock.json`), tags that commit `vX.Y.Z`, and creates
   the GitHub release with notes since the last one.

## The version

`scripts/release-plan.sh` works it out: the last release (the later of the newest `vX.Y.Z` tag and npm's `latest`),
bumped by the biggest change merged since that tag, one pull request at a time.

- **A label decides,** when a pull request has one: `release: major`, `release: minor`, `release: patch` or
  `release: none`.
- **Without one,** a pull request that changes `src/` is a **minor** release, one that changes only other files the
  package ships (the README, `llms.txt`) is a **patch**, and one that ships nothing (CI, tests, `docs/`) is **none**.
- A change pushed to `main` without a pull request counts as minor.

Run it yourself to see what a release would be: `scripts/release-plan.sh origin/main`. It only reads.

## Credentials

npm trusted publishing (OIDC): npm trusts this repository's `publish.yml` from the `release` environment, so there is
no token to keep, and every version carries provenance. Keep the file's name, or update the package's trusted
publisher on npmjs.com to match. An `NPM_TOKEN` secret, if set, is used as a fallback.

The `release` environment has a required reviewer, and only `main` (and `v*` tags) may deploy to it. That approval is
the human checkpoint before anything goes out, and it is why a pull request can't publish: its runs aren't on `main`.

## Dry runs and by hand

- A pull request that changes the release machinery or `package.json` runs the workflow as a dry run: plan, CI, pack,
  checks and `npm publish --dry-run`, with the package left as an artifact.
- **Run workflow** on Release (Actions tab) is a dry run on any branch. On `main`, with **publish** ticked, it
  releases what `main` holds, as a merge would: for a merge that didn't start a release, or a release that was
  rejected and is wanted after all.

## When something fails

- Before publishing, nothing has gone out: fix what the run says, then run Release from `main` with publish ticked.
- After publishing, the job stops once it can't record the release. If it published and tagged but couldn't merge the
  release commit into `main`, merge the tag by hand (`git merge vX.Y.Z`). If npm has a version with no tag, the next
  release stops and says so: tag the commit that version was built from, merge the tag into `main`, and run Release
  again.

## Settings, made once

- **The `release` environment** (Settings → Environments): a required reviewer, and deployment limited to `main` and
  `v*` tags.
- **The npm trusted publisher** (npmjs.com, the package's Settings): GitHub Actions, `liberation-data/desk`, workflow
  `publish.yml`, environment `release`, allowed to `npm publish`.
- **The labels** `release: major`, `release: minor`, `release: patch` and `release: none`, for the pull requests whose
  release isn't what their files say.
