/**
 * Skin Manager in TypeScript.
 * Handles on-demand skin importing from local .osk / .zip / folder paths, URLs, and fuzzy name matching.
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { printStatus } from './ui';

export class SkinManager {
  private skinsDir: string;
  private osuExportsDir?: string;

  constructor(skinsDir: string, osuExportsDir?: string) {
    this.skinsDir = path.resolve(skinsDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
    if (!fs.existsSync(this.skinsDir)) {
      fs.mkdirSync(this.skinsDir, { recursive: true });
    }
    if (osuExportsDir) {
      this.osuExportsDir = path.resolve(osuExportsDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
    }
  }

  async importSkin(sourcePathOrUrl: string): Promise<string | null> {
    let rawPath = sourcePathOrUrl.trim().replace(/^["']|["']$/g, '');

    // 1. Direct URL download
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) {
      printStatus('skin', `fetching skin from url: ${rawPath.toLowerCase()}...`);
      const tempOsk = path.join(this.skinsDir, '_temp_import.osk');
      try {
        const resp = await fetch(rawPath, { headers: { 'User-Agent': 'danser-autofetch' } });
        if (!resp.ok) throw new Error(`http error ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();
        fs.writeFileSync(tempOsk, Buffer.from(arrayBuffer));
        rawPath = tempOsk;
      } catch (e: any) {
        printStatus('skin', `failed to download skin from url: ${e.message.toLowerCase()}`, 'error');
        return null;
      }
    }

    const cleanPath = path.resolve(rawPath.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
    if (!fs.existsSync(cleanPath)) {
      return null;
    }

    const stat = fs.statSync(cleanPath);

    // 2. Local folder import
    if (stat.isDirectory()) {
      const skinName = path.basename(cleanPath);
      const dst = path.join(this.skinsDir, skinName);
      if (path.resolve(cleanPath) !== path.resolve(dst)) {
        if (fs.existsSync(dst)) {
          fs.rmSync(dst, { recursive: true, force: true });
        }
        fs.cpSync(cleanPath, dst, { recursive: true });
      }
      printStatus('skin', `imported skin folder: '${skinName.toLowerCase()}'`, 'success');
      return skinName;
    }

    // 3. Compressed skin archive (.osk / .zip)
    const lower = cleanPath.toLowerCase();
    if (lower.endsWith('.osk') || lower.endsWith('.zip')) {
      let rawName = path.basename(cleanPath).replace(/\.[^/.]+$/, '');
      if (rawName === '_temp_import') {
        rawName = 'imported_skin';
      }
      // Remove duplicate markers like (1), (2)
      if (rawName.includes(' (') && rawName.endsWith(')')) {
        rawName = rawName.replace(/\s*\(\d+\)$/, '').trim();
      }

      const dst = path.join(this.skinsDir, rawName);
      if (!fs.existsSync(dst)) {
        fs.mkdirSync(dst, { recursive: true });
      }

      try {
        const zip = new AdmZip(cleanPath);
        zip.extractAllTo(dst, true);
        printStatus('skin', `unpacked and installed skin: '${rawName.toLowerCase()}'`, 'success');
        if (cleanPath.endsWith('_temp_import.osk') && fs.existsSync(cleanPath)) {
          fs.unlinkSync(cleanPath);
        }
        return rawName;
      } catch (e: any) {
        printStatus('skin', `failed to unpack skin archive: ${e.message.toLowerCase()}`, 'error');
        return null;
      }
    }

    return null;
  }

  async syncFromSources(): Promise<number> {
    const scanDirs: string[] = [];
    if (this.osuExportsDir && fs.existsSync(this.osuExportsDir)) {
      scanDirs.push(this.osuExportsDir);
    }

    const downloadsDir = path.resolve((process.env.HOME || process.env.USERPROFILE || ''), 'Downloads');
    if (fs.existsSync(downloadsDir)) {
      scanDirs.push(downloadsDir);
    }

    let count = 0;
    for (const sDir of scanDirs) {
      const items = fs.readdirSync(sDir);
      for (const item of items) {
        const src = path.join(sDir, item);
        const lower = item.toLowerCase();
        if ((lower.endsWith('.osk') || lower.endsWith('.zip')) && !item.startsWith('.')) {
          let skinName = item.replace(/\.[^/.]+$/, '');
          if (skinName.includes(' (') && skinName.endsWith(')')) {
            skinName = skinName.replace(/\s*\(\d+\)$/, '').trim();
          }
          const dst = path.join(this.skinsDir, skinName);
          if (!fs.existsSync(dst)) {
            const imported = await this.importSkin(src);
            if (imported) count += 1;
          }
        } else if (fs.statSync(src).isDirectory() && sDir === this.osuExportsDir) {
          const dst = path.join(this.skinsDir, item);
          if (!fs.existsSync(dst)) {
            fs.cpSync(src, dst, { recursive: true });
            count += 1;
          }
        }
      }
    }
    return count;
  }

  listSkins(): string[] {
    if (!fs.existsSync(this.skinsDir)) {
      return [];
    }
    return fs.readdirSync(this.skinsDir).filter((d) => {
      const p = path.join(this.skinsDir, d);
      return fs.statSync(p).isDirectory();
    });
  }

  async matchSkin(query: string): Promise<string | null> {
    const cleanQuery = query.trim().replace(/^["']|["']$/g, '');

    // 1. Direct path check (as passed)
    const resolvedPath = path.resolve(cleanQuery.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''));
    if (cleanQuery.startsWith('http://') || cleanQuery.startsWith('https://') || fs.existsSync(resolvedPath)) {
      const imported = await this.importSkin(cleanQuery);
      if (imported) return imported;
    }

    // 2. Check standard user directories if cleanQuery was passed as a filename
    const home = process.env.HOME || process.env.USERPROFILE || '';
    const candidateDirs = [
      path.join(home, 'Documents'),
      path.join(home, 'Downloads'),
      path.join(home, 'Desktop'),
    ];
    if (this.osuExportsDir) {
      candidateDirs.unshift(this.osuExportsDir);
    }
    for (const cDir of candidateDirs) {
      const candidateFile = path.join(cDir, cleanQuery);
      if (fs.existsSync(candidateFile)) {
        const imported = await this.importSkin(candidateFile);
        if (imported) return imported;
      }
    }

    // 3. Search already installed skins
    const available = this.listSkins();
    if (available.length === 0) return null;

    // Strip .osk / .zip extensions for name matching
    const queryBase = cleanQuery.replace(/\.(osk|zip)$/i, '').trim();

    // 3.1 Exact match
    for (const s of available) {
      if (s.toLowerCase() === queryBase.toLowerCase() || s.toLowerCase() === cleanQuery.toLowerCase()) {
        return s;
      }
    }

    // 3.2 Starts with
    for (const s of available) {
      if (s.toLowerCase().startsWith(queryBase.toLowerCase())) {
        return s;
      }
    }

    // 3.3 Substring match
    for (const s of available) {
      if (s.toLowerCase().includes(queryBase.toLowerCase())) {
        return s;
      }
    }

    // 3.4 Reverse substring match
    for (const s of available) {
      if (queryBase.toLowerCase().includes(s.toLowerCase())) {
        return s;
      }
    }

    return null;
  }
}
