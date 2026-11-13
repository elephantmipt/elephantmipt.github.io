import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { mergePublications, normalizeTitle, parseDblp } from "./publication-sources.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const xmlPath = path.join(rootDir, "publications.xml");
const templatePath = path.join(rootDir, "templates", "publications.html");
const outputPath = path.join(rootDir, "publications", "index.html");
const overridesPath = path.join(rootDir, "bibtex-overrides.json");
const openReviewPath = path.join(rootDir, "publications-openreview.json");
const manualPath = path.join(rootDir, "publications-manual.json");

const readText = (file) => fs.readFileSync(file, "utf8");
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const escapeAttr = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const loadBibtexOverrides = () => {
  if (!fs.existsSync(overridesPath)) {
    return new Map();
  }

  try {
    const data = JSON.parse(readText(overridesPath));
    const items = Array.isArray(data.items) ? data.items : [];
    const map = new Map();
    for (const item of items) {
      const key = normalizeTitle(item.title);
      if (!key || !item.bibtex) continue;
      map.set(key, { bibtex: String(item.bibtex).trim(), link: item.link });
    }
    return map;
  } catch (error) {
    console.warn("Failed to read bibtex-overrides.json:", error.message);
    return new Map();
  }
};

const formatAuthors = (authors, selfName) => {
  if (!authors.length) return "";
  const formatted = authors.map((author) => {
    if (selfName && author.toLowerCase() === selfName.toLowerCase()) {
      return `<span class="author-self">${escapeAttr(author)}</span>`;
    }
    return escapeAttr(author);
  });
  return formatted.join(", ");
};

const buildList = (items) => {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.year)) groups.set(item.year, []);
    groups.get(item.year).push(item);
  }

  const years = Array.from(groups.keys()).sort((a, b) => Number(b) - Number(a));
  return years
    .map((year) => {
      const entries = groups.get(year);
      const listItems = entries
        .map((entry) => {
          const titleLink = /^https?:\/\//i.test(entry.link)
            ? `<a href="${escapeAttr(entry.link)}" target="_blank" rel="noopener noreferrer">${escapeAttr(entry.title)}</a>`
            : escapeAttr(entry.title);
          const venue = escapeAttr(entry.venue);
          const bibtex = entry.bibtex
            ? `<button type="button" class="bibtex-btn" aria-label="Copy BibTeX for ${escapeAttr(entry.title)}" data-bibtex="${escapeAttr(entry.bibtex)}">BibTeX</button>`
            : "";
          const titleRow = `<div class="pub-row"><strong class="pub-title">${titleLink}</strong>${bibtex}</div>`;
          return `
            <div class="list-item">
              <span class="meta">${venue || ""}</span>
              ${titleRow}
              ${entry.authors ? `<span class="pub-authors">${entry.authors}</span>` : ""}
            </div>
          `;
        })
        .join("\n");

      return `
        <section class="section">
          <h2 class="section-title">${escapeAttr(year)}</h2>
          <div class="list">
            ${listItems}
          </div>
        </section>
      `;
    })
    .join("\n");
};

const buildPublications = () => {
  const bibtexOverrides = loadBibtexOverrides();
  const { name: personName, items: dblpItems } = parseDblp(readText(xmlPath));
  const openReview = fs.existsSync(openReviewPath) ? JSON.parse(readText(openReviewPath)) : { items: [] };
  if (openReview.author && openReview.author !== personName) {
    throw new Error("OpenReview and DBLP bibliographies belong to different authors.");
  }
  const manual = fs.existsSync(manualPath) ? JSON.parse(readText(manualPath)) : { items: [] };
  if (manual.author && manual.author !== personName) {
    throw new Error("Manual publications belong to a different author.");
  }
  const items = mergePublications(dblpItems, openReview.items, manual.items).map((item) => {
    const override = bibtexOverrides.get(normalizeTitle(item.title));
    return {
      ...item,
      link: override?.link || item.link,
      authors: formatAuthors(item.authors, personName),
      bibtex: override?.bibtex || item.bibtex,
    };
  });

  const itemsHtml = buildList(items);
  const template = readText(templatePath)
    .replace(/\{\{name\}\}/g, () => escapeAttr(personName))
    .replace("{{items}}", () => itemsHtml || "<p class=\"bio\">No publications found.</p>")
    .replace(/[\t ]+$/gm, "");

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, template, "utf8");
  console.log(`Built publications page with ${items.length} conference and journal papers.`);
};

buildPublications();
