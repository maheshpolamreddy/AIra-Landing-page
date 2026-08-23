/**
 * Unit checks for WAV duration parsing and tolerant XML segment parsing.
 * Usage: node scripts/validate-wav-duration.mjs
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function buildMinimalWav(durationSec, sampleRate = 22050) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const dataSize = Math.floor(durationSec * byteRate);
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  return buffer;
}

/** Inline mirror of lib/content/ttsPipeline.parseWavDurationSeconds for unit test */
function parseWavDurationSeconds(buffer) {
  if (buffer.length < 44) return 0;
  const byteRate = buffer.readUInt32LE(28);
  if (byteRate <= 0) return 0;
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    if (chunkId === 'data') return Math.max(0.1, chunkSize / byteRate);
    offset += 8 + chunkSize;
    if (chunkSize <= 0) break;
  }
  return Math.max(0.1, Math.max(0, buffer.length - 44) / byteRate);
}

async function main() {
  const wav3s = buildMinimalWav(3.0);
  const measured = parseWavDurationSeconds(wav3s);
  if (Math.abs(measured - 3.0) > 0.05) {
    throw new Error(`WAV duration parse failed: expected ~3s, got ${measured}`);
  }
  console.log(`[PASS] parseWavDurationSeconds: ${measured.toFixed(2)}s`);

  const SEGMENT_BLOCK_REGEX = /<SEGMENT([^>]*)>([\s\S]*?)<\/SEGMENT>/gi;
  function parseSegmentAttributes(attrStr) {
    const attrs = {};
    const re = /(\w+)="([^"]*)"/g;
    let m;
    while ((m = re.exec(attrStr)) !== null) attrs[m[1]] = m[2];
    return attrs;
  }
  function parseXmlSegments(raw) {
    const segments = [];
    let match;
    SEGMENT_BLOCK_REGEX.lastIndex = 0;
    while ((match = SEGMENT_BLOCK_REGEX.exec(raw)) !== null) {
      const attrs = parseSegmentAttributes(match[1]);
      segments.push({
        visualMarker: attrs.visualMarker?.trim() || '',
        highlightTarget: attrs.highlightTarget?.trim() || '',
      });
    }
    return segments;
  }

  const xml = `
<SEGMENT highlightTarget="a.b.part" visualMarker="intro-marker" visualAction="highlight">
Hello world segment one.
</SEGMENT>
<SEGMENT visualMarker="second" highlightTarget="a.b.other">
Second segment text.
</SEGMENT>`;
  const parsed = parseXmlSegments(xml);
  if (parsed.length !== 2) throw new Error(`Expected 2 segments, got ${parsed.length}`);
  if (parsed[0].highlightTarget !== 'a.b.part') throw new Error('Attribute order tolerance failed');
  console.log('[PASS] parseXmlSegments tolerant attribute order');
  console.log('\nAll unit checks passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
