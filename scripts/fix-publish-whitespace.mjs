import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const textExtensions = new Set([
  ".astro", ".css", ".html", ".js", ".json", ".jsx", ".md", ".mdx",
  ".mjs", ".cjs", ".ts", ".tsx", ".txt", ".yaml", ".yml", ".ps1",
  ".svg", ".toml", ".scss", ".sh",
]);
const textNames = new Set([".gitignore", ".gitattributes", ".editorconfig"]);
const paths = [".", ":(exclude)AGENTS.md", ":(exclude)CLAUDE.md"];

export function cleanWhitespace(text, markdown = false) {
  // Keep existing line endings and Markdown's explicit two-space hard breaks.
  const cleaned = text.replace(/([^\r\n]*)(\r\n|\n|\r|$)/g, (match, line, eol) => {
    const trimmed = line.replace(/[ \t]+$/, "");
    const hardBreak = markdown && trimmed.length > 0 && / {2,}$/.test(line);
    return trimmed + (hardBreak ? "  " : "") + eol;
  });
  if (/^[\r\n]*$/.test(cleaned)) return "";
  return cleaned.replace(/((?:\r\n|\n|\r))(?:(?:\r\n|\n|\r))+$/, "$1");
}

export function fixPublishWhitespace(cwd = process.cwd()) {
  const gitFiles = args => execFileSync("git", args, { cwd, encoding: "utf8" })
    .split("\0").filter(Boolean);
  const candidates = new Set([
    ...gitFiles(["diff", "--name-only", "-z", "--diff-filter=ACMR", "--", ...paths]),
    ...gitFiles(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR", "--", ...paths]),
    ...gitFiles(["ls-files", "--others", "--exclude-standard", "-z", "--", ...paths]),
  ]);
  let count = 0;
  for (const relativePath of candidates) {
    const extension = extname(relativePath).toLowerCase();
    if (!textExtensions.has(extension) && !textNames.has(relativePath)) continue;
    const filename = resolve(cwd, relativePath);
    let stat;
    try {
      stat = lstatSync(filename);
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (!stat.isFile()) continue;
    const bytes = readFileSync(filename);
    if (bytes.includes(0)) continue;
    const text = bytes.toString("utf8");
    // Do not rewrite non-UTF-8 files or binary data; UTF-8 BOMs are preserved.
    if (!Buffer.from(text, "utf8").equals(bytes)) continue;
    const cleaned = cleanWhitespace(text, extension === ".md" || extension === ".mdx");
    if (cleaned === text) continue;
    writeFileSync(filename, cleaned, "utf8");
    process.stdout.write(`Fixed whitespace: ${relativePath}\n`);
    count++;
  }
  process.stdout.write(count ? `Cleaned ${count} file(s).\n` : "No whitespace changes needed.\n");
  return count;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fixPublishWhitespace();
}
