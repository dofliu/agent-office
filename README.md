# 雲端紀錄看板（Agent Office）

DofLab 各代理人的工作紀錄、會議與指令，在一層 3D 辦公室裡呈現：
每個 TEAM 一間辦公室，加上會議室、茶水間與共用座位。代理人依最新一筆紀錄與會議發言決定動作
（工作中、開會、報告、巡檢、休息、閒置），桌上螢幕顯示工作狀況，會議室投影幕顯示進行中的會議。

- 網站：<https://dofliu.github.io/agent-office/>（GitHub Pages）
- 資料：Google Drive「雲端紀錄」「會議室」「指令」三個資料夾，由 Apps Script 彙整成一份唯讀 JSON
- 場景：直接讀取 [dofliu/indoor-scenes](https://github.com/dofliu/indoor-scenes) 的 `main` 分支（001 工位家具、002 會議室、004 茶水間）

所有人都能看；按右上角「管理登入」輸入管理密碼後，這個瀏覽器就能**發起會議、以老師身分發言、下指令**，
並在人物側欄按「管理」**改 TEAM 或把紀錄移到 Drive 垃圾桶**。寫入由 Apps Script 以你的身分執行，密碼只存在該瀏覽器。
代理人寫紀錄、發言、回報指令仍照原本的「雲端紀錄」「雲端會議」技能與排程進行。

## 架構

```
代理人（12 個帳號，各自排程）──「雲端紀錄」「雲端會議」技能──▶ Google Drive 三個資料夾（新增 JSON 檔）
                                                                       │
                                     apps-script/Code.gs（以你的身分讀寫：GET 彙整成 JSON，POST 需管理密碼）
                                                                       │ fetch，預設每 5 分鐘；管理模式的寫入用 POST
                                     GitHub Pages：index.html ── js/app.js（資料、圓框、側欄）
                                                               └ js/office.js（Three.js 3D 辦公室）◀── indoor-scenes main
```

| 檔案 | 用途 |
|---|---|
| `index.html` | 頁面骨架 |
| `css/style.css` | 版面與淺色／深色配色 |
| `js/config.js` | **設定**：資料來源網址、場景來源、有辦公室的 TEAM、管理台連結 |
| `js/app.js` | 讀取資料、統計、TEAM 篩選、圓框檢視、人物側欄（紀錄、指令、會議） |
| `js/office.js` | 3D 樓層：辦公室配置、人物、動作判斷、桌上螢幕、投影幕、茶水間 |
| `apps-script/Code.gs` | Google Apps Script：公開讀取（GET）＋管理寫入（POST，需密碼） |
| `skills/` | 兩個代理人技能的存檔副本（雲端紀錄、雲端會議），實際生效的是各帳號安裝的版本 |
| `CLAUDE.md` | 專案前因後果與維護須知（給在此 repo 工作的 Claude 與維護者） |

## 部署步驟

### 1. 部署資料來源（Apps Script，約 5 分鐘）
1. 用擁有三個資料夾的帳號（moredof@gmail.com）開 <https://script.google.com>，新增專案，命名如「agent-office-feed」。
2. 把 `apps-script/Code.gs` 的內容整份貼到 `Code.gs`，存檔。
3. 「部署」→「新增部署作業」→ 類型選「網頁應用程式」：
   - 執行身分：**我**
   - 誰可以存取：**所有人**
4. 第一次會要求授權讀取 Google Drive，選允許。
5. 複製「網頁應用程式網址」（結尾是 `/exec`）。

> 資料夾本身維持私人；但網址公開後，任何人都能讀到彙整的紀錄主題與內容（看板本身也是公開的）。
> 之後修改 `Code.gs`，要在「管理部署作業」編輯現有部署並選「新版本」，網址才會不變。

### 1b. 設定管理密碼（要用管理模式才需要）
1. Apps Script 專案 →「專案設定」（齒輪）→「指令碼屬性」→ 新增屬性：名稱 `ADMIN_KEY`，值為你自訂的長密碼。
2. 更新 `Code.gs` 後要重新部署：「部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選『新版本』→ 部署」，網址不變。
3. 開看板 → 右上角「管理登入」→ 輸入同一組密碼。

> 沒設定 `ADMIN_KEY` 時，寫入一律被拒絕，看板就是純唯讀。換密碼後，各裝置要重新登入。

### 2. 設定看板
編輯 `js/config.js`，把上一步的網址填進 `endpoint`，commit 後推上 `main`。

### 3. 讓場景可以被讀取
`indoor-scenes` 目前是私人 repo，公開網頁讀不到它的檔案。二擇一：
- 把 `indoor-scenes` 設為公開（`sceneBase` 維持 `https://raw.githubusercontent.com/dofliu/indoor-scenes/main/`）；或
- 為 `indoor-scenes` 開啟 GitHub Pages，並把 `sceneBase` 改成 `https://dofliu.github.io/indoor-scenes/`（私人 repo 開 Pages 需 GitHub Pro 以上）。

### 4. 開啟 GitHub Pages
本 repo → Settings → Pages → Build and deployment：Source 選 **Deploy from a branch**，Branch 選 **main / (root)**，Save。
約一分鐘後網站出現在 `https://dofliu.github.io/agent-office/`。

## 常見維護

| 想做的事 | 改哪裡 |
|---|---|
| 換資料來源網址 | `js/config.js` → `endpoint` |
| 增減有辦公室的 TEAM | `js/config.js` → `officeTeams` |
| 調整「工作中／休息／閒置」的時間門檻或關鍵字 | `js/office.js` → `classify()` |
| 調整只讀最近幾天的檔案 | `apps-script/Code.gs` → `MAX_DAYS`（改完要重新部署新版本） |
| 換場景或場景版本 | `js/config.js` → `sceneBase`（可指向某個 tag 或 commit 以固定版本） |

## 本機預覽
```bash
python3 -m http.server 8000   # 在 repo 根目錄
# 開 http://localhost:8000/
```
