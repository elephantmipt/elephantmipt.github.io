import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const contentDir = path.join(rootDir, "content", "blog");
const templatePath = path.join(rootDir, "templates", "blog-post.html");
const outputBase = path.join(rootDir, "blog");

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const readText = (file) => fs.readFileSync(file, "utf8");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const extractBlockMath = (input) => {
  const blocks = [];
  let output = "";
  let i = 0;

  while (i < input.length) {
    if (input.startsWith("```", i)) {
      const fenceEnd = input.indexOf("```", i + 3);
      if (fenceEnd === -1) {
        output += input.slice(i);
        break;
      }
      const lineEnd = input.indexOf("\n", fenceEnd + 3);
      const close = lineEnd === -1 ? input.length : lineEnd + 1;
      output += input.slice(i, close);
      i = close;
      continue;
    }

    if (input.startsWith("$$", i)) {
      const end = input.indexOf("$$", i + 2);
      if (end === -1) {
        output += input.slice(i);
        break;
      }
      const raw = input.slice(i + 2, end);
      const key = `@@BLOCKMATH${blocks.length}@@`;
      blocks.push(raw.trim());
      output += key;
      i = end + 2;
      continue;
    }

    output += input[i];
    i += 1;
  }

  return { text: output, blocks };
};

const buildPosts = () => {
  if (!fs.existsSync(contentDir)) {
    console.warn("No content/blog directory found. Skipping blog build.");
    return;
  }

  const template = readText(templatePath);
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  const files = fs.readdirSync(contentDir).filter((file) => file.endsWith(".md"));

  files.forEach((file) => {
    const slug = path.basename(file, ".md");
    const raw = readText(path.join(contentDir, file));
    const { data, content } = matter(raw);

    const title = data.title ?? slug;
    const description = data.description ?? "";
    const date = data.date ?? data.published ?? "";
    const tags = Array.isArray(data.tags) ? data.tags : [];

    const extracted = extractBlockMath(content);
    let html = md.render(extracted.text);
    extracted.blocks.forEach((latex, idx) => {
      const block = `<div class="math-display">$$\n${latex}\n$$</div>`;
      html = html.replace(`@@BLOCKMATH${idx}@@`, block);
    });
    const tagHtml = tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("\n");

    const outDir = path.join(outputBase, slug);
    ensureDir(outDir);

    const rootFromOut = path.relative(outDir, rootDir) || ".";
    const rootPrefix = rootFromOut === "." ? "./" : `${rootFromOut}/`;

    const page = template
      .replace(/\{\{title\}\}/g, escapeHtml(title))
      .replace(/\{\{description\}\}/g, escapeHtml(description))
      .replace(/\{\{date\}\}/g, escapeHtml(date))
      .replace("{{content}}", html)
      .replace("{{tags}}", tagHtml || "<span class=\"tag\">notes</span>")
      .replace(/\{\{assetPrefix\}\}/g, rootPrefix)
      .replace(/\{\{homeLink\}\}/g, rootPrefix)
      .replace(/\{\{blogLink\}\}/g, `${rootPrefix}blog/`)
      .replace(/\{\{pubLink\}\}/g, `${rootPrefix}publications/`);

    fs.writeFileSync(path.join(outDir, "index.html"), page, "utf8");
  });
};

buildPosts();
