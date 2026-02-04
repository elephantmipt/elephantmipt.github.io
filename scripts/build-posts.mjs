import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import MarkdownIt from "markdown-it";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const contentDir = path.join(rootDir, "content", "blog");
const templatePath = path.join(rootDir, "templates", "blog-post.html");
const indexTemplatePath = path.join(rootDir, "templates", "blog-index.html");
const outputBase = path.join(rootDir, "blog");
const publicDir = path.join(rootDir, "public");
const sitemapPath = path.join(publicDir, "sitemap.xml");
const robotsPath = path.join(publicDir, "robots.txt");
const siteConfigPath = path.join(rootDir, "site.config.json");

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const readText = (file) => fs.readFileSync(file, "utf8");

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeBaseUrl = (value) => String(value || "").replace(/\/+$/, "");

const loadSiteConfig = () => {
  if (!fs.existsSync(siteConfigPath)) {
    return {};
  }
  try {
    return JSON.parse(readText(siteConfigPath)) || {};
  } catch (error) {
    console.warn("Failed to read site.config.json:", error.message);
    return {};
  }
};

const toIsoDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};

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

const buildBlogIndex = (posts) => {
  if (!fs.existsSync(indexTemplatePath)) {
    console.warn("blog-index.html template not found, skipping blog index build.");
    return;
  }

  const template = readText(indexTemplatePath);
  const items = posts.length
    ? posts
        .map((post) => {
          const meta = post.date ? `<span class="meta">${escapeHtml(post.date)}</span>` : "";
          const description = post.description ? `<span>${escapeHtml(post.description)}</span>` : "";
          return `
            <div class="list-item">
              ${meta}
              <strong><a href="./${post.slug}/">${escapeHtml(post.title)}</a></strong>
              ${description}
            </div>
          `;
        })
        .join("\n")
    : `
      <div class="list-item">
        <span class="meta">No posts yet</span>
        <strong>Coming soon</strong>
        <span>New writing will appear here.</span>
      </div>
    `;

  const page = template.replace("{{items}}", items.trim());
  ensureDir(outputBase);
  fs.writeFileSync(path.join(outputBase, "index.html"), page, "utf8");
};

const buildSitemap = (siteUrl, posts) => {
  if (!siteUrl) return;

  const urls = [
    { path: "/" },
    { path: "/blog/" },
    { path: "/publications/" },
    ...posts.map((post) => ({
      path: `/blog/${post.slug}/`,
      lastmod: post.lastmod,
    })),
  ];

  const entries = urls
    .map((item) => {
      const loc = `${siteUrl}${item.path}`;
      const lastmod = item.lastmod ? `<lastmod>${item.lastmod}</lastmod>` : "";
      return `  <url><loc>${loc}</loc>${lastmod}</url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries}\n` +
    `</urlset>\n`;

  ensureDir(publicDir);
  fs.writeFileSync(sitemapPath, xml, "utf8");
  const robots = `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`;
  fs.writeFileSync(robotsPath, robots, "utf8");
};

const buildPosts = () => {
  if (!fs.existsSync(contentDir)) {
    console.warn("No content/blog directory found. Skipping blog build.");
    return;
  }

  const template = readText(templatePath);
  const siteConfig = loadSiteConfig();
  let siteUrl = normalizeBaseUrl(siteConfig.baseUrl);
  if (!siteUrl) {
    siteUrl = "https://example.com";
    console.warn("site.config.json baseUrl missing; using https://example.com for sitemap.");
  }
  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
  });

  const files = fs.readdirSync(contentDir).filter((file) => file.endsWith(".md"));

  const posts = files.map((file, index) => {
    const slug = path.basename(file, ".md");
    const filePath = path.join(contentDir, file);
    const raw = readText(filePath);
    const { data, content } = matter(raw);

    const title = data.title ?? slug;
    const description = data.description ?? "";
    const date = data.date ?? data.published ?? "";
    const updated = data.updated ?? data.lastUpdated ?? "";
    const stats = fs.statSync(filePath);
    const parsedDate = Date.parse(date);
    const timestamp = Number.isNaN(parsedDate) ? stats.mtimeMs : parsedDate;
    const lastmod = toIsoDate(updated) || toIsoDate(date) || new Date(stats.mtimeMs).toISOString();

    const extracted = extractBlockMath(content);
    let html = md.render(extracted.text);
    extracted.blocks.forEach((latex, idx) => {
      const block = `<div class="math-display">$$\n${latex}\n$$</div>`;
      html = html.replace(`@@BLOCKMATH${idx}@@`, block);
    });

    const outDir = path.join(outputBase, slug);
    ensureDir(outDir);

    const rootFromOut = path.relative(outDir, rootDir) || ".";
    const rootPrefix = rootFromOut === "." ? "./" : `${rootFromOut}/`;
    const dateLine = date ? `<p class="meta">Published ${escapeHtml(date)}</p>` : "";
    const updatedLine = updated ? `<p class="meta">Updated ${escapeHtml(updated)}</p>` : "";

    const page = template
      .replace(/\{\{title\}\}/g, escapeHtml(title))
      .replace(/\{\{description\}\}/g, escapeHtml(description))
      .replace("{{dateLine}}", dateLine)
      .replace("{{updatedLine}}", updatedLine)
      .replace("{{content}}", html)
      .replace(/\{\{assetPrefix\}\}/g, rootPrefix)
      .replace(/\{\{homeLink\}\}/g, rootPrefix)
      .replace(/\{\{blogLink\}\}/g, `${rootPrefix}blog/`)
      .replace(/\{\{pubLink\}\}/g, `${rootPrefix}publications/`);

    fs.writeFileSync(path.join(outDir, "index.html"), page, "utf8");

    return {
      slug,
      title,
      description,
      date,
      updated,
      timestamp,
      lastmod,
      index,
    };
  });

  const sortedPosts = [...posts].sort((a, b) => {
    if (b.timestamp === a.timestamp) return a.index - b.index;
    return b.timestamp - a.timestamp;
  });

  buildBlogIndex(sortedPosts);
  buildSitemap(siteUrl, sortedPosts);
};

buildPosts();
