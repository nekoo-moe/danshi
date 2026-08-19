"""
Danser Execution & Rendering module (Cross-Platform: Windows, Linux, macOS).
Configures Danser settings, sets up FFmpeg runtime environment, and manages the rendering process.
"""

import os
import sys
import json
import shutil
import subprocess
from typing import Optional, List, Dict, Any


class DanserRenderer:
    def __init__(self, danser_dir: Optional[str] = None, output_dir: Optional[str] = None):
        self.danser_dir = self.resolve_danser_dir(danser_dir)
        self.output_dir = os.path.expanduser(output_dir) if output_dir else os.path.join(self.danser_dir, "videos")
        self.settings_file = os.path.join(self.danser_dir, "settings", "default.json")
        self.danser_bin = self.resolve_danser_binary()

    @staticmethod
    def resolve_danser_dir(user_path: Optional[str] = None) -> str:
        """
        Auto-detects Danser installation directory across Windows, Linux, and macOS.
        """
        if user_path and os.path.exists(os.path.expanduser(user_path)):
            return os.path.abspath(os.path.expanduser(user_path))

        # Common search paths
        candidates = [
            os.path.expanduser("~/Applications/danser"),
            os.path.expanduser("~/.danser"),
            os.path.abspath("./danser"),
            os.path.abspath("."),
        ]

        if sys.platform == "win32":
            appdata = os.environ.get("APPDATA", "")
            localappdata = os.environ.get("LOCALAPPDATA", "")
            programfiles = os.environ.get("ProgramFiles", "")
            if localappdata:
                candidates.extend([
                    os.path.join(localappdata, "Programs", "danser"),
                    os.path.join(localappdata, "danser"),
                ])
            if appdata:
                candidates.append(os.path.join(appdata, "danser"))
            if programfiles:
                candidates.append(os.path.join(programfiles, "danser"))
        elif sys.platform == "darwin":
            candidates.append(os.path.expanduser("~/Library/Application Support/danser"))

        for c in candidates:
            if c and os.path.exists(c) and (
                os.path.exists(os.path.join(c, "settings")) or
                os.path.exists(os.path.join(c, "danser")) or
                os.path.exists(os.path.join(c, "danser.exe"))
            ):
                return c

        return os.path.abspath(os.path.expanduser(user_path or candidates[0]))

    def resolve_danser_binary(self) -> str:
        """
        Finds the Danser binary (danser-cli or danser, with .exe on Windows).
        """
        is_windows = sys.platform == "win32"
        bin_names = ["danser-cli.exe", "danser.exe"] if is_windows else ["danser-cli", "danser"]

        # 1. Search inside danser_dir
        for name in bin_names:
            p = os.path.join(self.danser_dir, name)
            if os.path.isfile(p):
                return p

        # 2. Search in system PATH
        for name in bin_names:
            found = shutil.which(name)
            if found:
                return found

        return os.path.join(self.danser_dir, bin_names[0])

    def configure_settings(
        self,
        use_skin_cursor: bool = True,
        use_skin_hitsounds: bool = True,
        use_skin_colors: bool = True,
        skip_lead_in: bool = True,
        fps: int = 60,
        resolution: tuple = (1920, 1080)
    ):
        """
        Updates Danser's default.json to ensure optimal high-quality recording settings.
        """
        if not os.path.exists(self.settings_file):
            return

        try:
            with open(self.settings_file, "r", encoding="utf-8") as f:
                cfg = json.load(f)

            # Paths
            cfg.setdefault("General", {})
            cfg["General"]["OsuSongsDir"] = os.path.join(self.danser_dir, "Songs")
            cfg["General"]["OsuSkinsDir"] = os.path.join(self.danser_dir, "Skins")
            cfg["General"]["OsuReplaysDir"] = os.path.join(self.danser_dir, "Replays")
            cfg["General"]["UnpackOszFiles"] = True

            # Skin
            cfg.setdefault("Skin", {})
            cfg["Skin"]["UseColorsFromSkin"] = use_skin_colors
            cfg["Skin"]["UseBeatmapColors"] = not use_skin_colors
            cfg["Skin"].setdefault("Cursor", {})
            cfg["Skin"]["Cursor"]["UseSkinCursor"] = use_skin_cursor

            # Audio / Hitsounds
            cfg.setdefault("Audio", {})
            cfg["Audio"]["IgnoreBeatmapSamples"] = use_skin_hitsounds

            # Gameplay / Intro
            if "Gameplay" in cfg:
                if skip_lead_in:
                    cfg["Gameplay"]["LeadInTime"] = 0
                    cfg["Gameplay"]["LeadInHold"] = 0
                if "SeizureWarning" in cfg["Gameplay"]:
                    cfg["Gameplay"]["SeizureWarning"]["Enabled"] = False

            # Recording
            if "Recording" in cfg:
                cfg["Recording"]["FrameWidth"] = resolution[0]
                cfg["Recording"]["FrameHeight"] = resolution[1]
                cfg["Recording"]["FPS"] = fps
                # Encoder
                if sys.platform == "win32":
                    cfg["Recording"]["Encoder"] = "libx264"
                else:
                    cfg["Recording"]["Encoder"] = "libx264"

            with open(self.settings_file, "w", encoding="utf-8") as f:
                json.dump(cfg, f, indent=4)
        except Exception as e:
            print(f"⚠️ Warning: Could not update Danser config: {e}")

    def run_record(self, replay_path: str, skin_name: Optional[str] = None, extra_args: Optional[List[str]] = None) -> int:
        """
        Executes danser to render the replay into a video across Windows, Linux, and macOS.
        """
        env = dict(os.environ)
        
        # Prepend bundled FFmpeg and Danser shared libraries if present
        bundled_ffmpeg = os.path.join(self.danser_dir, "ffmpeg")
        if os.path.exists(bundled_ffmpeg):
            if sys.platform == "win32":
                env["PATH"] = f"{bundled_ffmpeg};{env.get('PATH', '')}"
            elif sys.platform == "darwin":
                env["PATH"] = f"{bundled_ffmpeg}:{env.get('PATH', '')}"
                env["DYLD_LIBRARY_PATH"] = f"{bundled_ffmpeg}:{self.danser_dir}:{env.get('DYLD_LIBRARY_PATH', '')}"
            else:
                env["PATH"] = f"{bundled_ffmpeg}:{env.get('PATH', '')}"
                env["LD_LIBRARY_PATH"] = f"{bundled_ffmpeg}:{self.danser_dir}:{env.get('LD_LIBRARY_PATH', '')}"

        cmd = [self.danser_bin, "-record", "-skip", "-replay", os.path.abspath(replay_path)]

        if skin_name:
            cmd.extend(["-skin", skin_name])

        if extra_args:
            cmd.extend(extra_args)

        print(f"\n🚀 Launching Danser: {' '.join(cmd)}")
        return subprocess.call(cmd, cwd=self.danser_dir, env=env)
