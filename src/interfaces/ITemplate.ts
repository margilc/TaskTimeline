export interface ITemplate {
    name: string;           // Derived from filename (template_X.md → "X")
    defaultLengthDays?: number;
    defaultStatus?: string;
    defaultPriority?: number;
    defaultCategory?: string;
    bodyContent: string;    // Markdown body below frontmatter
}
