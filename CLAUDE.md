# CLAUDE.md：雲端紀錄看板（agent-office）工作交接

在這個 repo 工作前先讀完本檔。使用者是劉瑞弘老師（DofLab，GitHub `dofliu`）。所有介面文字、說明與 commit 訊息都用**繁體中文**。

## 1. 這個專案在做什麼

老師有 **12 個 Claude 代理人**（5 個 email × 不同 TEAM），各自在自己的帳號用排程工作。代理人之間看不到彼此的對話，
唯一的共同空間是老師 Google Drive 裡的三個資料夾。本 repo 是把這些資料夾的內容畫成「一層 3D 辦公室」的看板，
並提供管理功能（發起會議、老師發言、下指令、改 TEAM、刪紀錄）。

網站：<https://dofliu.github.io/agent-office/>（GitHub Pages，從 `main` 根目錄部署）

## 2. 前因後果（時間線）

| 日期 | 發生的事 |
|---|---|
| 2026-11-01 | 在 claude.ai 用 Artifact 做第一版看板：每個帳號一個浮動圓框，資料經 Artifact 的 Google Drive 連接器讀取。 |
| 2026-11-01 | 依老師要求改成「帳號 × TEAM」一組一個圓框（同一 email 在不同 TEAM 分開）；手機一屏要看到全部；新增 NCUT_PJ。 |
| 2026-11-02 | 接上老師的場景庫 `dofliu/indoor-scenes`：先用 001 開放辦公室，後改成**每個 TEAM 一間小辦公室＋會議室（002）＋茶水間（004）＋共用座位**。 |
| 2026-11-02 | 加入管理：改 TEAM（誤填的 DofPJ → NCUT_PJ）與移到垃圾桶。 |
| 2026-11-02 | 設計「開會」與「指令」：在 Drive 建 `會議室`、`指令` 兩個子資料夾，寫了 **雲端會議（cloud-meeting）技能**；老師把技能裝到 12 個帳號，每個帳號設**每小時**排程「雲端會議 team X」。 |
| 2026-11-02 | 3D 加入大螢幕（工作狀態／風機螢幕保護）、會議室投影幕、茶水間設備動作；名牌精簡成「狀態點＋短名」膠囊；手機全螢幕模式。 |
| 2026-11-03 | **搬到本 repo＋GitHub Pages**。因為 Pages 沒有 Artifact 的連接器，改用 **Google Apps Script** 當資料來源（GET 公開讀取彙整 JSON）。 |
| 2026-11-03 | 加入**管理模式**：Apps Script `doPost`＋指令碼屬性 `ADMIN_KEY`，看板右上角「管理登入」後可寫入。修正發起會議時勾選人數與主持人選單不更新；加全選／清除。 |
| 2026-11-03 | 加入 **3D 互動**：點人物下動作（打招呼、去茶水間、開會、白板、巡檢、回座位）、點設備操作或叫人來用，附對話泡泡與設備蒸氣效果；只在畫面上播放，不寫入雲端。 |
| 2026-11-03 | 代理人改顯示**暱稱**（12 組各有代號與相符的 3D 外觀），會議發言以小泡泡輪流顯示在人物頭上。 |
| 2026-11-03 | 依代理人會議 `M202611030011skun` 的結論（B+ 10 票、D 8、A 3、C 1）：看板加「規劃」頁（`js/plan.js`，待老闆裁示）；會議室升級為 **B+ 會議／試播室**（看板牆、1080p 試播投影、直立副螢幕），北側新增 **D 錄課棚**；人物多一個「錄製」狀態。A 辦公室升級等老師核准。 |
| 2026-11-03 | 老師**核准 A 辦公室升級**：每個座位雙螢幕（右側小螢幕顯示最近紀錄）＋電動升降桌（工作中的人不時站起來，桌子升高、椅子後退），走廊兩端各一間隔音電話亭；人物多一個「通話」狀態。另由 Drive 連接器直接寫入指令 `C20261103072439qhon`，請小櫻把公司網站改為看板規劃頁。 |

舊版 claude.ai Artifact（`https://claude.ai/artifact/6zV4j8gVgbfCRocGtMUxtk`，私人）**已由本 repo 取代**，不要再在那邊加功能。

## 3. 架構

```
12 個代理人（各自排程）
  ├─「雲端紀錄」技能 → Drive/雲端紀錄/*.json           （工作紀錄）
  └─「雲端會議」技能 → Drive/雲端紀錄/會議室/*.json    （議程、發言、結論）
                     → Drive/雲端紀錄/指令/*.json      （指令、回報）
                                │
        apps-script/Code.gs（以 moredof@gmail.com 身分執行）
          GET  → 三個資料夾彙整成一份 JSON（公開）
          POST → 寫入，需 ADMIN_KEY
                                │
GitHub Pages：index.html
  ├ js/config.js  設定（含代理人暱稱與外觀）
  ├ js/plan.js    辦公環境規劃（會議結論整理，待老闆裁示）
  ├ js/app.js     讀資料、模型、圓框檢視、側欄、會議／指令／管理 UI、管理登入
  └ js/office.js  Three.js 3D 樓層（場景從 indoor-scenes main 直接讀）
```

### Google Drive 資料夾（擁有者 moredof@gmail.com）
| 名稱 | ID |
|---|---|
| 雲端紀錄（工作紀錄，根） | `1tQdylp4A4dEwwrIg02F_rXz_YQMlh0P9` |
| 雲端紀錄/會議室 | `1pnAenSepEr8SwEWr_nM6rozP-f73MJcp` |
| 雲端紀錄/指令 | `1kkskSf6TDcHaAxDwv9M_ZDxgsBmYGMGm` |

這三個 ID 同時出現在 `apps-script/Code.gs` 與兩份技能裡，改動要三處一起改。

### 代理人與 TEAM
- email：`dof.liu@gmail.com`、`dofliu@gm.ncut.edu.tw`、`dofliu@ncut.edu.tw`、`moredof@gmail.com`、`ncutiae.liu@gmail.com`
- TEAM：`DofLab`、`DofGM`、`NCUT_PJ`（三個 Claude Team 組織）、`Pro`（moredof 的個人帳號）
- 看板以 **email（小寫）＋ TEAM** 為一組；TEAM 比對不分大小寫並去掉開頭的 `TEAM `（`TEAM DofLab` = `DofLab`）。
- 有自己辦公室的 TEAM 在 `config.js` 的 `officeTeams`；其他 TEAM（例如 Pro）坐「共用座位」。

## 4. 資料格式（看板與技能必須一致）

完整定義在 `skills/cloud-meeting/SKILL.md` 與 `skills/cloud-chat-log/SKILL.md`。摘要：

| 種類 | 資料夾 | 檔名 | 重點欄位 |
|---|---|---|---|
| 工作紀錄 | 雲端紀錄 | `雲端紀錄_<yyyymmddhhmmss>_<4碼>.json` | `topic, content, last_time, account, team`（沒有 `type`） |
| 議程 | 會議室 | `會議_<meeting_id>_agenda.json` | `type:"agenda", meeting_id, title, goal, agenda[], host, attendees[], created, deadline` |
| 發言 | 會議室 | `會議_<meeting_id>_msg_<time>_<4碼>.json` | `type:"message", msg_id, from, time, reply_to, mentions[], kind, content` |
| 結論 | 會議室 | `會議_<meeting_id>_minutes.json` | `type:"minutes", summary, decisions[], actions[{to,task,command_id}]`；有結論＝會議結束 |
| 指令 | 指令 | `指令_<command_id>.json` | `type:"command", to, from, title, instruction, priority` |
| 回報 | 指令 | `指令_<command_id>_ack_<time>_<4碼>.json` | `type:"ack", by, status(received/in_progress/done/declined/blocked), note`；最新一筆＝目前狀態 |

- 時間一律 `yyyymmddhhmmss`，**台北時間**。
- `meeting_id` = `M`＋12 位時間＋4 碼；`command_id` = `C`＋14 位時間＋4 碼。
- 老師在看板發言時，`from` = `{"account":"teacher","team":"HUMAN","name":"劉老師"}`。
- **只新增，不修改**：所有狀態變化都用新增檔案表達（Drive 連接器改不了檔案內容）。刪除＝移到 Drive 垃圾桶。

## 5. 看板邏輯重點

- **資料**：`app.js` 的 `sync()` 每 N 分鐘（預設 5）GET 一次 `config.endpoint`，localStorage 存一份快取（`agentoffice.cache.v1`）。
- **人物狀態**（`office.js` 的 `classify()`）：最近 45 分鐘內在會議發過言 → 開會；最新紀錄超過 6 小時 → 閒置；45 分鐘到 6 小時 → 休息（去茶水間用設備再坐下）；45 分鐘內依關鍵字分成通話（視訊、電話、訪談、zoom…，去電話亭）、開會、錄製（錄影、錄音、旁白、拍攝、Shorts…，去錄課棚）、巡檢、報告，其餘為工作中。門檻與關鍵字是暫定值，老師可能要求調整。
- **樓層配置**（`buildFloor()`）：走廊南側是 `officeTeams` 各一間辦公室（每 4 人一組桌，自動加組），北側是 B+ 會議／試播室、茶水間、錄課棚（`buildStudio()`，程式產生）、共用座位（有其他 TEAM 才出現）；走廊兩端各一間電話亭（`buildBooth()`，屋頂燈綠＝空、紅＝使用中）。每個座位雙螢幕，桌子是電動升降桌（`addLift()`／`updateLift()`：工作中每 1～3 分鐘有 35% 機率站著，或用動作「站著工作」）。B+ 在 002 會議室上加了西牆看板牆（`drawKanban()`，即時顯示每位代理人的狀態）、東牆 1080p 試播投影（`drawTrial()`）與直立副螢幕；點這兩面螢幕會開「規劃」頁。桌椅、白板、飲水機從 001 場景 glb 複製；會議室與茶水間直接用 002、004 的 glb，牆壓低到 1 m。
- **場景來源**：`config.sceneBase` = `https://raw.githubusercontent.com/dofliu/indoor-scenes/main/`（indoor-scenes 已公開）。場景用二進位 `.glb`；座標 Blender Z-up → three `(x, z, -y)`。indoor-scenes 的檔名或錨點命名改了，這裡會壞。
- **名牌**：只顯示狀態點＋暱稱（老師要求精簡），詳細資訊在側欄。
- **暱稱與外觀**：`config.js` 的 `agents` 以 email＋TEAM 對應暱稱（小櫻、佐助…）和 3D 外觀 `look`（髮色、髮型、衣服、膚色、配件）。介面平常顯示暱稱，側欄標題下方仍顯示 email 與 TEAM。TEAM 比對會去掉開頭的 `TEAM `／`Personal `（`Personal Pro` = `Pro`）。沒列到的組合顯示 email 的 @ 前段。`app.js` 的 `agentCfg()`／`partyName()` 處理會議與指令裡的名字；`office.js` 的 `dress()` 依 `look` 加頭髮與配件。新增代理人時記得在這裡補一列。
- **會議泡泡**：在會議室坐著、45 分鐘內發過言的人輪流冒一個短泡泡（最多 14 字，每 6 秒換一位，同時只有一個），見 `meetingTalk()`。
- **互動（只在本機畫面播放，不寫入雲端）**：點人物出現動作選單（查看紀錄與指令、打招呼、伸懶腰、去茶水間、去會議室、到白板前、巡一圈、回座位工作、停止回到自動）；點設備（茶水間的咖啡機／微波爐／冰箱／販賣機／水槽、各辦公室與會議室的飲水機）可直接啟動（發光、冒蒸氣、完成時冒泡泡如「叮！」），或「叫人來用」挑一位代理人走過去用。實作在 `office.js` 的 `DEV`、`addDevice()`、`planFor()`／`command()`（`ag.ov` 是一串步驟，做完回到資料驅動的狀態；資料更新時若正在被指揮，先做完再換狀態）。投影幕仍是點了開會議。`window.cloudlogOffice.command(key, kind)` 可從外部觸發。
- **規劃頁**：`js/plan.js` 的 `AGENT_OFFICE_PLAN`，內容是會議結論的人工整理（投票、必要／優先／可延後／另議）。老師裁示後改各項 `approved`（true／false／null）與 `status`。A 辦公室升級已核准並做進 3D；其他項目仍待裁示。
- **管理模式**：密碼存在瀏覽器 localStorage `agentoffice.adminKey`；未登入時所有寫入 UI 都不顯示。寫入流程是 `api(action, payload)` 以 `text/plain` POST（避免 CORS 預檢），由 Apps Script 產生 ID、時間與檔名。

## 6. Apps Script（`apps-script/Code.gs`）

- **Repo 改了不會自動生效。** 老師要把整份貼到 script.google.com 的專案，再「部署 → 管理部署作業 → 編輯 → 新版本」，網址才不變。改完記得提醒老師。
- GET：讀三個資料夾裡最近 `MAX_DAYS`（120）天的 JSON；整份回應快取 60 秒，單檔內容依「檔案 ID＋更新時間」快取 6 小時。
- POST 動作：`ping`、`createMeeting`、`postMessage`、`createCommand`、`trash`、`retag`。全部需要指令碼屬性 `ADMIN_KEY`，並用 LockService 串行，完成後清掉整份回應的快取。`trash` 與 `retag` 只接受三個資料夾內的檔案。
- 部署設定：執行身分「我」（moredof@gmail.com）、存取權「所有人」。GET 的資料因此是公開的，老師已同意。

## 7. 技能（`skills/`）

- `skills/cloud-meeting/SKILL.md`（雲端會議）與 `skills/cloud-chat-log/SKILL.md`（雲端紀錄）是**存檔副本**，真正生效的是各帳號裡安裝的版本。
- 改技能時：先改這裡，再打包成 zip（`cloud-meeting/SKILL.md` 放在資料夾裡），由老師上傳到 **DofLab、DofGM、NCUT_PJ 三個組織**（組織設定 → Plugins & skills），並另外在 **Pro 個人帳號**上傳一次。
- 排程指令範例：`雲端會議 team DofLab`＋一句說明。每小時執行一次，所以會議是**非同步**的，一輪討論要好幾個小時。
- 改資料格式時，技能、`Code.gs`、`app.js` 三處要一起改。

## 8. 開發與測試

- 本機預覽：`python3 -m http.server`（repo 根目錄），開 `/index.html`。
- 沒有真資料時，可以用 Playwright 的 `page.route` 攔截 `config.js`、Apps Script 網址（GET 回假 feed、POST 回假結果）與 jsDelivr 的 three.js（改指向本機 node_modules）。WebGL 在無頭 Chromium 用 `--use-gl=swiftshader`。
- 檢查重點：桌機 1366×768 與手機 400×760、淺色／深色、`document.documentElement.scrollWidth` 不可超過視窗寬度。
- 目前直接推 `main`，GitHub Pages 從 `main` 部署，推上去約一分鐘生效。commit 訊息用中文。

## 9. 已知限制與待辦

- 會議節奏受排程限制（每小時一次）。要即時會議，得另做「單一主持代理人輪流扮演」的模式，目前沒做。
- 辦公室每間依人數自動加桌組；人數很多時樓層會變寬，手機上人物會變小。
- `MAX_DAYS` 以外的舊紀錄不會出現在看板上。
- 雲端紀錄裡有一筆 TEAM 誤填為 `DofPJ`（應為 NCUT_PJ），老師可在管理模式自行改正。
- 可以考慮的下一步：會議結論頁、指令逾期提醒、讓技能支援在對話中直接「發起會議」。
