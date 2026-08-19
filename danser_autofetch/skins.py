"""
Skin Manager module (Clean On-Demand Architecture).
Handles on-demand skin importing from local .osk / .zip / folder paths, URLs, and fuzzy name matching.
Starts with 0 extra skins by default unless user explicitly provides or imports one.
"""

import os
import shutil
import zipfile
import urllib.request
from typing import List, Optional


class SkinManager:
    def __init__(self, skins_dir: str, osu_exports_dir: Optional[str] = None):
        self.skins_dir = os.path.expanduser(skins_dir)
        os.makedirs(self.skins_dir, exist_ok=True)
        self.osu_exports_dir = os.path.expanduser(osu_exports_dir) if osu_exports_dir else None

    def import_skin(self, source_path_or_url: str) -> Optional[str]:
        """
        Imports a skin on-demand from:
        - A local .osk or .zip file path
        - A local skin folder path
        - A direct download URL (http/https)
        Returns the installed skin name if successful.
        """
        raw_path = source_path_or_url.strip("\"' ")

        # 1. Direct URL download
        if raw_path.startswith("http://") or raw_path.startswith("https://"):
            print(f"📥 Downloading skin from URL: {raw_path}...")
            temp_osk = os.path.join(self.skins_dir, "_temp_import.osk")
            try:
                req = urllib.request.Request(raw_path, headers={"User-Agent": "danser-autofetch"})
                with urllib.request.urlopen(req, timeout=30) as in_f, open(temp_osk, "wb") as out_f:
                    out_f.write(in_f.read())
                raw_path = temp_osk
            except Exception as e:
                print(f"❌ Failed to download skin from URL: {e}")
                return None

        clean_path = os.path.abspath(os.path.expanduser(raw_path))
        if not os.path.exists(clean_path):
            return None

        # 2. If it's a local folder
        if os.path.isdir(clean_path):
            skin_name = os.path.basename(os.path.normpath(clean_path))
            dst = os.path.join(self.skins_dir, skin_name)
            if os.path.abspath(clean_path) != os.path.abspath(dst):
                if os.path.exists(dst):
                    shutil.rmtree(dst)
                shutil.copytree(clean_path, dst)
            print(f"✅ Successfully imported skin folder: '{skin_name}'")
            return skin_name

        # 3. If it's an archive (.osk / .zip)
        if clean_path.lower().endswith(".osk") or clean_path.lower().endswith(".zip"):
            raw_name = os.path.basename(clean_path).rsplit(".", 1)[0]
            if raw_name == "_temp_import":
                raw_name = "Imported_Skin"
            # Clean up duplicate suffix markers like (1), (2)
            if " (" in raw_name and raw_name.endswith(")"):
                raw_name = raw_name.rsplit(" (", 1)[0]

            dst = os.path.join(self.skins_dir, raw_name)
            os.makedirs(dst, exist_ok=True)
            try:
                with zipfile.ZipFile(clean_path, "r") as z:
                    z.extractall(dst)
                print(f"✅ Successfully unpacked & installed skin: '{raw_name}'")
                if clean_path.endswith("_temp_import.osk"):
                    os.remove(clean_path)
                return raw_name
            except Exception as e:
                print(f"❌ Failed to unpack skin archive: {e}")
                return None

        return None

    def sync_from_sources(self) -> int:
        """
        Manually scans osu! exports and Downloads directories when explicitly requested (--sync-skins).
        """
        scan_dirs = []
        if self.osu_exports_dir and os.path.exists(self.osu_exports_dir):
            scan_dirs.append(self.osu_exports_dir)
        
        downloads_dir = os.path.expanduser("~/Downloads")
        if os.path.exists(downloads_dir):
            scan_dirs.append(downloads_dir)

        count = 0
        for s_dir in scan_dirs:
            for item in os.listdir(s_dir):
                src = os.path.join(s_dir, item)
                if (item.lower().endswith(".osk") or item.lower().endswith(".zip")) and not item.startswith("."):
                    skin_name = item.rsplit(".", 1)[0]
                    if " (" in skin_name and skin_name.endswith(")"):
                        skin_name = skin_name.rsplit(" (", 1)[0]
                    dst = os.path.join(self.skins_dir, skin_name)
                    if not os.path.exists(dst):
                        if self.import_skin(src):
                            count += 1
                elif os.path.isdir(src) and s_dir == self.osu_exports_dir:
                    dst = os.path.join(self.skins_dir, item)
                    if not os.path.exists(dst):
                        shutil.copytree(src, dst)
                        count += 1
        return count

    def list_skins(self) -> List[str]:
        """Returns a list of all available skin names in Danser."""
        if not os.path.exists(self.skins_dir):
            return []
        return [
            d for d in os.listdir(self.skins_dir)
            if os.path.isdir(os.path.join(self.skins_dir, d))
        ]

    def match_skin(self, query: str) -> Optional[str]:
        """
        Matches an existing skin name or automatically imports on-the-fly if query is a local file path / URL.
        """
        clean_query = query.strip("\"' ")

        # If query is a local file path, directory, or URL, auto-import it on the fly!
        if (
            clean_query.startswith("http://")
            or clean_query.startswith("https://")
            or os.path.exists(os.path.expanduser(clean_query))
        ):
            imported = self.import_skin(clean_query)
            if imported:
                return imported

        available = self.list_skins()
        if not available:
            return None

        # 1. Exact match
        for s in available:
            if s.lower() == clean_query.lower():
                return s

        # 2. Starts with query
        for s in available:
            if s.lower().startswith(clean_query.lower()):
                return s

        # 3. Substring match
        for s in available:
            if clean_query.lower() in s.lower():
                return s

        return None
