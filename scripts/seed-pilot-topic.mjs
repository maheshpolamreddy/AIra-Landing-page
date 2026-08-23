/**
 * Seed pilot topic (bio-11-8-mitochondria) and queue full generation.
 * Requires FIREBASE_SERVICE_ACCOUNT_JSON, GROQ_API_KEY, SARVAM_API_KEY, INNGEST_EVENT_KEY (optional).
 *
 * Usage: node scripts/seed-pilot-topic.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.CONTENT_API_BASE || 'http://127.0.0.1:3000';
const BRIDGE = process.env.CONTENT_BRIDGE_SECRET;
if (!BRIDGE) {
  console.error('CONTENT_BRIDGE_SECRET is required');
  process.exit(1);
}

const PILOT_TOPIC = {
  topicId: 'bio-11-8-mitochondria',
  gradeId: 'grade-11-science',
  subjectId: 'biology',
  chapterId: 'bio-11-8',
  topicName: 'Mitochondria',
  description: 'Structure and function of mitochondria — the powerhouse of the cell.',
  difficulty: 'intermediate',
  gradeName: 'Grade 11 Science',
  subjectName: 'Biology',
  chapterName: 'Cell: The Unit of Life',
  contentVersion: 1,
  visualRegistryVersion: 1,
  diagramKeys: [
    '8_mitochondria_c.8_mitochondria_d',
    '8_mitochondria_c.8_mitochondria_d.overview',
    '8_mitochondria_c.8_mitochondria_d.outer',
    '8_mitochondria_c.8_mitochondria_d.inner',
    '8_mitochondria_c.8_mitochondria_d.cristae',
    '8_mitochondria_c.8_mitochondria_d.matrix',
    '8_mitochondria_c.8_mitochondria_d.mtdna',
  ],
  status: 'active',
};

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-aira-content-bridge': BRIDGE,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

async function main() {
  console.log('Registering pilot topic...');
  await post('/api/content/register-topic', { ...PILOT_TOPIC, queueGeneration: true });
  console.log('Pilot topic registered and generation queued (5 styles × 3 languages).');
  console.log('Monitor via Inngest dashboard or GET /api/content/status?topicId=bio-11-8-mitochondria');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
