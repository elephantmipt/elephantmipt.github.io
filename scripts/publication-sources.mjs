const value = (field) => field?.value ?? field;

export const normalizeTitle = (title) =>
  String(title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export const decodeXml = (text) =>
  String(text ?? "")
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const tags = (xml, tag) =>
  [...xml.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g"))]
    .map((match) => decodeXml(match[1].replace(/<[^>]+>/g, "").trim()));
const tag = (xml, name) => tags(xml, name)[0] || "";

const conferenceNames = {
  iclr: "International Conference on Learning Representations",
  icml: "International Conference on Machine Learning",
  neurips: "Advances in Neural Information Processing Systems",
  nips: "Advances in Neural Information Processing Systems",
  acl: "Annual Meeting of the Association for Computational Linguistics",
  "acl (1)": "Annual Meeting of the Association for Computational Linguistics",
  emnlp: "Conference on Empirical Methods in Natural Language Processing",
  colm: "Conference on Language Modeling",
};

const makeBibtex = ({ type, title, authors, year, venue, link }) => {
  const surname = (authors[0] || "paper").split(/\s+/).at(-1);
  const key = `${surname}${year}${normalizeTitle(title).slice(0, 12)}`.toLowerCase();
  const venueField = type === "article" ? "journal" : "booktitle";
  return `@${type}{${key},\n  title={${title}},\n  author={${authors.join(" and ")}},\n  ${venueField}={${conferenceNames[venue.toLowerCase()] || venue}},\n  year={${year}},\n  url={${link}}\n}`;
};

export function parseDblp(xml, expectedPid) {
  const person = xml.match(/<dblpperson\b([^>]*)>/);
  if (!person || !xml.trim().endsWith("</dblpperson>")) {
    throw new Error("Expected a complete DBLP XML bibliography.");
  }
  const pid = person[1].match(/\bpid="([^"]+)"/)?.[1];
  const name = decodeXml(person[1].match(/\bname="([^"]+)"/)?.[1]);
  if (!name || !pid || (expectedPid && pid !== expectedPid)) {
    throw new Error("DBLP bibliography does not match the configured author.");
  }

  const items = [];
  for (const [block] of xml.matchAll(/<r>[\s\S]*?<\/r>/g)) {
    const record = block.match(/<(inproceedings|article)\b([^>]*)>/);
    if (!record || /\bpubltype="[^"]*(?:informal|withdrawn)/i.test(record[2])) continue;
    const type = record[1];
    const venue = tag(block, type === "article" ? "journal" : "booktitle");
    if (!venue || /\b(?:CoRR|arXiv|bioRxiv|medRxiv|workshops?|RepL4NLP|Findings)\b|@/i.test(venue)) continue;

    const item = {
      type,
      title: tag(block, "title").replace(/\.$/, ""),
      year: tag(block, "year"),
      venue,
      link: tags(block, "ee")[0] || "",
      authors: tags(block, "author"),
    };
    if (!item.title || !/^\d{4}$/.test(item.year) || !item.authors.includes(name)) continue;
    item.bibtex = makeBibtex(item);
    items.push(item);
  }
  if (!items.length) throw new Error("DBLP returned no conference or journal papers.");
  return { name, pid, items };
}

export function parseOpenReview(data, authorName, profileId) {
  if (!Array.isArray(data.notes) || !Number.isInteger(data.count) || data.count < 0) {
    throw new Error("Expected OpenReview search results.");
  }
  if (data.count > data.notes.length) {
    throw new Error("OpenReview returned an incomplete bibliography; increase the search limit.");
  }
  const items = new Map();
  for (const note of data.notes) {
    const content = note.forumContent ?? note.content ?? {};
    const authors = value(content.authors) || [];
    const authorIds = value(content.authorids) || [];
    if (!Array.isArray(authors) || !authors.includes(authorName)) continue;
    if (authorIds.length && !authorIds.includes(profileId)) continue;

    const venueId = value(content.venueid) || "";
    const venue = value(content.venue) || "";
    // Conference submissions have additional path segments until accepted.
    const conference = /\/Conference$/i.test(venueId);
    const journal = /^(?:TMLR|jmlr\.org\/TMLR)$/.test(venueId) || /\/Journal$/i.test(venueId);
    if ((!conference && !journal) || /submitted|under review|reject|withdraw|workshop|findings/i.test(`${venueId} ${venue}`)) continue;

    const bibtex = value(content._bibtex) || "";
    const year = bibtex.match(/\byear\s*=\s*[{\"]?(\d{4})/i)?.[1];
    const title = value(content.title)?.trim().replace(/\.$/, "");
    const id = note.forum || note.id;
    if (!title || !year || !/^[\w-]+$/.test(id)) continue;
    const item = {
      id,
      venueId,
      type: journal ? "article" : "inproceedings",
      title,
      year,
      venue: conference ? venue.replace(/\s+\d{4}\b.*$/, "") : venue,
      link: `https://openreview.net/forum?id=${id}`,
      authors,
      bibtex,
    };
    items.set(id, item);
  }
  return [...items.values()].sort((a, b) => Number(b.year) - Number(a.year) || a.title.localeCompare(b.title));
}

export function mergePublications(...sources) {
  const items = new Map();
  for (const source of sources) {
    for (const item of source) {
      const key = normalizeTitle(item.title);
      const previous = items.get(key);
      if (!previous || Number(item.year) >= Number(previous.year)) items.set(key, item);
    }
  }
  return [...items.values()];
}
