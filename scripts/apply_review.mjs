// Applies an exported review bundle (taskeen-review-*.json) to the canonical data/tahqeeq/entries.json.
//
//   node scripts/apply_review.mjs <export.json>            dry run (prints what would change)
//   node scripts/apply_review.mjs <export.json> --write    backs up entries.json, then applies
//   (--entries <path> overrides the target file)
//
// Afterwards run:  npm run build:db   (rebuilds the SQLite content DB and syncs src/data/entries.json)
//                  python scripts/check_references.py   (refreshes the cross-check data)
//
// Rules:
//  * A correction is applied only if the file still holds the value the reviewer saw (`original`);
//    otherwise it is reported as a conflict and skipped.
//  * An entry gets a `reviewed` stamp only when its latest review is "approved" AND that review's
//    content hash equals the hash of the entry as it will be after corrections. Anything else is
//    reported as stale — an approval never carries over to changed content.
//  * `verified` is never touched (build_db.mjs uses it to decide what goes into the DB).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const exportPath = args.find((a) => !a.startsWith('--') && a !== args[args.indexOf('--entries') + 1]);
const write = args.includes('--write');
const entriesPath = args.includes('--entries') ? args[args.indexOf('--entries') + 1] : path.join(ROOT, 'data', 'tahqeeq', 'entries.json');

if (!exportPath) {
  console.error('Usage: node scripts/apply_review.mjs <export.json> [--write] [--entries <path>]');
  process.exit(1);
}

// Must stay identical to reviewedFields()/hashItem() in src/lib/contentHash.ts
const contentHash = (it) =>
  crypto.createHash('sha256').update(JSON.stringify({
    arabic: it.arabic_uthmani,
    meaning: it.bangla_meaning,
    fazilat: it.fazilat_text,
    story: it.story_context || '',
    source: it.primary_source,
    grade: it.hadith_grade,
  }), 'utf8').digest('hex');

const bundle = JSON.parse(fs.readFileSync(exportPath, 'utf8'));
if (bundle.format !== 'taskeen-review-export') {
  console.error('This is not a Taskeen review export.');
  process.exit(1);
}
const entries = JSON.parse(fs.readFileSync(entriesPath, 'utf8'));
const byId = new Map(entries.map((e) => [e.id, e]));

const report = { corrected: [], conflicts: [], unknown: [], stamped: [], stale: [], needsFix: [] };

for (const [id, c] of Object.entries(bundle.corrections || {})) {
  const e = byId.get(id);
  if (!e) { report.unknown.push(id); continue; }
  const changes = [];
  let conflict = false;
  for (const field of ['primary_source', 'hadith_grade']) {
    if (c[field] === undefined || c[field] === e[field]) continue;
    if (c.original?.[field] !== e[field]) { conflict = true; changes.push(`${field}: file now "${e[field]}" ≠ reviewer saw "${c.original?.[field]}"`); continue; }
    changes.push({ field, from: e[field], to: c[field] });
  }
  if (conflict) { report.conflicts.push({ id, details: changes.filter((x) => typeof x === 'string') }); continue; }
  for (const ch of changes) { e[ch.field] = ch.to; }
  if (changes.length) report.corrected.push({ id, changes });
}

for (const [id, list] of Object.entries(bundle.reviews || {})) {
  const e = byId.get(id);
  if (!e || !list?.length) continue;
  const latest = [...list].sort((a, b) => b.at.localeCompare(a.at))[0];
  if (latest.status === 'needs_fix') { report.needsFix.push({ id, note: latest.note }); continue; }
  if (latest.content_hash === contentHash(e)) {
    e.reviewed = { status: 'approved', reviewer: latest.reviewer, at: latest.at, content_hash: latest.content_hash, story_grade: latest.story_grade };
    report.stamped.push(id);
  } else {
    report.stale.push(id);
  }
}

console.log(`Corrections applied : ${report.corrected.length}`);
for (const c of report.corrected) for (const ch of c.changes) console.log(`  ${c.id}  ${ch.field}: "${ch.from}" → "${ch.to}"`);
console.log(`Conflicts (skipped) : ${report.conflicts.length}`);
for (const c of report.conflicts) console.log(`  ${c.id}: ${c.details.join('; ')}`);
console.log(`Unknown ids         : ${report.unknown.length} ${report.unknown.join(', ')}`);
console.log(`Stamped reviewed    : ${report.stamped.length}`);
console.log(`Stale approvals     : ${report.stale.length}${report.stale.length ? ' — content changed after approval; re-review in the app' : ''}`);
console.log(`Marked needs-fix    : ${report.needsFix.length}`);
for (const n of report.needsFix) console.log(`  ${n.id}: ${n.note}`);

if (!write) {
  console.log('\nDry run only. Re-run with --write to apply.');
  process.exit(0);
}
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const backupDir = path.join(path.dirname(entriesPath), 'backup');
fs.mkdirSync(backupDir, { recursive: true });
const backup = path.join(backupDir, `entries.${stamp}.json`);
fs.copyFileSync(entriesPath, backup);
fs.writeFileSync(entriesPath, JSON.stringify(entries, null, 2) + '\n', 'utf8');
console.log(`\nBackup: ${backup}\nWritten: ${entriesPath}\nNext: npm run build:db && python scripts/check_references.py`);
