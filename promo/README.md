# 導覽影片原始檔

導覽影片 `agent-office-tour.mp4`（1920×1080、30 fps、約 1 分 52 秒、無聲）的原始檔。影片本身不放在 repo 裡。
每一景是一個獨立的 HTML 動畫，用無頭瀏覽器逐格渲染，再用 ffmpeg 加轉場串起來。

| 景 | 檔案 | 秒 | 內容 |
|---|---|---|---|
| 1 | `s01_open.html` | 7 | 開場：代理人的 3D 辦公室 |
| 2 | `s02_problem.html` | 8 | 12 位代理人彼此看不到 → 共用 Drive 資料夾 |
| 3 | `s03_ui.html` | 8 | 介面導覽（真實畫面＋編號標註） |
| 4 | `s04_offices.html` | 8 | 每個 TEAM 一間辦公室、共用座位 |
| 5 | `s04b_common.html` | 7 | 公共空間：茶水間、會議室投影幕 |
| 6 | `s05_interact.html` | 8 | 八種狀態、點人物、點設備 |
| 7 | `s06_call.html` | 8 | 發起會議（真實議程） |
| 8 | `s07_discuss.html` | 9 | 捲動真實會議紀錄＋9 個提案 |
| 9 | `s08_vote.html` | 8 | 投票：B+ 10、D 8、A 3、C 1 |
| 10 | `s09_decide.html` | 8 | 結論 → 規劃頁 → 核准 A・B+・D |
| 11 | `s10_beforeafter.html` | 9 | 改造前後對比 |
| 12 | `s11_bplus.html` | 8 | B+ 會議／試播室 |
| 13 | `s12_da.html` | 9 | D 錄課棚＋A 電話亭、雙螢幕升降桌 |
| 14 | `s13_loop.html` | 8 | 第 9 週教材：決議 → 指令 → 回報 |
| 15 | `s14_cta.html` | 7 | 結尾 |

`assets/` 是 2026-11-03 從上線看板拍下來的真實畫面（真實資料）。側欄標題與會議發言裡的 email 都已模糊；會議議程裡有一條帶分享金鑰的舊網址，已用色塊遮住。**重拍時請保留這些處理**（`capture.js`、`capture_drawers.js` 已內建；看板每 30 秒會重繪一次，`capture_drawers.js` 會在重繪後重新遮住）。

## 需要的工具

- Python 3 與 `playwright`、`Pillow`；ffmpeg；Node 與 `playwright`（只有重拍畫面才需要）。
- 渲染與串接腳本來自 **intro-video 技能**（`render_scenes.py`、`assemble_video.py`）。
  先把環境變數 `INTRO_VIDEO_SKILL` 指向技能資料夾（預設 `~/.claude/skills/intro-video`）。

## 怎麼改

- **改字或版面**：改 `build.py`（場景都是它產生的）再執行 `python3 build.py`；只是小改也可以直接改該景 HTML。
  `raw/` 不在 repo 裡；沒有 `raw/` 時，`build.py` 只重產場景與 `storyboard.json`，沿用現有的 `assets/`。
- **先看畫面**：`python3 preview.py s08_vote` 會在 `preview/` 存一張 85% 時間點的畫面，比整景渲染快很多。
- **渲染**（每景一個瀏覽器，同時跑 4 景；4 核心的機器全片大約 15 分鐘）：

  ```bash
  python3 render_parallel.py storyboard.json --workdir work/intro --jobs 4
  python3 render_parallel.py storyboard.json --workdir work/intro --only s08_vote   # 只重渲一景
  ```

  每景會另存 `work/intro/check_<景>.png`，出片前逐張看過。
- **串接**：

  ```bash
  python3 $INTRO_VIDEO_SKILL/scripts/assemble_video.py storyboard.json --workdir work/intro --out agent-office-tour.mp4
  ```

- **加配樂**：串接時加 `--music bgm.mp3`；想讓音樂小聲一點再加 `--loudness -20`。

## 重拍畫面

1. 在 repo 根目錄開 `python3 -m http.server 8765`。改造前的畫面要用舊版本（commit `9708e32`）另外開在 8766 port；
   不需要重拍改造前的畫面時，設 `SKIP_OLD=1`。
2. `node capture.js`：拍 3D 樓層、各房間、設備特寫、互動選單（存到 `raw/`）。
3. `node capture_drawers.js`，再執行 `python3 stitch.py`：拍會議紀錄與規劃頁的長圖。
   打開 `raw/check_links.png`，確認看不到 `sk=` 之類的分享網址。
4. `python3 build.py` 重新產生 `assets/` 與場景，再渲染。
