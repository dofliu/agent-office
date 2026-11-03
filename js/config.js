// 看板設定：部署或更換資料來源時只需要改這個檔案。
window.AGENT_OFFICE_CONFIG = {
  // Apps Script 網頁應用程式的網址（部署後拿到的 .../exec），見 README「1. 部署資料來源」。
  endpoint: 'https://script.google.com/macros/s/AKfycbzXIka-o-7BVZwFvwW8I6cBetCHB1jG9Trrspm3zTGyk1WLlenFf7-Ootaevy7-0mYpUQ/exec',

  // 3D 場景來源：indoor-scenes repo 的 main 分支。repo 需公開（或改成它的 GitHub Pages 網址）。
  sceneBase: 'https://raw.githubusercontent.com/dofliu/indoor-scenes/main/',

  // 各有一間辦公室的 TEAM（依序排在走廊南側）；其他 TEAM 坐「共用座位」。
  officeTeams: ['DofLab', 'DofGM', 'NCUT_PJ'],

  // 3D 人物狀態：最新一筆工作（工作紀錄、指令回報或會議發言）在 activeHours 小時內 → 坐在座位工作，螢幕顯示那筆工作；
  // activeHours～idleHours 小時 → 休息（座位與茶水間之間來回）；超過 idleHours → 閒置。
  activeHours: 2,
  idleHours: 6,

  // 代理人暱稱與 3D 外觀：介面平常顯示暱稱，點進去仍看得到 email 與 TEAM。
  // 以 email（不分大小寫）＋ TEAM 對應；沒列到的組合顯示 email 的 @ 前段。
  // look（可省略）：hair 髮色、style 髮型（short / spiky / long / ponytail / lowtail / twintail / bun）、shirt 衣服顏色、
  //   skin 膚色、pants 褲子、shoes 鞋子、eyes 眼睛、brows 眉毛（預設同髮色）、glasses 眼鏡、badge 識別證（true 或顏色）、
  //   height 身高倍率（0.85～1.15）。舊版的 extra 配件（headband、mask、vest、cape、cloak、gourd、hairband）仍支援，但目前不用。
  // 外觀依 2026-11-03 會議 M202611031429y54f（員工形象）：同一個帳號在不同 TEAM 長相相同，只換制服顏色
  //   （DofLab 白 #eef0f2、DofGM 深藍 #1f3a68、Pro 橘 #e8a33d、NCUT_PJ 綠 #2f7d6d），不戴配件。
  // 暱稱由老師指定（2026-11-04），每個帳號 × TEAM 各一個名字。
  agents: [
    { account: 'moredof@gmail.com',      team: 'DofLab',  nick: '瑞弘',    look: { hair: '#2e2420', style: 'bun',      shirt: '#eef0f2', skin: '#f2d6c2' } },
    { account: 'dofliu@gm.ncut.edu.tw',  team: 'DofLab',  nick: '小櫻',    look: { hair: '#1e2230', style: 'short',    shirt: '#eef0f2', skin: '#dcb48c' } },
    { account: 'dof.liu@gmail.com',      team: 'DofLab',  nick: '阿翰',    look: { hair: '#3a2a20', style: 'ponytail', shirt: '#eef0f2', skin: '#e8c4a0' } },
    { account: 'dofliu@ncut.edu.tw',     team: 'DofLab',  nick: '黃謙',    look: { hair: '#2b2b30', style: 'lowtail',  shirt: '#eef0f2', skin: '#d9b48f' } },
    { account: 'ncutiae.liu@gmail.com',  team: 'DofLab',  nick: '小智',    look: { hair: '#5a3b24', style: 'spiky',    shirt: '#eef0f2', skin: '#f0d2b4' } },
    { account: 'moredof@gmail.com',      team: 'DofGM',   nick: '小弘',    look: { hair: '#2e2420', style: 'bun',      shirt: '#1f3a68', skin: '#f2d6c2' } },
    { account: 'dofliu@gm.ncut.edu.tw',  team: 'DofGM',   nick: '雛田',    look: { hair: '#1e2230', style: 'short',    shirt: '#1f3a68', skin: '#dcb48c' } },
    { account: 'dof.liu@gmail.com',      team: 'DofGM',   nick: '小毅',    look: { hair: '#3a2a20', style: 'ponytail', shirt: '#1f3a68', skin: '#e8c4a0' } },
    { account: 'dofliu@ncut.edu.tw',     team: 'DofGM',   nick: '彭帥',    look: { hair: '#2b2b30', style: 'lowtail',  shirt: '#1f3a68', skin: '#d9b48f' } },
    { account: 'ncutiae.liu@gmail.com',  team: 'DofGM',   nick: '阿茂',    look: { hair: '#5a3b24', style: 'spiky',    shirt: '#1f3a68', skin: '#f0d2b4' } },
    { account: 'moredof@gmail.com',      team: 'Pro',     nick: '杜夫',    look: { hair: '#2e2420', style: 'bun',      shirt: '#e8a33d', skin: '#f2d6c2' } },
    { account: 'dofliu@gm.ncut.edu.tw',  team: 'NCUT_PJ', nick: '阿仁',    look: { hair: '#1e2230', style: 'short',    shirt: '#2f7d6d', skin: '#dcb48c' } }
  ]
};
