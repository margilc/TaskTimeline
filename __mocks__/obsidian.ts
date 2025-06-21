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

export class Events {
    on = jest.fn();
    off = jest.fn();
    trigger = jest.fn();
}

export class App {
    vault = {
        getAbstractFileByPath: jest.fn(),
        getFiles: jest.fn(() => []),
        getMarkdownFiles: jest.fn(() => []),
        on: jest.fn(),
        off: jest.fn(),
        adapter: {
            path: {
                relative: jest.fn()
            }
        }
    };
    workspace = {
        getLeaf: jest.fn(() => ({
            openFile: jest.fn()
        }))
    };
}

export class TFile {
    path: string;
    name: string;
    constructor(path: string, name: string) {
        this.path = path;
        this.name = name;
    }
}

export class TFolder {
    path: string;
    name: string;
    children: any[];
    constructor(path: string, name: string) {
        this.path = path;
        this.name = name;
        this.children = [];
    }
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
        onClick: jest.fn()
    }));
    showAtMouseEvent = jest.fn();
}

export const TAbstractFile = class {
    path: string;
    name: string;
    constructor(path: string, name: string) {
        this.path = path;
        this.name = name;
    }
};