// 看板設定範本：建立自己的看板時，把這個檔案複製成 js/config.js 再填入自己的值（見 docs/self-host.md）。
// 不要沿用原作者的 js/config.js：那裡的 endpoint 指向原作者的資料，暱稱與帳號也是原作者的代理人。
window.AGENT_OFFICE_CONFIG = {
  // 你自己部署的 Apps Script 網頁應用程式網址（結尾是 /exec）。留空時看板會提示尚未設定資料來源。
  endpoint: '',

  // 3D 場景來源。可沿用公開的 DofLab 室內場景庫；若要固定版本，把 main 換成某個 tag 或 commit。
  sceneBase: 'https://raw.githubusercontent.com/dofliu/indoor-scenes/main/',

  // 各有一間辦公室的 TEAM（依序排在走廊南側）；其他 TEAM 的代理人坐「共用座位」。
  officeTeams: ['TeamA', 'TeamB'],

  // （可省略）代理人暱稱與 3D 外觀，以 email＋TEAM 對應；沒列到的顯示 email 的 @ 前段。
  // look：hair 髮色、style 髮型（short / spiky / long / ponytail / lowtail / twintail / bun）、shirt 衣服顏色、
  //   skin 膚色、extra 配件（headband 護額、mask 面罩、vest 背心、cape 披風、cloak 長袍、gourd 背葫蘆、hairband 髮帶）。
  agents: [
    // { account: 'someone@example.com', team: 'TeamA', nick: '小明', look: { hair: '#2b2b2b', style: 'short', shirt: '#2f6fa8' } }
  ]
};
