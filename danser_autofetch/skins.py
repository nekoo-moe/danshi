"""
Skin Manager module.
Handles skin synchronization, unpacking .osk / .zip archives, and fuzzy skin name matching.
"""

import os
import shutil
import zipfile
from typing import List, Optional, Tuple


class SkinManager:
    def __init__(self, skins_dir: str, osu_exports_dir: Optional[str] = None):
        self.skins_dir = os.path.expanduser(skins_dir)
        os.makedirs(self.skins_dir, exist_ok=True)
        self.osu_exports_dir = os.path.expanduser(osu_exports_dir) if osu_exports_dir else None

    def sync_from_osu_exports(self) -> int:
        """
        Scans osu! exports directory, copies folders, and extracts .osk / .zip files into Danser Skins directory.
        Returns the number of imported/updated skins.
        """
        if not self.osu_exports_dir or not os.path.exists(self.osu_exports_dir):
            return 0

        count = 0
        for item in os.listdir(self.osu_exports_dir):
            src = os.path.join(self.osu_exports_dir, item)
            
            # Directory skin
            if os.path.isdir(src):
                dst = os.path.join(self.skins_dir, item)
                if not os.path.exists(dst):
                    shutil.copytree(src, dst)
                    count += 1

            # Compressed skin (.osk or .zip)
            elif item.endswith(".osk") or item.endswith(".zip"):
                skin_name = item.rsplit(".", 1)[0]
                if " (" in skin_name and skin_name.endswith(")"):
                    skin_name = skin_name.rsplit(" (", 1)[0]
                
                dst = os.path.join(self.skins_dir, skin_name)
                if not os.path.exists(dst):
                    os.makedirs(dst, exist_ok=True)
                    try:
                        with zipfile.ZipFile(src, "r") as z:
                            z.extractall(dst)
                        count += 1
                    except Exception:
                        pass
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
        Fuzzy matches a user-provided skin name or keyword against available skins.
        Example: 'rafis' -> 'Rafis 2018-03-26 HDDT (blue cursor)'
        """
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
