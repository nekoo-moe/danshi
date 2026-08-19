/**
 * Auto-Installer & Bootstrapper for Danser-go.
 * Automatically detects OS, downloads the latest Danser-go release, unpacks it,
 * and sets up executable permissions without requiring manual intervention.
 */

import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

const USER_AGENT = 'danser-autofetch/1.3.0 (https://github.com/heiznerd/danser-autofetch)';
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

  static async ensureInstalled(targetDir?: string): Promise<string> {
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

    console.log(`\n[SETUP] Danser-go was not found on this machine.`);
    console.log(`[SETUP] Performing first-boot auto-installation for [${process.platform}]...`);
    console.log(`[SETUP] Target directory: ${installDir}`);

    const asset = await this.resolveDownloadUrl();
    const tempZip = path.join(path.dirname(installDir), `_temp_${asset.name}`);

    if (!fs.existsSync(path.dirname(installDir))) {
      fs.mkdirSync(path.dirname(installDir), { recursive: true });
    }

    console.log(`[DOWNLOAD] Fetching ${asset.name} from GitHub...`);

    try {
      const resp = await fetch(asset.downloadUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!resp.ok || !resp.body) {
        throw new Error(`Failed to download Danser (HTTP ${resp.status}): ${resp.statusText}`);
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
            const percent = Math.floor((downloaded * 100) / totalBytes);
            process.stdout.write(`\r[PROGRESS] Downloading Danser: ${percent}% (${Math.floor(downloaded / (1024 * 1024))} MB / ${Math.floor(totalBytes / (1024 * 1024))} MB)`);
          }
        }
      }

      fileStream.end();
      console.log('\n[SETUP] Extracting and configuring Danser-go...');

      if (!fs.existsSync(installDir)) {
        fs.mkdirSync(installDir, { recursive: true });
      }

      const zip = new AdmZip(tempZip);
      zip.extractAllTo(installDir, true);

      // Clean up temporary zip
      if (fs.existsSync(tempZip)) {
        fs.unlinkSync(tempZip);
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
            },
            null,
            4
          ),
          'utf-8'
        );
      }

      console.log(`[SUCCESS] Danser-go has been successfully installed to: ${installDir}\n`);
      return installDir;
    } catch (err: any) {
      if (fs.existsSync(tempZip)) {
        fs.unlinkSync(tempZip);
      }
      throw new Error(`Auto-installation failed: ${err.message}`);
    }
  }
}
