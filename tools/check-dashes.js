#!/usr/bin/env node
'use strict';

/**
 * House style: no em dashes, en dashes or horizontal bars in anything we ship.
 *
 * This exists because the rule had been stated and the site still carried
 * twenty-six of them, spread across a page title, a chart alt attribute, a
 * JSON data file and two source comments. Prose review does not catch a dash
 * inside `alt="..."`; a grep run once does not stop the next one arriving.
 *
 * The hyphen-minus (U+002D) is fine and is what to use. So is a minus sign in
 * mathematics, which is why U+2212 is listed separately below and reported
 * with a different suggestion.
 *
 * `schema/` is exempt, and deliberately. Those files are byte-for-byte mirrors
 * of agentrust-io/trace-spec, enforced by .github/workflows/schema-parity.yml.
 * Editing one here to remove a dash would break parity, so a dash appearing in
 * them is a trace-spec fix followed by a re-sync, not something this repository
 * can act on. Failing CI here for something CI here cannot fix would only teach
 * people to ignore it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const EXTENSIONS = new Set([
  '.html', '.js', '.css', '.txt', '.md', '.json', '.xml', '.svg', '.yml', '.yaml',
]);

const SKIP_DIRECTORIES = new Set(['.git', 'node_modules', '.github']);

/** Mirrored upstream; see the note above. */
const EXEMPT_PREFIXES = ['schema/'];

// Built from code points, not written as literals. A checker containing the
// characters it bans reports itself, which sounds like a joke until it is the
// only failure in the log and somebody adds an exemption for the checker in
// order to make CI green.
const OFFENDERS = [
  { code: 0x2014, name: 'em dash', fix: 'use a colon, a comma, or two sentences' },
  { code: 0x2013, name: 'en dash', fix: 'write the range out: "A to Z", "2024 to 2026"' },
  { code: 0x2015, name: 'horizontal bar', fix: 'use a colon or a comma' },
  { code: 0x2212, name: 'minus sign', fix: 'use a hyphen-minus (-) outside mathematics' },
].map((entry) => ({ ...entry, char: String.fromCharCode(entry.code) }));

const BY_CHAR = new Map(OFFENDERS.map((entry) => [entry.char, entry]));

function* walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      yield* walk(path.join(directory, entry.name));
    } else if (EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      yield path.join(directory, entry.name);
    }
  }
}

function exempt(relative) {
  return EXEMPT_PREFIXES.some((prefix) => relative.startsWith(prefix));
}

function findings() {
  const found = [];
  for (const absolute of walk(ROOT)) {
    const relative = path.relative(ROOT, absolute).split(path.sep).join('/');
    if (exempt(relative)) continue;
    const lines = fs.readFileSync(absolute, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const [character, offender] of BY_CHAR) {
        let at = line.indexOf(character);
        while (at !== -1) {
          found.push({
            file: relative,
            line: index + 1,
            offender,
            // Enough either side to identify which occurrence, without dumping
            // a minified line into the log.
            context: line.slice(Math.max(0, at - 45), at + 45).trim(),
          });
          at = line.indexOf(character, at + 1);
        }
      }
    });
  }
  return found;
}

const found = findings();
if (found.length === 0) {
  console.log('no em dashes, en dashes or horizontal bars outside schema/');
  process.exit(0);
}

for (const entry of found) {
  console.error(`${entry.file}:${entry.line}: ${entry.offender.name} (${entry.offender.fix})`);
  console.error(`  ...${entry.context}...`);
}
console.error(`\n${found.length} occurrence(s). House style is no em dashes anywhere we publish.`);
process.exit(1);
