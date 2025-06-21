import { App, Modal, Setting, TextComponent, Notice } from 'obsidian';

export class NewProjectModal extends Modal {
    folderName = '';
    onSubmit: (folderName: string) => void;

    constructor(app: App, onSubmit: (folderName: string) => void) {
        super(app);
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty(); // Clear any previous content
        contentEl.addClass('task-timeline-new-project-modal');

        contentEl.createEl('h2', { text: 'Create New Project Folder' });

        let textInput: TextComponent;

        new Setting(contentEl)
            .setName('Folder Name')
            .addText(text => {
                textInput = text;
                text.setPlaceholder('Enter project name');
                text.onChange(value => {
                    this.folderName = value;
                });
                // Allow submitting with Enter key
                text.inputEl.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter') {
                        event.preventDefault(); // Prevent default form submission if any
                        this.submitForm();
                    }
                });
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Create')
                .setCta() // Makes it stand out
                .onClick(() => {
                    this.submitForm();
                }))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                }));

        // Focus the input field when the modal opens
        // Use a slight delay to ensure the element is ready
        setTimeout(() => {
             if (textInput) {
                 textInput.inputEl.focus();
             }
        }, 50); 
    }

    submitForm() {
        const trimmedName = this.folderName.trim();
        if (!trimmedName) {
            new Notice('Folder name cannot be empty.');
            return;
        }
        this.close();
        this.onSubmit(trimmedName);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
} 