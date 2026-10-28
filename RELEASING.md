# Releasing

Desk is released by CI, the way Drivine is. Nothing is published from a laptop.

## The process

1. **Prepare release.** In the Actions tab, run "Prepare release" (`.github/workflows/prepare-release.yml`) with a
   `bump` of `patch`, `minor`, `major` or `prerelease`, or an exact `version`. It bumps `package.json` and
   `package-lock.json` on a branch `release/vX.Y.Z`, and opens a PR "Release vX.Y.Z" that lists the merges since the
   last tag. Feature PRs leave the version alone.
2. **Review and merge the release PR.** It passes CI like any other PR. Merging it is the release point.
3. **CI publishes.** The merge, a push to `main` that changes `package.json`, runs `.github/workflows/publish.yml`. It
   runs the full gate, packs, checks, publishes, and creates the GitHub release with its tag `vX.Y.Z` on the merge
   commit.
4. **Credentials.** npm trusted publishing (OIDC): npm trusts this repository's `publish.yml`, so there is no token to
   keep, and every version carries provenance. Keep the file's name, or update the package's trusted publisher on
   npmjs.com to match. An `NPM_TOKEN` secret, if set, is used as a fallback. The publish job runs in a GitHub
   environment named `release`: give it required reviewers, and their approval of the run is the human checkpoint
   before anything goes out.

A PR that "Prepare release" opens with the default `GITHUB_TOKEN` starts no workflows, so CI wouldn't run on it by
itself. Prepare release therefore starts CI and the release dry run on the release branch by hand, which that token may
do, and their checks land on the PR's commit: there is nothing to push. With a `RELEASE_PR_TOKEN` secret set, the PR is
opened with that token and CI runs on it the usual way. "Prepare release" fails, saying why, when the version is already tagged
or on npm, isn't later than the last tag and npm's `latest`, or its `release/vX.Y.Z` branch already exists.

**Tagging by hand is the fallback.** A pushed tag `vX.Y.Z` releases the tagged commit, which must be on `main`, have
that version in `package.json`, and, unless it's a prerelease, be later than npm's `latest`:

```
git switch main && git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

A tag that fails `check` publishes nothing. Delete it (`git push origin :refs/tags/vX.Y.Z`), fix what the message says,
and tag again. If a release failed after publishing, re-run its failed jobs.

## What publish.yml does

- **`check`** works out the version: the tag without its `v` on a tag push, or `package.json`'s otherwise. On a push to
  `main` it releases only a new version: not tagged, not on npm (versions up to 0.35.2 were published by hand without
  tags), and later than every `vX.Y.Z` tag and npm's `latest` by semver precedence (`scripts/release-version.mjs`; a
  prerelease `vX.Y.Z-rc.N` sorts below `vX.Y.Z`). Otherwise its notice says why it released nothing.
- **`gate`** runs `ci.yml` unchanged: typecheck, tests, build and the size budget.
- **`build`** packs the package from a clean `npm ci` and `npm run build`, checks the tarball holds the entry points and
  no tests, installs it alone in an empty project and loads it, and dry-runs `npm publish`. The tarball is the run's
  artifact.
- **`publish`** runs on a release alone, in the `release` environment, and publishes that exact tarball with
  `--provenance`. A prerelease goes under the `next` dist-tag, so `latest` stays on the last release.
- **`github-release`** creates the GitHub release with generated notes, and on a push to `main` the tag with it. A tag
  made this way starts no workflow, so it doesn't release again.

A **dry run** is everything but `publish` and `github-release`. Run it from the Actions tab (Release, Run workflow, on
any branch), and it runs by itself on a pull request that changes the release machinery or `package.json`. npm refuses
even a dry run of a version it has, so a dry run of a released version tries a copy as `X.Y.Z-dryrun.<run id>`, still
with `--dry-run`: nothing is published.

## Settings, made once

- **GitHub:** Settings, Environments, a `release` environment, with required reviewers. Make it before the first
  release: when a job names an environment that doesn't exist yet, GitHub creates it with no reviewers, and the release
  goes out unreviewed. Its deployment branches and tags, if limited, must allow both the branch `main` (a merged bump) and
  the tags `v*` (a tag pushed by hand).
- **GitHub Actions and PRs:** Settings, Actions, General, "Allow GitHub Actions to create and approve pull requests",
  so "Prepare release" can open its PR with `GITHUB_TOKEN`.
- **Optional, a `RELEASE_PR_TOKEN` secret:** a fine-grained personal access token with Contents and Pull requests
  read and write on this repository. "Prepare release" pushes its branch and opens its PR with it, so CI runs on the PR.
- **npm trusted publishing:** on npmjs.com, `@liberation-data/desk`, Settings, Trusted publishing, a GitHub Actions
  publisher with organization `liberation-data`, repository `desk` and workflow `publish.yml`. Its environment, if
  set, must be `release`.
