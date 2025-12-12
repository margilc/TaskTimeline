import { readFileSync, writeFileSync } from "fs";

const targetVersion = process.env.npm_package_version;

if (!targetVersion || targetVersion === "undefined") {
	throw new Error(
		`version-bump.mjs: Missing npm_package_version (got ${JSON.stringify(targetVersion)}). ` +
		`Run this via an npm script so npm sets the env var.`
	);
}

// read minAppVersion from manifest.json and bump version to target version
let manifestRaw = readFileSync("manifest.json", "utf8");
let manifest;
try {
	manifest = JSON.parse(manifestRaw);
} catch (e) {
	throw new Error(`version-bump.mjs: Failed to parse manifest.json as JSON: ${(e && e.message) || e}`);
}
const { minAppVersion } = manifest;
manifest.version = targetVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");

// update versions.json with target version and minAppVersion from manifest.json
let versionsRaw = readFileSync("versions.json", "utf8");
let versions;
try {
	versions = JSON.parse(versionsRaw);
} catch (e) {
	throw new Error(`version-bump.mjs: Failed to parse versions.json as JSON: ${(e && e.message) || e}`);
}
versions[targetVersion] = minAppVersion;
writeFileSync("versions.json", JSON.stringify(versions, null, "\t") + "\n");
