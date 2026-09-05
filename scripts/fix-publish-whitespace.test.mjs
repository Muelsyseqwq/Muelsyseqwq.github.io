import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { cleanWhitespace, fixPublishWhitespace } from "./fix-publish-whitespace.mjs";

test("cleans spaces, tabs and EOF blanks while preserving encoding and Markdown breaks", () => {
  assert.equal(cleanWhitespace("\uFEFFtitle \t\r\nbody\t\r\n \r\n\r\n"), "\uFEFFtitle\r\nbody\r\n");
  assert.equal(cleanWhitespace("hello \nworld   \n\t\n", true), "hello\nworld  \n");
  assert.equal(cleanWhitespace("last line \t"), "last line");
  assert.equal(cleanWhitespace(""), "");
  assert.equal(cleanWhitespace(" \n\t\n"), "");
  const once = cleanWhitespace("article  \nnext\n\n", true);
  assert.equal(cleanWhitespace(once, true), once);
});

test("cleans staged, unstaged and new files without touching excluded or unchanged files", () => {
  const repo = mkdtempSync(join(tmpdir(), "blog-whitespace-test-"));
  const git = (...args) => execFileSync("git", ["-c", "core.autocrlf=false", ...args], { cwd: repo, stdio: "pipe" });
  const write = (name, content) => writeFileSync(join(repo, name), content);
  const read = name => readFileSync(join(repo, name), "utf8");
  try {
    git("init");
    write(".gitignore", "ignored.txt\n");
    write("unchanged.txt", "keep me \n");
    write("staged.txt", "before\n");
    write("unstaged.txt", "before\n");
    git("add", ".");
    git("-c", "user.name=Whitespace Test", "-c", "user.email=test@example.invalid", "commit", "-m", "fixture");
    write("staged.txt", "staged \n\n");
    git("add", "staged.txt");
    write("unstaged.txt", "unstaged\t\n");
    write("中文 file.md", "first \nsecond  \n\n");
    write("AGENTS.md", "excluded \n");
    write("CLAUDE.md", "excluded \n");
    write("ignored.txt", "ignored \n");
    write("binary.txt", Buffer.from([0, 32, 10]));
    write("legacy.txt", Buffer.from([0xff, 32, 10]));
    assert.equal(fixPublishWhitespace(repo), 3);
    assert.equal(read("staged.txt"), "staged\n");
    assert.equal(read("unstaged.txt"), "unstaged\n");
    assert.equal(read("中文 file.md"), "first\nsecond  \n");
    for (const name of ["AGENTS.md", "CLAUDE.md"]) assert.equal(read(name), "excluded \n");
    assert.equal(read("unchanged.txt"), "keep me \n");
    assert.equal(read("ignored.txt"), "ignored \n");
    assert.deepEqual(readFileSync(join(repo, "binary.txt")), Buffer.from([0, 32, 10]));
    assert.deepEqual(readFileSync(join(repo, "legacy.txt")), Buffer.from([0xff, 32, 10]));
    assert.equal(fixPublishWhitespace(repo), 0);
    git("add", "staged.txt", "unstaged.txt", "中文 file.md");
    git("diff", "--cached", "--check", "--", ".", ":(exclude,icase)*.md", ":(exclude,icase)*.mdx");
    git("-c", "core.whitespace=-blank-at-eol", "diff", "--cached", "--check", "--", ":(icase)*.md", ":(icase)*.mdx");
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
