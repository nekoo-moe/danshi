"""
Beatmap Auto-Fetcher module.
Resolves Beatmap MD5 checksums and fallback text queries across multiple mirror APIs.
Includes creator/difficulty-aware matching to pinpoint the exact beatmap set.
"""

import os
import re
import json
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, Dict, Any, Tuple

USER_AGENT = "danser-autofetch/1.0 (https://github.com/heiznerd/danser-autofetch)"


class BeatmapFetcher:
    def __init__(self, songs_dir: str):
        self.songs_dir = os.path.expanduser(songs_dir)
        os.makedirs(self.songs_dir, exist_ok=True)

    def fetch_by_md5_catboy(self, md5: str) -> Optional[Dict[str, Any]]:
        """Queries Catboy (Mino) API by MD5."""
        url = f"https://catboy.best/api/v2/md5/{md5}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                sid = data.get("beatmapset_id")
                if sid:
                    return {
                        "beatmapset_id": sid,
                        "title": data.get("title", "Unknown"),
                        "artist": data.get("artist", "Unknown"),
                        "download_url": f"https://catboy.best/d/{sid}",
                        "source": "Catboy/Mino (MD5)"
                    }
        except Exception:
            pass
        return None

    def fetch_by_md5_sayobot(self, md5: str) -> Optional[Dict[str, Any]]:
        """Queries Sayobot API by MD5."""
        url = f"https://api.sayobot.cn/v2/beatmapinfo?K={md5}&T=1"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=6) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("status") == 0 and "data" in data:
                    sid = data["data"].get("sid")
                    if sid:
                        return {
                            "beatmapset_id": sid,
                            "title": data["data"].get("title", "Unknown"),
                            "artist": data["data"].get("artist", "Unknown"),
                            "download_url": f"https://sayobot.cn/beatmaps/download/full/{sid}",
                            "source": "Sayobot (MD5)"
                        }
        except Exception:
            pass
        return None

    @staticmethod
    def parse_replay_filename(filename: str) -> Dict[str, Optional[str]]:
        """
        Parses metadata out of standard osu! replay filenames:
        'heiznerd playing ShortStumpyEngine - Thick of HiT (S8-10 Opening Mashup) (Basensorex) [riot\'s insane] (2026-07-15_16-53).osr'
        Returns: { 'artist': ..., 'title': ..., 'creator': 'Basensorex', 'diff': 'riot\'s insane' }
        """
        name = os.path.basename(filename)
        if " playing " in name:
            name = name.split(" playing ", 1)[1]
        
        # Strip trailing timestamp e.g. (2026-07-15_16-53).osr
        name = re.sub(r"\s*\(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\)\.osr$", "", name, flags=re.IGNORECASE)
        name = re.sub(r"\.osr$", "", name, flags=re.IGNORECASE).strip()

        diff = None
        m_diff = re.search(r"\[(.*?)\]$", name)
        if m_diff:
            diff = m_diff.group(1).strip()
            name = name[:m_diff.start()].strip()

        creator = None
        m_creator = re.search(r"\((.*?)\)$", name)
        if m_creator:
            creator = m_creator.group(1).strip()
            name = name[:m_creator.start()].strip()

        artist = None
        title = name
        if " - " in name:
            parts = name.split(" - ", 1)
            artist = parts[0].strip()
            title = parts[1].strip()

        return {
            "artist": artist,
            "title": title,
            "creator": creator,
            "diff": diff,
        }

    def search_mirror_with_metadata(self, meta: Dict[str, Optional[str]]) -> Optional[Dict[str, Any]]:
        """
        Searches Catboy mirror with artist, title, and creator filtering.
        """
        queries = []
        if meta.get("artist") and meta.get("title"):
            queries.append(f"{meta['artist']} {meta['title']}")
        if meta.get("title"):
            queries.append(meta["title"])
        if meta.get("artist"):
            queries.append(meta["artist"])

        creator_target = (meta.get("creator") or "").lower().strip()
        diff_target = (meta.get("diff") or "").lower().strip()

        for q in queries:
            clean_q = urllib.parse.quote_plus(q)
            url = f"https://catboy.best/api/v2/search?q={clean_q}"
            try:
                req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
                with urllib.request.urlopen(req, timeout=6) as resp:
                    results = json.loads(resp.read().decode("utf-8"))
                    if isinstance(results, list) and len(results) > 0:
                        # 1. Look for matching creator
                        if creator_target:
                            for item in results:
                                c = (item.get("creator") or (item.get("user") or {}).get("username") or "").lower().strip()
                                if c == creator_target:
                                    sid = item.get("id")
                                    return {
                                        "beatmapset_id": sid,
                                        "title": item.get("title", q),
                                        "artist": item.get("artist", "Unknown"),
                                        "download_url": f"https://catboy.best/d/{sid}",
                                        "source": f"Catboy/Mino (Creator: {meta['creator']})"
                                    }

                        # 2. Look for matching difficulty in beatmaps list if present
                        if diff_target:
                            for item in results:
                                for b in item.get("beatmaps", []):
                                    if (b.get("version") or "").lower().strip() == diff_target:
                                        sid = item.get("id")
                                        return {
                                            "beatmapset_id": sid,
                                            "title": item.get("title", q),
                                            "artist": item.get("artist", "Unknown"),
                                            "download_url": f"https://catboy.best/d/{sid}",
                                            "source": f"Catboy/Mino (Difficulty: {meta['diff']})"
                                        }

                        # 3. If no specific creator given or found, take highest-relevance result
                        if not creator_target:
                            first = results[0]
                            sid = first.get("id")
                            return {
                                "beatmapset_id": sid,
                                "title": first.get("title", q),
                                "artist": first.get("artist", "Unknown"),
                                "download_url": f"https://catboy.best/d/{sid}",
                                "source": "Catboy/Mino (Search)"
                            }
            except Exception:
                pass

        return None

    def resolve_beatmap(self, md5: str, filename_hint: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Resolves beatmap metadata using MD5 with creator/title search fallback.
        """
        # 1. Try MD5 lookups
        info = self.fetch_by_md5_catboy(md5)
        if info:
            return info

        info = self.fetch_by_md5_sayobot(md5)
        if info:
            return info

        # 2. Fallback: Parse filename metadata and search
        if filename_hint:
            meta = self.parse_replay_filename(filename_hint)
            print(f"🔍 Searching mirror servers for: '{meta['artist']} - {meta['title']}' (Mapper: {meta['creator']})...")
            info = self.search_mirror_with_metadata(meta)
            if info:
                return info

        return None

    def ensure_beatmap(self, md5: str, filename_hint: Optional[str] = None) -> Tuple[bool, str]:
        """
        Ensures the beatmap is downloaded into Danser Songs directory.
        """
        info = self.resolve_beatmap(md5, filename_hint)
        if not info:
            return False, f"Could not resolve beatmap (MD5: {md5}) on any mirror."

        sid = info["beatmapset_id"]
        title = info.get("title", "Unknown Song")
        artist = info.get("artist", "Unknown Artist")
        target_osz = os.path.join(self.songs_dir, f"{sid}.osz")
        target_extracted = os.path.join(self.songs_dir, str(sid))

        if os.path.exists(target_osz) or os.path.exists(target_extracted):
            return True, f"Beatmap '{artist} - {title}' (Set #{sid}) is already present."

        download_url = info["download_url"]
        print(f"⚡ Downloading beatmap: {artist} - {title} (Set #{sid}) from {info['source']}...")

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
