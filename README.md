# Danser AutoFetch

[![Python Version](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://python.org)
[![Danser-go](https://img.shields.io/badge/Danser--go-v0.11%2B-brightgreen.svg)](https://github.com/Wieku/danser-go)
[![osu! lazer](https://img.shields.io/badge/osu!-lazer%20compatible-ff66aa.svg)](https://osu.ppy.sh)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

Danser AutoFetch is a lightweight, cross-platform CLI automation tool that bridges **osu! lazer** and **[danser-go](https://github.com/Wieku/danser-go)**. It automatically parses exported replay files (`.osr`), fetches missing beatmaps and audio from high-speed mirror networks, manages custom skins, and renders smooth 1080p 60FPS video replays with zero manual file management.

---

> **Note on Compatibility / Lưu ý tương thích:**
>
> **EN:** This tool is designed and optimized specifically for **osu! lazer**. If you are using **osu! stable**, please consider using the upstream **[danser-go](https://github.com/Wieku/danser-go)** project directly to support the original author.
>
> **VI:** Hoạt động tốt nhất khi sử dụng phiên bản **osu!lazer**, nếu bạn sử dụng bản **osu! stable**, hãy sử dụng trực tiếp **[danser-go](https://github.com/Wieku/danser-go)** để ủng hộ dự án chính.

---

## Overview & Architecture

In **osu! lazer**, beatmaps, audio files, and background images are stored as fragmented, content-addressed hash blobs managed inside a Realm database (`client.realm`) rather than human-readable folders. Because Danser-go was originally architected for osu! stable's traditional folder hierarchy, rendering a replay exported from osu! lazer previously required manually downloading `.osz` files or extracting beatmap archives.

Danser AutoFetch solves this by implementing an on-the-fly resolution pipeline:
1. **Binary Replay Parsing:** Reads the `.osr` replay stream to extract the beatmap MD5 checksum, player name, score, accuracy, and mods.
2. **Multi-Mirror Auto-Fetcher:** Queries multiple community mirror APIs (*Catboy / Mino, Sayobot, Chimu*) to resolve the Beatmap Set ID and automatically download missing `.osz` packages in the background.
3. **On-Demand Skin Management:** Imports local skin archives (`.osk`, `.zip`), directories, or direct URLs on demand with zero bloat.
4. **Automated Danser Execution:** Injects native skin cursors, skin hitsounds, skips lead-in delays, resolves FFmpeg binaries, and encodes 1080p 60FPS video output.

---

## Strengths & Advantages (Điểm mạnh)

- **Single-Command Workflow:** Transforms exported `.osr` files into high-definition MP4 videos without requiring any manual beatmap searching or downloading.
- **Multi-Source Fallback System:** Uses a resilient waterfall fallback across multiple mirror APIs (*Catboy -> Sayobot -> Chimu*) to ensure beatmaps are retrieved even if one service is offline.
- **Zero-Default Skin Architecture:** Does not poll or clutter system directories by default. Skins are loaded purely on-demand via local path, directory, URL, or keyword.
- **True Skin Asset Fidelity:** Automatically forces skin hitsounds (`IgnoreBeatmapSamples`), skin cursors (`UseSkinCursor`), long cursor trails, and skin combo colors.
- **Lead-In Optimization:** Automatically bypasses opening intro pauses and warnings to jump straight to active drain gameplay.
- **No External Dependencies:** Built entirely with the Python 3 standard library (`urllib`, `struct`, `json`, `subprocess`, `zipfile`).
- **Cross-Platform Compatibility:** Native support and path auto-detection for Linux, Windows, and macOS.

---

## Limitations & Technical Considerations (Điểm yếu & Giới hạn)

- **Network Dependency for New Maps:** Auto-fetching requires an active internet connection the first time an uncached beatmap is rendered.
- **Unranked / Unsubmitted Map Limitations:** If a replay was played on a completely private or unsubmitted local map that does not exist on public osu! mirrors, the `.osz` cannot be fetched automatically and must be placed manually in Danser's `Songs` folder.
- **Gamemode Scope:** Danser-go is specifically designed for standard osu! gameplay (`Mode: 0`). Replays for Taiko, Catch the Beat, or osu!mania are not rendered by Danser.
- **Hardware-Dependent Encoding Speed:** Video rendering speed is determined by your CPU/GPU hardware specifications.

---

## Installation

### 1. Prerequisites
Download and extract the latest release of **[danser-go](https://github.com/Wieku/danser-go/releases)**:
- **Linux:** Default location is `~/Applications/danser` or `~/.danser`.
- **Windows:** Extract to any directory (e.g., `%LOCALAPPDATA%\Programs\danser` or next to this repository).
- **macOS:** Default location is `~/Applications/danser` or `~/Library/Application Support/danser`.

### 2. Install Danser AutoFetch
Clone this repository and install it locally:
```bash
git clone https://github.com/heiznerd/danser-autofetch.git
cd danser-autofetch
pip install -e .
```

---

## Usage Guide

### Basic Rendering
Pass the path to any exported `.osr` replay file:
```bash
danser-record /path/to/replay.osr
```

### Rendering with Custom Skins
You can supply a skin name, a local `.osk`/`.zip` file path, a skin folder, or a download URL:

```bash
# Using a fuzzy keyword for an already installed skin:
danser-record /path/to/replay.osr -s rafis
danser-record /path/to/replay.osr -s whitecat

# Using a local .osk file path (Linux / macOS):
danser-record /path/to/replay.osr -s "/home/user/Downloads/MySkin.osk"

# Using a local .osk file path (Windows):
danser-record replay.osr -s "C:\Users\Name\Downloads\MySkin.osk"

# Using a direct skin download URL:
danser-record /path/to/replay.osr -s "https://example.com/skins/CustomSkin.osk"
```

### Managing Skins
```bash
# List all currently installed skins:
danser-record --list-skins

# Permanently import a skin without rendering:
danser-record --import-skin "/path/to/skin.osk"

# Manually synchronize skins from osu! exports and Downloads folders:
danser-record --sync-skins
```

---

## Command-Line Options Reference

| Argument | Description | Default |
| :--- | :--- | :--- |
| `replay` | Path to the target osu! replay file (`.osr`) | *Required for rendering* |
| `-s, --skin` | Skin keyword, local archive path (`.osk`/`.zip`), folder path, or download URL | Default Skin |
| `--import-skin` | Import and unpack a skin into Danser without starting a render | None |
| `-d, --danser-dir` | Custom path to Danser installation directory | Auto-detected |
| `-o, --output-dir` | Destination directory for exported MP4 videos | `~/Videos/danser_records` |
| `--exports-dir` | Custom path to osu! lazer `exports/` folder | Auto-detected |
| `--fps` | Framerate of the output video | `60` |
| `--list-skins` | Print all installed skins and exit | Disabled |
| `--sync-skins` | Manually scan and import skins from system folders | Disabled |
| `-v, --version` | Display program version | |

---

## Hướng dẫn chi tiết (Tiếng Việt)

### Tổng quan
Trong **osu! lazer**, toàn bộ dữ liệu bài hát và nhạc nền được mã hóa dạng hash bên trong cơ sở dữ liệu `client.realm`. Do đó, khi xuất file replay `.osr`, người dùng không thể đưa trực tiếp vào Danser-go như bản osu! stable ngày trước.

**Danser AutoFetch** tự động hóa toàn bộ quy trình này:
1. **Phân tích replay `.osr`**: Trích xuất mã MD5 bài hát, tên người chơi, mods và điểm số.
2. **Tự động tải nhạc ngầm**: Tìm kiếm và tải file `.osz` gốc từ các mirror server (*Catboy, Sayobot, Chimu*) về Danser trong vài giây.
3. **Cơ chế nạp Skin linh hoạt**: Nhận diện đường dẫn file `.osk`, thư mục hoặc link tải trực tiếp mà không cần cài đặt thủ công.
4. **Xuất video chuẩn 1080p 60FPS**: Tự động áp dụng Hitsound của Skin, con trỏ chuột, bỏ qua intro và lưu video vào thư mục `Videos/danser_records`.

---

### Điểm mạnh & Điểm yếu

#### Điểm mạnh:
- **Tự động hóa 100%**: Chỉ cần 1 lệnh duy nhất với file `.osr` là có video hoàn chỉnh.
- **Hệ thống tải dự phòng đa nguồn**: Tự động chuyển đổi giữa các máy chủ nếu có một máy chủ gặp sự cố.
- **Không rác hệ thống**: Khởi đầu với 0 skin mặc định, chỉ nạp đúng skin người dùng yêu cầu.
- **Tương thích đa nền tảng**: Chạy tốt trên cả Windows, Linux và macOS.
- **Không phụ thuộc thư viện ngoài**: Hoạt động hoàn toàn trên thư viện chuẩn của Python 3.

#### Điểm yếu:
- **Cần kết nối Internet lần đầu**: Khi render một bài hát mới chưa có trong máy, tool cần mạng để tải file nhạc gốc.
- **Chỉ hỗ trợ osu! chuẩn (Standard)**: Giới hạn theo Danser-go, chỉ render chế độ chơi Standard (`Mode: 0`), không áp dụng cho Taiko, Catch, hay Mania.
- **Không tải được map chưa từng upload**: Các bài hát tự tạo cục bộ chưa từng upload lên hệ thống osu! sẽ không có trên server mirror và cần copy thủ công vào thư mục `Songs`.

---

## License & Credits

- Core rendering engine powered by **[danser-go](https://github.com/Wieku/danser-go)** by **Wieku**.
- Beatmap resolution powered by community mirrors: **Catboy / Mino**, **Sayobot**, and **Chimu**.
- Licensed under the **[MIT License](LICENSE)**.
