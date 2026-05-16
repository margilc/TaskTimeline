import { App, ItemView, MarkdownRenderer, Notice, TFile, ViewStateResult, WorkspaceLeaf } from 'obsidian';
import { IHorizontalTaskColumn, parseHorizontalTaskContent } from '../core/utils/horizontalTaskUtils';

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
        }

        this.filePath = nextFilePath;
        await this.render();
    }

    async onOpen(): Promise<void> {
        this.contentEl.addClass('horizontal-task-view');
        await this.render();
    }

    async onClose(): Promise<void> {
        this.foldedColumnIds.clear();
    }

    private async render(): Promise<void> {
        this.contentEl.empty();
        this.contentEl.addClass('horizontal-task-view');

        if (!this.filePath) {
            this.renderMessage('No task file selected.');
            return;
        }

        const file = this.app.vault.getAbstractFileByPath(this.filePath);
        if (!(file instanceof TFile)) {
            this.renderMessage(`Task file not found: ${this.filePath}`);
            return;
        }

        try {
            const fileContent = await this.app.vault.read(file);
            const parsedTask = parseHorizontalTaskContent(fileContent);
            const grid = document.createElement('div');
            grid.className = 'horizontal-task-grid';
            grid.style.setProperty('--horizontal-task-column-count', String(Math.max(parsedTask.columns.length, 1)));

            this.contentEl.appendChild(grid);

            for (const column of parsedTask.columns) {
                await this.renderColumn(grid, column);
            }
        } catch (error) {
            console.error('Failed to render horizontal task view:', error);
            new Notice('Failed to render horizontal task view.');
            this.renderMessage('Failed to render this task file.');
        }
    }

    private async renderColumn(parent: HTMLElement, column: IHorizontalTaskColumn): Promise<void> {
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

        if (column.type === 'frontmatter') {
            const preEl = document.createElement('pre');
            preEl.className = 'horizontal-task-frontmatter';
            const codeEl = document.createElement('code');
            codeEl.textContent = column.content;
            preEl.appendChild(codeEl);
            bodyEl.appendChild(preEl);
            return;
        }

        if (column.content.trim()) {
            await MarkdownRenderer.render(this.app, column.content, bodyEl, this.filePath ?? '', this);
        } else {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'horizontal-task-empty-column';
            emptyEl.textContent = 'No content';
            bodyEl.appendChild(emptyEl);
        }
    }

    private renderMessage(message: string): void {
        const messageEl = document.createElement('div');
        messageEl.className = 'horizontal-task-message';
        messageEl.textContent = message;
        this.contentEl.appendChild(messageEl);
    }
}
