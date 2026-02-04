import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const xmlPath = path.join(rootDir, "publications.xml");
const templatePath = path.join(rootDir, "templates", "publications.html");
const outputPath = path.join(rootDir, "publications", "index.html");
const overridesPath = path.join(rootDir, "bibtex-overrides.json");

const readText = (file) => fs.readFileSync(file, "utf8");
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const decodeXml = (value) =>
  String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

const escapeAttr = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const getTag = (block, tag) => {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1].trim()) : "";
};

const getTags = (block, tag) => {
  const matches = [...block.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "g"))];
  return matches.map((m) => decodeXml(m[1].trim())).filter(Boolean);
};

const normalizeTitle = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

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
      map.set(key, String(item.bibtex).trim());
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
      return `<span class="author-self">${author}</span>`;
    }
    return author;
  });
  return formatted.join(", ");
};

const makeBibtexKey = (authors, year, title) => {
  const firstAuthor = (authors[0] || "paper").split(/\s+/).slice(-1)[0];
  const firstWord = String(title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
  return `${firstAuthor}${year}${firstWord}`.toLowerCase();
};

const expandConferenceName = (name) => {
  const normalized = String(name || "").trim();
  if (!normalized) return "";
  const key = normalized.toLowerCase();
  const map = {
    "iclr": "International Conference on Learning Representations",
    "icml": "International Conference on Machine Learning",
    "neurips": "Advances in Neural Information Processing Systems",
    "nips": "Advances in Neural Information Processing Systems",
    "acl": "Annual Meeting of the Association for Computational Linguistics",
    "acl (1)": "Annual Meeting of the Association for Computational Linguistics",
    "emnlp": "Conference on Empirical Methods in Natural Language Processing",
    "colm": "Conference on Language Modeling",
  };
  return map[key] || normalized;
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
          const titleLink = entry.link
            ? `<a href="${entry.link}" target="_blank" rel="noopener noreferrer">${entry.title}</a>`
            : entry.title;
          const venue = entry.venue ? entry.venue : "";
          const bibtex = entry.bibtex
            ? `<button class="bibtex-btn" data-bibtex="${escapeAttr(entry.bibtex)}">BibTeX</button>`
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
          <h2 class="section-title">${year}</h2>
          <div class="list">
            ${listItems}
          </div>
        </section>
      `;
    })
    .join("\n");
};

const buildPublications = () => {
  if (!fs.existsSync(xmlPath)) {
    console.warn("publications.xml not found, skipping publications build.");
    return;
  }

  const xml = readText(xmlPath);
  const bibtexOverrides = loadBibtexOverrides();
  const nameMatch = xml.match(/<dblpperson[^>]*name="([^"]+)"/);
  const personName = nameMatch ? decodeXml(nameMatch[1]) : "Your Name";

  const blocks = [...xml.matchAll(/<r>[\s\S]*?<\/r>/g)].map((m) => m[0]);

  const items = blocks
    .filter((block) => /<inproceedings[\s>]/.test(block))
    .filter((block) => {
      const booktitle = getTag(block, "booktitle").toLowerCase();
      return !booktitle.includes("repl4nlp");
    })
    .map((block) => {
      const title = getTag(block, "title").replace(/\.$/, "");
      const titleKey = normalizeTitle(title);
      const year = getTag(block, "year");
      const booktitle = getTag(block, "booktitle");
      const journal = getTag(block, "journal");
      const volume = getTag(block, "volume");
      const ee = getTags(block, "ee")[0] || "";
      const authorsRaw = getTags(block, "author");

      const venue = booktitle || journal || "";
      const venueLabel = journal && volume ? `${venue} (${volume})` : venue;
      const bibtexVenue = expandConferenceName(venue);
      const bibtexKey = makeBibtexKey(authorsRaw, year, title);
      const generatedBibtex = `@inproceedings{${bibtexKey},\n  title={${title}},\n  author={${authorsRaw.join(" and ")}},\n  booktitle={${bibtexVenue || "Conference"}},\n  year={${year}},\n  url={${ee}}\n}`;
      const bibtex = bibtexOverrides.get(titleKey) || generatedBibtex;

      return {
        title,
        year,
        venue: venueLabel,
        link: ee,
        authors: formatAuthors(authorsRaw, personName),
        bibtex,
      };
    })
    .filter((item) => item.title && item.year);

  const itemsHtml = buildList(items);
  const template = readText(templatePath)
    .replace(/\{\{name\}\}/g, personName)
    .replace("{{items}}", itemsHtml || "<p class=\"bio\">No publications found.</p>");

  ensureDir(path.dirname(outputPath));
  fs.writeFileSync(outputPath, template, "utf8");
};

buildPublications();
