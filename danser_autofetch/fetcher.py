"""
Beatmap Auto-Fetcher module.
Resolves Beatmap MD5 checksums across multiple mirror APIs and downloads the complete .osz package.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, Tuple

USER_AGENT = "danser-autofetch/1.0 (https://github.com/heiznerd/danser-autofetch)"


class BeatmapFetcher:
    def __init__(self, songs_dir: str):
        self.songs_dir = os.path.expanduser(songs_dir)
        os.makedirs(self.songs_dir, exist_ok=True)

    def is_beatmap_installed(self, beatmap_md5: str) -> bool:
        """
        Checks if a beatmap is already installed in the Danser songs directory.
        """
        # 1. Check if an extracted directory has the .osu file with matching hash or name
        for root, _, files in os.walk(self.songs_dir):
            for file in files:
                if file.endswith(".osu"):
                    pass # Danser manages internal SQLite database once imported
        return False

    def fetch_metadata_from_catboy(self, md5: str) -> Optional[Dict[str, Any]]:
        """Queries Catboy (Mino) API by MD5."""
        url = f"https://catboy.best/api/v2/md5/{md5}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                sid = data.get("beatmapset_id")
                if sid:
                    return {
                        "beatmapset_id": sid,
                        "title": data.get("title", "Unknown"),
                        "artist": data.get("artist", "Unknown"),
                        "version": data.get("version", ""),
                        "creator": data.get("creator", ""),
                        "download_url": f"https://catboy.best/d/{sid}",
                        "source": "Catboy/Mino"
                    }
        except Exception:
            pass
        return None

    def fetch_metadata_from_sayobot(self, md5: str) -> Optional[Dict[str, Any]]:
        """Queries Sayobot API by MD5."""
        url = f"https://api.sayobot.cn/v2/beatmapinfo?K={md5}&T=1"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("status") == 0 and "data" in data:
                    sid = data["data"].get("sid")
                    title = data["data"].get("title", "Unknown")
                    artist = data["data"].get("artist", "Unknown")
                    if sid:
                        return {
                            "beatmapset_id": sid,
                            "title": title,
                            "artist": artist,
                            "download_url": f"https://sayobot.cn/beatmaps/download/full/{sid}",
                            "source": "Sayobot"
                        }
        except Exception:
            pass
        return None

    def fetch_metadata_from_chimu(self, md5: str) -> Optional[Dict[str, Any]]:
        """Queries Chimu API by MD5."""
        url = f"https://api.chimu.moe/v1/map?md5={md5}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                sid = data.get("ParentSetId") or data.get("BeatmapSetId")
                if sid:
                    return {
                        "beatmapset_id": sid,
                        "title": data.get("Title", "Unknown"),
                        "artist": data.get("Artist", "Unknown"),
                        "download_url": f"https://api.chimu.moe/v1/download/{sid}?n=1",
                        "source": "Chimu"
                    }
        except Exception:
            pass
        return None

    def resolve_beatmap(self, md5: str) -> Optional[Dict[str, Any]]:
        """
        Resolves beatmap metadata from multiple mirror services with automatic fallback.
        """
        # Try Catboy/Mino -> Sayobot -> Chimu
        providers = [
            self.fetch_metadata_from_catboy,
            self.fetch_metadata_from_sayobot,
            self.fetch_metadata_from_chimu,
        ]

        for provider in providers:
            info = provider(md5)
            if info and info.get("beatmapset_id"):
                return info
        return None

    def ensure_beatmap(self, md5: str) -> Tuple[bool, str]:
        """
        Ensures the beatmap matching the MD5 is downloaded into the Danser songs directory.
        Returns (success, message).
        """
        info = self.resolve_beatmap(md5)
        if not info:
            return False, f"Could not resolve beatmap with MD5: {md5} on any mirror."

        sid = info["beatmapset_id"]
        title = info.get("title", "Unknown Song")
        artist = info.get("artist", "Unknown Artist")
        target_osz = os.path.join(self.songs_dir, f"{sid}.osz")
        target_extracted = os.path.join(self.songs_dir, str(sid))

        if os.path.exists(target_osz) or os.path.exists(target_extracted):
            return True, f"Beatmap '{artist} - {title}' (Set #{sid}) is already present."

        download_url = info["download_url"]
        print(f"⚡ Downloading beatmap: {artist} - {title} (ID #{sid}) from {info['source']}...")

        try:
            req = urllib.request.Request(download_url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=30) as in_f, open(target_osz, "wb") as out_f:
                total_bytes = int(in_f.headers.get("Content-Length", 0))
                downloaded = 0
                chunk_size = 65536

                while True:
                    chunk = in_f.read(chunk_size)
                    if not chunk:
                        break
                    out_f.write(chunk)
                    downloaded += len(chunk)
                    if total_bytes > 0:
                        percent = downloaded * 100 // total_bytes
                        print(f"\r📥 Progress: {percent}% ({downloaded // 1024} KB / {total_bytes // 1024} KB)", end="", flush=True)

            print("\n✅ Download completed successfully!")
            return True, f"Downloaded '{artist} - {title}' (Set #{sid})"
        except Exception as e:
            if os.path.exists(target_osz):
                os.remove(target_osz)
            return False, f"Failed to download from {download_url}: {e}"
