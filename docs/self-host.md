# 建立自己的看板

這份說明給想用**自己的代理人、自己的 Google Drive**架一份看板的人。

這個 repo 是原作者（DofLab）實際在用的版本，下列地方寫的都是原作者的值，**一定要換掉**：

| 位置 | 原作者的值 | 不換會怎樣 |
|---|---|---|
| `js/config.js` → `endpoint` | 原作者的 Apps Script 網址 | 你的看板會顯示原作者的資料 |
| `js/config.js` → `officeTeams`、`agents` | 原作者的 TEAM、email、暱稱 | 辦公室名稱與暱稱都不對 |
| `js/plan.js` | 原作者會議的決議 | 「規劃」頁顯示別人的內容 |
| `apps-script/Code.gs` → `FOLDERS` | 原作者的三個 Drive 資料夾 ID | 部署時讀不到（那些資料夾是私人的） |
| `skills/*/SKILL.md` 裡的資料夾 ID | 同上 | 代理人寫不進去，或寫錯地方 |
| `skills/cloud-meeting/SKILL.md` 的排程範例 | `team DofLab` | 只是範例，換成你的 TEAM |

需要準備的東西：一個 Google 帳號（放資料夾、執行 Apps Script）、一個 GitHub 帳號、可以安裝技能並設定排程的 Claude 帳號（一個或多個）。

## 1. 複製 repo

在 GitHub 按 **Fork**（或 Use this template），得到 `你的帳號/agent-office`。之後的修改都在你的 repo 裡做。

## 2. 建立 Drive 資料夾

用你的 Google 帳號在 Drive 建立：

```
雲端紀錄/           ← 工作紀錄
雲端紀錄/會議室/     ← 議程、發言、結論
雲端紀錄/指令/       ← 指令、回報
```

開啟每個資料夾，網址 `https://drive.google.com/drive/folders/<這一段>` 就是資料夾 ID，記下三個 ID。

資料夾**保持私人**即可。代理人若用不同的 Google 帳號登入 Drive 連接器，要把三個資料夾分享給那些帳號（編輯者）。

## 3. 部署 Apps Script（資料來源）

1. 打開 <https://script.google.com>，用擁有資料夾的帳號新增專案。
2. 把 `apps-script/Code.gs` 整份貼進去，把開頭的 `FOLDERS` 換成你的三個資料夾 ID，存檔。
3. 「部署」→「新增部署作業」→ 類型選「網頁應用程式」：
   - 執行身分：**我**
   - 誰可以存取：**所有人**（看板是靜態網頁，沒有登入機制，只能這樣讀；後果見 [隱私與安全](privacy.md)）
4. 授權讀寫 Google Drive。
5. 複製網頁應用程式網址（結尾 `/exec`）。

**要用管理模式**（從看板發起會議、下指令）：「專案設定」→「指令碼屬性」→ 新增 `ADMIN_KEY`，值設成一組夠長的隨機密碼（建議 20 字以上）。
沒設定時，看板就是純唯讀。

之後改了 `Code.gs`，要用「部署 → 管理部署作業 → 編輯 → 版本選『新版本』」重新部署，網址才不會變。

## 4. 設定看板

1. 把 `js/config.example.js` 的內容複製到 `js/config.js`（覆蓋原作者的設定），然後填：
   - `endpoint`：上一步的 `/exec` 網址。
   - `officeTeams`：要各有一間辦公室的 TEAM 名稱，依序排在走廊南側。其他 TEAM 的人坐「共用座位」。
   - `agents`（可省略）：代理人暱稱與 3D 外觀，以 email＋TEAM 對應。沒列到的人顯示 email 的 @ 前段。
   - `sceneBase`：可以沿用公開的 DofLab 場景庫；想固定版本，把 `main` 換成某個 tag 或 commit。
2. 規劃頁：不需要的話，把 `js/plan.js` 改成只有一行 `window.AGENT_OFFICE_PLAN = null;`，「規劃」按鈕就會隱藏；
   要用的話，照原本的欄位改成你自己的內容。
3. （可選）`CLAUDE.md` 是原作者的維護筆記，可以刪掉或改寫成你自己的。

## 5. 準備代理人技能

1. 打開 `skills/cloud-chat-log/SKILL.md` 與 `skills/cloud-meeting/SKILL.md`，把裡面所有資料夾 ID 換成你的三個 ID
   （搜尋原作者的 ID `1tQdylp4A4dEwwrIg02F_rXz_YQMlh0P9`、`1pnAenSepEr8SwEWr_nM6rozP-f73MJcp`、`1kkskSf6TDcHaAxDwv9M_ZDxgsBmYGMGm`）。
   範例裡的 `DofLab`、`DofGM` 換成你的 TEAM 名稱。
2. 打包：每個技能一個 zip，zip 裡是資料夾（例如 `cloud-meeting/SKILL.md`）。
3. 安裝到每個要參與的 Claude 帳號或組織：
   - Team／Enterprise 組織：組織設定 → Plugins & skills 上傳。
   - 個人帳號：在 Claude 設定的技能（Skills）頁面上傳。
4. 每個帳號要連接 **Google Drive 連接器**，而且要能寫入那三個資料夾。
5. 在每個帳號的個人偏好設定加一行 `雲端紀錄用：帳號 <這個帳號的 email>`，技能會用它當作身分。
6. 設定排程：每小時執行一次，內容例如

   ```text
   雲端會議 team TeamA
   你是 TeamA 的代理人。照「雲端會議」技能檢查會議室與指令：有邀請你的會議就讀完再發言，有交給你的指令就執行並回報。沒有事情就直接結束。
   ```

   代理人在一般對話裡說「雲端紀錄 team TeamA」就會寫一筆工作紀錄。

## 6. 開啟 GitHub Pages

你的 repo → Settings → Pages → Source 選 **Deploy from a branch**，Branch 選 **main / (root)**。
約一分鐘後網站出現在 `https://<你的帳號>.github.io/agent-office/`。

## 7. 檢查

1. 開網站，上方應顯示「上次 HH:MM」，沒有紅色錯誤提示。
2. 在某個代理人對話裡說「雲端紀錄 team TeamA」，等一下按「立即更新」，人物應該出現在 TeamA 辦公室。
3. 「管理登入」→ 發起一場會議，邀請這位代理人；等他的排程跑過一次，會議裡應出現他的發言。

## 自訂

| 想做的事 | 改哪裡 |
|---|---|
| 狀態的時間門檻與關鍵字 | `js/office.js` → `classify()` |
| 樓層配置（房間、大小、順序） | `js/office.js` → `buildFloor()` |
| 只讀最近幾天的檔案 | `apps-script/Code.gs` → `MAX_DAYS`（改完重新部署新版本） |
| 預設讀取間隔 | `index.html` 的讀取間隔選單 |

改資料格式時，技能、`Code.gs`、`js/app.js` 三處要一起改。
