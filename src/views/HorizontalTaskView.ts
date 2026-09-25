import { App, Component, getAllTags, ItemView, MarkdownRenderer, Notice, TFile, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { EditorState, Prec, Range } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentLess, indentWithTab } from '@codemirror/commands';
import { Decoration, DecorationSet, EditorView, keymap, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { continueListItem, IHorizontalTaskColumn, mergeColumnsForSave, parseHorizontalTaskContent, serializeHorizontalTaskColumns } from '../core/utils/horizontalTaskUtils';
import { isFenceLine, parseCheckboxLine, toggleCheckboxLine } from '../core/utils/taskUtils';
import { HORIZONTAL_TASK_VIEW_TYPE } from './viewTypes';


interface HorizontalTaskViewState {
    filePath?: string;
}

interface HorizontalCompletion {
    label: string;
    detail: string;
    apply: string;
}

interface HorizontalCompletionState {
    view: EditorView;
    from: number;
    to: number;
    options: HorizontalCompletion[];
    selectedIndex: number;
}

function isHorizontalTaskViewState(state: unknown): state is HorizontalTaskViewState {
    return typeof state === 'object' && state !== null && (
        !('filePath' in state) || typeof (state as HorizontalTaskViewState).filePath === 'string'
    );
}

class HorizontalCheckboxWidget extends WidgetType {
    constructor(private readonly from: number, private readonly checked: boolean) {
        super();
    }

    eq(other: HorizontalCheckboxWidget): boolean {
        return this.from === other.from && this.checked === other.checked;
    }

    toDOM(view: EditorView): HTMLElement {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'task-list-item-checkbox horizontal-task-editor-checkbox';
        checkbox.checked = this.checked;
        checkbox.setAttribute('aria-label', this.checked ? 'Mark task incomplete' : 'Mark task complete');
        checkbox.addEventListener('change', () => {
            view.dispatch({
                changes: {
                    from: this.from,
                    to: this.from + 3,
                    insert: checkbox.checked ? '[x]' : '[ ]',
                },
            });
            view.focus();
        });
        return checkbox;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

function buildCheckboxDecorations(view: EditorView): Range<Decoration>[] {
    const decorations: Range<Decoration>[] = [];
    let inFence = false;

    for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
        const line = view.state.doc.line(lineNumber);
        if (isFenceLine(line.text)) {
            inFence = !inFence;
            continue;
        }

        const checkbox = inFence ? null : parseCheckboxLine(line.text);
        if (!checkbox) continue;

        const markerIndex = line.text.search(/\[[ xX]\]/);
        if (markerIndex < 0) continue;

        const from = line.from + markerIndex;
        decorations.push(Decoration.replace({
            widget: new HorizontalCheckboxWidget(from, checkbox.checked),
        }).range(from, from + 3));
    }

    return decorations;
}

const horizontalCheckboxes = ViewPlugin.fromClass(class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
        this.decorations = Decoration.set(buildCheckboxDecorations(view));
    }

    update(update: ViewUpdate): void {
        if (update.docChanged) {
            this.decorations = Decoration.set(buildCheckboxDecorations(update.view));
        }
    }
}, {
    decorations: plugin => plugin.decorations,
});

/**
 * Map a click in the rendered preview to an offset in the column's markdown,
 * so editing starts where the user clicked (as in Obsidian's editor).
 * Heuristic: take the clicked text node and find the same occurrence of its
 * text in the source — rendered text nodes are verbatim runs of the source
 * with the markup stripped. Null when the click isn't on text or the text
 * can't be found (e.g. an aliased link), and the caller falls back to the end.
 */
function sourceOffsetAtPoint(previewEl: HTMLElement, source: string, x: number, y: number): number | null {
    const range = document.caretRangeFromPoint?.(x, y);
    const node = range?.startContainer;
    if (!range || !node || node.nodeType !== Node.TEXT_NODE || !previewEl.contains(node)) return null;

    const text = node.textContent ?? '';
    if (!text.trim()) return null;

    // How many times this text occurs in the preview before the clicked node.
    let before = '';
    const walker = document.createTreeWalker(previewEl, NodeFilter.SHOW_TEXT);
    for (let current = walker.nextNode(); current && current !== node; current = walker.nextNode()) {
        before += current.textContent ?? '';
    }
    let occurrence = 0;
    for (let i = before.indexOf(text); i !== -1; i = before.indexOf(text, i + 1)) occurrence++;

    let index = -1;
    for (let n = 0; n <= occurrence; n++) {
        const next = source.indexOf(text, index + 1);
        if (next === -1) break;
        index = next;
    }
    return index === -1 ? null : index + range.startOffset;
}

export class HorizontalTaskView extends ItemView {
    private filePath: string | null = null;
    private foldedColumnIds: Set<string> = new Set();
    private columns: IHorizontalTaskColumn[] = [];
    private saveTimer: number | null = null;
    private completionEl: HTMLElement | null = null;
    private completionState: HorizontalCompletionState | null = null;

    // At most one column is in edit mode. Switching modes swaps only that
    // column's body — the rest of the grid stays mounted.
    private editor: { columnId: string; view: EditorView } | null = null;
    private columnBodies: Map<string, HTMLElement> = new Map();
    // Per-column owner of the rendered preview's child components, unloaded
    // whenever that preview is replaced.
    private previewComponents: Map<string, Component> = new Map();

    // Bumped per render(); a render that finds itself superseded after its
    // file read bails instead of appending a second grid.
    private renderGeneration = 0;

    // Columns the user changed since the last save. Saves merge these onto a
    // fresh parse of the file, so an external edit to another column (second
    // pane, sync) survives instead of being overwritten from stale state.
    private dirtyColumnIds: Set<string> = new Set();
    // Saves run one at a time (each reads, merges, then writes the file).
    private saveChain: Promise<void> = Promise.resolve();
    // True while our own vault.modify is in flight, so the modify listener
    // can tell our writes apart from external ones.
    private selfModify = false;

    constructor(leaf: WorkspaceLeaf, appRef: App) {
        super(leaf);
        this.app = appRef;
    }

    getViewType() { return HORIZONTAL_TASK_VIEW_TYPE; }

    getDisplayText() {
        if (!this.filePath) return 'Horizontal Task';

        const fileName = this.filePath.split('/').pop() || this.filePath;
        return fileName.replace(/\.md$/, '');
    }

    getState(): Record<string, unknown> {
        return {
            ...super.getState(),
            filePath: this.filePath,
        };
    }

    async setState(state: unknown, result: ViewStateResult): Promise<void> {
        await super.setState(state, result);

        if (!isHorizontalTaskViewState(state)) {
            return;
        }

        const nextFilePath = state.filePath ?? null;
        if (nextFilePath !== this.filePath) {
            await this.flushSave();
            this.foldedColumnIds.clear();
        }

        this.filePath = nextFilePath;
        await this.render();
    }

    async onOpen(): Promise<void> {
        this.contentEl.addClass('horizontal-task-view');

        // The plugin itself renames task files when frontmatter name/start
        // changes (canonicalizeFile). Without following the rename, every
        // subsequent save would silently hit a stale path and be dropped.
        this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
            if (this.filePath && oldPath === this.filePath) {
                this.filePath = file.path;
            }
        }));

        // External modification (second pane, sync client): re-render from
        // disk when we have no local edits; pending local edits are merged
        // per-column at save time instead.
        this.registerEvent(this.app.vault.on('modify', (file) => {
            if (this.selfModify || !this.filePath || file.path !== this.filePath) return;
            if (this.editor === null && this.dirtyColumnIds.size === 0) {
                void this.render();
            }
        }));

        await this.render();
    }

    async onClose(): Promise<void> {
        // Flush, don't drop: a debounced save may still be pending.
        this.closeCompletion();
        this.destroyEditor();
        await this.flushSave();
        this.clearPreviews();
        this.foldedColumnIds.clear();
    }

    private async render(): Promise<void> {
        const generation = ++this.renderGeneration;

        const file = this.filePath ? this.getCurrentFile() : null;
        let fileContent: string | null = null;
        let readError: unknown = null;
        if (file) {
            try {
                fileContent = await this.app.vault.read(file);
            } catch (error) {
                readError = error;
            }
        }
        if (generation !== this.renderGeneration) return;

        this.closeCompletion();
        this.destroyEditor();
        this.clearPreviews();
        this.contentEl.empty();
        this.contentEl.addClass('horizontal-task-view');

        if (!this.filePath) {
            this.renderMessage('No task file selected.');
            return;
        }
        if (!file) {
            this.renderMessage(`Task file not found: ${this.filePath}`);
            return;
        }

        try {
            if (readError) throw readError;
            const parsedTask = parseHorizontalTaskContent(fileContent ?? '');
            this.columns = parsedTask.columns.map(column => ({ ...column }));
            this.dirtyColumnIds.clear();

            const grid = document.createElement('div');
            grid.className = 'horizontal-task-grid';
            this.contentEl.appendChild(grid);

            for (const column of this.columns) {
                this.renderColumn(grid, column);
            }
        } catch (error) {
            console.error('Failed to render horizontal task view:', error);
            new Notice('Failed to render horizontal task view.');
            this.renderMessage('Failed to render this task file.');
        }
    }

    private renderColumn(parent: HTMLElement, column: IHorizontalTaskColumn): void {
        const columnEl = document.createElement('section');
        columnEl.className = 'horizontal-task-column';

        const headerEl = document.createElement('header');
        headerEl.className = 'horizontal-task-column-header';

        const titleEl = document.createElement('div');
        titleEl.className = 'horizontal-task-column-title';
        titleEl.textContent = column.title;
        headerEl.appendChild(titleEl);

        const toggleButton = document.createElement('button');
        toggleButton.className = 'horizontal-task-fold-toggle';
        toggleButton.type = 'button';
        headerEl.appendChild(toggleButton);

        const applyFold = () => {
            const isFolded = this.foldedColumnIds.has(column.id);
            columnEl.classList.toggle('is-folded', isFolded);
            toggleButton.textContent = isFolded ? '+' : '-';
            toggleButton.setAttribute('aria-label', `${isFolded ? 'Unfold' : 'Fold'} ${column.title}`);
        };
        toggleButton.addEventListener('click', () => {
            if (this.foldedColumnIds.has(column.id)) {
                this.foldedColumnIds.delete(column.id);
            } else {
                this.foldedColumnIds.add(column.id);
                if (this.editor?.columnId === column.id) this.stopEditing();
            }
            applyFold();
        });
        applyFold();

        columnEl.appendChild(headerEl);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'horizontal-task-column-body';
        bodyEl.classList.toggle('is-frontmatter', column.type === 'frontmatter');
        columnEl.appendChild(bodyEl);
        parent.appendChild(columnEl);

        this.columnBodies.set(column.id, bodyEl);
        this.renderColumnPreview(column);
    }

    private renderMessage(message: string): void {
        const messageEl = document.createElement('div');
        messageEl.className = 'horizontal-task-message';
        messageEl.textContent = message;
        this.contentEl.appendChild(messageEl);
    }

    private getCurrentFile(): TFile | null {
        if (!this.filePath) return null;
        const file = this.app.vault.getAbstractFileByPath(this.filePath);
        return file instanceof TFile ? file : null;
    }

    private getColumn(columnId: string): IHorizontalTaskColumn | undefined {
        return this.columns.find(column => column.id === columnId);
    }

    private queueSave(): void {
        if (this.saveTimer !== null) {
            window.clearTimeout(this.saveTimer);
        }

        this.saveTimer = window.setTimeout(() => {
            this.saveTimer = null;
            void this.saveColumns();
        }, 500);
    }

    /** Cancel the debounce and write pending changes now. */
    private flushSave(): Promise<void> {
        if (this.saveTimer !== null) {
            window.clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        return this.saveColumns();
    }

    private saveColumns(): Promise<void> {
        this.saveChain = this.saveChain.then(() => this.writeDirtyColumns());
        return this.saveChain;
    }

    private async writeDirtyColumns(): Promise<void> {
        if (this.dirtyColumnIds.size === 0) return;
        const file = this.getCurrentFile();
        if (!file) {
            new Notice('TaskTimeline: task file not found — changes were not saved.');
            return;
        }

        // Claim the dirty set up front: edits typed while this write is in
        // flight re-mark their column and queue the next save.
        const saving = new Set(this.dirtyColumnIds);
        this.dirtyColumnIds.clear();

        try {
            try {
                const diskColumns = parseHorizontalTaskContent(await this.app.vault.read(file)).columns;
                const previous = this.columns;
                this.columns = mergeColumnsForSave(previous, diskColumns, saving);
                // Show external edits that were merged into other columns.
                this.columns.forEach((column, i) => {
                    if (column !== previous[i] && column.content !== previous[i]?.content
                        && this.editor?.columnId !== column.id) {
                        this.renderColumnPreview(column);
                    }
                });
            } catch {
                // File unreadable/unparseable — write our full local state.
            }

            this.selfModify = true;
            try {
                await this.app.vault.modify(file, serializeHorizontalTaskColumns(this.columns));
            } finally {
                this.selfModify = false;
            }
        } catch (error) {
            saving.forEach(id => this.dirtyColumnIds.add(id));
            console.error('Failed to save horizontal task view:', error);
            new Notice('Failed to save horizontal task view.');
        }
    }

    private clearPreviews(): void {
        this.previewComponents.forEach(component => this.removeChild(component));
        this.previewComponents.clear();
        this.columnBodies.clear();
    }

    private renderColumnPreview(column: IHorizontalTaskColumn): void {
        const bodyEl = this.columnBodies.get(column.id);
        if (!bodyEl) return;

        const previous = this.previewComponents.get(column.id);
        if (previous) this.removeChild(previous);
        const component = this.addChild(new Component());
        this.previewComponents.set(column.id, component);

        bodyEl.empty();
        const previewEl = document.createElement('div');
        previewEl.className = 'horizontal-task-preview markdown-rendered';
        previewEl.tabIndex = 0;
        previewEl.setAttribute('role', 'button');
        previewEl.setAttribute('aria-label', `Edit ${column.title}`);
        previewEl.addEventListener('click', (event) => this.handlePreviewClick(event, column.id, previewEl), { capture: true });
        previewEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.startEditing(column.id);
            }
        });
        bodyEl.appendChild(previewEl);

        const markdown = column.type === 'frontmatter'
            ? `\`\`\`yaml\n${column.content}\n\`\`\``
            : column.content;

        if (markdown.trim()) {
            void MarkdownRenderer.render(this.app, markdown, previewEl, this.filePath ?? '', component);
        } else {
            previewEl.addClass('is-empty');
            previewEl.textContent = 'Click to edit';
        }
    }

    /**
     * Put the column in edit mode with the cursor at `cursor` (a source
     * offset; defaults to the end). Any other column being edited is
     * returned to preview first.
     */
    private startEditing(columnId: string, cursor?: number): void {
        if (this.editor?.columnId === columnId) return;
        if (this.editor) this.stopEditing();

        const column = this.getColumn(columnId);
        const bodyEl = this.columnBodies.get(columnId);
        if (!column || !bodyEl) return;

        const previous = this.previewComponents.get(columnId);
        if (previous) {
            this.removeChild(previous);
            this.previewComponents.delete(columnId);
        }
        bodyEl.empty();

        const view = this.createColumnEditor(bodyEl, column);
        this.editor = { columnId, view };

        const anchor = Math.min(cursor ?? view.state.doc.length, view.state.doc.length);
        view.dispatch({
            selection: { anchor },
            effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
        });
        view.focus();
    }

    /** Return the edited column to preview and write its changes. */
    private stopEditing(): void {
        if (!this.editor) return;
        const { columnId, view } = this.editor;
        this.editor = null;
        this.closeCompletion();
        view.destroy();

        const column = this.getColumn(columnId);
        if (column) this.renderColumnPreview(column);

        const structureBefore = this.columns.map(c => c.title).join('\n');
        void this.flushSave().then(() => {
            // A `# heading` typed inside the column became its own section
            // on disk; re-read so the grid shows it as a column.
            const parsed = parseHorizontalTaskContent(serializeHorizontalTaskColumns(this.columns)).columns;
            if (parsed.map(c => c.title).join('\n') !== structureBefore && this.editor === null) {
                void this.render();
            }
        });
    }

    private destroyEditor(): void {
        this.editor?.view.destroy();
        this.editor = null;
    }

    private handlePreviewClick(event: MouseEvent, columnId: string, previewEl: HTMLElement): void {
        const target = event.target;
        if (target instanceof HTMLElement) {
            const checkboxEl = target.closest('input[type="checkbox"]');
            if (checkboxEl instanceof HTMLInputElement) {
                event.preventDefault();
                event.stopPropagation();
                this.togglePreviewCheckbox(checkboxEl, columnId);
                return;
            }

            const linkEl = target.closest('a');
            if (linkEl instanceof HTMLAnchorElement) {
                if (linkEl.hasClass('internal-link')) {
                    event.preventDefault();
                    event.stopPropagation();
                    const linkText = linkEl.getAttribute('data-href') || linkEl.getAttribute('href') || linkEl.textContent || '';
                    if (linkText.trim()) {
                        this.app.workspace.openLinkText(linkText, this.filePath ?? '', event.ctrlKey || event.metaKey);
                    }
                }
                return;
            }
        }

        // A drag-selection in the preview is for copying, not editing.
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && previewEl.contains(selection.anchorNode)) return;

        const column = this.getColumn(columnId);
        const cursor = column && column.type !== 'frontmatter'
            ? sourceOffsetAtPoint(previewEl, column.content, event.clientX, event.clientY)
            : undefined;
        this.startEditing(columnId, cursor ?? undefined);
    }

    private createColumnEditor(parent: HTMLElement, column: IHorizontalTaskColumn): EditorView {
        const columnId = column.id;
        return new EditorView({
            parent,
            state: EditorState.create({
                doc: column.content,
                extensions: [
                    EditorView.lineWrapping,
                    history(),
                    // Completion navigation must win over Enter/Tab/arrows.
                    Prec.highest(EditorView.domEventHandlers({
                        keydown: (event, view) => this.handleCompletionKeydown(event, view),
                    })),
                    keymap.of([
                        { key: 'Enter', run: view => this.handleEditorEnter(view) },
                        { key: 'Tab', run: view => this.handleEditorTab(view), shift: indentLess },
                        { key: 'Escape', run: () => { this.stopEditing(); return true; } },
                        ...historyKeymap,
                        ...defaultKeymap,
                    ]),
                    horizontalCheckboxes,
                    EditorView.updateListener.of(update => {
                        if (!update.docChanged) return;
                        // Look the column up by id: a save may have swapped
                        // the column objects since this editor was created.
                        const current = this.getColumn(columnId);
                        if (current) current.content = update.state.doc.toString();
                        this.dirtyColumnIds.add(columnId);
                        this.queueSave();
                        this.updateCompletion(update.view);
                    }),
                    EditorView.domEventHandlers({
                        blur: (_event, view) => {
                            window.setTimeout(() => {
                                if (view.dom.contains(document.activeElement)) return;
                                if (this.editor?.view === view) this.stopEditing();
                            }, 0);
                        },
                    }),
                    EditorView.theme({
                        '&': {
                            height: '100%',
                            backgroundColor: 'transparent',
                        },
                        '.cm-scroller': {
                            fontFamily: column.type === 'frontmatter'
                                ? 'var(--font-monospace)'
                                : 'var(--font-text)',
                            fontSize: column.type === 'frontmatter'
                                ? 'var(--tt-font-size-caption)'
                                : 'var(--font-text-size)',
                            lineHeight: 'var(--line-height-normal)',
                        },
                        '.cm-content': {
                            padding: '0',
                            minHeight: '100%',
                        },
                        '.cm-line': {
                            padding: '0',
                        },
                        '&.cm-focused': {
                            outline: 'none',
                        },
                    }),
                ],
            }),
        });
    }

    private handleEditorEnter(view: EditorView): boolean {
        const selection = view.state.selection.main;
        if (!selection.empty) return false;

        const line = view.state.doc.lineAt(selection.head);
        const continuation = continueListItem(line.text, selection.head - line.from);
        if (!continuation) return false;

        if (continuation.kind === 'end') {
            view.dispatch({
                changes: { from: line.from, to: line.from + continuation.prefixLength, insert: '' },
                userEvent: 'delete',
            });
        } else {
            view.dispatch({
                ...view.state.replaceSelection(continuation.insert),
                scrollIntoView: true,
                userEvent: 'input',
            });
        }
        return true;
    }

    private togglePreviewCheckbox(checkboxEl: HTMLInputElement, columnId: string): void {
        const column = this.getColumn(columnId);
        if (!column) return;

        const previewEl = checkboxEl.closest('.horizontal-task-preview');
        if (!previewEl) return;

        const checkboxes = Array.from(previewEl.querySelectorAll('input[type="checkbox"]'));
        const checkboxIndex = checkboxes.indexOf(checkboxEl);
        if (checkboxIndex < 0) return;

        // Enumerate checkbox lines exactly the way Obsidian renders them
        // (shared matcher: -, *, + and ordered bullets; fenced code skipped),
        // so the DOM index maps to the right line and never toggles a
        // neighbor.
        let currentIndex = -1;
        let inFence = false;
        const nextLines = column.content.split('\n').map(line => {
            if (isFenceLine(line)) { inFence = !inFence; return line; }
            if (inFence || !parseCheckboxLine(line)) return line;
            currentIndex += 1;
            return currentIndex === checkboxIndex ? toggleCheckboxLine(line) : line;
        });

        column.content = nextLines.join('\n');
        this.dirtyColumnIds.add(column.id);
        this.renderColumnPreview(column);
        void this.flushSave();
    }

    private handleCompletionKeydown(event: KeyboardEvent, view: EditorView): boolean {
        if (!this.completionState || this.completionState.view !== view) return false;

        if (event.key === 'Escape') {
            event.preventDefault();
            this.closeCompletion();
            return true;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            this.completionState.selectedIndex = (
                this.completionState.selectedIndex + delta + this.completionState.options.length
            ) % this.completionState.options.length;
            this.renderCompletion();
            return true;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            this.applyCompletion(this.completionState.options[this.completionState.selectedIndex]);
            return true;
        }

        return false;
    }

    private handleEditorTab(view: EditorView): boolean {
        if (this.completionState?.view === view) {
            this.applyCompletion(this.completionState.options[this.completionState.selectedIndex]);
            return true;
        }
        return indentWithTab.run?.(view) ?? false;
    }

    private updateCompletion(view: EditorView): void {
        const cursor = view.state.selection.main.head;
        const beforeCursor = view.state.doc.sliceString(0, cursor);
        const linkMatch = beforeCursor.match(/\[\[([^\]\n]*)$/);

        if (linkMatch) {
            const query = linkMatch[1].toLowerCase();
            this.openCompletion(view, cursor - linkMatch[1].length, cursor, this.getFileCompletions(query));
            return;
        }

        const tagMatch = beforeCursor.match(/(^|\s)#([A-Za-z0-9_/-]*)$/);
        if (tagMatch) {
            const query = tagMatch[2].toLowerCase();
            this.openCompletion(view, cursor - tagMatch[2].length, cursor, this.getTagCompletions(query));
            return;
        }

        this.closeCompletion();
    }

    private openCompletion(view: EditorView, from: number, to: number, options: HorizontalCompletion[]): void {
        if (options.length === 0) {
            this.closeCompletion();
            return;
        }

        this.completionState = { view, from, to, options: options.slice(0, 20), selectedIndex: 0 };
        this.renderCompletion();
    }

    private renderCompletion(): void {
        if (!this.completionState) return;

        if (!this.completionEl) {
            this.completionEl = document.createElement('div');
            this.completionEl.className = 'horizontal-task-completion';
            document.body.appendChild(this.completionEl);
        }

        this.completionEl.empty();
        const coords = this.completionState.view.coordsAtPos(this.completionState.to);
        if (coords) {
            this.completionEl.style.left = `${coords.left}px`;
            this.completionEl.style.top = `${coords.bottom + 4}px`;
        }

        this.completionState.options.forEach((option, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'horizontal-task-completion-item';
            if (index === this.completionState?.selectedIndex) {
                itemEl.classList.add('is-selected');
            }

            const labelEl = document.createElement('span');
            labelEl.className = 'horizontal-task-completion-label';
            labelEl.textContent = option.label;
            itemEl.appendChild(labelEl);

            const detailEl = document.createElement('span');
            detailEl.className = 'horizontal-task-completion-detail';
            detailEl.textContent = option.detail;
            itemEl.appendChild(detailEl);

            itemEl.addEventListener('mousedown', event => {
                event.preventDefault();
                this.applyCompletion(option);
            });

            this.completionEl?.appendChild(itemEl);
        });
    }

    private applyCompletion(option: HorizontalCompletion): void {
        if (!this.completionState) return;

        this.completionState.view.dispatch({
            changes: {
                from: this.completionState.from,
                to: this.completionState.to,
                insert: option.apply,
            },
        });
        this.completionState.view.focus();
        this.closeCompletion();
    }

    private closeCompletion(): void {
        this.completionState = null;
        if (this.completionEl) {
            this.completionEl.remove();
            this.completionEl = null;
        }
    }

    // Built once per completion burst instead of on every keystroke.
    private fileCompletionPool: { at: number; items: HorizontalCompletion[] } | null = null;

    private getFileCompletions(query: string): HorizontalCompletion[] {
        const now = Date.now();
        if (!this.fileCompletionPool || now - this.fileCompletionPool.at > 5000) {
            this.fileCompletionPool = {
                at: now,
                items: this.app.vault.getMarkdownFiles().map(file => {
                    const basename = file.name.replace(/\.md$/, '');
                    return { label: basename, detail: file.path, apply: basename };
                }).sort((a, b) => a.label.localeCompare(b.label)),
            };
        }
        return this.fileCompletionPool.items
            .filter(option => option.label.toLowerCase().includes(query) || option.detail.toLowerCase().includes(query));
    }

    private getTagCompletions(query: string): HorizontalCompletion[] {
        const tags = new Set<string>();
        for (const file of this.app.vault.getMarkdownFiles()) {
            const cache = this.app.metadataCache.getFileCache(file);
            const fileTags = cache ? getAllTags(cache) : null;
            fileTags?.forEach(tag => tags.add(tag.replace(/^#/, '')));
        }

        return Array.from(tags)
            .filter(tag => tag.toLowerCase().includes(query))
            .sort((a, b) => a.localeCompare(b))
            .map(tag => ({
                label: `#${tag}`,
                detail: 'tag',
                apply: tag,
            }));
    }
}
