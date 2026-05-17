#!/usr/bin/env bash
#
# create_release.sh — bump version, commit, tag, and trigger the GitHub release.
#
# Usage: ./create_release.sh -v <version> [--no-build] [--no-push] [--remote <name>]
#
# What it does:
#   1. Validates the version (semver: MAJOR.MINOR.PATCH).
#   2. Checks the working tree is clean and the tag does not already exist.
#   3. Updates package.json, manifest.json, and versions.json.
#   4. Runs `npm run build` as a sanity check (unless --no-build).
#   5. Commits the metadata changes and creates an annotated tag.
#   6. Pushes the commit + tag (unless --no-push) — the GitHub Actions
#      workflow in .github/workflows/release.yml builds main.js and
#      publishes a release with main.js, manifest.json, and styles.css.
#
set -euo pipefail

usage() {
    cat <<EOF
Usage: $0 -v <version> [--no-build] [--no-push] [--remote <name>]

  -v, --version <x.y.z>   Target version (semver)
      --no-build          Skip the local 'npm run build' sanity check
      --no-push           Stage commit + tag locally but do not push
      --remote <name>     Git remote to push to (default: origin)
  -h, --help              Show this help
EOF
}

VERSION=""
DO_BUILD=1
DO_PUSH=1
REMOTE="origin"

while [[ $# -gt 0 ]]; do
    case "$1" in
        -v|--version)
            VERSION="${2:-}"
            shift 2
            ;;
        --no-build)
            DO_BUILD=0
            shift
            ;;
        --no-push)
            DO_PUSH=0
            shift
            ;;
        --remote)
            REMOTE="${2:-origin}"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "error: unknown argument: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

if [[ -z "$VERSION" ]]; then
    echo "error: -v <version> is required" >&2
    usage >&2
    exit 1
fi

if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "error: version '$VERSION' is not valid semver (expected MAJOR.MINOR.PATCH)" >&2
    exit 1
fi

# Move into the repo root (directory of this script) so relative paths work.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ ! -d .git ]]; then
    echo "error: $SCRIPT_DIR is not a git repository" >&2
    exit 1
fi

# Working tree must be clean — otherwise the release commit would pick up
# unrelated changes.
if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "error: working tree has uncommitted changes. Commit or stash first." >&2
    git status --short >&2
    exit 1
fi

# Tag must not already exist locally or on the remote.
if git rev-parse -q --verify "refs/tags/$VERSION" >/dev/null; then
    echo "error: tag '$VERSION' already exists locally" >&2
    exit 1
fi
if git ls-remote --exit-code --tags "$REMOTE" "refs/tags/$VERSION" >/dev/null 2>&1; then
    echo "error: tag '$VERSION' already exists on remote '$REMOTE'" >&2
    exit 1
fi

# Bump version in package.json, manifest.json, and versions.json using node so
# we don't depend on jq. The minAppVersion in versions.json is copied from
# manifest.json's current minAppVersion (matching version-bump.mjs).
node - "$VERSION" <<'NODE'
const { readFileSync, writeFileSync } = require("fs");
const target = process.argv[2];

const writeJson = (path, obj) => {
    writeFileSync(path, JSON.stringify(obj, null, "\t") + "\n");
};

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.version = target;
writeJson("package.json", pkg);

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const minAppVersion = manifest.minAppVersion;
manifest.version = target;
writeJson("manifest.json", manifest);

const versions = JSON.parse(readFileSync("versions.json", "utf8"));
versions[target] = minAppVersion;
writeJson("versions.json", versions);

console.log(`Bumped to ${target} (minAppVersion=${minAppVersion}).`);
NODE

# Sanity-check the build before we tag — catches breakages so we don't push a
# tag the CI workflow can't build.
if [[ "$DO_BUILD" -eq 1 ]]; then
    echo "Running 'npm run build' as a sanity check..."
    npm run build
fi

# Stage only the metadata files; main.js is gitignored and built by CI.
git add package.json manifest.json versions.json

git commit -m "Release $VERSION"
git tag -a "$VERSION" -m "Release $VERSION"

echo
echo "Created commit and tag '$VERSION'."

if [[ "$DO_PUSH" -eq 1 ]]; then
    BRANCH="$(git rev-parse --abbrev-ref HEAD)"
    echo "Pushing $BRANCH and tag '$VERSION' to '$REMOTE'..."
    git push "$REMOTE" "$BRANCH"
    git push "$REMOTE" "refs/tags/$VERSION"
    echo
    echo "Done. The release workflow will build main.js and publish the GitHub release with main.js, manifest.json, and styles.css."
    echo "Watch: https://github.com/margilc/TaskTimeline/actions"
else
    echo "Skipping push (--no-push). To publish the release manually:"
    echo "  git push $REMOTE \$(git rev-parse --abbrev-ref HEAD)"
    echo "  git push $REMOTE refs/tags/$VERSION"
fi
