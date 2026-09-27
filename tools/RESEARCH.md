# Research library

`data/research.json` is the metadata source. `tools/build-research.py` generates
the collection, paper and version pages, BibTeX, CITATION.cff and SHA256SUMS.
PDFs and source ZIPs are frozen release inputs. The builder verifies their hashes.

For a metadata correction or a newly assigned DOI:

```sh
python tools/build-research.py
python tools/build-header.py
python tools/build-discovery.py
python tools/build-research.py --check
python tools/check-site.py
python tools/check-discovery.py
```

Only add a DOI after the external record is published and its identity, authors,
version and files have been checked. Before then, citations use the version URL.
The research pages do not claim repository acceptance or peer review.

For a substantive paper revision, retain the published version and add a new
version directory, citation and version-history entry. Extend the builder's
current v1-only rendering when introducing v2; do not overwrite v1 or update its
hashes to disguise a changed artifact. Use the same versioned PDF in the site and
external archive. External repositories may add their own cover or metadata;
document any resulting file difference.

Source ZIPs contain only the released manuscript's source, figures and experiment
material. They exclude private portfolio records and unrelated manuscripts.
Captured benchmark results are historical records; publishing them is not a new
experiment run or independent replication. The exact SDK revision is missing
from some original results, and that limitation remains visible.

The current library uses the site's existing shared header and a scoped CSS file.
No global stylesheet version bump is needed for changes to `research/research.css`.
