# Search discovery and availability

The public HTML is the primary source for readers and crawlers. `llms.txt` is a short navigation and interpretation guide, not a ranking signal or a substitute for the specifications. Keep its claims aligned with the visible pages and link to release information instead of copying versions that will become stale.

## Updating pages and the catalog

Run these commands from the repository root with Python 3.11 or later:

```sh
python tools/build-discovery.py
python tools/build-discovery.py --check
python tools/check-discovery.py
python tools/check-site.py
node marketplace/marketplace.test.js
node tools/check-dashes.js
```

The generator builds `sitemap.xml` from canonical, indexable HTML. Redirect aliases, including the 30 control permalinks, and the 404 page are excluded. It omits modification dates rather than inventing freshness. CI checks titles, descriptions, main headings, canonical URLs, sitemap coverage, local AI-guide links, and access under eight search and assistant robots policies.

To update the saved marketplace catalog when integrations change:

```sh
python tools/build-discovery.py --refresh
```

This fetches both catalogs at one public `agentrust-io/integrations` commit, records the capture date and source revision in `data/marketplace-snapshot.json`, and rebuilds `/marketplace/catalog/`. Commit both the snapshot and generated HTML in the current site PR. Review the descriptions and links before merging. Offline generation and CI never fetch remote catalogs. The saved catalog is visibly dated and points to live search for newer listings; it is not updated automatically.

## Availability checks

After merging, the Public site availability workflow runs every six hours and can be dispatched manually. It reads the deployed sitemap, checks its pages, checks the home/robots/sitemap/AI-guide endpoints of all seven public hosts, and verifies that an unknown URL returns 404. Individual probes retry once. Results are retained as a workflow artifact for 14 days. Maintainers can use GitHub Actions failure notifications to investigate.

```sh
python tools/check-availability.py
```

This checks public HTTP status, nonempty responses, challenge headers, and unexpected `X-Robots-Tag: noindex`. It does not measure browser rendering, all content changes, uptime percentages, real search-engine IP access, or field Core Web Vitals. Requests identify themselves as `AgenTrust-availability-check/1.0`; a generic Python user agent received HTTP 403 during the initial audit, while the declared monitor and sampled search/assistant user agents received 200. Do not treat user-agent substitution as proof of actual crawler access.

## Search-engine verification

Use the site's verified Google Search Console and Bing Webmaster Tools properties to inspect indexing, canonical selection, submitted sitemaps, crawl errors, queries, and actual referrals. Those account reports were not inspected in this change. Browser preview was interrupted by a connection timeout, so the new catalog and 404 still need visual review.

Keep Googlebot, Bingbot, OAI-SearchBot, Claude-SearchBot, and PerplexityBot access separate from training preferences. Do not disable WAF protection or trust an arbitrary user-agent string to admit purported bots; investigate real crawler requests and published verification guidance when a block occurs. This PR preserves the existing allow-all crawl policy and updates the explicit Claude names.

Technical eligibility does not guarantee indexing, ranking, inclusion in generated answers, or citation. Avoid duplicate pages written for query variants, invented testimonials, hidden bot-only claims, or unsupported assurance labels.

Primary guidance:

- [Google search technical requirements](https://developers.google.com/search/docs/essentials/technical)
- [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Google AI search guidance](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Anthropic crawler controls](https://privacy.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler)
- [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)
