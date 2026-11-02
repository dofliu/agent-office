// 看板設定：部署或更換資料來源時只需要改這個檔案。
window.AGENT_OFFICE_CONFIG = {
  // Apps Script 網頁應用程式的網址（部署後拿到的 .../exec），見 README「1. 部署資料來源」。
  endpoint: 'https://script.google.com/macros/s/AKfycbzXIka-o-7BVZwFvwW8I6cBetCHB1jG9Trrspm3zTGyk1WLlenFf7-Ootaevy7-0mYpUQ/exec',

  // 3D 場景來源：indoor-scenes repo 的 main 分支。repo 需公開（或改成它的 GitHub Pages 網址）。
  sceneBase: 'https://raw.githubusercontent.com/dofliu/indoor-scenes/main/',

  // 各有一間辦公室的 TEAM（依序排在走廊南側）；其他 TEAM 坐「共用座位」。
  officeTeams: ['DofLab', 'DofGM', 'NCUT_PJ'],

  // 代理人暱稱與 3D 外觀：介面平常顯示暱稱，點進去仍看得到 email 與 TEAM。
  // 以 email（不分大小寫）＋ TEAM 對應；沒列到的組合顯示 email 的 @ 前段。
  // look（可省略）：hair 髮色、style 髮型（short / spiky / long / ponytail / lowtail / twintail / bun）、shirt 衣服顏色、
  //   skin 膚色、extra 配件（headband 護額、mask 面罩、vest 背心、cape 披風、cloak 長袍、gourd 背葫蘆、hairband 髮帶）。
  agents: [
    { account: 'moredof@gmail.com',      team: 'DofLab',  nick: '小櫻',   look: { hair: '#f4a6c4', style: 'long',     shirt: '#c8323c', extra: ['hairband'] } },
    { account: 'dofliu@gm.ncut.edu.tw',  team: 'DofLab',  nick: '佐助',   look: { hair: '#1c1f2b', style: 'spiky',    shirt: '#2b3a67', extra: ['headband'] } },
    { account: 'dof.liu@gmail.com',      team: 'DofLab',  nick: '鹿丸',   look: { hair: '#1f1f24', style: 'ponytail', shirt: '#3d4a3a', extra: ['vest'] } },
    { account: 'dofliu@ncut.edu.tw',     team: 'DofLab',  nick: '鼬',     look: { hair: '#15161c', style: 'lowtail',  shirt: '#1b1d26', extra: ['cloak', 'headband'] } },
    { account: 'ncutiae.liu@gmail.com',  team: 'DofLab',  nick: '水門',   look: { hair: '#f5d142', style: 'spiky',    shirt: '#30476b', extra: ['vest', 'cape'] } },
    { account: 'moredof@gmail.com',      team: 'DofGM',   nick: '雛田',   look: { hair: '#2a2e5c', style: 'long',     shirt: '#c9c0e6' } },
    { account: 'dofliu@gm.ncut.edu.tw',  team: 'DofGM',   nick: '卡卡西', look: { hair: '#d7dbe0', style: 'spiky',    shirt: '#2f3a52', extra: ['vest', 'mask', 'headband'] } },
    { account: 'dof.liu@gmail.com',      team: 'DofGM',   nick: '綱手',   look: { hair: '#f2d77a', style: 'twintail', shirt: '#6f7f63', extra: ['cape'] } },
    { account: 'dofliu@ncut.edu.tw',     team: 'DofGM',   nick: '我愛羅', look: { hair: '#b0322b', style: 'short',    shirt: '#7a3b33', extra: ['gourd'] } },
    { account: 'ncutiae.liu@gmail.com',  team: 'DofGM',   nick: '大蛇丸', look: { hair: '#14151a', style: 'long',     shirt: '#d9d3c0', skin: '#f2ece4' } },
    { account: 'moredof@gmail.com',      team: 'Pro',     nick: '鳴人',   look: { hair: '#f6c829', style: 'spiky',    shirt: '#f08a24', extra: ['headband'] } },
    { account: 'dofliu@gm.ncut.edu.tw',  team: 'NCUT_PJ', nick: '自來也', look: { hair: '#eceef0', style: 'long',     shirt: '#a23a32', extra: ['vest'] } }
  ]
};
