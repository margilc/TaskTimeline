export interface DropdownOption {
    value: string;
    label: string;
    swatch?: string;
}

export interface CustomDropdownConfig {
    options: DropdownOption[];
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
}

export class CustomDropdown {
    private container: HTMLElement;
    private triggerEl: HTMLElement;
    private triggerSwatchEl: HTMLElement | null = null;
    private triggerLabelEl: HTMLElement;
    private menuEl: HTMLElement;
    private isOpen = false;
    private options: DropdownOption[] = [];
    private selectedValue = '';
    private triggerTextOverride: string | null = null;
    private onChangeCallback: ((value: string) => void) | null = null;
    private readonly outsideClickHandler: (e: MouseEvent) => void;

    constructor(parent: HTMLElement, config: CustomDropdownConfig) {
        this.container = document.createElement('div');
        this.container.className = 'tt-dropdown';

        // Trigger
        this.triggerEl = document.createElement('div');
        this.triggerEl.className = 'tt-dropdown-trigger';
        this.triggerEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        this.triggerLabelEl = document.createElement('span');
        this.triggerLabelEl.className = 'tt-dropdown-label';
        this.triggerEl.appendChild(this.triggerLabelEl);

        this.container.appendChild(this.triggerEl);

        // Menu
        this.menuEl = document.createElement('div');
        this.menuEl.className = 'tt-dropdown-menu';
        this.container.appendChild(this.menuEl);

        // Outside click
        this.outsideClickHandler = (e: MouseEvent) => {
            if (!this.container.contains(e.target as Node)) {
                this.close();
            }
        };
        document.addEventListener('click', this.outsideClickHandler);

        // Initialize
        this.options = config.options;
        if (config.onChange) this.onChangeCallback = config.onChange;
        this.selectedValue = config.value ?? config.options[0]?.value ?? '';
        this.buildMenu();
        this.updateTrigger();

        parent.appendChild(this.container);
    }

    private toggle(): void {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    private open(): void {
        this.menuEl.classList.add('is-open');
        this.isOpen = true;
    }

    private close(): void {
        this.menuEl.classList.remove('is-open');
        this.isOpen = false;
    }

    private buildMenu(): void {
        this.menuEl.innerHTML = '';
        for (const option of this.options) {
            const item = document.createElement('div');
            item.className = 'tt-dropdown-item';
            item.dataset.value = option.value;

            if (option.swatch) {
                const swatch = document.createElement('span');
                swatch.className = 'tt-dropdown-swatch';
                swatch.style.backgroundColor = option.swatch;
                item.appendChild(swatch);
            }

            const label = document.createElement('span');
            label.textContent = option.label;
            item.appendChild(label);

            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(option.value);
            });

            this.menuEl.appendChild(item);
        }
    }

    private select(value: string): void {
        this.selectedValue = value;
        this.triggerTextOverride = null;
        this.updateTrigger();
        this.close();
        if (this.onChangeCallback) this.onChangeCallback(value);
    }

    private updateTrigger(): void {
        const selected = this.options.find(o => o.value === this.selectedValue);
        this.triggerLabelEl.textContent = this.triggerTextOverride ?? selected?.label ?? '';

        // Update trigger swatch
        const swatchColor = selected?.swatch;
        if (swatchColor) {
            if (!this.triggerSwatchEl) {
                this.triggerSwatchEl = document.createElement('span');
                this.triggerSwatchEl.className = 'tt-dropdown-swatch';
                this.triggerEl.appendChild(this.triggerSwatchEl);
            }
            this.triggerSwatchEl.style.backgroundColor = swatchColor;
        } else if (this.triggerSwatchEl) {
            this.triggerSwatchEl.remove();
            this.triggerSwatchEl = null;
        }
    }

    setValue(value: string): void {
        this.selectedValue = value;
        this.triggerTextOverride = null;
        this.updateTrigger();
    }

    getValue(): string {
        return this.selectedValue;
    }

    setOptions(options: DropdownOption[]): void {
        this.options = options;
        this.buildMenu();
        this.updateTrigger();
    }

    setTriggerText(text: string): void {
        this.triggerTextOverride = text;
        this.triggerLabelEl.textContent = text;
    }

    onChange(callback: (value: string) => void): void {
        this.onChangeCallback = callback;
    }

    getElement(): HTMLElement {
        return this.container;
    }

    destroy(): void {
        document.removeEventListener('click', this.outsideClickHandler);
        this.container.remove();
    }
}
