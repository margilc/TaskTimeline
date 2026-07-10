// Test double for the 'obsidian' package (types-only on npm), wired via
// jest.config.cjs moduleNameMapper. Intentional and load-bearing: any test
// importing src modules that import 'obsidian' resolves here.

export class Plugin {
    app: any;
    addChild = jest.fn();
    removeChild = jest.fn();
    unload = jest.fn();
    registerEvent = jest.fn();
    registerDomEvent = jest.fn();
    registerInterval = jest.fn();
    load = jest.fn();
}

export class Component {
    addChild = jest.fn();
    removeChild = jest.fn();
    unload = jest.fn();
    registerEvent = jest.fn();
    registerDomEvent = jest.fn();
    registerInterval = jest.fn();
    load = jest.fn();
}

/** Real minimal event emitter so state-manager tests can observe events. */
export class Events {
    private handlers: Record<string, Array<(...args: any[]) => void>> = {};
    on(name: string, cb: (...args: any[]) => void) {
        (this.handlers[name] ??= []).push(cb);
        return { name, cb } as any;
    }
    off(name: string, cb: (...args: any[]) => void) {
        this.handlers[name] = (this.handlers[name] ?? []).filter(f => f !== cb);
    }
    trigger(name: string, ...data: any[]) {
        (this.handlers[name] ?? []).slice().forEach(f => f(...data));
    }
}

export class Notice {
    constructor(public message?: string, public timeout?: number) {}
}

export function normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '');
}

export function stringifyYaml(obj: Record<string, unknown>): string {
    return Object.entries(obj)
        .map(([key, value]) => `${key}: ${typeof value === 'string' ? JSON.stringify(value) : String(value)}`)
        .join('\n') + '\n';
}

export class App {
    vault: any = {
        getAbstractFileByPath: jest.fn(),
        getFiles: jest.fn(() => []),
        getMarkdownFiles: jest.fn(() => []),
        read: jest.fn(),
        modify: jest.fn(),
        create: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        adapter: { exists: jest.fn() },
    };
    fileManager: any = {
        processFrontMatter: jest.fn(),
        renameFile: jest.fn(),
    };
    workspace: any = {
        getLeaf: jest.fn(() => ({ openFile: jest.fn() })),
    };
}

export class TAbstractFile {
    path: string;
    name: string;
    constructor(path: string) {
        this.path = path;
        this.name = path.split('/').pop() ?? path;
    }
}

export class TFile extends TAbstractFile {
    basename: string;
    extension: string;
    parent: { path: string } | null;
    constructor(path: string) {
        super(path);
        const dot = this.name.lastIndexOf('.');
        this.basename = dot === -1 ? this.name : this.name.slice(0, dot);
        this.extension = dot === -1 ? '' : this.name.slice(dot + 1);
        const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
        this.parent = dir ? { path: dir } : null;
    }
}

export class TFolder extends TAbstractFile {
    children: any[] = [];
}

export class DropdownComponent {
    addOption = jest.fn();
    setValue = jest.fn();
    getValue = jest.fn();
    onChange = jest.fn();
}

export class Menu {
    addItem = jest.fn(() => ({
        setTitle: jest.fn(),
        setIcon: jest.fn(),
        onClick: jest.fn(),
    }));
    showAtMouseEvent = jest.fn();
}
