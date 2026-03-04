export interface LrcLine {
  time: number; // milliseconds
  text: string;
}

export interface LrcMetadata {
  title?: string;
  artist?: string;
  album?: string;
  length?: string;
}

export interface ParsedLrc {
  metadata: LrcMetadata;
  lines: LrcLine[];
}

/**
 * Parse a timestamp like [mm:ss.xx] or [mm:ss.xxx] into milliseconds
 */
function parseTimestamp(timestamp: string): number {
  const match = timestamp.match(/(\d+):(\d+)(?:\.(\d+))?/);
  if (!match) return 0;

  const minutes = parseInt(match[1], 10);
  const seconds = parseInt(match[2], 10);
  let milliseconds = 0;

  if (match[3]) {
    const frac = match[3];
    // Normalize to milliseconds: "12" -> 120, "123" -> 123, "1" -> 100
    milliseconds = parseInt(frac.padEnd(3, '0').slice(0, 3), 10);
  }

  return minutes * 60 * 1000 + seconds * 1000 + milliseconds;
}

/**
 * Parse LRC content string into structured data
 */
export function parseLrc(content: string): ParsedLrc {
  const lines = content.split(/\r?\n/);
  const metadata: LrcMetadata = {};
  const lrcLines: LrcLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check metadata tags
    const metaMatch = trimmed.match(/^\[([a-z]+):(.+)\]$/i);
    if (metaMatch) {
      const tag = metaMatch[1].toLowerCase();
      const value = metaMatch[2].trim();
      switch (tag) {
        case 'ti':
          metadata.title = value;
          break;
        case 'ar':
          metadata.artist = value;
          break;
        case 'al':
          metadata.album = value;
          break;
        case 'length':
          metadata.length = value;
          break;
      }
      continue;
    }

    // Match timed lines: [mm:ss.xx]text or multiple timestamps [mm:ss.xx][mm:ss.xx]text
    const timestampRegex = /\[(\d+:\d+(?:\.\d+)?)\]/g;
    const timestamps: number[] = [];
    let lastIndex = 0;
    let match;

    while ((match = timestampRegex.exec(trimmed)) !== null) {
      timestamps.push(parseTimestamp(match[1]));
      lastIndex = match.index + match[0].length;
    }

    if (timestamps.length > 0) {
      const text = trimmed.slice(lastIndex).trim();
      // Each timestamp gets the same text (for multi-timestamp lines)
      for (const time of timestamps) {
        lrcLines.push({ time, text });
      }
    }
  }

  // Sort by time
  lrcLines.sort((a, b) => a.time - b.time);

  return { metadata, lines: lrcLines };
}

/**
 * Get the active line index for a given playback time (ms)
 */
export function getActiveLine(lines: LrcLine[], currentTime: number): number {
  if (lines.length === 0) return -1;

  // Find the last line whose time is <= currentTime
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= currentTime) {
      activeIndex = i;
    } else {
      break;
    }
  }

  return activeIndex;
}

/**
 * Get total duration from LRC lines (last line time + a buffer)
 */
export function getLrcDuration(lines: LrcLine[]): number {
  if (lines.length === 0) return 0;
  return lines[lines.length - 1].time + 5000; // 5s buffer after last line
}

/**
 * Get the display text (word-by-word) for a given time in ms
 */
export function getTextAtTime(lines: LrcLine[], timeMs: number): string {
  const idx = getActiveLine(lines, timeMs);
  if (idx < 0) return '';
  const line = lines[idx];
  if (!line.text) return '';

  const lineStart = line.time;
  const nextLine = lines[idx + 1];
  const lineEnd = nextLine ? nextLine.time : lineStart + 4000;
  const lineDuration = lineEnd - lineStart;
  const words = line.text.split(/\s+/).filter(Boolean);
  const totalWords = words.length;
  if (totalWords === 0) return '';

  const elapsedInLine = timeMs - lineStart;
  const wordInterval = lineDuration / totalWords;
  const wordsToShow = Math.min(
    totalWords,
    Math.max(1, Math.floor(elapsedInLine / wordInterval) + 1)
  );
  return words.slice(0, wordsToShow).join(' ');
}

/**
 * Format milliseconds to mm:ss display
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Sample LRC content for demo purposes
 */
export const sampleLrc = `[ti:365]
[ar:Charli XCX]
[al:BRAT]

[00:00.00]
[00:04.50]I wanna do bad things to you
[00:08.20]Every night, every day
[00:12.00]365 party girl
[00:15.50]I'm on my own
[00:19.00]I'm dancing alone
[00:22.50]365 party girl
[00:26.00]Sweat dripping down me
[00:29.50]Music is so loud
[00:33.00]365 party girl
[00:36.50]I keep on going
[00:40.00]I don't wanna stop
[00:43.50]I just wanna dance
[00:47.00]365 party girl
[00:50.50]Every night, I'm the one
[00:54.00]Under neon lights
[00:57.50]365 party girl
[01:01.00]Can't stop, won't stop
[01:04.50]Living for the beat
[01:08.00]365 party girl`;
