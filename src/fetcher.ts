/**
 * Beatmap Auto-Fetcher in TypeScript.
 * Resolves Beatmap MD5 checksums and fallback text queries across multiple mirror APIs:
 * Catboy/Mino, Sayobot, osu.direct, Nerinyan.
 */

import * as fs from 'fs';
import * as path from 'path';
import { finished } from 'stream/promises';
import { BeatmapInfo, FilenameMetadata } from './types';
import { printStatus, renderProgress, finishProgress, ProgressCallback } from './ui';
import { PPCalculator } from './calculator';

const USER_AGENT = 'danshi/1.5.0 (https://github.com/nekoo-moe/danshi)';

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

  async fetchByMd5OsuDirect(md5: string): Promise<BeatmapInfo | null> {
    const url = `https://osu.direct/api/v2/md5/${md5}`;
    try {
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return null;
      const data: any = await resp.json();
      const sid = data.beatmapset_id;
      if (sid) {
        let title = 'Unknown';
        let artist = 'Unknown';
        let creator = data.creator;
        try {
          const sResp = await fetch(`https://osu.direct/api/s/${sid}`, {
            headers: { 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(3000),
          });
          if (sResp.ok) {
            const sData: any = await sResp.json();
            title = sData.Title || title;
            artist = sData.Artist || artist;
            creator = sData.Creator || creator;
          }
        } catch {}

        return {
          beatmapSetId: sid,
          title,
          artist,
          version: data.version,
          creator,
          downloadUrl: `https://catboy.best/d/${sid}`,
          source: 'osu.direct (MD5)',
        };
      }
    } catch {
      // Ignore network errors
    }
    return null;
  }

  async fetchByBeatmapId(bid: number): Promise<BeatmapInfo | null> {
    // 1. Try osu.direct /api/b/
    try {
      const url = `https://osu.direct/api/b/${bid}`;
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data: any = await resp.json();
        const sid = data.ParentSetID;
        if (sid) {
          let title = 'Unknown';
          let artist = 'Unknown';
          let creator: string | undefined;
          try {
            const sResp = await fetch(`https://osu.direct/api/s/${sid}`, {
              headers: { 'User-Agent': USER_AGENT },
              signal: AbortSignal.timeout(3000),
            });
            if (sResp.ok) {
              const sData: any = await sResp.json();
              title = sData.Title || title;
              artist = sData.Artist || artist;
              creator = sData.Creator;
            }
          } catch {}
          return {
            beatmapSetId: sid,
            title,
            artist,
            version: data.DiffName,
            creator,
            downloadUrl: `https://catboy.best/d/${sid}`,
            source: `osu.direct (Beatmap #${bid})`,
          };
        }
      }
    } catch {}

    // 2. Try Catboy /api/v2/b/
    try {
      const url = `https://catboy.best/api/v2/b/${bid}`;
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data: any = await resp.json();
        const sid = data.beatmapset_id;
        if (sid) {
          let title = (data.set && (data.set.title || data.set.title_unicode)) || 'Unknown';
          let artist = (data.set && (data.set.artist || data.set.artist_unicode)) || 'Unknown';
          let creator = (data.owners && data.owners[0] && data.owners[0].username) || (data.set && data.set.creator);
          if (title === 'Unknown') {
            try {
              const sResp = await fetch(`https://catboy.best/api/v2/s/${sid}`, {
                headers: { 'User-Agent': USER_AGENT },
                signal: AbortSignal.timeout(3000),
              });
              if (sResp.ok) {
                const sData: any = await sResp.json();
                title = sData.title || title;
                artist = sData.artist || artist;
                creator = creator || sData.creator;
              }
            } catch {}
          }
          return {
            beatmapSetId: sid,
            title,
            artist,
            version: data.version,
            creator,
            downloadUrl: `https://catboy.best/d/${sid}`,
            source: `Catboy (Beatmap #${bid})`,
          };
        }
      }
    } catch {}

    // 3. Try Sayobot T=0
    try {
      const url = `https://api.sayobot.cn/v2/beatmapinfo?K=${bid}&T=0`;
      const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data: any = await resp.json();
        if (data.status === 0 && data.data && data.data.sid) {
          return {
            beatmapSetId: data.data.sid,
            title: data.data.title || 'Unknown',
            artist: data.data.artist || 'Unknown',
            creator: data.data.creator,
            downloadUrl: `https://dl.sayobot.cn/beatmaps/download/full/${data.data.sid}`,
            source: `Sayobot (Beatmap #${bid})`,
          };
        }
      }
    } catch {}

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

    // 1. Check for osu! lazer exported replay pattern: (solo-)?replay-osu_{beatmapId}_{scoreId}.osr or osu_{beatmapId}_{scoreId}.osr
    let beatmapId: number | undefined;
    const lazerIdMatch = name.match(/^(?:solo-)?replay-osu_(\d+)_/i) || name.match(/^osu_(\d+)_/i) || name.match(/^(\d+)_\d+\.osr$/i);
    if (lazerIdMatch) {
      beatmapId = parseInt(lazerIdMatch[1], 10);
      return { beatmapId };
    }

    // 2. Strip trailing timestamp e.g. (2026-09-01_10-29).osr
    name = name.replace(/\s*\(\d{4}-\d{2}-\d{2}(?:_\d{2}-\d{2}(?:-\d{2})?)?\)\.osr$/i, '');
    name = name.replace(/\.osr$/i, '').trim();

    // If name matches the pure lazer pattern without metadata, avoid using it as search title
    if (/^(?:solo-)?replay-osu_\d+/i.test(name) || /^osu_\d+/i.test(name)) {
      return { beatmapId };
    }

    // 3. Extract difficulty from trailing brackets [DiffName]
    let diff: string | undefined;
    const diffMatch = name.match(/\[([^\[\]]*)\]$/);
    if (diffMatch) {
      diff = diffMatch[1].trim();
      name = name.slice(0, diffMatch.index).trim();
    }

    // 4. Extract mapper from trailing parentheses (Mapper)
    let creator: string | undefined;
    const creatorMatch = name.match(/\(([^()]*)\)$/);
    if (creatorMatch) {
      creator = creatorMatch[1].trim();
      name = name.slice(0, creatorMatch.index).trim();
    }

    // 5. Strip '{player} playing ' prefix from in-game lazer exports
    if (name.includes(' playing ')) {
      name = name.split(' playing ').slice(1).join(' playing ').trim();
    }

    // 6. Split Artist and Title
    let artist: string | undefined;
    let title: string | undefined = name;
    if (name.includes(' - ')) {
      const parts = name.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    }

    return { artist, title, creator, diff, beatmapId };
  }

  async searchMirrorWithMetadata(meta: FilenameMetadata): Promise<BeatmapInfo | null> {
    const queries: string[] = [];
    const cleanTitle = (meta.title || '').replace(/\s*\([^)]*\)/g, '').trim();

    // Build intelligent prioritized query strings
    if (meta.creator && cleanTitle) {
      queries.push(`${meta.creator} ${cleanTitle}`);
    }
    if (meta.creator && meta.artist && cleanTitle) {
      queries.push(`${meta.creator} ${meta.artist} ${cleanTitle}`);
    }
    if (meta.artist && cleanTitle) {
      queries.push(`${meta.artist} ${cleanTitle}`);
      queries.push(`${meta.artist} ${meta.title}`);
    }
    if (cleanTitle) {
      queries.push(cleanTitle);
    }
    if (meta.title && meta.title !== cleanTitle) {
      queries.push(meta.title);
    }
    if (meta.creator) {
      queries.push(meta.creator);
    }

    const creatorTarget = (meta.creator || '').toLowerCase().trim();
    const diffTarget = (meta.diff || '').toLowerCase().trim();

    for (const q of queries) {
      const cleanQ = encodeURIComponent(q);

      // 1. Try osu.direct search
      try {
        const url = `https://osu.direct/api/search?q=${cleanQ}`;
        const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const results: any = await resp.json();
          if (Array.isArray(results) && results.length > 0) {
            for (const item of results) {
              const c = (item.Creator || '').toLowerCase().trim();
              if (!creatorTarget || c === creatorTarget) {
                let matchedBid: number | undefined;
                if (Array.isArray(item.ChildrenBeatmaps) && diffTarget) {
                  const matched = item.ChildrenBeatmaps.find((b: any) =>
                    b.DiffName && b.DiffName.toLowerCase().trim() === diffTarget
                  );
                  if (matched && matched.BeatmapID) {
                    matchedBid = matched.BeatmapID;
                    meta.beatmapId = matchedBid;
                  }
                }
                return {
                  beatmapSetId: item.SetID,
                  beatmapId: matchedBid || meta.beatmapId,
                  title: item.Title || q,
                  artist: item.Artist || 'Unknown',
                  creator: item.Creator,
                  downloadUrl: `https://catboy.best/d/${item.SetID}`,
                  source: `osu.direct (${item.Creator ? `Creator: ${item.Creator}` : 'Search'})`,
                };
              }
            }
          }
        }
      } catch {
        // Continue
      }

      // 2. Try Catboy search
      try {
        const url = `https://catboy.best/api/v2/search?q=${cleanQ}`;
        const resp = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) });
        if (resp.ok) {
          const results: any = await resp.json();
          if (Array.isArray(results) && results.length > 0) {
            for (const item of results) {
              const c = (item.creator || (item.user && item.user.username) || '').toLowerCase().trim();
              if (!creatorTarget || c === creatorTarget) {
                if (Array.isArray(item.beatmaps) && diffTarget) {
                  const matchedDiff = item.beatmaps.find((b: any) => b.version && b.version.toLowerCase().trim() === diffTarget);
                  if (matchedDiff && matchedDiff.id) {
                    meta.beatmapId = matchedDiff.id;
                  }
                }
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

      // 3. Try Sayobot search
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

      // 4. Try Nerinyan search
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

  async resolveBeatmap(
    md5: string,
    filenameHint?: string,
    onProgress?: ProgressCallback
  ): Promise<BeatmapInfo | null> {
    // 1. Try MD5 lookups across all mirrors
    if (onProgress) {
      onProgress({ processName: 'fetch', percent: 0, log: 'querying catboy/mino mirror (md5)...' });
    }
    const catboyInfo = await this.fetchByMd5Catboy(md5);
    if (catboyInfo) return catboyInfo;

    if (onProgress) {
      onProgress({ processName: 'fetch', percent: 0, log: 'querying osu.direct mirror (md5)...' });
    }
    const osuDirectInfo = await this.fetchByMd5OsuDirect(md5);
    if (osuDirectInfo) return osuDirectInfo;

    if (onProgress) {
      onProgress({ processName: 'fetch', percent: 0, log: 'querying sayobot mirror (md5)...' });
    }
    const sayobotInfo = await this.fetchByMd5Sayobot(md5);
    if (sayobotInfo) return sayobotInfo;

    if (onProgress) {
      onProgress({ processName: 'fetch', percent: 0, log: 'querying nerinyan mirror (md5)...' });
    }
    const nerinyanInfo = await this.fetchByMd5Nerinyan(md5);
    if (nerinyanInfo) return nerinyanInfo;

    // 2. Try Beatmap ID if extracted from replay filename (osu! lazer format)
    if (filenameHint) {
      const meta = this.parseReplayFilename(filenameHint);
      if (meta.beatmapId) {
        if (onProgress) {
          onProgress({ processName: 'fetch', percent: 0, log: `querying lazer beatmap id #${meta.beatmapId}...` });
        } else {
          printStatus('lookup', `detected osu! lazer beatmap id #${meta.beatmapId} from filename`);
        }
        const bidInfo = await this.fetchByBeatmapId(meta.beatmapId);
        if (bidInfo) return bidInfo;
      }

      // 3. Fallback: Search mirrors by artist / song title
      if (meta.title && meta.title.length > 2) {
        const queryDesc = `'${(meta.artist || '').toLowerCase()} - ${(meta.title || '').toLowerCase()}'`;
        if (onProgress) {
          onProgress({ processName: 'fetch', percent: 0, log: `searching mirrors for ${queryDesc}...` });
        } else {
          printStatus('search', `querying mirror servers for: ${queryDesc}`);
        }
        const searchInfo = await this.searchMirrorWithMetadata(meta);
        if (searchInfo) return searchInfo;
      }
    }

    return null;
  }

  async downloadFromMirrors(
    sid: number | string,
    targetOsz: string,
    onProgress?: ProgressCallback
  ): Promise<boolean> {
    const candidates = BeatmapFetcher.getDownloadCandidates(sid);

    for (const mirror of candidates) {
      try {
        if (onProgress) {
          onProgress({ processName: 'mirror', percent: 0, log: `connecting to ${mirror.name.toLowerCase()}...` });
        } else {
          printStatus('mirror', `connecting to ${mirror.name.toLowerCase()}...`);
        }

        const resp = await fetch(mirror.url, {
          headers: { 'User-Agent': USER_AGENT },
          signal: AbortSignal.timeout(30000),
        });

        if (!resp.ok || !resp.body) {
          if (onProgress) {
            onProgress({ processName: 'mirror', log: `${mirror.name.toLowerCase()} returned http ${resp.status}` });
          } else {
            printStatus('mirror', `${mirror.name.toLowerCase()} returned http ${resp.status}`, 'warning');
          }
          continue;
        }

        const totalBytes = Number(resp.headers.get('content-length')) || 0;
        let downloaded = 0;

        const tempOsz = `${targetOsz}.download`;
        if (fs.existsSync(tempOsz)) {
          try {
            fs.unlinkSync(tempOsz);
          } catch {}
        }

        const fileStream = fs.createWriteStream(tempOsz);
        const reader = resp.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            fileStream.write(Buffer.from(value));
            downloaded += value.length;
            if (totalBytes > 0) {
              const percent = (downloaded * 100) / totalBytes;
              const downMb = (downloaded / (1024 * 1024)).toFixed(1);
              const totMb = (totalBytes / (1024 * 1024)).toFixed(1);
              if (onProgress) {
                onProgress({
                  processName: 'mirror',
                  percent,
                  detail: `${downMb} / ${totMb} mb`,
                  log: `downloading set #${sid} from ${mirror.name.toLowerCase()}...`,
                });
              } else {
                renderProgress('download', downloaded, totalBytes, 'kb');
              }
            }
          }
        }

        fileStream.end();
        await finished(fileStream);
        if (!onProgress) finishProgress();

        if (totalBytes > 0 && downloaded < totalBytes) {
          throw new Error(`download interrupted: received ${downloaded} of ${totalBytes} bytes`);
        }

        // Validate downloaded file is larger than 10KB (avoid HTML error pages)
        if (fs.existsSync(tempOsz) && fs.statSync(tempOsz).size > 10240) {
          if (fs.existsSync(targetOsz)) {
            try {
              fs.unlinkSync(targetOsz);
            } catch {}
          }
          fs.renameSync(tempOsz, targetOsz);

          if (onProgress) {
            onProgress({
              processName: 'mirror',
              percent: 100,
              detail: 'downloaded',
              log: `downloaded set #${sid} from ${mirror.name.toLowerCase()}`,
            });
          } else {
            printStatus('mirror', `downloaded set #${sid} from ${mirror.name.toLowerCase()}`, 'success');
          }
          return true;
        } else {
          if (fs.existsSync(tempOsz)) {
            try {
              fs.unlinkSync(tempOsz);
            } catch {}
          }
        }
      } catch (err: any) {
        const tempOsz = `${targetOsz}.download`;
        if (fs.existsSync(tempOsz)) {
          try {
            fs.unlinkSync(tempOsz);
          } catch {}
        }
        if (onProgress) {
          onProgress({ processName: 'mirror', log: `${mirror.name.toLowerCase()} failed: ${err.message.toLowerCase()}` });
        } else {
          printStatus('mirror', `${mirror.name.toLowerCase()} failed: ${err.message.toLowerCase()}`, 'warning');
        }
        if (fs.existsSync(targetOsz)) {
          try {
            fs.unlinkSync(targetOsz);
          } catch {}
        }
      }
    }

    return false;
  }

  async ensureBeatmap(
    md5: string,
    filenameHint?: string,
    onProgress?: ProgressCallback
  ): Promise<{ success: boolean; message: string }> {
    // 0. Quick local cache check before querying mirrors
    const existingOsu = PPCalculator.findOsuFileInSongs(this.songsDir, md5);
    if (existingOsu) {
      return { success: true, message: 'beatmap is already present in songs folder.' };
    }

    const info = await this.resolveBeatmap(md5, filenameHint, onProgress);

    if (!info) {
      return { success: false, message: `could not resolve beatmap (md5: ${md5.toLowerCase()}) on any mirror.` };
    }

    const sid = info.beatmapSetId;
    const title = info.title;
    const artist = info.artist;
    const targetOsz = path.join(this.songsDir, `${sid}.osz`);
    const targetExtracted = path.join(this.songsDir, String(sid));

    if (fs.existsSync(targetOsz) || fs.existsSync(targetExtracted)) {
      return { success: true, message: `beatmap '${artist.toLowerCase()} - ${title.toLowerCase()}' (set #${sid}) is already present.` };
    }

    if (onProgress) {
      onProgress({
        processName: 'fetch',
        percent: 0,
        log: `fetching beatmap: ${artist.toLowerCase()} - ${title.toLowerCase()} (set #${sid})...`,
      });
    } else {
      printStatus('fetch', `fetching beatmap: ${artist.toLowerCase()} - ${title.toLowerCase()} (set #${sid})...`);
    }

    const downloaded = await this.downloadFromMirrors(sid, targetOsz, onProgress);
    if (downloaded) {
      return { success: true, message: `downloaded '${artist.toLowerCase()} - ${title.toLowerCase()}' (set #${sid})` };
    }

    return { success: false, message: `failed to download beatmap from all mirrors for set #${sid}.` };
  }
}
