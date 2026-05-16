import { App, getAllTags, ItemView, MarkdownRenderer, Notice, TFile, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { IHorizontalTaskColumn, parseHorizontalTaskContent, serializeHorizontalTaskColumns } from '../core/utils/horizontalTaskUtils';

export const HORIZONTAL_TASK_VIEW_TYPE = 'task-timeline-horizontal-task-view';

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

export class HorizontalTaskView extends ItemView {
    private filePath: string | null = null;
    private foldedColumnIds: Set<string> = new Set();
    private columns: IHorizontalTaskColumn[] = [];
    private saveTimer: number | null = null;
    private editorViews: EditorView[] = [];
    private editingColumnId: string | null = null;
    private completionEl: HTMLElement | null = null;
    private completionState: HorizontalCompletionState | null = null;

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
        await this.render();
    }

    async onClose(): Promise<void> {
        if (this.saveTimer !== null) {
            window.clearTimeout(this.saveTimer);
            this.saveTimer = null;
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
        if (!file || typeof (file as { path?: unknown }).path !== 'string') {
            return null;
        }

        return file as TFile;
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
        const file = this.getCurrentFile();
        if (!file) return;

        try {
            await this.app.vault.modify(file, serializeHorizontalTaskColumns(this.columns));
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

    private startEditing(columnId: string): void {
        this.editingColumnId = columnId;
        this.render();
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
                    EditorView.updateListener.of(update => {
                        if (!update.docChanged) return;
                        column.content = update.state.doc.toString();
                        this.queueSave();
                        this.updateCompletion(update.view);
                    }),
                    EditorView.domEventHandlers({
                        keydown: (event, view) => this.handleCompletionKeydown(event, view),
                        blur: () => {
                            this.finishEditing();
                        },
                    }),
                    EditorView.theme({
                        '&': {
                            height: '100%',
                            backgroundColor: 'transparent',
                        },
                        '.cm-scroller': {
                            overflow: 'hidden',
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

    private async finishEditing(): Promise<void> {
        this.closeCompletion();
        await this.saveColumns();
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

        let currentIndex = -1;
        const nextLines = column.content.split('\n').map(line => {
            if (!/^\s*[-*]\s+\[[ xX]\]/.test(line)) return line;
            currentIndex += 1;
            if (currentIndex !== checkboxIndex) return line;

            const isChecked = /^\s*[-*]\s+\[[xX]\]/.test(line);
            return line.replace(/^(\s*[-*]\s+\[)[ xX](\])/, `$1${isChecked ? ' ' : 'x'}$2`);
        });

        column.content = nextLines.join('\n');
        this.saveColumns();
        this.render();
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

        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            this.applyCompletion(this.completionState.options[this.completionState.selectedIndex]);
            return true;
        }

        return false;
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

    private getFileCompletions(query: string): HorizontalCompletion[] {
        return this.app.vault.getMarkdownFiles()
            .map(file => {
                const basename = file.name.replace(/\.md$/, '');
                return {
                    label: basename,
                    detail: file.path,
                    apply: basename,
                };
            })
            .filter(option => option.label.toLowerCase().includes(query) || option.detail.toLowerCase().includes(query))
            .sort((a, b) => a.label.localeCompare(b.label));
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
