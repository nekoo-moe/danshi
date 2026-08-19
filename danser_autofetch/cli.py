"""
Command Line Interface for Danser AutoFetch (Cross-Platform).
"""

import os
import sys
import time
import argparse
from typing import Optional
from danser_autofetch import __version__
from danser_autofetch.parser import parse_replay
from danser_autofetch.fetcher import BeatmapFetcher
from danser_autofetch.skins import SkinManager
from danser_autofetch.renderer import DanserRenderer


def get_default_paths():
    """Detects default system paths based on operating system."""
    # 1. Output Directory
    videos_dir = os.path.expanduser("~/Videos")
    if sys.platform == "win32":
        user_profile = os.environ.get("USERPROFILE", os.path.expanduser("~"))
        videos_dir = os.path.join(user_profile, "Videos")
    output_dir = os.path.join(videos_dir, "danser_records")

    # 2. osu! Exports Directory
    osu_exports_dir = None
    if sys.platform == "win32":
        localappdata = os.environ.get("LOCALAPPDATA", "")
        appdata = os.environ.get("APPDATA", "")
        candidates = [
            os.path.join(localappdata, "osu!", "exports"),
            os.path.join(localappdata, "osu!", "Exports"),
            os.path.join(appdata, "osu", "exports"),
        ]
        for c in candidates:
            if os.path.exists(c):
                osu_exports_dir = c
                break
        if not osu_exports_dir and localappdata:
            osu_exports_dir = os.path.join(localappdata, "osu!", "exports")
    elif sys.platform == "darwin":
        osu_exports_dir = os.path.expanduser("~/Library/Application Support/osu/exports")
    else:
        candidates = [
            os.path.expanduser("~/.var/app/sh.ppy.osu/data/osu/exports"),
            os.path.expanduser("~/.local/share/osu/exports"),
        ]
        for c in candidates:
            if os.path.exists(c):
                osu_exports_dir = c
                break
        if not osu_exports_dir:
            osu_exports_dir = candidates[0]

    # 3. Danser Directory
    danser_dir = DanserRenderer.resolve_danser_dir()

    return danser_dir, output_dir, osu_exports_dir


def print_banner():
    banner = f"""
==================================================================
   🎵 DANSER AUTOFETCH v{__version__}
   Automated osu! Replay Video Renderer (Cross-Platform)
   GitHub: https://github.com/heiznerd/danser-autofetch
==================================================================
"""
    print(banner)


def main():
    default_danser, default_output, default_exports = get_default_paths()

    parser = argparse.ArgumentParser(
        description="Auto-fetch beatmaps and render osu! replay files (.osr) into 1080p 60FPS videos using Danser across Windows, Linux, and macOS."
    )
    parser.add_argument("replay", nargs="?", help="Path to the osu! replay file (.osr)")
    parser.add_argument("-s", "--skin", help="Skin name, local file path (.osk/.zip), folder path, or direct download URL")
    parser.add_argument("--import-skin", "--add-skin", help="Import a new skin from a local path (.osk/.zip/folder) or download URL")
    parser.add_argument("-d", "--danser-dir", default=default_danser, help=f"Path to Danser directory (default: {default_danser})")
    parser.add_argument("-o", "--output-dir", default=default_output, help=f"Directory to store output MP4 videos (default: {default_output})")
    parser.add_argument("--exports-dir", default=default_exports, help=f"osu! lazer exports directory (default: {default_exports})")
    parser.add_argument("--list-skins", action="store_true", help="List all available skins and exit")
    parser.add_argument("--sync-skins", action="store_true", help="Manually sync skins from osu! exports and Downloads folders")
    parser.add_argument("--fps", type=int, default=60, help="Output video framerate (default: 60)")
    parser.add_argument("-v", "--version", action="version", version=f"danser-autofetch {__version__}")

    args, extra_danser_args = parser.parse_known_args()

    print_banner()

    renderer = DanserRenderer(
        danser_dir=args.danser_dir,
        output_dir=args.output_dir
    )

    if not os.path.exists(renderer.danser_dir):
        print(f"❌ Error: Danser directory not found at: {renderer.danser_dir}")
        print("Please download Danser from https://github.com/Wieku/danser-go/releases")
        print("or specify --danser-dir /path/to/danser")
        sys.exit(1)

    skin_manager = SkinManager(
        skins_dir=os.path.join(renderer.danser_dir, "Skins"),
        osu_exports_dir=args.exports_dir
    )

    # 1. Explicit Skin Import
    if args.import_skin:
        imported_name = skin_manager.import_skin(args.import_skin)
        if imported_name:
            print(f"🎉 Successfully added new skin: '{imported_name}'!")
            print("You can now use it with: danser-record <replay.osr> -s " + f'"{imported_name}"')
        return

    # 2. Manual Skin Sync (Only when user explicitly asks with --sync-skins)
    if args.sync_skins:
        imported = skin_manager.sync_from_sources()
        print(f"📦 Synchronized {imported} skin(s) from system folders into Danser.")
        return

    if args.list_skins:
        skins = skin_manager.list_skins()
        if skins:
            print(f"🎨 Available Skins ({len(skins)} total):")
            for s in sorted(skins):
                print(f"  • {s}")
        else:
            print("🎨 No custom skins installed yet. You can add one with: danser-record --import-skin <path/to/skin.osk>")
        return

    if not args.replay:
        parser.print_help()
        sys.exit(1)

    replay_path = os.path.abspath(os.path.expanduser(args.replay.strip("\"' ")))
    if not os.path.exists(replay_path):
        print(f"❌ Error: Replay file not found: {replay_path}")
        sys.exit(1)

    print(f"📂 Analyzing Replay: {os.path.basename(replay_path)}")
    try:
        replay_info = parse_replay(replay_path)
        print(f"👤 Player:      {replay_info['player_name']}")
        print(f"🎯 Mods:        {replay_info['mods_string']}")
        print(f"💯 Score:       {replay_info['total_score']:,} | Max Combo: {replay_info['max_combo']}x")
        print(f"🔑 Beatmap MD5: {replay_info['beatmap_md5']}")
    except Exception as e:
        print(f"⚠️ Warning: Could not parse replay header: {e}")
        replay_info = {}

    beatmap_md5 = replay_info.get("beatmap_md5")
    if beatmap_md5:
        fetcher = BeatmapFetcher(songs_dir=os.path.join(renderer.danser_dir, "Songs"))
        success, msg = fetcher.ensure_beatmap(beatmap_md5, filename_hint=replay_path)
        print(f"🗺️  Beatmap Status: {msg}")
        if not success:
            print("⚠️ Warning: Beatmap could not be auto-downloaded. Proceeding with existing local database...")

    # Skin matching or on-the-fly import from user-provided local path / URL
    selected_skin = None
    if args.skin:
        matched = skin_manager.match_skin(args.skin)
        if matched:
            selected_skin = matched
            print(f"🎨 Using Skin: '{selected_skin}'")
        else:
            selected_skin = args.skin
            print(f"🎨 Using Custom Skin: '{selected_skin}'")

    renderer.configure_settings(
        use_skin_cursor=True,
        use_skin_hitsounds=True,
        use_skin_colors=True,
        skip_lead_in=True,
        fps=args.fps
    )

    start_time = time.time()

    exit_code = renderer.run_record(
        replay_path=replay_path,
        skin_name=selected_skin,
        extra_args=extra_danser_args
    )

    # Verify if a video was actually generated during this run
    video_generated = False
    if os.path.exists(args.output_dir):
        for f in os.listdir(args.output_dir):
            if f.endswith(".mp4"):
                full_p = os.path.join(args.output_dir, f)
                if os.path.getmtime(full_p) >= start_time - 2:
                    video_generated = True
                    break

    if exit_code == 0 and video_generated:
        print("\n" + "=" * 66)
        print(f"🎉 Rendering Complete! Video saved to:")
        print(f"📁 {args.output_dir}")
        print("=" * 66)
    else:
        print("\n" + "=" * 66)
        print("❌ Rendering ended without producing a video.")
        print("If the beatmap was not found, please ensure the beatmap (.osz) is in Danser's Songs folder.")
        print("=" * 66)
        sys.exit(1 if exit_code == 0 else exit_code)


if __name__ == "__main__":
    main()
