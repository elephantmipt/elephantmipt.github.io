import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mergePublications, parseDblp, parseOpenReview } from "./publication-sources.mjs";
import { updatePublications } from "./update-publications.mjs";

const author = "Nikita Balagansky";
const profile = "~Nikita_Balagansky3";
const note = ({ id = "accepted", title = "Accepted paper", venueId = "ICML.cc/2026/Conference", venue = "ICML 2026 regular", authorId = profile } = {}) => ({
  id,
  forum: id,
  content: {
    title: { value: title },
    authors: { value: [author] },
    authorids: { value: [authorId] },
    venueid: { value: venueId },
    venue: { value: venue },
    _bibtex: { value: `@inproceedings{paper, title={${title}}, year={2026}}` },
  },
});
const searchResults = (notes) => ({ count: notes.length, notes });
const record = (type, title, venue, attributes = "") => `<r><${type} ${attributes}><author>${author}</author><title>${title}.</title><year>2026</year><${type === "article" ? "journal" : "booktitle"}>${venue}</${type === "article" ? "journal" : "booktitle"}><ee>https://example.org/paper</ee></${type}></r>`;
const bibliography = (...records) => `<dblpperson name="${author}" pid="318/0989">${records.join("")}</dblpperson>`;
const xml = bibliography(record("inproceedings", "Conference paper", "ICML"));

test("includes accepted conference papers and excludes submissions, rejections, withdrawals, workshops and Findings", () => {
  const notes = [
    note(),
    note({ id: "submitted", venue: "Submitted to ICLR 2026" }),
    note({ id: "rejected", venueId: "ICLR.cc/2026/Conference/Rejected_Submission" }),
    note({ id: "withdrawn", venueId: "ICLR.cc/2026/Conference/Withdrawn_Submission" }),
    note({ id: "workshop", venueId: "ICML.cc/2026/Workshop/Mech_Interp" }),
    note({ id: "findings", venueId: "EMNLP/2026/Conference", venue: "Findings of EMNLP 2026" }),
    note({ id: "other-author", authorId: "~Nikita_Balagansky99" }),
  ];
  const items = parseOpenReview(searchResults(notes), author, profile);
  assert.deepEqual(items.map((item) => item.id), ["accepted"]);
  assert.equal(items[0].venue, "ICML");
});

test("reads search results containing forum content and accepts published journals", () => {
  const journal = note({ id: "journal", venueId: "TMLR", venue: "Transactions on Machine Learning Research" });
  const items = parseOpenReview(searchResults([{ id: "review", forum: journal.id, forumContent: journal.content }]), author, profile);
  assert.equal(items[0].type, "article");
  assert.equal(items[0].id, "journal");
});

test("rejects malformed or incomplete OpenReview responses", () => {
  assert.throws(() => parseOpenReview({}, author, profile), /search results/);
  assert.throws(() => parseOpenReview({ notes: [], count: 1001 }, author, profile), /incomplete/);
});

test("includes DBLP journals while excluding preprints, informal records, workshops and Findings", () => {
  const data = bibliography(
    record("inproceedings", "Conference paper", "ICML"),
    record("article", "Journal paper", "JMLR"),
    record("article", "Preprint", "CoRR"),
    record("article", "Informal", "Other", 'publtype="informal"'),
    record("inproceedings", "Workshop paper", "RepL4NLP@ACL"),
    record("inproceedings", "Other workshop", "ICML Workshops"),
    record("inproceedings", "Findings paper", "Findings of EMNLP"),
  );
  const { items } = parseDblp(data, "318/0989");
  assert.deepEqual(items.map((item) => item.title), ["Conference paper", "Journal paper"]);
  assert.match(items[1].bibtex, /@article\{[\s\S]*journal=\{JMLR\}/);
});

test("rejects bot challenges, truncated XML and the wrong DBLP author", () => {
  assert.throws(() => parseDblp("<!doctype html><html>Check your browser</html>"), /complete DBLP/);
  assert.throws(() => parseDblp(xml.replace("</dblpperson>", "")), /complete DBLP/);
  assert.throws(() => parseDblp(xml, "999/9999"), /configured author/);
});

test("decodes title entities and strips DBLP formatting", () => {
  const { items } = parseDblp(bibliography(record("article", "A &amp; B <i>study</i> &#x2014; &#945;", "JMLR")));
  assert.equal(items[0].title, "A & B study — α");
});

test("merges duplicate papers across sources, preferring the newer publication", () => {
  const old = { title: "A paper.", year: "2025", link: "old" };
  const latest = { title: "A PAPER", year: "2026", link: "new" };
  assert.deepEqual(mergePublications([latest], [old]), [latest]);
  assert.deepEqual(mergePublications([old], [latest]), [latest]);
});

const fixture = (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "publication-sync-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "site.config.json"), JSON.stringify({ publications: { name: author, dblpPid: "318/0989", openReviewProfile: profile } }));
  fs.writeFileSync(path.join(root, "publications.xml"), xml);
  fs.writeFileSync(path.join(root, "publications-openreview.json"), "saved snapshot\n");
  return root;
};
const logger = { warn() {}, log() {} };

test("keeps the DBLP snapshot when it returns HTML and refreshes OpenReview independently", async (context) => {
  const root = fixture(context);
  const fetcher = async (url) => String(url).includes("dblp.org")
    ? new Response("<html>Bot challenge</html>")
    : Response.json(searchResults([note()]));
  await updatePublications({ root, fetcher, logger });
  assert.equal(fs.readFileSync(path.join(root, "publications.xml"), "utf8"), xml);
  const snapshot = JSON.parse(fs.readFileSync(path.join(root, "publications-openreview.json"), "utf8"));
  assert.equal(snapshot.items[0].id, "accepted");
  const modified = fs.statSync(path.join(root, "publications-openreview.json")).mtimeMs;
  await updatePublications({ root, fetcher, logger });
  assert.equal(fs.statSync(path.join(root, "publications-openreview.json")).mtimeMs, modified);
});

test("reports failure without changing either saved source when all refreshes fail", async (context) => {
  const root = fixture(context);
  const fetcher = async () => new Response("Unavailable", { status: 503 });
  await assert.rejects(updatePublications({ root, fetcher, logger }), /No publication source/);
  assert.equal(fs.readFileSync(path.join(root, "publications.xml"), "utf8"), xml);
  assert.equal(fs.readFileSync(path.join(root, "publications-openreview.json"), "utf8"), "saved snapshot\n");
});
