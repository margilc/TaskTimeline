// Jest transformer that imports non-code files (e.g. .md templates) as raw strings,
// mirroring esbuild's `loader: { ".md": "text" }`.
module.exports = {
  process(sourceText) {
    return { code: `module.exports = ${JSON.stringify(sourceText)};` };
  },
};
