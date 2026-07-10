/**
 * Path-based ignore matching for task discovery.
 *
 * Each pattern is matched against a vault-relative path using simple glob
 * semantics, anchored to whole path segments at any depth — "temp" ignores a
 * file or folder literally named "temp" but not "templates". Supported
 * wildcards:
 *   *   matches any run of characters except the path separator "/"
 *   **  matches any run of characters including "/"
 *
 * Matching is case-insensitive (e.g. "CLAUDE.md" also ignores "claude.md").
 *
 * Patterns are typically folder fragments such as "templates/" or ".claude/",
 * which exclude anything inside a folder of that name at any depth. When
 * testing a folder for exclusion, callers append a trailing "/" to the folder
 * path so folder-scoped patterns match (e.g. "Taskdown/templates/").
 */
function patternToRegExp(pattern: string): RegExp {
	// Escape regex metacharacters, leaving "*" for glob expansion below. Every
	// other character is treated literally, so the resulting source is always
	// a valid RegExp and never throws. Split on "**" (matches across "/") and
	// expand single "*" within each piece, which avoids any placeholder char.
	const escaped = pattern.replace(/[.+^${}()|[\]\\?]/g, "\\$&");
	const body = escaped
		.split("**")
		.map((segment) => segment.replace(/\*/g, "[^/]*"))
		.join(".*");
	// Anchor to segment boundaries: the match must start at the path root or
	// right after a "/", and end at a "/" or the end of the path (a trailing
	// "/" in the pattern already closes the segment).
	const suffix = body.endsWith("/") ? "" : "(/|$)";
	return new RegExp("(^|/)" + body + suffix, "i");
}

/**
 * Returns true if `path` matches any of the (non-empty, trimmed) ignore
 * patterns. Empty or missing pattern lists never ignore anything.
 */
export function isPathIgnored(path: string, patterns?: string[] | null): boolean {
	if (!patterns || patterns.length === 0) return false;
	for (const raw of patterns) {
		const pattern = raw.trim();
		if (!pattern) continue;
		if (patternToRegExp(pattern).test(path)) return true;
	}
	return false;
}
