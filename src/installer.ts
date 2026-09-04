/**
 * Auto-Installer & Bootstrapper for Danser-go.
 * Automatically detects OS, downloads the latest Danser-go release, unpacks it,
 * and sets up executable permissions without requiring manual intervention.
 */

import * as fs from 'fs';
import * as path from 'path';
import { finished } from 'stream/promises';
import AdmZip from 'adm-zip';
import { printStatus, renderProgress, finishProgress, ProgressCallback } from './ui';

const USER_AGENT = 'danser-autofetch/1.4.1 (https://github.com/heiznerd/danser-autofetch)';
const GITHUB_API_URL = 'https://api.github.com/repos/Wieku/danser-go/releases/latest';

export interface DanserReleaseAsset {
  name: string;
  downloadUrl: string;
  size: number;
}

export class DanserInstaller {
  static getPlatformKeyword(): 'win' | 'linux' | 'mac' {
    if (process.platform === 'win32') return 'win';
    if (process.platform === 'darwin') return 'mac';
    return 'linux';
  }

  static getDefaultInstallDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || '';
    if (process.platform === 'win32') {
      const localAppData = process.env.LOCALAPPDATA;
      if (localAppData) {
        return path.join(localAppData, 'Programs', 'danser');
      }
      return path.join(home, 'Applications', 'danser');
    }
    return path.join(home, 'Applications', 'danser');
  }

  static isDanserInstalled(dir: string): boolean {
    if (!fs.existsSync(dir)) return false;
    const isWindows = process.platform === 'win32';
    const binaries = isWindows ? ['danser-cli.exe', 'danser.exe'] : ['danser-cli', 'danser'];

    for (const b of binaries) {
      if (fs.existsSync(path.join(dir, b))) {
        return true;
      }
    }
    return false;
  }

  static async resolveDownloadUrl(): Promise<DanserReleaseAsset> {
    const osKey = this.getPlatformKeyword();

    try {
      const resp = await fetch(GITHUB_API_URL, { headers: { 'User-Agent': USER_AGENT } });
      if (resp.ok) {
        const data: any = await resp.json();
        const assets = data.assets || [];
        for (const asset of assets) {
          const name: string = asset.name.toLowerCase();
          if (name.includes(osKey) && name.endsWith('.zip')) {
            return {
              name: asset.name,
              downloadUrl: asset.browser_download_url,
              size: asset.size || 0,
            };
          }
        }
      }
    } catch {
      // Fallback below
    }

    // Default Fallback to 0.11.0 stable release
    const defaultTag = '0.11.0';
    const fallbackFilename = `danser-${defaultTag}-${osKey}.zip`;
    const fallbackUrl = `https://github.com/Wieku/danser-go/releases/download/${defaultTag}/${fallbackFilename}`;

    return {
      name: fallbackFilename,
      downloadUrl: fallbackUrl,
      size: 0,
    };
  }

  static async ensureInstalled(targetDir?: string, onProgress?: ProgressCallback): Promise<string> {
    const installDir = targetDir
      ? path.resolve(targetDir.replace(/^~(?=$|\/|\\)/, process.env.HOME || process.env.USERPROFILE || ''))
      : this.getDefaultInstallDir();

    if (this.isDanserInstalled(installDir)) {
      // Ensure essential subdirectories and configuration exist
      const songsDir = path.join(installDir, 'Songs');
      const skinsDir = path.join(installDir, 'Skins');
      const replaysDir = path.join(installDir, 'Replays');
      fs.mkdirSync(songsDir, { recursive: true });
      fs.mkdirSync(skinsDir, { recursive: true });
      fs.mkdirSync(replaysDir, { recursive: true });
      return installDir;
    }

    if (onProgress) {
      onProgress({ processName: 'setup', percent: 0, log: 'checking danser-go release on github...' });
    } else {
      printStatus('setup', `danser-go not found. starting first-boot auto-installation for [${process.platform}]...`);
      printStatus('setup', `install directory: ${installDir.toLowerCase()}`);
    }

    const asset = await this.resolveDownloadUrl();
    const tempZip = path.join(path.dirname(installDir), `_temp_${asset.name}`);

    if (fs.existsSync(tempZip)) {
      try {
        fs.unlinkSync(tempZip);
      } catch {}
    }

    if (!fs.existsSync(path.dirname(installDir))) {
      fs.mkdirSync(path.dirname(installDir), { recursive: true });
    }

    if (onProgress) {
      onProgress({ processName: 'download', percent: 0, log: `fetching ${asset.name.toLowerCase()}...` });
    } else {
      printStatus('download', `fetching ${asset.name.toLowerCase()} from github...`);
    }

    try {
      const resp = await fetch(asset.downloadUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!resp.ok || !resp.body) {
        throw new Error(`failed to download danser (http ${resp.status}): ${resp.statusText}`);
      }

      const totalBytes = Number(resp.headers.get('content-length')) || asset.size;
      let downloaded = 0;

      const fileStream = fs.createWriteStream(tempZip);
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
                processName: 'download',
                percent,
                detail: `${downMb} / ${totMb} mb`,
                log: `downloading ${asset.name.toLowerCase()}...`,
              });
            } else {
              renderProgress('download', downloaded, totalBytes, 'mb');
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

      if (!fs.existsSync(tempZip) || fs.statSync(tempZip).size < 10240) {
        throw new Error('downloaded danser archive is empty or incomplete');
      }

      if (onProgress) {
        onProgress({ processName: 'setup', percent: 100, detail: 'unpacking', log: 'extracting and configuring danser-go...' });
      } else {
        printStatus('setup', 'extracting and configuring danser-go...');
      }

      if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
      }

      const zip = new AdmZip(tempZip);
      zip.extractAllTo(installDir, true);

      // Clean up temporary zip
      if (fs.existsSync(tempZip)) {
        try {
          fs.unlinkSync(tempZip);
        } catch {}
      }

      // Make binaries executable on POSIX systems
      if (process.platform !== 'win32') {
        const filesToChmod = ['danser', 'danser-cli', path.join('ffmpeg', 'ffmpeg')];
        for (const f of filesToChmod) {
          const fullP = path.join(installDir, f);
          if (fs.existsSync(fullP)) {
            try {
              fs.chmodSync(fullP, 0o755);
            } catch {
              // Ignore chmod errors
            }
          }
        }
      }

      // Initialize default subdirectories
      const songsDir = path.join(installDir, 'Songs');
      const skinsDir = path.join(installDir, 'Skins');
      const replaysDir = path.join(installDir, 'Replays');
      const settingsDir = path.join(installDir, 'settings');
      const videosDir = path.join(installDir, 'videos');

      fs.mkdirSync(songsDir, { recursive: true });
      fs.mkdirSync(skinsDir, { recursive: true });
      fs.mkdirSync(replaysDir, { recursive: true });
      fs.mkdirSync(settingsDir, { recursive: true });
      fs.mkdirSync(videosDir, { recursive: true });

      // Pre-seed default.json so Danser never attempts to query osu! stable AppData\Local\osu!\Songs
      const defaultSettingsFile = path.join(settingsDir, 'default.json');
      if (!fs.existsSync(defaultSettingsFile)) {
        fs.writeFileSync(
          defaultSettingsFile,
          JSON.stringify(
            {
              General: {
                OsuSongsDir: songsDir,
                OsuSkinsDir: skinsDir,
                OsuReplaysDir: replaysDir,
                DiscordPresenceOn: true,
                UnpackOszFiles: true,
                VerboseImportLogs: false,
              },
              Audio: {
                IgnoreBeatmapSamples: true,
              },
              Skin: {
                UseColorsFromSkin: true,
                Cursor: {
                  UseSkinCursor: true,
                },
              },
              Gameplay: {
                PPVersion: 'latest',
                LeadInTime: 0,
                LeadInHold: 0,
                SeizureWarning: {
                  Enabled: false,
                },
                PPCounter: {
                  Show: true,
                  ShowPPComponents: true,
                },
              },
              Recording: {
                OutputDir: videosDir,
              },
            },
            null,
            4
          ),
          'utf-8'
        );
      }

      if (onProgress) {
        onProgress({ processName: 'setup', percent: 100, detail: 'completed', log: 'danser-go successfully installed' });
      } else {
        printStatus('danser', `danser-go successfully installed to: ${installDir.toLowerCase()}`, 'success');
      }
      return installDir;
    } catch (err: any) {
      if (fs.existsSync(tempZip)) {
        try {
          fs.unlinkSync(tempZip);
        } catch {}
      }
      throw new Error(`Auto-installation failed: ${err.message}`);
    }
  }
}
