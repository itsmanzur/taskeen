import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '..');

const JSON_PATH = path.join(BASE_DIR, 'data', 'tahqeeq', 'entries.json');
const FRONTEND_JSON_PATH = path.join(BASE_DIR, 'src', 'data', 'entries.json');
const DB_PATH = path.join(BASE_DIR, 'src-tauri', 'resources', 'taskeen.db');

function build() {
  const raw = fs.readFileSync(JSON_PATH, 'utf8');
  const entries = JSON.parse(raw);
  const verified = entries.filter((e) => e.verified !== false);

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }

  const db = new DatabaseSync(DB_PATH);
  db.exec(`
    CREATE TABLE items (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title_bn TEXT NOT NULL,
      emotion_tag TEXT NOT NULL,
      arabic_uthmani TEXT NOT NULL,
      bangla_pronunciation TEXT,
      bangla_meaning TEXT NOT NULL,
      fazilat_text TEXT NOT NULL,
      story_title TEXT,
      story_context TEXT,
      primary_source TEXT NOT NULL,
      hadith_grade TEXT NOT NULL,
      recommended_count INTEGER NOT NULL,
      alim_note TEXT
    );
    CREATE VIRTUAL TABLE items_fts USING fts5(
      id UNINDEXED, title_bn, bangla_meaning, fazilat_text, story_context
    );
  `);

  const insertItem = db.prepare(
    'INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
  );
  const insertFts = db.prepare(
    'INSERT INTO items_fts VALUES (?,?,?,?,?)'
  );

  db.exec('BEGIN');
  try {
    for (const item of verified) {
      insertItem.run(
        item.id,
        item.category,
        item.title_bn,
        item.emotion_tag,
        item.arabic_uthmani,
        item.bangla_pronunciation ?? '',
        item.bangla_meaning,
        item.fazilat_text,
        item.story_title ?? '',
        item.story_context ?? '',
        item.primary_source,
        item.hadith_grade,
        item.recommended_count ?? 33,
        item.alim_note ?? ''
      );
      insertFts.run(
        item.id,
        item.title_bn,
        item.bangla_meaning,
        item.fazilat_text,
        item.story_context ?? ''
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.close();
  }

  // Keep frontend bundled JSON in sync
  fs.mkdirSync(path.dirname(FRONTEND_JSON_PATH), { recursive: true });
  fs.copyFileSync(JSON_PATH, FRONTEND_JSON_PATH);

  const digest = crypto
    .createHash('sha256')
    .update(fs.readFileSync(DB_PATH))
    .digest('hex');

  console.log(`Built ${DB_PATH} with ${verified.length} verified items.`);
  console.log(`Synced ${FRONTEND_JSON_PATH}`);
  console.log(`SHA-256: ${digest}`);
}

build();
