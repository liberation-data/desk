#!/usr/bin/env bash
# What merging has made releasable, and as which version. See RELEASING.md.
#
#   scripts/release-plan.sh [<ref>]     # default HEAD
#
# Prints, one per line, for $GITHUB_OUTPUT or a person:
#   last=v0.36.1         the newest vX.Y.Z tag
#   base=0.36.1          the later of that tag and npm's latest: the version this release follows
#   prs=45 46            the pull requests merged since the tag, by the commits on the main line
#   bump=minor           the biggest any of them asks for. A label says it: release: major, release: minor,
#                        release: patch, release: none. Without one, a pull request that changes src/ is minor, one
#                        that changes only other files the package ships (the README, llms.txt) is patch, and one that
#                        ships nothing (CI, tests, docs/) is none. Empty when nothing asks for a release.
#   version=0.37.0       base bumped by that, or empty when there is nothing to release
#
# Needs git with tags fetched, node, and gh with GH_TOKEN able to read this repository's pull requests. Reads only.
set -euo pipefail

ref="${1:-HEAD}"
repo="${GITHUB_REPOSITORY:-liberation-data/desk}"
here="$(dirname "$0")"

last=$(git tag -l 'v*' | node "$here/release-version.mjs" newest)
base="${last#v}"
latest=$(npm view @liberation-data/desk dist-tags.latest 2>/dev/null || true)
if [[ -n "$latest" ]] && { [[ -z "$base" ]] || node "$here/release-version.mjs" greater "$latest" "$base"; }; then
  base="$latest"
fi

# The main line since the tag: merge commits, and anything pushed straight to it. A release commit the workflow made
# itself is not a change to release.
range="$ref"
[[ -n "$last" ]] && range="$last..$ref"
prs=()
direct=false
err=$(mktemp)
trap 'rm -f "$err"' EXIT
while read -r sha subject; do
  [[ -z "$sha" ]] && continue
  [[ "$subject" =~ ^Release\ v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] && continue
  # A commit GitHub doesn't know (a pull request's test merge, a local one) has no pull request either. Any other
  # failure stops the plan, rather than count a merge as a change pushed straight to main.
  if ! found=$(gh api "repos/$repo/commits/$sha/pulls" --jq '[.[] | select(.merged_at != null) | .number] | join(" ")' 2>"$err"); then
    grep -q 'No commit found for SHA' "$err" || { cat "$err" >&2; exit 1; }
    found=''
  fi
  if [[ -n "$found" ]]; then
    for n in $found; do [[ " ${prs[*]-} " == *" $n "* ]] || prs+=("$n"); done
  else
    direct=true
  fi
done < <(git log --first-parent --format='%H %s' "$range")

# What the package ships besides src/ (package.json `files`, and what npm always adds), and what builds it.
SHIPPED='README\.md|LICENSE|NOTICE|llms\.txt|package\.json|package-lock\.json|tsconfig(\.build)?\.json|scripts/css\.mjs'

rank() { case "$1" in major) echo 3 ;; minor) echo 2 ;; patch) echo 1 ;; *) echo 0 ;; esac; }
bump=''
consider() { if (( $(rank "$1") > $(rank "$bump") )); then bump="$1"; fi; }
for n in "${prs[@]-}"; do
  [[ -z "$n" ]] && continue
  labels=$(gh api "repos/$repo/issues/$n/labels" --jq '[.[].name] | join(",")')
  case ",$labels," in
    *",release: major,"*) consider major ;;
    *",release: minor,"*) consider minor ;;
    *",release: patch,"*) consider patch ;;
    *",release: none,"*) ;;
    *)
      files=$(gh api --paginate "repos/$repo/pulls/$n/files" --jq '.[].filename')
      if grep -q '^src/' <<< "$files"; then
        consider minor
      elif grep -qxE "$SHIPPED" <<< "$files"; then
        consider patch
      fi
      ;;
  esac
done
# A change pushed to main without a pull request has no label to read, so it counts as a feature.
$direct && consider minor

version=''
if [[ -n "$bump" ]]; then
  version=$(node "$here/release-version.mjs" bump "${base:-0.0.0}" "$bump")
fi

echo "last=$last"
echo "base=$base"
echo "prs=${prs[*]-}"
echo "bump=$bump"
echo "version=$version"
