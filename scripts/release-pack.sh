#!/usr/bin/env bash
# Packs the package as <version>, checks it, and installs it alone to load it. See RELEASING.md.
#
#   scripts/release-pack.sh 0.37.0     # leaves package/<tarball>, package/pack.json and package/files.txt
#
# The version is set in the package only, by npm version without a commit: main takes it once it is published.
set -euo pipefail

version="$1"
npm version "$version" --no-git-tag-version --ignore-scripts --allow-same-version > /dev/null
npm run build
rm -rf package && mkdir package
npm pack --ignore-scripts --pack-destination package --json > package/pack.json
jq -r '.[0].files[].path' package/pack.json | sort > package/files.txt
echo "$(wc -l < package/files.txt) files in $(jq -r '.[0].filename' package/pack.json)"
for f in package.json README.md LICENSE NOTICE llms.txt dist/core/index.js dist/core/index.d.ts dist/react/index.js dist/react/index.d.ts dist/fx/index.js dist/desk.css; do
  grep -qx "$f" package/files.txt || { echo "::error::The package has no $f."; exit 1; }
done
# src/ ships on purpose, for the source maps; tests and anything local don't.
if grep -E '(^|/)(node_modules|test|examples)/|\.test\.|\.env' package/files.txt; then
  echo "::error::The package holds files it shouldn't (above)."
  exit 1
fi
# Installed alone, as a user gets it: no devDependencies. The core entry needs no React.
tarball="$PWD/package/$(jq -r '.[0].filename' package/pack.json)"
smoke=$(mktemp -d)
(
  cd "$smoke"
  npm init -y > /dev/null
  npm install --no-audit --no-fund --omit=peer "$tarball" > /dev/null
  node --input-type=module -e 'const desk = await import("@liberation-data/desk"); if (typeof desk.createDesk !== "function") throw new Error("no createDesk")'
)
rm -rf "$smoke"
echo "Packed and loaded @liberation-data/desk@$version"
