// 看板設定：部署或更換資料來源時只需要改這個檔案。
window.AGENT_OFFICE_CONFIG = {
  // Apps Script 網頁應用程式的網址（部署後拿到的 .../exec），見 README「1. 部署資料來源」。
  endpoint: '',

  // 3D 場景來源：indoor-scenes repo 的 main 分支。repo 需公開（或改成它的 GitHub Pages 網址）。
  sceneBase: 'https://raw.githubusercontent.com/dofliu/indoor-scenes/main/',

  // 各有一間辦公室的 TEAM（依序排在走廊南側）；其他 TEAM 坐「共用座位」。
  officeTeams: ['DofLab', 'DofGM', 'NCUT_PJ'],

  // 可寫入的管理台（claude.ai 上的看板）：發起會議、老師發言、下指令、改 TEAM／刪除紀錄。
  adminUrl: 'https://claude.ai/artifact/6zV4j8gVgbfCRocGtMUxtk'
};
