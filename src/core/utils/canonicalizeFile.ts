import { App, TFile } from 'obsidian';
import { parseTaskFromContent } from './taskUtils';
import {
    formatDateForFilename,
    nameToIdentifier,
    parseTaskFilename,
} from './fileRenameUtils';

const MAX_COLLISION_RETRIES = 5;
const COLLISION_MESSAGE_FRAGMENT = 'Destination file already exists';

/**
 * Idempotent file-rename based on current frontmatter. If `frontmatter.start`
 * or `frontmatter.name` no longer match the file's `YYYYMMDD_identifier.md`
 * filename, rename to match. If already aligned (including collision-bumped
 * `_N` variants), no-op.
 *
 * `onWillRename` is invoked synchronously immediately before each
 * `fileManager.renameFile` attempt with the candidate new path. Callers use
 * it to register the predicted destination in any in-flight mutation tracker
 * before Obsidian fires the rename/modify events for it.
 *
 * `Destination file already exists` errors retry with a forcibly-higher `_N`
 * suffix to make progress when the vault registry view disagrees with the
 * filesystem (capped at MAX_COLLISION_RETRIES).
 */
export async function canonicalizeFile(
    app: App,
    file: TFile,
    onWillRename?: (newPath: string) => void,
): Promise<TFile> {
    const content = await app.vault.read(file);

    let parsed;
    try {
        parsed = parseTaskFromContent(content, file.path);
    } catch {
        return file;
    }

    if (!parsed.start) return file;

    const dir = file.parent?.path ?? '';
    const expectedDate = formatDateForFilename(new Date(parsed.start));
    const expectedId = nameToIdentifier(parsed.name);
    if (!expectedId) return file;

    const parsedCurrent = parseTaskFilename(file.name);
    if (
        parsedCurrent
        && parsedCurrent.dateStr === expectedDate
        && (parsedCurrent.identifier === expectedId
            || parsedCurrent.identifier.startsWith(expectedId + '_'))
    ) {
        return file;
    }

    const buildPath = (name: string) => (dir ? `${dir}/${name}` : name);
    const buildCandidate = (n: number) =>
        n === 0
            ? `${expectedDate}_${expectedId}.md`
            : `${expectedDate}_${expectedId}_${n}.md`;

    // Monotonic counter across retries: each attempt MUST use a strictly
    // higher N than the previous one. Without this, a registry/filesystem
    // disagreement (NTFS-through-WSL, post-deletion limbo, stale cache) makes
    // every retry re-derive the same candidate and fail identically.
    let lastTriedN = -1;

    for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
        let n = lastTriedN + 1;
        let fullPath = buildPath(buildCandidate(n));
        while (app.vault.getAbstractFileByPath(fullPath) && fullPath !== file.path) {
            n++;
            if (n > 1000) return file;
            fullPath = buildPath(buildCandidate(n));
        }
        if (fullPath === file.path) return file;
        lastTriedN = n;

        onWillRename?.(fullPath);
        try {
            await app.fileManager.renameFile(file, fullPath);
            const renamed = app.vault.getAbstractFileByPath(fullPath);
            return renamed instanceof TFile ? renamed : file;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes(COLLISION_MESSAGE_FRAGMENT) && attempt < MAX_COLLISION_RETRIES - 1) {
                // Yield briefly so in-flight vault events can settle before
                // we re-scan the registry on the next iteration.
                await new Promise((resolve) => setTimeout(resolve, 10));
                continue;
            }
            throw err;
        }
    }

    return file;
}
