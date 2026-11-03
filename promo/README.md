# 導覽影片原始檔

兩支影片，影片檔本身不放在 repo 裡：

| 影片 | 規格 | 片長 | 場景 |
|---|---|---|---|
| 介紹片 `agent-office-intro.mp4` | 1920×1080、30 fps | 3 分鐘 | `intro/`（21 景） |
| Shorts `agent-office-shorts.mp4` | 1080×1920（9:16）、30 fps | 45 秒 | `shorts/`（8 景） |

**內容原則**（老師 2026-11-03 指示）：先不揭露技術細節，不提 Google Drive／雲端資料夾交換，也不放 repo 或網站連結。
拍攝時看板上的「Google Drive · 雲端紀錄資料夾」字樣、頁尾的資料來源與原始碼連結、3D 選單底部「不會寫入雲端」都隱藏（`motion.js` 的 `HIDE_CSS`）。

畫面是 2026-11-03 12:12 的真實資料（同一份快照拍兩支片）。有幾個鏡頭用看板內建的「讓他做…」動作安排人物
（去錄課棚、進電話亭、站著工作、去會議室）；會議室的發言泡泡是依那場會議的真實發言重現，片中有註明。

## 分鏡

### 3 分鐘介紹片（`intro/`）

| 景 | 秒 | 畫面 | 內容 |
|---|---|---|---|
| `i01_open` | 9 | 運鏡 `aerial_open` | 開場：從高空旋轉降下看整層樓 |
| `i02_team` | 8 | 字卡 | 12 位代理人各做各的 → 同一間 3D 辦公室 |
| `i03_ui` | 9 | 介面截圖 | 介面導覽，7 個編號 |
| `i04_fly` | 14 | 運鏡 `corridor` | 沿走廊飛一圈，房間名稱標籤跟著畫面跑 |
| `i05_office` | 10 | 運鏡 `office` | 團隊辦公室：雙螢幕、升降桌（水門站起來）、白板 |
| `i06_screen` | 10 | 運鏡 `screen` | 從水門背後推近看他的兩個螢幕 |
| `i07_panel` | 9 | 運鏡 `panel` | 點人物 → 選單 → 打開工作紀錄側欄 |
| `i08_circle` | 10 | 運鏡 `circle` | 切換圓框模式，12 人狀態一次看完 |
| `i09_interact` | 10 | 運鏡 `interact` | 點綱手：打招呼、站著工作 |
| `i10_states` | 6 | 字卡 | 8 種狀態各自去哪裡 |
| `i11_call` | 8 | 議程截圖 | 老闆發起會議 |
| `i12_meet` | 10 | 運鏡 `meetroom` | 會議室發言泡泡（依真實發言重現） |
| `i13_proposals` | 8 | 會議紀錄長圖 | 18 則發言、9 個提案 |
| `i14_vote` | 8 | 字卡 | 投票：B+ 10、D 8、A 3、C 1（全片唯一的戲劇景） |
| `i15_decide` | 9 | 運鏡 `projector` | 結論投在會議室投影幕 → 核准 A・B+・D |
| `i16_beforeafter` | 9 | 截圖 | 改造前後 |
| `i17_bplus` | 11 | 運鏡 `bplus` | B+ 會議／試播室：看板牆 → 試播投影、直立副螢幕 |
| `i18_studio` | 10 | 運鏡 `studio` | D 錄課棚：ON AIR → 收音桌、9:16 拍攝位 |
| `i19_booth` | 9 | 運鏡 `booth` | A 電話亭：紅燈＝通話中，走廊另一端也有一間 |
| `i20_loop` | 7 | 字卡 | 第 9 週教材：決議 → 指令 → 回報 |
| `i21_end` | 8 | 運鏡 `aerial_end` | 結尾 |

### 45 秒 Shorts（`shorts/`）

字都放在畫面上半部：Shorts 下方約四分之一與右側會被 YouTube 的標題、按鈕蓋住。

| 景 | 秒 | 畫面 | 內容 |
|---|---|---|---|
| `v01_hook` | 6 | 運鏡 `p_aerial` | 12 位 AI 代理人，在同一間 3D 辦公室上班 |
| `v02_office` | 5.5 | 運鏡 `p_office` | 每個團隊一間辦公室 |
| `v03_screen` | 5.5 | 運鏡 `p_screen` | 看他的螢幕（卡卡西） |
| `v04_circle` | 6 | 運鏡 `p_circle` | 一鍵切換圓框 |
| `v05_meet` | 6.5 | 運鏡 `p_meet` | 有事就開會（依真實發言重現） |
| `v06_vote` | 5.5 | 字卡 | 投票結果＋老闆核准 |
| `v07_upgrade` | 7 | 運鏡 `p_studio`＋`p_booth` | 辦公室真的改了 |
| `v08_end` | 5.8 | 字卡＋運鏡 | 結尾 |

## 檔案

| 檔案 | 做什麼 |
|---|---|
| `motion.js` | 逐格錄影工具：看板載完後切成虛擬時鐘，每格推進 1/30 秒、照鏡頭路徑擺好鏡頭再截圖；畫游標、真的送出點擊；把 3D 點投影到畫面存成 `track.json`；隱私遮罩 |
| `shots.js` | 鏡頭表（橫式 13 段、直式 7 段運鏡＋1 張介面截圖），每段各開一次看板，可單獨重拍 |
| `lib.py` | 場景版面、運鏡畫面播放器、跟著 3D 位置跑的標籤 |
| `build.py` | 產生場景：更新截圖素材，再執行 `build_intro.py`、`build_shorts.py` |
| `render.js` | 逐格渲染每一景成 MP4（虛擬時鐘，畫面平順、可重現） |
| `assemble.py` | 轉場串接成片，可加配樂 |
| `capture.js`、`capture_drawers.js`、`stitch.py` | 拍靜態截圖：改造前後的樓層（`floor`、`old`）、會議議程與紀錄長圖（`agenda`、`meeting`） |
| `assets/` | 靜態截圖 |

`work/`（運鏡畫面、渲好的各景、成片）、`raw/` 不在 repo 裡。

## 從頭做一次

需要 Node 與 `playwright`、Python 3 與 `Pillow`、ffmpeg。字型用 Noto Sans TC（沒裝時退回文泉驛正黑，字會比較粗糙）。

1. repo 根目錄開看板：`python3 -m http.server 8765 --bind 127.0.0.1`
2. 拍運鏡畫面（4 核心約 15 分鐘）。要兩支片用同一份資料，先存一份快照再固定時間：

   ```bash
   curl -sL "<config.js 的 endpoint>" -o /tmp/feed.json
   FEED=/tmp/feed.json NOW=2026-11-03T12:12:00+08:00 node shots.js --jobs 4
   ```

   只想先看構圖：`node shots.js --preview corridor`（存在 `work/preview/corridor/`）。
3. 產生場景：`python3 build.py`
4. 渲染（4 核心：介紹片約 25 分鐘、Shorts 約 6 分鐘），渲完逐張看 `work/intro/check_*.png`、`work/shorts/check_*.png`：

   ```bash
   node render.js intro/storyboard.json --jobs 4
   node render.js shorts/storyboard.json --jobs 4
   ```

5. 串接：

   ```bash
   python3 assemble.py intro/storyboard.json --out work/agent-office-intro.mp4
   python3 assemble.py shorts/storyboard.json --out work/agent-office-shorts.mp4
   ```

   加配樂：`--music bgm.mp3`，或 `--music default` 用 intro-video 技能附的預設曲（環境變數 `INTRO_VIDEO_SKILL` 指向技能資料夾）；想小聲一點加 `--loudness -20`。

## 小改

- **改字**：改 `build_intro.py`／`build_shorts.py`，`python3 build.py`，只重渲那一景（例如 `node render.js intro/storyboard.json --only i08_circle`），再串接。
- **改鏡頭**：改 `shots.js` 的路徑（`S(x, y, 高度)` 是場景座標：x 往東、y 往北），`--preview` 看構圖，再 `--only <鏡頭>` 重拍。
- **重拍靜態截圖**：照舊版步驟，`capture.js` 需要改造前的版本（commit `9708e32`）開在 8766 port；不重拍改造前就設 `SKIP_OLD=1`。
  接著 `node capture_drawers.js`、`python3 stitch.py`，打開 `raw/check_links.png` 確認看不到 `sk=` 之類的網址，再 `python3 build.py`。

## 隱私

- 側欄標題的 email 一律模糊；內文裡的 email 與「@帳號」模糊、網址用色塊遮住（`motion.js` 的 `installBlur`，看板重繪後會再套一次）。重拍時不要拿掉。
- 會議議程裡有一條帶分享金鑰的舊網址，`assets/agenda.jpg` 已遮住。
- 3D 座位螢幕會顯示代理人的工作主題與內容，這部分沒辦法遮；選特寫對象時挑內容沒有網址的人（目前是水門、卡卡西）。

舊版 1 分 52 秒的單支導覽影片（15 景）在 git 歷史裡（commit `3ec0216`）。
