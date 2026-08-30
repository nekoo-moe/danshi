/**
 * Beatmap Auto-Fetcher in TypeScript.
 * Resolves Beatmap MD5 checksums and fallback text queries across multiple mirror APIs:
 * Catboy/Mino, Sayobot, osu.direct, Nerinyan.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BeatmapInfo, FilenameMetadata } from './types';

const USER_AGENT = 'danser-autofetch/1.3.4 (https://github.com/heiznerd/danser-autofetch)';

export class BeatmapFetcher {
  private songsDir: string;

  constructor(songsDir: string) {
    this.songsDir = path.resolve(songsDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
    if (!fs.existsSync(this.songsDir)) {
      fs.mkdirSync(this.songsDir, { recursive: true });
    }
  }

  static getDownloadCandidates(sid: number | string): { name: string; url: string }[] {
    return [
      { name: 'Catboy/Mino', url: `https://catboy.best/d/${sid}` },
      { name: 'Sayobot (Full)', url: `https://dl.sayobot.cn/beatmaps/download/full/${sid}` },
      { name: 'osu.direct', url: `https://osu.direct/api/d/${sid}` },
      { name: 'Nerinyan', url: `https://api.nerinyan.moe/d/${sid}` },
      { name: 'Sayobot (Mini)', url: `https://dl.sayobot.cn/beatmaps/download/mini/${sid}` },
    ];
  }

  async fetchByMd5Catboy(md5: string): Promise<BeatmapInfo | null> {
    const url = `https://catboy.best/api/v2/md5/${md5}`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data: any = await resp.json();
      const sid = data.beatmapset_id || (data.set && data.set.id);
      const title = (data.set && (data.set.title || data.set.title_unicode)) || data.title || 'Unknown';
      const artist = (data.set && (data.set.artist || data.set.artist_unicode)) || data.artist || 'Unknown';
      const version = data.version;
      const creator = (data.set && data.set.creator) || data.creator;

      if (sid) {
        return {
          beatmapSetId: sid,
          title,
          artist,
          version,
          creator,
          downloadUrl: `https://catboy.best/d/${sid}`,
          source: 'Catboy/Mino (MD5)',
        };
      }
    } catch {
      // Ignore network errors
    }
    return null;
  }

  async fetchByMd5Sayobot(md5: string): Promise<BeatmapInfo | null> {
    const url = `https://api.sayobot.cn/v2/beatmapinfo?K=${md5}&T=1`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data: any = await resp.json();
      if (data.status === 0 && data.data && data.data.sid) {
        return {
          beatmapSetId: data.data.sid,
          title: data.data.title || 'Unknown',
          artist: data.data.artist || 'Unknown',
          version: data.data.version,
          creator: data.data.creator,
          downloadUrl: `https://dl.sayobot.cn/beatmaps/download/full/${data.data.sid}`,
          source: 'Sayobot (MD5)',
        };
      }
    } catch {
      // Ignore network errors
    }
    return null;
  }

  async fetchByMd5Nerinyan(md5: string): Promise<BeatmapInfo | null> {
    const url = `https://api.nerinyan.moe/search?q=${md5}`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data: any = await resp.json();
      if (Array.isArray(data) && data.length > 0) {
        const item = data[0];
        return {
          beatmapSetId: item.id,
          title: item.title || 'Unknown',
          artist: item.artist || 'Unknown',
          creator: item.creator,
          downloadUrl: `https://api.nerinyan.moe/d/${item.id}`,
          source: 'Nerinyan (MD5)',
        };
      }
    } catch {
      // Ignore network errors
    }
    return null;
  }

  public parseReplayFilename(filename: string): FilenameMetadata {
    let name = path.basename(filename);
    if (name.includes(' playing ')) {
      name = name.split(' playing ')[1];
    }

    // Strip trailing timestamp e.g. (2026-07-15_16-53).osr
    name = name.replace(/\s*\(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\)\.osr$/i, '');
    name = name.replace(/\.osr$/i, '').trim();

    let diff: string | undefined;
    const diffMatch = name.match(/\[(.*?)\]$/);
    if (diffMatch) {
      diff = diffMatch[1].trim();
      name = name.slice(0, diffMatch.index).trim();
    }

    let creator: string | undefined;
    const creatorMatch = name.match(/\((.*?)\)$/);
    if (creatorMatch) {
      creator = creatorMatch[1].trim();
      name = name.slice(0, creatorMatch.index).trim();
    }

    let artist: string | undefined;
    let title = name;
    if (name.includes(' - ')) {
      const parts = name.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    return { artist, title, creator, diff };
  }

  async searchMirrorWithMetadata(meta: FilenameMetadata): Promise<BeatmapInfo | null> {
    const queries: string[] = [];
    if (meta.artist && meta.title) {
      // Clean query without (feat. ...) which often breaks exact match in search engines
      const cleanTitle = meta.title.replace(/\s*\([^)]*\)/g, '').trim();
      queries.push(`${meta.artist} ${cleanTitle}`);
      queries.push(`${meta.artist} ${meta.title}`);
    }
    if (meta.title) {
      queries.push(meta.title.replace(/\s*\([^)]*\)/g, '').trim());
      queries.push(meta.title);
    }
    if (meta.artist) {
      queries.push(meta.artist);
    }

    const creatorTarget = (meta.creator || '').toLowerCase().trim();
    const diffTarget = (meta.diff || '').toLowerCase().trim();

    for (const q of queries) {
      const cleanQ = encodeURIComponent(q);

      // 1. Try Catboy search
      try {
        const url = `https://catboy.best/api/v2/search?q=${cleanQ}`;
        const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const results: any = await resp.json();
          if (Array.isArray(results) && results.length > 0) {
            for (const item of results) {
              const c = (item.creator || (item.user && item.user.username) || '').toLowerCase().trim();
              if (!creatorTarget || c === creatorTarget) {
                return {
                  beatmapSetId: item.id,
                  title: item.title || q,
                  artist: item.artist || 'Unknown',
                  creator: item.creator,
                  downloadUrl: `https://catboy.best/d/${item.id}`,
                  source: `Catboy/Mino (${item.creator ? `Creator: ${item.creator}` : 'Search'})`,
                };
              }
            }
          }
        }
      } catch {
        // Continue
      }

      // 2. Try Sayobot search
      try {
        const url = `https://api.sayobot.cn/beatmaplist?0=20&1=0&2=4&8=2&100=${cleanQ}`;
        const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const data: any = await resp.json();
          const list = data.data || [];
          if (Array.isArray(list) && list.length > 0) {
            for (const item of list) {
              const c = (item.creator || '').toLowerCase().trim();
              if (!creatorTarget || c === creatorTarget) {
                return {
                  beatmapSetId: item.sid,
                  title: item.title || q,
                  artist: item.artist || 'Unknown',
                  creator: item.creator,
                  downloadUrl: `https://dl.sayobot.cn/beatmaps/download/full/${item.sid}`,
                  source: `Sayobot (${item.creator ? `Creator: ${item.creator}` : 'Search'})`,
                };
              }
            }
          }
        }
      } catch {
        // Continue
      }

      // 3. Try Nerinyan search
      try {
        const url = `https://api.nerinyan.moe/search?q=${cleanQ}`;
        const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const results: any = await resp.json();
          if (Array.isArray(results) && results.length > 0) {
            for (const item of results) {
              const c = (item.creator || '').toLowerCase().trim();
              if (!creatorTarget || c === creatorTarget) {
                return {
                  beatmapSetId: item.id,
                  title: item.title || q,
                  artist: item.artist || 'Unknown',
                  creator: item.creator,
                  downloadUrl: `https://api.nerinyan.moe/d/${item.id}`,
                  source: `Nerinyan (${item.creator ? `Creator: ${item.creator}` : 'Search'})`,
                };
              }
            }
          }
        }
      } catch {
        // Continue
      }
    }

    return null;
  }

  async resolveBeatmap(md5: string, filenameHint?: string): Promise<BeatmapInfo | null> {
    // 1. Try MD5 lookups across all mirrors
    const catboyInfo = await this.fetchByMd5Catboy(md5);
    if (catboyInfo) return catboyInfo;

    const sayobotInfo = await this.fetchByMd5Sayobot(md5);
    if (sayobotInfo) return sayobotInfo;

    const nerinyanInfo = await this.fetchByMd5Nerinyan(md5);
    if (nerinyanInfo) return nerinyanInfo;

    // 2. Fallback: Parse filename metadata and search
    if (filenameHint) {
      const meta = this.parseReplayFilename(filenameHint);
      console.log(`[SEARCH] Querying mirror servers for: '${meta.artist || ''} - ${meta.title || ''}' (Mapper: ${meta.creator || 'Any'})...`);
      const searchInfo = await this.searchMirrorWithMetadata(meta);
      if (searchInfo) return searchInfo;
    }

    return null;
  }

  async downloadFromMirrors(sid: number | string, targetOsz: string): Promise<boolean> {
    const candidates = BeatmapFetcher.getDownloadCandidates(sid);

    for (const mirror of candidates) {
      try {
        console.log(`[DOWNLOAD] Trying mirror: ${mirror.name} (${mirror.url})...`);
        const resp = await fetch(mirror.url, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(30000),
        });

        if (!resp.ok || !resp.body) {
          console.warn(`[WARN] Mirror ${mirror.name} returned HTTP ${resp.status}`);
          continue;
        }

        const totalBytes = Number(resp.headers.get('content-length')) || 0;
        let downloaded = 0;

        const fileStream = fs.createWriteStream(targetOsz);
        const reader = resp.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            fileStream.write(Buffer.from(value));
            downloaded += value.length;
            if (totalBytes > 0) {
              const percent = Math.floor((downloaded * 100) / totalBytes);
              process.stdout.write(`\r[PROGRESS] Downloading: ${percent}% (${Math.floor(downloaded / 1024)} KB / ${Math.floor(totalBytes / 1024)} KB)`);
            }
          }
        }

        fileStream.end();

        // Validate downloaded file is larger than 10KB (avoid HTML error pages)
        if (fs.existsSync(targetOsz) && fs.statSync(targetOsz).size > 10240) {
          console.log(`\n[SUCCESS] Downloaded successfully from ${mirror.name}!`);
          return true;
        } else {
          if (fs.existsSync(targetOsz)) fs.unlinkSync(targetOsz);
        }
      } catch (err: any) {
        console.warn(`[WARN] Mirror ${mirror.name} failed: ${err.message}`);
        if (fs.existsSync(targetOsz)) fs.unlinkSync(targetOsz);
      }
    }

    return false;
  }

  async ensureBeatmap(md5: string, filenameHint?: string): Promise<{ success: boolean; message: string }> {
    let info = await this.resolveBeatmap(md5, filenameHint);

    // If MD5 failed, try metadata search directly
    if (!info && filenameHint) {
      const meta = this.parseReplayFilename(filenameHint);
      info = await this.searchMirrorWithMetadata(meta);
    }

    if (!info) {
      return { success: false, message: `Could not resolve beatmap (MD5: ${md5}) on any mirror.` };
    }

    const sid = info.beatmapSetId;
    const title = info.title;
    const artist = info.artist;
    const targetOsz = path.join(this.songsDir, `${sid}.osz`);
    const targetExtracted = path.join(this.songsDir, String(sid));

    if (fs.existsSync(targetOsz) || fs.existsSync(targetExtracted)) {
      return { success: true, message: `Beatmap '${artist} - ${title}' (Set #${sid}) is already present.` };
    }

    console.log(`[DOWNLOAD] Fetching beatmap: ${artist} - ${title} (Set #${sid})...`);

    const downloaded = await this.downloadFromMirrors(sid, targetOsz);
    if (downloaded) {
      return { success: true, message: `Downloaded '${artist} - ${title}' (Set #${sid})` };
    }

    return { success: false, message: `Failed to download beatmap from all mirrors for Set #${sid}.` };
  }
}
