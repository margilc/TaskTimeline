export interface NewTaskFormData {
	name: string;
	category?: string;
	status?: string;
	priority?: string;
	start: string;
	end?: string;
	templateContent?: string;
	horizontalMode?: boolean;
}
