"""
Command Line Interface for Danser AutoFetch.
"""

import os
import sys
import argparse
from danser_autofetch import __version__
from danser_autofetch.parser import parse_replay
from danser_autofetch.fetcher import BeatmapFetcher
from danser_autofetch.skins import SkinManager
from danser_autofetch.renderer import DanserRenderer

DEFAULT_DANSER_DIR = os.path.expanduser("~/Applications/danser")
DEFAULT_OUTPUT_DIR = os.path.expanduser("~/Videos/danser_records")
DEFAULT_OSU_EXPORTS_DIR = os.path.expanduser("~/.var/app/sh.ppy.osu/data/osu/exports")
if not os.path.exists(DEFAULT_OSU_EXPORTS_DIR):
    DEFAULT_OSU_EXPORTS_DIR = os.path.expanduser("~/.local/share/osu/exports")


def print_banner():
    banner = f"""
==================================================================
   🎵 DANSER AUTOFETCH v{__version__}
   Automated osu! Replay Renderer & Multi-Mirror Beatmap Fetcher
==================================================================
"""
    print(banner)


def main():
    parser = argparse.ArgumentParser(
        description="Auto-fetch beatmaps and render osu! replay files (.osr) into 1080p 60FPS videos using Danser."
    )
    parser.add_argument("replay", nargs="?", help="Path to the osu! replay file (.osr)")
    parser.add_argument("-s", "--skin", help="Skin name or keyword to use for rendering (e.g. 'rafis', 'whitecat')")
    parser.add_argument("-d", "--danser-dir", default=DEFAULT_DANSER_DIR, help=f"Path to Danser directory (default: {DEFAULT_DANSER_DIR})")
    parser.add_argument("-o", "--output-dir", default=DEFAULT_OUTPUT_DIR, help=f"Directory to store output MP4 videos (default: {DEFAULT_OUTPUT_DIR})")
    parser.add_argument("--exports-dir", default=DEFAULT_OSU_EXPORTS_DIR, help=f"osu! lazer exports directory (default: {DEFAULT_OSU_EXPORTS_DIR})")
    parser.add_argument("--list-skins", action="store_true", help="List all available skins and exit")
    parser.add_argument("--sync-skins", action="store_true", help="Sync/import all skins from osu! exports into Danser")
    parser.add_argument("--fps", type=int, default=60, help="Output video framerate (default: 60)")
    parser.add_argument("-v", "--version", action="version", version=f"danser-autofetch {__version__}")

    args, extra_danser_args = parser.parse_known_args()

    print_banner()

    if not os.path.exists(args.danser_dir):
        print(f"❌ Error: Danser directory not found at: {args.danser_dir}")
        print("Please specify --danser-dir or install Danser in ~/Applications/danser")
        sys.exit(1)

    skin_manager = SkinManager(
        skins_dir=os.path.join(args.danser_dir, "Skins"),
        osu_exports_dir=args.exports_dir
    )

    # Sync skins from lazer exports
    imported = skin_manager.sync_from_osu_exports()
    if imported > 0:
        print(f"📦 Synchronized {imported} new skin(s) from osu! exports directory.")

    if args.list_skins:
        skins = skin_manager.list_skins()
        print(f"🎨 Available Skins ({len(skins)} total):")
        for s in sorted(skins):
            print(f"  • {s}")
        return

    if args.sync_skins:
        print("✅ Skins synchronization complete.")
        return

    if not args.replay:
        parser.print_help()
        sys.exit(1)

    replay_path = os.path.abspath(os.path.expanduser(args.replay))
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
        fetcher = BeatmapFetcher(songs_dir=os.path.join(args.danser_dir, "Songs"))
        success, msg = fetcher.ensure_beatmap(beatmap_md5)
        print(f"🗺️  Beatmap Status: {msg}")
        if not success:
            print("⚠️ Warning: Beatmap could not be auto-downloaded. Proceeding with existing local database...")

    # Skin matching
    selected_skin = None
    if args.skin:
        matched = skin_manager.match_skin(args.skin)
        if matched:
            selected_skin = matched
            print(f"🎨 Using Matched Skin: '{selected_skin}'")
        else:
            selected_skin = args.skin
            print(f"🎨 Using Custom Skin: '{selected_skin}'")

    renderer = DanserRenderer(
        danser_dir=args.danser_dir,
        output_dir=args.output_dir
    )

    renderer.configure_settings(
        use_skin_cursor=True,
        use_skin_hitsounds=True,
        use_skin_colors=True,
        skip_lead_in=True,
        fps=args.fps
    )

    exit_code = renderer.run_record(
        replay_path=replay_path,
        skin_name=selected_skin,
        extra_args=extra_danser_args
    )

    if exit_code == 0:
        print("\n" + "=" * 66)
        print(f"🎉 Rendering Complete! Video saved to:")
        print(f"📁 {args.output_dir}")
        print("=" * 66)
    else:
        print(f"\n❌ Danser exited with code: {exit_code}")
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
