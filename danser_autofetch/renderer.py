"""
Danser Execution & Rendering module.
Configures Danser settings, sets up FFmpeg runtime environment, and manages the rendering process.
"""

import os
import json
import subprocess
from typing import Optional, List, Dict, Any


class DanserRenderer:
    def __init__(self, danser_dir: str, output_dir: Optional[str] = None):
        self.danser_dir = os.path.expanduser(danser_dir)
        self.output_dir = os.path.expanduser(output_dir) if output_dir else os.path.join(self.danser_dir, "videos")
        self.settings_file = os.path.join(self.danser_dir, "settings", "default.json")
        self.danser_bin = os.path.join(self.danser_dir, "danser-cli")
        if not os.path.exists(self.danser_bin):
            self.danser_bin = os.path.join(self.danser_dir, "danser")

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
            with open(self.settings_file, "r") as f:
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
                cfg["Recording"]["Encoder"] = "libx264"

            with open(self.settings_file, "w") as f:
                json.dump(cfg, f, indent=4)
        except Exception as e:
            print(f"⚠️ Warning: Could not update Danser config: {e}")

    def run_record(self, replay_path: str, skin_name: Optional[str] = None, extra_args: Optional[List[str]] = None) -> int:
        """
        Executes danser-cli to render the replay into a video.
        """
        env = dict(os.environ)
        
        # Prepend bundled FFmpeg and Danser shared libraries
        bundled_ffmpeg = os.path.join(self.danser_dir, "ffmpeg")
        if os.path.exists(bundled_ffmpeg):
            env["PATH"] = f"{bundled_ffmpeg}:{env.get('PATH', '')}"
            env["LD_LIBRARY_PATH"] = f"{bundled_ffmpeg}:{self.danser_dir}:{env.get('LD_LIBRARY_PATH', '')}"

        cmd = [self.danser_bin, "-record", "-skip", "-replay", os.path.abspath(replay_path)]

        if skin_name:
            cmd.extend(["-skin", skin_name])

        if extra_args:
            cmd.extend(extra_args)

        print(f"\n🚀 Running Danser Command: {' '.join(cmd)}")
        return subprocess.call(cmd, cwd=self.danser_dir, env=env)
