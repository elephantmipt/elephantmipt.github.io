import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseDblp, parseOpenReview } from "./publication-sources.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const run = promisify(execFile);

async function fetchSource(url, options) {
  try {
    return await fetch(url, options);
  } catch (error) {
    // Some local Node installations cannot use the system's trusted certificate chain.
    // curl still verifies TLS using the system trust store; never disable verification.
    if (!["CERT_SIGNATURE_FAILURE", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"].includes(error.cause?.code)) throw error;
    const { stdout } = await run("curl", ["--fail", "--silent", "--show-error", "--location", "--max-time", "30", String(url)], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 35000,
    });
    return { ok: true, text: async () => stdout, json: async () => JSON.parse(stdout) };
  }
}

const writeIfChanged = (file, text) => {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === text) return false;
  const temporary = `${file}.tmp`;
  fs.writeFileSync(temporary, text, "utf8");
  fs.renameSync(temporary, file);
  return true;
};

export async function updatePublications({ root = defaultRoot, fetcher = fetchSource, logger = console } = {}) {
  const config = JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8")).publications;
  if (!config?.name || !config.dblpPid || !config.openReviewProfile) {
    throw new Error("Configure the publications author in site.config.json.");
  }
  const get = async (url) => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  };

  const search = new URL("https://api2.openreview.net/notes/search");
  search.searchParams.set("term", `"${config.name}"`);
  search.searchParams.set("content", "authors");
  search.searchParams.set("limit", "1000");
  const sources = await Promise.allSettled([
    (async () => {
      const xml = await (await get(`https://dblp.org/pid/${config.dblpPid}.xml`)).text();
      parseDblp(xml, config.dblpPid);
      return { file: "publications.xml", text: xml, label: "DBLP" };
    })(),
    (async () => {
      const data = await (await get(search)).json();
      const items = parseOpenReview(data, config.name, config.openReviewProfile);
      if (!items.length) throw new Error("OpenReview returned no accepted conference or journal papers.");
      const snapshot = { author: config.name, profile: config.openReviewProfile, items };
      return { file: "publications-openreview.json", text: `${JSON.stringify(snapshot, null, 2)}\n`, label: "OpenReview" };
    })(),
  ]);

  let successful = 0;
  for (const [index, source] of sources.entries()) {
    if (source.status === "rejected") {
      logger.warn(`${index === 0 ? "DBLP" : "OpenReview"} refresh failed; kept the saved bibliography: ${source.reason.message}`);
      continue;
    }
    const { file, text, label } = source.value;
    const changed = writeIfChanged(path.join(root, file), text);
    logger.log(`${label}: ${changed ? "updated" : "already current"}.`);
    successful += 1;
  }
  if (!successful) throw new Error("No publication source could be refreshed. Saved files were preserved.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updatePublications().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
