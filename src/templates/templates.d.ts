// Allow importing template markdown files as raw text.
// esbuild inlines these via `loader: { ".md": "text" }`; Jest via jest-raw-transform.cjs.
declare module "*.md" {
	const content: string;
	export default content;
}
