"""
Skin Manager module.
Handles skin synchronization, direct .osk / .zip / URL importing, and fuzzy skin name matching.
"""

import os
import shutil
import zipfile
import urllib.request
from typing import List, Optional, Tuple


class SkinManager:
    def __init__(self, skins_dir: str, osu_exports_dir: Optional[str] = None):
        self.skins_dir = os.path.expanduser(skins_dir)
        os.makedirs(self.skins_dir, exist_ok=True)
        self.osu_exports_dir = os.path.expanduser(osu_exports_dir) if osu_exports_dir else None

    def import_skin(self, source_path_or_url: str) -> Optional[str]:
        """
        Imports a skin from a local file (.osk, .zip, directory) or a direct download URL.
        Returns the installed skin name if successful.
        """
        target_file = source_path_or_url

        # 1. Download if URL
        if source_path_or_url.startswith("http://") or source_path_or_url.startswith("https://"):
            print(f"📥 Downloading skin from: {source_path_or_url}...")
            temp_osk = os.path.join(self.skins_dir, "_temp_import.osk")
            try:
                req = urllib.request.Request(source_path_or_url, headers={"User-Agent": "danser-autofetch"})
                with urllib.request.urlopen(req, timeout=30) as in_f, open(temp_osk, "wb") as out_f:
                    out_f.write(in_f.read())
                target_file = temp_osk
            except Exception as e:
                print(f"❌ Failed to download skin from URL: {e}")
                return None

        target_file = os.path.expanduser(target_file)
        if not os.path.exists(target_file):
            return None

        # 2. If it's a directory
        if os.path.isdir(target_file):
            skin_name = os.path.basename(os.path.normpath(target_file))
            dst = os.path.join(self.skins_dir, skin_name)
            if os.path.abspath(target_file) != os.path.abspath(dst):
                if os.path.exists(dst):
                    shutil.rmtree(dst)
                shutil.copytree(target_file, dst)
            print(f"✅ Imported skin folder: '{skin_name}'")
            return skin_name

        # 3. If it's an archive (.osk / .zip)
        if target_file.endswith(".osk") or target_file.endswith(".zip"):
            raw_name = os.path.basename(target_file).rsplit(".", 1)[0]
            if raw_name == "_temp_import":
                raw_name = "Imported_Skin"
            # Clean up (1), (2) suffixes
            if " (" in raw_name and raw_name.endswith(")"):
                raw_name = raw_name.rsplit(" (", 1)[0]

            dst = os.path.join(self.skins_dir, raw_name)
            os.makedirs(dst, exist_ok=True)
            try:
                with zipfile.ZipFile(target_file, "r") as z:
                    z.extractall(dst)
                print(f"✅ Extracted & installed skin: '{raw_name}'")
                if target_file.endswith("_temp_import.osk"):
                    os.remove(target_file)
                return raw_name
            except Exception as e:
                print(f"❌ Failed to unpack skin archive: {e}")
                return None

        return None

    def sync_from_sources(self) -> int:
        """
        Scans osu! exports and Downloads directories for new .osk skins and imports them.
        """
        scan_dirs = []
        if self.osu_exports_dir and os.path.exists(self.osu_exports_dir):
            scan_dirs.append(self.osu_exports_dir)
        
        # Also check ~/Downloads for freshly downloaded .osk files
        downloads_dir = os.path.expanduser("~/Downloads")
        if os.path.exists(downloads_dir):
            scan_dirs.append(downloads_dir)

        count = 0
        for s_dir in scan_dirs:
            for item in os.listdir(s_dir):
                src = os.path.join(s_dir, item)
                if (item.endswith(".osk") or item.endswith(".zip")) and not item.startswith("."):
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
        Matches a skin name or imports directly if query is a file path / URL.
        """
        # If query is a file path or URL, auto-import it on the fly!
        if (
            query.startswith("http://")
            or query.startswith("https://")
            or os.path.exists(os.path.expanduser(query))
        ):
            imported = self.import_skin(query)
            if imported:
                return imported

        available = self.list_skins()
        if not available:
            return None

        # 1. Exact match
        for s in available:
            if s.lower() == query.lower():
                return s

        # 2. Starts with query
        for s in available:
            if s.lower().startswith(query.lower()):
                return s

        # 3. Substring match
        for s in available:
            if query.lower() in s.lower():
                return s

        return None
