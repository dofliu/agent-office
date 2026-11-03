---
name: "cloud-chat-log"
description: "當使用者說「雲端紀錄」（可加 team 名稱，例如「雲端紀錄 team DofLab」）時，把本對話的主題、最後對話時間、帳號 email、Team 存成新的 JSON 檔到指定 Google Drive 資料夾。"
---

# 雲端紀錄

使用者說「雲端紀錄」時，把**這個對話**的五項基本資訊寫成一份新的 JSON 檔，放到固定的 Google Drive 資料夾。只記這五項，不記對話內容。

## 觸發格式
- `雲端紀錄 team 名稱`：例如 `雲端紀錄 team DofLab`。`team` 不分大小寫，後面到訊息結尾的文字（去掉前後空白）就是 Team 名稱，照使用者寫的原樣保留大小寫。
- `雲端紀錄`：沒有指定 Team。

## 固定設定
- 目的資料夾：「雲端紀錄」
  - folder ID：`1tQdylp4A4dEwwrIg02F_rXz_YQMlh0P9`
  - https://drive.google.com/drive/folders/1tQdylp4A4dEwwrIg02F_rXz_YQMlh0P9
- 時區：Asia/Taipei

## 要記的五個欄位
```json
{
  "topic": "對話主題(15個字以內)",
  "content": "內容（100個字以內）",
  "last_time": "yyyymmddhhmmss",
  "account": "帳號 email",
  "team": "DofLab"
}
```
（可選）第六個欄位 `"project_id": "P20261103160000ab12"`：這次的工作屬於某個**專案**時才加（見下方第 6 點），否則不要加這個鍵。

1. **topic**：用 15 個字以內概括本對話的主題，能馬上知道這對話在做什麼。只寫主題，不寫人名、帳號、數字、內容細節或任何敏感資料。「雲端紀錄」這句指令本身不算主題。
2. **content**：用 100 個字以內概括本對話的重點。要可以讓使用者知道對話重點在做什麼。「雲端紀錄」這指令本身不算內容。
3. **last_time**：使用者說「雲端紀錄」的時間，格式 `yyyymmddhhmmss`（14 位數，Asia/Taipei，24 小時制），例如 `20261028215012`。用取得現在時間的工具取得；沒有該工具時，用系統提供的這則訊息時間。不可猜測或自行編造。
4. **account**：依下列順序取得，取到就停：
   1. 平台在本對話提供的使用者 email（例如系統內容中標明的使用者 email）。
   2. 使用者個人偏好設定中的這一行：`雲端紀錄用：帳號 email = （email）`。
   3. 都沒有時，問使用者一次；使用者不提供就填 `null`。
   - 若 1 與 2 都有但不一致，填 1 的值，並在回覆中提醒使用者兩者不同。
   - 不可猜測。
5. **team**：
   1. 指令中有 `team 名稱` → 用該名稱。這是主要來源。
   2. 指令中沒有 → 平台在本對話明確標示的 Team／組織名稱。
   3. 都沒有 → `null`（不用問）。
   - **不要**從個人偏好設定取 Team：同一帳號在不同 Team 共用同一份偏好設定，無法分辨。
   - 不可猜測，也不要從對話內容推論 Team。
6. **project_id**（可選）：只有這次工作明確屬於某個專案時才加，例如在執行帶有 `project_id` 的指令、參加帶有 `project_id` 的會議，
   或使用者明講「這是 ○○ 專案的工作」並給了專案編號（`P` 開頭 19 碼）。原樣複製編號，不可猜測；不確定就不要加。
   看板會讓有專案的工作在 3D 的專案辦公室裡進行。

## 步驟
1. 依上面規則整理五個欄位（有專案時加 `project_id`），組成 JSON（UTF-8，不加 Markdown 包裝）。
2. 檔名：`雲端紀錄_（last_time）_（4位隨機英數）.json`，例如 `雲端紀錄_20261028215012_k3f9.json`。
3. 用 Google Drive 連接器的 create_file 建立**新檔**：
   - parentId：`1tQdylp4A4dEwwrIg02F_rXz_YQMlh0P9`
   - contentMimeType：`application/json`
   - disableConversionToGoogleType：`true`
   - textContent：完整 JSON
4. 用 download_file_content 讀回一次，確認內容與送出的相同、檔案在上述資料夾內。
5. 回覆一行：檔名與連結 `https://drive.google.com/file/d/（fileId）/view`，並列出這四個欄位的值（account／team 來自哪裡也標一下：指令、平台、偏好設定或使用者提供）。

## 限制
- 只新增檔案。不修改、覆寫、改名、搬移、刪除任何檔案，不改分享權限，不建立公開連結。
- 每說一次「雲端紀錄」只建一個檔。建立結果不確定時，先在資料夾中搜尋同檔名，找到就不要重建。
- Google Drive 連接器在本對話不可用時，直接說明，並把 JSON 顯示出來讓使用者自行保存；不要改存到其他位置。