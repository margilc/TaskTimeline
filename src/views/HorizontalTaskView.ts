import { App, ItemView, MarkdownRenderer, Notice, TFile, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { IHorizontalTaskColumn, parseHorizontalTaskContent, serializeHorizontalTaskColumns } from '../core/utils/horizontalTaskUtils';

export const HORIZONTAL_TASK_VIEW_TYPE = 'task-timeline-horizontal-task-view';

interface HorizontalTaskViewState {
    filePath?: string;
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
        previewEl.addEventListener('click', (event) => this.handlePreviewClick(event, column.id));
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
                    }),
                    EditorView.domEventHandlers({
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
}
