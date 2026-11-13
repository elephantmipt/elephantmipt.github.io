# Updating publications

The publications page lists main conference and journal papers. Preprints, submissions,
rejected or withdrawn papers, Findings, and workshop-only papers are excluded. Papers appearing
in multiple sources are listed once, using the most recent publication year.

Run `npm run update:pubs` to refresh the saved DBLP bibliography and accepted papers
from OpenReview, then rebuild `publications/index.html`. Author identifiers are in
`site.config.json`. OpenReview acceptance is determined by the final venue identifier,
not by a submission title, conference name, or search result label.

`publications.xml` and `publications-openreview.json` are saved source snapshots.
`publications-manual.json` contains papers verified directly against publisher records
that these sources have not indexed yet. A refresh preserves these manual additions.
Builds use these files without network access: `npm run build:pubs` regenerates the
page, and `npm run build` builds the whole site. A failed or invalid source response
leaves its saved snapshot intact; if every source fails, the refresh command fails.
Review partial-refresh warnings because a successful source does not establish that
the other source is current.

Use `bibtex-overrides.json` for verified proceedings citations or corrections. Each
override has a `title` and `bibtex`; an optional `link` selects the canonical paper
page. These overrides take priority over generated citations.

Run `npm run test:pubs` to check publication filtering, deduplication and source-failure
handling. Refreshes are manual; no scheduled check is enabled. Changes remain local
until committed and pushed through the site's existing deployment process.
