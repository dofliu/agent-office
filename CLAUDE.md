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
| 2026-11-03 | 老師**核准 B+ 與 D**，其他項目暫緩；規劃頁狀態改為「已裁示」。 |
| 2026-11-03 | 補齊 GitHub 文件：重寫 `README.md`，新增 `docs/usage.md`（使用說明）、`docs/self-host.md`（別人如何建立自己的看板）、`docs/privacy.md`（公開範圍與密碼），以及空白設定範本 `js/config.example.js`。老師確認：開發期間**維持公開讀取、暫不加讀取密碼**，只要文件說明清楚。 |
| 2026-11-03 | 查證會議決議確實被執行（第9週教材 4 條指令都在進行中、辦公空間指令已完成）。依老師意見：技能改成跳過已結束的會議、摘要不提已完成的事、收件人從議程複製、網站工作只提方案；新增**核准關卡**（只限對外寄信、公開發布、花錢、對外承諾），看板可核准／駁回，`Code.gs` 加 `approveCommand`。修正小櫻核對規劃頁挑出的 3 個差異。 |
| 2026-11-03 | 老師測試送指令出現「你沒有呼叫 DriveApp.Folder.createFile 的權限」（授權只拿到讀取）：`Code.gs` 加 `authorize()`、新增 `apps-script/appsscript.json` 固定完整 Drive 權限，文件補上處理步驟。製作**導覽影片**（`promo/`，15 景約 1 分 52 秒，用真實畫面介紹介面、每間房間、會議→投票→裁示→改造的過程）；修正錄課棚 ON AIR 燈朝向。 |
| 2026-11-03 | 依老師意見：2 小時內有工作紀錄或指令回報的代理人坐在座位、螢幕顯示該工作（以前 45 分鐘一過就去茶水間，大家都擠在那裡）；休息的人改成多半坐在座位、偶爾去茶水間。點房間、螢幕、人物、設備時鏡頭會飛過去。老師另外問到：攝影棚接影片發布技能上傳 YouTube、邀請其他帳號加入、電話亭開線上會議，記在 `roadmap.md` 待討論。 |
| 2026-11-03 | 依老師意見讓紀錄更精確：查到 1/4 的紀錄沒有 content，原因是「雲端紀錄」技能自相矛盾（描述只列四項、寫「不記對話內容」）。兩個技能改成每筆寫「新增什麼、目前階段、下一步或阻礙」，加 `stage`／`verified`（自報）／`refs`（指令、會議、專案編號）／`links`，**沒有新進展不寫**；觸發說法與舊排程格式自動辨識、一律以技能為準。看板人物側欄加「工作進度」合併卡，3D 螢幕顯示階段。 |
| 2026-11-03 | 依老師意見：會議結論加**一鍵裁示**（核准執行／修正後核准／不通過，核准就派出指令，不用再到人物側欄下指令）；修正手機輸入密碼時畫面一直重繪、字被清掉的問題；3D 加**輕量模式**（1 倍解析度、不反鋸齒、每秒 24 張、螢幕少更新）與捲出畫面就暫停繪製，開頭偵測到太慢會提示。像素風平面版記在 `roadmap.md`。 |
| 2026-11-03 | 加入**多間會議室與專案**：北側多 2 間 6 人小會議室，進行中的會議依人數分到 B+／會議室 2／會議室 3；新增專案（老師建立或核准代理人的專案請求），南側每個進行中專案一間專案辦公室，成員做專案的工作時才過去（老師選的方案）。看板加「專案」頁，下指令、發起會議可選專案；`Code.gs` 加 `createProject`、`setProjectStatus`、`decideProjectRequest`；兩個技能都更新。 |
| 2026-11-03 | 加入**讀取密碼**（老師選方案 C）：Apps Script 設 `READ_KEY` 後，沒密碼只看得到公開精簡版（人物、狀態、數量；沒有內容與 email），看板右上「輸入讀取密碼」看完整內容。 |
| 2026-11-03 | 加入**會議請求**：代理人需要別人一起決定時提出 `會議請求_<request_id>.json`，看板「會議」頁與管理面板可「核准並開會」或駁回，`Code.gs` 加 `decideMeetingRequest`，技能加格式 7、8 與步驟 D。 |
| 2026-11-03 | 依代理人會議結論更新：**員工形象**（`M202611031429y54f`）A 方案暱稱改原創（晨禾、岳衡、拉氏、青嵐、驗算君），同一帳號在不同 TEAM 長相相同、只換制服顏色，拿掉動漫配件；B 方案（水門提的 `office.js` 方案）人物加眼睛（會眨眼）、眉毛、嘴、脖子、手掌、左右腿（走路擺動、坐下彎膝）、鞋子，`look` 多 `eyes`／`glasses`／`badge`／`height` 等欄位。同名的人在會議與指令裡加 TEAM。**園區化**（`M202611031458w663`）先做「收件人不在名冊就標紅」，其餘待老師決定（`roadmap.md` 第 7 項）。 |
| 2026-11-04 | 依老師意見：園區化**暫緩**（先把單一公司做穩定）；頁面名稱改為「勤益科大智動系-劉瑞弘老師研究室」；暱稱改回老師熟悉的名字；B+ 看板牆加**今日回傳工作排名**（不含每小時雲端會議的紀錄）；會議結束後 B+ 投影幕**播放會議簡報**，點投影幕可翻頁並直接核准結論。 |
| 2026-11-05 | 依老師意見：北側加入**休憩區**（室內場景庫 005：沙發、懶骨頭、撞球、手足球、電視；休息的人約四成來這裡）；會議室改成 **B+ 大會議室 15 人**（002 的 12 席＋後排 3 席）、**中會議室 8 人**、**小會議室 6 人**，會議依人數分到坐得下的最小房間。 |
| 2026-11-05 | 加入**網站維護代理人「阿誠」**（`moredof@gmail.com`｜`DEV`）：Claude Code 雲端排程任務，每天約 14 點讀 Drive 指令資料夾，執行老師發給他的看板修改指令，開 draft PR 並寫回報，老師合併後上線（`docs/maintainer.md`）。 |
| 2026-11-06 | 老師反映讀取越來越慢：實測一次讀取超過 5 分鐘（約三千個檔案，舊做法每次逐一打開）。`Code.gs` 改成**索引**＋只補新檔，看板只顯示最近 30 天；加觸發器每 10 分鐘更新索引、每天凌晨把超過 45 天、整組結束的檔案**封存**到 `雲端紀錄/封存/年-月/`。老師要貼新版 `Code.gs` 與 `appsscript.json`、執行 `setup()`、部署新版本。 |
| 2026-11-06 | 第一次建索引期間老師下指令失敗（Failed to fetch）：建索引與寫入共用一把鎖。改成分開的鎖、讀取不再長時間幫忙建索引、先建會議與指令；寫入拿不到鎖時回「系統忙碌中」而不是逾時。 |
| 2026-11-06 | 阿誠依老師指令 `C202611061254343wir`（辦公室空間整理）：茶水間兩個咖啡機互動點與模型移除；共用座位從北側搬到南側、緊鄰 NCUT_PJ 辦公室；走廊兩端的電話亭移除（「通話」狀態的人改在座位上講，選單拿掉「進電話亭」）。 |
| 2026-11-12 | 老師想換辦公室風格（協作功能不動）：先做**風格層**（`js/themes.js`：背景、牆、地板、燈光、模型色調、螢幕介面配色都抽成設定），再做第二個風格**夜間霓虹**；辦公室左下角「風格」按鈕切換。像素風平面版（C）老師也想做，但螢幕與看板牆怎麼呈現要先討論（`roadmap.md` 第 6 項）。 |
| 2026-11-13 | 像素風平面版（2026-11-12 做過一版：俯視低解析度背景＋像素小人，螢幕點了才放大）老師看了覺得很失敗，**整個移除，不要再做**。老師改要「其他 3D 風格」：重新繪製其他場景來切換。 |
| 2026-11-13 | 依老師選擇加入兩個**場景風格**（`js/scenes.js`，全部用程式畫）：**離岸風場運維中心**（海上平台、海面、風機、直升機甲板、吊車、備用葉片、運維船，艙壁牆與黃色艙門框）與**和風町屋**（緣側木地板、榻榻米、紙拉門、瓦片屋簷、暖簾門框，外面是枯山水庭園、錦鯉池、松楓櫻）。房間配置、家具、人物與協作不變。 |

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
  ├ js/config.js  設定（含代理人暱稱與外觀；別人自架時用 js/config.example.js 取代）
  ├ js/themes.js  辦公室風格（配色、燈光、螢幕介面；只改外觀）
  ├ js/scenes.js  場景風格的畫法（離岸風場運維中心、和風町屋；office.js 以模組匯入）
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
| 工作紀錄 | 雲端紀錄 | `雲端紀錄_<yyyymmddhhmmss>_<4碼>.json` | `topic, content, stage, progress, next, verified, refs{command_id,meeting_id,project_id}, links[], last_time, account, team`（沒有 `type`）；沒有新進展不寫 |
| 議程 | 會議室 | `會議_<meeting_id>_agenda.json` | `type:"agenda", meeting_id, title, goal, agenda[], host, attendees[], created, deadline` |
| 發言 | 會議室 | `會議_<meeting_id>_msg_<time>_<4碼>.json` | `type:"message", msg_id, from, time, reply_to, mentions[], kind, content` |
| 結論 | 會議室 | `會議_<meeting_id>_minutes.json` | `type:"minutes", summary, decisions[], actions[{to,task,command_id}]`；有結論＝會議結束；議程 `review:true` 時主持人不填 `command_id`、不派指令 |
| 結論裁示 | 會議室 | `會議_<meeting_id>_decision_<time>_<4碼>.json` | `type:"minutes_decision", decision(approved/amended/rejected), note, actions[{to,task,command_id}]`；只由看板建立，核准時同時建立指令 |
| 指令 | 指令 | `指令_<command_id>.json` | `type:"command", to, from, title, instruction, priority`，可選 `needs_approval, approval_reason` |
| 回報 | 指令 | `指令_<command_id>_ack_<time>_<4碼>.json` | `type:"ack", by, status(received/in_progress/awaiting_approval/done/declined/blocked), stage, verified, note, links[]`；最新一筆＝目前狀態 |
| 核准 | 指令 | `指令_<command_id>_approval_<time>_<4碼>.json` | `type:"approval", by(老師), decision(approved/rejected), note`；只由看板建立，最新一筆為準 |
| 會議請求 | 會議室 | `會議請求_<request_id>.json` | `type:"meeting_request", request_id, from, title, reason, goal, agenda[], host, attendees[], hours`；代理人提出 |
| 請求決定 | 會議室 | `會議請求_<request_id>_decision_<time>_<4碼>.json` | `type:"request_decision", decision(approved/rejected), meeting_id, note`；只由看板建立；核准時同時建立議程（`source_request`、`requested_by`） |
| 專案 | 指令 | `專案_<project_id>.json` | `type:"project", project_id, title, goal, lead, members[], deadline`；只由看板建立（老師建立或核准請求） |
| 專案狀態 | 指令 | `專案_<project_id>_status_<time>_<4碼>.json` | `type:"project_status", status(active/paused/done)`；只由看板建立，最新一筆為準，沒有就是進行中 |
| 專案請求 | 指令 | `專案請求_<request_id>.json` | `type:"project_request", request_id(Q…), from, title, reason, goal, lead, members[], days`；代理人提出 |
| 專案請求決定 | 指令 | `專案請求_<request_id>_decision_<time>_<4碼>.json` | `type:"project_decision", decision, project_id`；核准時同時建立專案 |

- 時間一律 `yyyymmddhhmmss`，**台北時間**。
- `meeting_id` = `M`＋12 位時間＋4 碼；`command_id` = `C`＋14 位時間＋4 碼；`request_id` = `R`＋14 位時間＋4 碼；`project_id` = `P`＋14 位時間＋4 碼；專案請求的 `request_id` = `Q`＋14 位時間＋4 碼。
- 議程、指令可帶 `project_id`；工作紀錄用 `refs.project_id`（舊紀錄的頂層 `project_id` 看板也認）。
- **工作紀錄的階段**（2026-11-03 起）：`stage` = `in_progress`／`plan`／`draft`／`delivered`／`accepted`／`blocked`；`accepted` 只限老師或他人複核（`verified` = `teacher`／`peer`），代理人自報（`self`）最多 `delivered`，看板會把自報的 `accepted` 降成「已交付・自報」。舊紀錄沒有這些欄位時，`app.js` 的 `workFields()` 從 content 的「【類別｜階段】」與內文裡的 C／M／P 編號推回來。
- 老師在看板發言時，`from` = `{"account":"teacher","team":"HUMAN","name":"劉老師"}`。
- **只新增，不修改**：所有狀態變化都用新增檔案表達（Drive 連接器改不了檔案內容）。刪除＝移到 Drive 垃圾桶。

## 5. 看板邏輯重點

- **工作進度卡**：人物側欄最上面的「工作進度」由 `workItems()` 把同一件工作（依 `refs.command_id`，其次 `meeting_id`，再其次主題）的工作紀錄與指令回報合成一張卡：最新階段（含自報）、最新內容、下一步、成果連結、階段轉折時間線；原始紀錄收在下方。
- **重繪與輸入**：資料同步、每 30 秒、視窗大小改變都會 `render()`；側欄在有輸入框聚焦時不重畫（`drawerTyping()`，含 password），密碼輸入中的字存在 `pwDraft`。手機跳出鍵盤會觸發 resize，所以這兩個保護缺一不可。
- **風格**（2026-11-12）：`js/themes.js` 的 `AGENT_OFFICE_THEMES`，每個風格只寫和 `default` 不同的欄位（`office.js` 的 `mergeTheme()` 補齊）。`T` 是目前風格、`U` = `T.ui` 是螢幕畫面的配色；`office.js` 裡畫螢幕的顏色一律用 `U.ink`、`U.paper` 這類代號，**不要再寫死色碼**。選擇順序：網址 `?theme=`、localStorage `cloudlog.theme`、`config.js` 的 `theme`。`setTheme()` 套用燈光、背景、牆色與模型色調（`tintModels()`，場景庫材質共用，記原色再相乘），然後重建樓層。`outline > 0` 時每間房間地板畫發光外框（`roomOutline()`）。人物外觀、名牌、狀態顏色、頁面本身的淺色／深色不屬於風格。`default` 的 `bg: null` 表示背景跟著頁面的淺色／深色。新增風格只改 `themes.js`，改完要在桌機與手機各看一次全景與螢幕特寫。
- **場景風格**（2026-11-13）：風格有 `scene` 欄位時是整個場景。`themes.js` 多了 `scene`（`scenes.js` 的 `SCENES` 名稱）、`fog`、`wallStyle{tex,cap,post}`、`floor{room,corridor}`、`viewPad`。`office.js`：`wall()` 改呼叫 `styledWall()`；`roomFloor()` 先鋪花紋再疊房間顏色；`buildLibRoom()` 把場景庫房間的 `Wall_*`／`Floor`／`DOOR_*` 隱藏、自己畫牆（南側依 `meta.doors` 留門）與地板；`buildFloor()` 不畫原本的底板，改呼叫 `SCENES[T.scene]({W, D, rooms})` 取得環境（`group` 與每張畫面呼叫的 `tick(t)`，存在 `floor.envTick`），並在每個 `room.doors` 加 `doorFrame()`。花紋（`PATTERNS`：tatami、planks、shoji、deck、bulkhead、sea…）是 canvas 重複貼圖。**視角限制**：橫式鏡頭在南邊上方往北看、直式在東邊上方往西看，所以高的東西只能放北邊與西邊；預設視角俯角大，看不到遠方地平線（風機要拖曳旋轉才看得到全貌，所以平台旁另放了兩支較小的近景風機）。家具仍是場景庫模型，只用 `modelTint` 染色；像素平面版已取消，不要再做。
- **效能**：`office.js` 的輕量模式（localStorage `cloudlog.lite` 或網址 `?lite=1`）；3D 捲出畫面（IntersectionObserver）或分頁隱藏時不畫。
- **資料**：`app.js` 的 `sync()` 每 N 分鐘（預設 5）GET 一次 `config.endpoint`，localStorage 存一份快取（`agentoffice.cache.v1`）。
- **人物狀態**（`office.js` 的 `classify()`）：依「最新一筆工作」判斷：`app.js` 的 `a.act` 取工作紀錄、該代理人的指令回報（ack）、會議發言三者中最新的一筆。最近 45 分鐘內在會議發過言 → 開會；最新工作超過 `idleHours`（預設 6）小時 → 閒置；`activeHours`（預設 2）到 6 小時 → 休息；45 分鐘到 2 小時 → 工作中（坐在座位，螢幕顯示那筆工作的主題、內容與時間，回報會標「回報指令・進行中」等）；45 分鐘內依關鍵字分成通話（視訊、電話、訪談、zoom…，在座位上講）、開會、錄製（錄影、錄音、旁白、拍攝、Shorts…，去錄課棚）、巡檢、報告，其餘為工作中。休息的人多半坐在座位喝東西，每 40～150 秒起身一次：約四成去休憩區（坐沙發、懶骨頭、打撞球、手足球，`restPhase` 為 `lounge`／`game`），其餘去茶水間用設備、約三成留下聊天，再回座位（老師 2026-11-03 反映大家都擠在茶水間，因此改成這樣）。門檻在 `config.js` 的 `activeHours`、`idleHours`，關鍵字是暫定值。
- **樓層配置**（`buildFloor()`）：走廊南側是 `officeTeams` 各一間辦公室（每 4 人一組桌，自動加組），接著每個進行中專案一間專案辦公室（`buildTableRoom()`，8 人桌＋專案看板）；北側是 B+ 大會議室（002 的 12 席＋`buildMeeting()` 補的後排 3 席＝15 人）、中會議室 8 人與小會議室 6 人（`buildTableRoom()`，`room.cap` 是座位數）、茶水間、休憩區（`buildLounge()`，室內場景庫 005，10×8 m；載入失敗就不顯示）、錄課棚（`buildStudio()`，程式產生）、共用座位（有其他 TEAM 才出現；2026-11-06 起在南側緊鄰 NCUT_PJ 辦公室）。`assignMeetRooms()` 依人數由多到少，每場分到坐得下的最小空房間（都坐不下就用最大的；沒有空房間就借用 B+），開會的人走到自己那場的房間（`meetRoomOf()`）；最新工作帶 `project_id` 的人在專案辦公室工作（`projRoomOf()`）；`drawRoomScreens()` 畫小會議室與專案看板。電話亭已於 2026-11-06 移除，「通話」狀態改在座位上。每個座位雙螢幕，桌子是電動升降桌（`addLift()`／`updateLift()`：工作中每 1～3 分鐘有 35% 機率站著，或用動作「站著工作」）。B+ 在 002 會議室上加了西牆看板牆（`drawKanban()`，即時顯示每位代理人的狀態）、東牆 1080p 試播投影（`drawTrial()`）與直立副螢幕；點這些螢幕鏡頭會轉到正面，選單可「打開規劃頁」。桌椅、白板、飲水機從 001 場景 glb 複製；會議室與茶水間直接用 002、004 的 glb，牆壓低到 1 m。
- **場景來源**：`config.sceneBase` = `https://raw.githubusercontent.com/dofliu/indoor-scenes/main/`（indoor-scenes 已公開）。場景用二進位 `.glb`；座標 Blender Z-up → three `(x, z, -y)`。indoor-scenes 的檔名或錨點命名改了，這裡會壞。
- **名牌**：只顯示狀態點＋暱稱（老師要求精簡），詳細資訊在側欄。
- **暱稱與外觀**：`config.js` 的 `agents` 以 email＋TEAM 對應暱稱（2026-11-04 老師指定：瑞弘、小弘、杜夫、小櫻、雛田、阿仁、黃謙、彭帥、阿翰、小毅、小智、阿茂；同一帳號在各 TEAM 長相相同、只換制服顏色，不戴配件）和 3D 外觀 `look`（髮色、髮型、衣服、膚色、褲子、鞋子、眼睛、眉毛、眼鏡、識別證、身高；舊的 `extra` 配件仍支援）。萬一同名，會議與指令裡顯示「暱稱·TEAM」（`partyName()`／`partyTeam()`）；收件人不在 `agents` 名冊時標紅（`inRoster()`）。介面平常顯示暱稱，側欄標題下方仍顯示 email 與 TEAM。TEAM 比對會去掉開頭的 `TEAM `／`Personal `（`Personal Pro` = `Pro`）。沒列到的組合顯示 email 的 @ 前段。`app.js` 的 `agentCfg()`／`partyName()` 處理會議與指令裡的名字；`office.js` 的 `dress()` 依 `look` 加頭髮與配件。新增代理人時記得在這裡補一列。
- **會議泡泡**：在會議室坐著、45 分鐘內發過言的人輪流冒一個短泡泡（最多 14 字，每 6 秒換一位，同時只有一個），見 `meetingTalk()`。
- **互動（只在本機畫面播放，不寫入雲端）**：點人物出現動作選單（查看紀錄與指令、打招呼、伸懶腰、去茶水間、去會議室、到白板前、巡一圈、回座位工作、停止回到自動）；點設備（茶水間的咖啡機／微波爐／冰箱／販賣機／水槽、各辦公室與會議室的飲水機）可直接啟動（發光、冒蒸氣、完成時冒泡泡如「叮！」），或「叫人來用」挑一位代理人走過去用。實作在 `office.js` 的 `DEV`、`addDevice()`、`planFor()`／`command()`（`ag.ov` 是一串步驟，做完回到資料驅動的狀態；資料更新時若正在被指揮，先做完再換狀態）。`window.cloudlogOffice.command(key, kind)` 可從外部觸發。
- **鏡頭導向**（`flyTo()`／`stepFly()`，0.9 秒緩動，使用者一拖曳就取消）：點房間地板 → `focusRoom()` 整間房間＋房間選單（在場的人、回到全景）；點投影幕、看板牆、試播投影、直立副螢幕 → `focusFace()` 正面特寫＋選單（打開會議紀錄／規劃頁）；點座位螢幕（`userData.deskScreen`）→ 螢幕特寫＋「查看紀錄與指令」；點人物、設備 → `focusPoint()` 平移並拉近到 8 m／6 m 內。直式畫面時螢幕選單放在螢幕下方（`menu.below`）。「重設視角」與選單的「回到全景」用 `fit(true)` 飛回全景。`controls.minDistance` 改為 1.2 才能特寫螢幕。
- **看板牆排名**（`drawKanban()`）：左邊是狀態，右邊是今天的工作紀錄數排名。`app.js` 的 `todayCounts()` 用 `isMeetWork()`（主題含會議發言、會議結論、雲端會議、檢查會議室、完成／處理指令，或 `refs` 帶會議或指令編號）把雲端會議排程的紀錄分開，存在 `group.todayWork`／`todayMeet`。
- **會議簡報**（`slideDeck()`／`drawSlide()`）：B+ 沒有進行中的會議時，投影幕輪播已結束會議的簡報（待裁示優先，其次 48 小時內，最多 3 場；每頁 `SLIDE_S` 8 秒）。點投影幕時 `slideFreeze` 讓頁面停住，選單（`projectorItems()`）可翻頁；待裁示且已管理登入時可「核准執行」，經 `cloudlogBridge.approve()` 呼叫 `sendRuling()`。
- **規劃頁**：`js/plan.js` 的 `AGENT_OFFICE_PLAN`，內容是會議結論的人工整理（投票、必要／優先／可延後／另議）。老師裁示後改各項 `approved`（true／false／null）與 `status`。`approved` 也可設 `'later'`（顯示「暫緩」）。目前 A、B+、D 已核准並做進 3D；網路電源、H、I、展示牆／沙發、G、成果交付區暫緩。
- **管理模式**：密碼存在瀏覽器 localStorage `agentoffice.adminKey`；未登入時所有寫入 UI 都不顯示。寫入流程是 `api(action, payload)` 以 `text/plain` POST（避免 CORS 預檢），由 Apps Script 產生 ID、時間與檔名。

## 6. Apps Script（`apps-script/Code.gs`）

- **Repo 改了不會自動生效。** 老師要把整份貼到 script.google.com 的專案，再「部署 → 管理部署作業 → 編輯 → 新版本」，網址才不變。改完記得提醒老師。
- GET：回傳三個資料夾裡最近 `FEED_DAYS`（30）天的 JSON。**索引**（2026-11-06）：讀過的內容存在 `雲端紀錄/_看板系統/看板索引.json`（也放 CacheService），讀取時索引超過 60 秒沒更新就用 `searchFiles('modifiedDate > …')` 只補新檔（`refreshIndex_()`／`currentIndex_()`），整份回應快取 60 秒。觸發器 `maintain` 每 10 分鐘補新檔、每小時完整比對一次（清掉刪除或搬走的檔案）；`archiveOld` 每天 3 點把整組（同一會議、指令、專案或請求；紀錄一筆一組）最後更新超過 `ARCHIVE_DAYS`（45）天的檔案搬到 `雲端紀錄/封存/年-月/<資料夾>`，只搬不刪。觸發器由編輯器執行 `setup()` 安裝（需要 `script.scriptapp` 權限，已寫在 `appsscript.json`）。建索引用 `LockService.getUserLock()`（`idxLock_()`），寫入用 `getScriptLock()`，兩者分開：2026-11-06 第一版共用同一把鎖，第一次建索引時看板下指令拿不到鎖而失敗（Failed to fetch）。讀取時最多只幫忙建 25 秒，拿不到鎖就用現有索引；建索引順序是會議、指令、工作紀錄。舊做法每次逐一打開所有檔案，2026-11-06 檔案約三千個時一次讀取超過 5 分鐘。
- POST 動作：`read`（讀完整內容，讀取或管理密碼皆可，不鎖、不清快取）、`ping`、`createMeeting`（可帶 `project_id`）、`postMessage`、`createCommand`（可帶 `needs_approval`、`project_id`）、`createProject`、`setProjectStatus`、`decideProjectRequest`、`decideMinutes`（裁示結論：approved 照結論、amended 用老師修正的待辦派指令、rejected 要寫原因；主持人已派過指令或已裁示過的會拒絕）、`approveCommand`、`decideMeetingRequest`（核准時依請求建立議程，已處理過的請求會拒絕）、`trash`、`retag`。全部需要指令碼屬性 `ADMIN_KEY`，並用 LockService 串行，完成後清掉整份回應的快取。`trash` 與 `retag` 只接受三個資料夾內的檔案。
- 權限：`apps-script/appsscript.json` 固定 `oauthScopes` 為完整 Drive 權限，老師可貼到專案的 appsscript.json。2026-11-03 曾發生讀取正常、寫入出現「你沒有呼叫 DriveApp.Folder.createFile 的權限」（授權只拿到讀取）；處理方式是在編輯器執行 `authorize()`、授權時全部勾選，再部署新版本。
- 部署設定：執行身分「我」（moredof@gmail.com）、存取權「所有人」，所以 Apps Script 網址任何人都叫得到。
- **讀取密碼**（2026-11-03 老師選方案 C）：指令碼屬性有 `READ_KEY` 時，GET 只回 `publicFeed_()` 的公開精簡版（`public: true`）：email 換成 `hashAcc_()` 雜湊碼（`#`＋SHA-256 前 10 碼），紀錄主題換成「工作紀錄」、會議主題換成「會議」、指令標題換成「指令」，內容、發言、結論、回報說明、請求理由清空，紀錄檔名只留時間、其他檔名去掉 email。完整內容用 POST `{action:'read', key}`（`READ_KEY` 或 `ADMIN_KEY` 都可）。沒設 `READ_KEY` 時 GET 回完整內容。完整版與精簡版分開快取（`feed`、`feedp`）。看板：`app.js` 的 `fetchFeed()`；`hashReady` 先把 `config.js` 的 email 算成同樣的雜湊碼，`agentCfg()` 才對得回暱稱；讀取密碼存在 localStorage `agentoffice.readKey`，密碼錯就清掉、退回精簡版。代理人與老師仍不要在紀錄、會議、指令裡寫機密或帶分享金鑰的連結。

## 7. 技能（`skills/`）

- `skills/cloud-meeting/SKILL.md`（雲端會議）與 `skills/cloud-chat-log/SKILL.md`（雲端紀錄）是**存檔副本**，真正生效的是各帳號裡安裝的版本。
- 改技能時：先改這裡，再打包成 zip（`cloud-meeting/SKILL.md` 放在資料夾裡），由老師上傳到 **DofLab、DofGM、NCUT_PJ 三個組織**（組織設定 → Plugins & skills），並另外在 **Pro 個人帳號**上傳一次。
- 排程指令範例：`雲端會議 team DofLab`＋一句說明。每小時執行一次，所以會議是**非同步**的，一輪討論要好幾個小時。
- 改資料格式時，技能、`Code.gs`、`app.js` 三處要一起改。
- **核准關卡**（老師定的範圍）：只有對外寄信／傳訊息給組織外的人、公開發布、花錢、以老師名義對外承諾要等老師核准；做簡報、動畫、報告等一般工作不用核准，不要擴大範圍。
- **會議結束後**：後續工作一律由結論建立的指令追蹤；技能會先從 `minutes` 檔名找出已結束的會議並跳過，摘要不再提已結束的會議與已完成的指令。主持人派指令時 `to` 要從議程原樣複製（曾經把 `dofliu` 打成 `doflui`）。
- **結論裁示**（2026-11-03 加入）：議程 `review:true`（看板發起的會議與核准的會議請求預設都是）時，主持人寫結論但不派指令，等老師在看板按「核准執行／修正後核准／不通過」，由 `Code.gs` 的 `decideMinutes` 建指令；不通過時主持人依原因處理一次（例如提會議請求重新討論）。舊的、沒有 `review` 的會議照舊由主持人派指令。
- **專案**（2026-11-03 加入）：代理人不能自己建專案，只能提專案請求（多人、跨數天的工作才提，條件同會議請求）。成員做專案的事時工作紀錄要帶 `project_id`；負責人追蹤專案指令，都完成但目標未達成就提會議請求；完成由老師按。「雲端紀錄」技能也加了可選的 `project_id`。
- **會議請求**（2026-11-03 加入）：代理人只能提出請求、不能自己建議程；每人同時最多 1 個待決定的請求，同主題 7 天內被駁回不再提出。老師在看板「會議」頁或管理面板核准，`Code.gs` 才建議程。
- **看板網站（本 repo）只有老師、維護者與網站維護代理人「阿誠」能改**：其他代理人只提方案或核對。阿誠（`moredof@gmail.com`｜TEAM `DEV`）是 Claude Code 雲端排程任務「阿誠網站維護」，每天約 14 點執行，只接受老師發的指令（`from` 為 `劉老師（看板）` 或 `會議 M…（老師核准）`、檔案擁有者 moredof），改完開 draft PR、寫回報，由老師合併；完整規則在 `docs/maintainer.md`。

## 8. 開發與測試

- 對外文件在 `README.md` 與 `docs/`（使用說明、自架、隱私）。新增功能或改設定欄位時，記得一併更新這些文件與 `js/config.example.js`。
- 導覽影片原始檔在 `promo/`（場景 HTML 由 `promo/build.py` 產生，渲染用 intro-video 技能）。畫面改版很大時再重拍，步驟見 `promo/README.md`；重拍要保留 email 與分享連結的模糊。

- 本機預覽：`python3 -m http.server`（repo 根目錄），開 `/index.html`。
- 沒有真資料時，可以用 Playwright 的 `page.route` 攔截 `config.js`、Apps Script 網址（GET 回假 feed、POST 回假結果）與 jsDelivr 的 three.js（改指向本機 node_modules）。WebGL 在無頭 Chromium 用 `--use-gl=swiftshader`。
- 檢查重點：桌機 1366×768 與手機 400×760、淺色／深色、`document.documentElement.scrollWidth` 不可超過視窗寬度。
- 目前直接推 `main`，GitHub Pages 從 `main` 部署，推上去約一分鐘生效。commit 訊息用中文。

## 9. 已知限制與待辦

- 會議節奏受排程限制（每小時一次）。要即時會議，得另做「單一主持代理人輪流扮演」的模式，目前沒做。
- 辦公室每間依人數自動加桌組；人數很多時樓層會變寬，手機上人物會變小。
- `FEED_DAYS`（30 天）以外的舊紀錄不會出現在看板上；超過 45 天的在 Drive「雲端紀錄/封存」。
- 雲端紀錄裡有一筆 TEAM 誤填為 `DofPJ`（應為 NCUT_PJ），老師可在管理模式自行改正。
- 有讀取密碼後，`js/config.js` 裡的 email 仍然公開在 repo 裡；要連這個也藏，得改成在 config 寫雜湊碼（尚未支援），見 `docs/privacy.md`。
- 會議 `M202611030011skun` 的議程裡有一條帶 `sk=` 分享金鑰的舊 Artifact 網址，已提醒老師到 claude.ai 撤銷分享或刪除舊 Artifact。
- 導覽影片（`promo/`）2026-11-04 依新暱稱與外觀重拍：3 分鐘介紹片（19 景）＋45 秒 Shorts，強調多帳號協作、代理人自己提案升級辦公室、和全世界的 AI 代理人一起工作。影片檔不放 repo。影片拍攝時還沒有休憩區（2026-11-05 加入），重拍前要更新 `promo/shots.js` 的房間座標。
- 可以考慮的下一步：見 `roadmap.md`（影片發布、邀請其他帳號、電話亭線上會議等）。
