import { App, getAllTags, ItemView, MarkdownRenderer, Notice, TFile, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { EditorState, Range } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { Decoration, DecorationSet, EditorView, keymap, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view';
import { IHorizontalTaskColumn, parseHorizontalTaskContent, serializeHorizontalTaskColumns } from '../core/utils/horizontalTaskUtils';
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

export class HorizontalTaskView extends ItemView {
    private filePath: string | null = null;
    private foldedColumnIds: Set<string> = new Set();
    private columns: IHorizontalTaskColumn[] = [];
    private saveTimer: number | null = null;
    private editorViews: EditorView[] = [];
    private editingColumnId: string | null = null;
    private completionEl: HTMLElement | null = null;
    private completionState: HorizontalCompletionState | null = null;

    // Columns the user changed since the last save. Saves merge these onto a
    // fresh parse of the file, so an external edit to another column (second
    // pane, sync) survives instead of being overwritten from stale state.
    private dirtyColumnIds: Set<string> = new Set();
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
            this.foldedColumnIds.clear();
            this.editingColumnId = null;
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
            if (this.editingColumnId === null && this.dirtyColumnIds.size === 0) {
                void this.render();
            }
        }));

        await this.render();
    }

    async onClose(): Promise<void> {
        // Flush, don't drop: a debounced save may still be pending.
        if (this.saveTimer !== null) {
            window.clearTimeout(this.saveTimer);
            this.saveTimer = null;
            await this.saveColumns();
        }
        this.destroyEditors();
        this.closeCompletion();
        this.editingColumnId = null;
        this.foldedColumnIds.clear();
    }

    private async render(): Promise<void> {
        this.destroyEditors();
        this.contentEl.empty();
        this.contentEl.addClass('horizontal-task-view');

        if (!this.filePath) {
            this.renderMessage('No task file selected.');
            return;
        }

        const file = this.getCurrentFile();
        if (!file) {
            this.renderMessage(`Task file not found: ${this.filePath}`);
            return;
        }

        try {
            const fileContent = await this.app.vault.read(file);
            const parsedTask = parseHorizontalTaskContent(fileContent);
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
        const isFolded = this.foldedColumnIds.has(column.id);
        const columnEl = document.createElement('section');
        columnEl.className = 'horizontal-task-column';
        if (isFolded) {
            columnEl.classList.add('is-folded');
        }

        const headerEl = document.createElement('header');
        headerEl.className = 'horizontal-task-column-header';

        const titleEl = document.createElement('div');
        titleEl.className = 'horizontal-task-column-title';
        titleEl.textContent = column.title;
        headerEl.appendChild(titleEl);

        const toggleButton = document.createElement('button');
        toggleButton.className = 'horizontal-task-fold-toggle';
        toggleButton.type = 'button';
        toggleButton.textContent = isFolded ? '+' : '-';
        toggleButton.setAttribute('aria-label', `${isFolded ? 'Unfold' : 'Fold'} ${column.title}`);
        toggleButton.addEventListener('click', () => {
            if (isFolded) {
                this.foldedColumnIds.delete(column.id);
            } else {
                this.foldedColumnIds.add(column.id);
            }
            this.render();
        });
        headerEl.appendChild(toggleButton);

        columnEl.appendChild(headerEl);

        const bodyEl = document.createElement('div');
        bodyEl.className = 'horizontal-task-column-body';
        columnEl.appendChild(bodyEl);
        parent.appendChild(columnEl);

        if (isFolded) {
            return;
        }

        bodyEl.classList.toggle('is-frontmatter', column.type === 'frontmatter');
        if (this.editingColumnId === column.id) {
            this.editorViews.push(this.createColumnEditor(bodyEl, column));
        } else {
            this.renderColumnPreview(bodyEl, column);
        }
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

    private queueSave(): void {
        if (this.saveTimer !== null) {
            window.clearTimeout(this.saveTimer);
        }

        this.saveTimer = window.setTimeout(() => {
            this.saveTimer = null;
            this.saveColumns();
        }, 500);
    }

    private async saveColumns(): Promise<void> {
        if (this.dirtyColumnIds.size === 0) return;
        const file = this.getCurrentFile();
        if (!file) {
            new Notice('TaskTimeline: task file not found — changes were not saved.');
            return;
        }

        try {
            // Merge onto a fresh parse of the file so external edits to
            // columns the user did NOT touch survive this save.
            try {
                const diskColumns = parseHorizontalTaskContent(await this.app.vault.read(file)).columns;
                this.columns = diskColumns.map(diskColumn =>
                    this.dirtyColumnIds.has(diskColumn.id)
                        ? this.columns.find(c => c.id === diskColumn.id) ?? diskColumn
                        : diskColumn
                );
            } catch {
                // File unreadable/unparseable — write our full local state.
            }

            this.selfModify = true;
            try {
                await this.app.vault.modify(file, serializeHorizontalTaskColumns(this.columns));
            } finally {
                this.selfModify = false;
            }
            this.dirtyColumnIds.clear();
        } catch (error) {
            console.error('Failed to save horizontal task view:', error);
            new Notice('Failed to save horizontal task view.');
        }
    }

    private renderColumnPreview(parent: HTMLElement, column: IHorizontalTaskColumn): void {
        const previewEl = document.createElement('div');
        previewEl.className = 'horizontal-task-preview markdown-rendered';
        previewEl.tabIndex = 0;
        previewEl.setAttribute('role', 'button');
        previewEl.setAttribute('aria-label', `Edit ${column.title}`);
        previewEl.addEventListener('click', (event) => this.handlePreviewClick(event, column.id), { capture: true });
        previewEl.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.startEditing(column.id);
            }
        });
        parent.appendChild(previewEl);

        const markdown = column.type === 'frontmatter'
            ? `\`\`\`yaml\n${column.content}\n\`\`\``
            : column.content;

        if (markdown.trim()) {
            MarkdownRenderer.render(this.app, markdown, previewEl, this.filePath ?? '', this);
        } else {
            previewEl.addClass('is-empty');
            previewEl.textContent = 'Click to edit';
        }
    }

    private async startEditing(columnId: string): Promise<void> {
        this.closeCompletion();
        this.editingColumnId = columnId;
        await this.saveColumns();
        if (this.editingColumnId === columnId) {
            await this.render();
        }
    }

    private handlePreviewClick(event: MouseEvent, columnId: string): void {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            this.startEditing(columnId);
            return;
        }

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

        this.startEditing(columnId);
    }

    private createColumnEditor(parent: HTMLElement, column: IHorizontalTaskColumn): EditorView {
        return new EditorView({
            parent,
            state: EditorState.create({
                doc: column.content,
                extensions: [
                    EditorView.lineWrapping,
                    keymap.of([{
                        ...indentWithTab,
                        run: view => this.handleEditorTab(view),
                    }]),
                    horizontalCheckboxes,
                    EditorView.updateListener.of(update => {
                        if (!update.docChanged) return;
                        column.content = update.state.doc.toString();
                        this.dirtyColumnIds.add(column.id);
                        this.queueSave();
                        this.updateCompletion(update.view);
                    }),
                    EditorView.domEventHandlers({
                        keydown: (event, view) => this.handleCompletionKeydown(event, view),
                        blur: (_event, view) => {
                            window.setTimeout(() => {
                                if (view.dom.contains(document.activeElement)) return;
                                if (this.editingColumnId === column.id) {
                                    void this.finishEditing(column.id);
                                }
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

    private async finishEditing(columnId: string): Promise<void> {
        if (this.editingColumnId !== columnId) return;
        this.closeCompletion();
        await this.saveColumns();
        if (this.editingColumnId !== columnId) return;
        this.editingColumnId = null;
        await this.render();
    }

    private destroyEditors(): void {
        for (const editorView of this.editorViews) {
            editorView.destroy();
        }
        this.editorViews = [];
    }

    private togglePreviewCheckbox(checkboxEl: HTMLInputElement, columnId: string): void {
        const column = this.columns.find(item => item.id === columnId);
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
        this.editingColumnId = null;
        this.closeCompletion();
        void this.saveColumns().then(() => this.render());
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
