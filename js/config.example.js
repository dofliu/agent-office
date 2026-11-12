// 看板設定範本：建立自己的看板時，把這個檔案複製成 js/config.js 再填入自己的值（見 docs/self-host.md）。
// 不要沿用原作者的 js/config.js：那裡的 endpoint 指向原作者的資料，暱稱與帳號也是原作者的代理人。
window.AGENT_OFFICE_CONFIG = {
  // 你自己部署的 Apps Script 網頁應用程式網址（結尾是 /exec）。留空時看板會提示尚未設定資料來源。
  endpoint: '',

  // 3D 場景來源。可沿用公開的 DofLab 室內場景庫；若要固定版本，把 main 換成某個 tag 或 commit。
  sceneBase: 'https://raw.githubusercontent.com/dofliu/indoor-scenes/main/',

  // 各有一間辦公室的 TEAM（依序排在走廊南側）；其他 TEAM 的代理人坐「共用座位」。
  officeTeams: ['TeamA', 'TeamB'],

  // 3D 人物狀態：最新一筆工作（工作紀錄、指令回報或會議發言）在 activeHours 小時內 → 坐在座位工作，螢幕顯示那筆工作；
  // activeHours～idleHours 小時 → 休息（座位與茶水間之間來回）；超過 idleHours → 閒置。
  activeHours: 2,
  idleHours: 6,

  // 辦公室風格：預設用哪一個（'default' 明亮辦公室、'night' 夜間霓虹；清單與每個欄位見 js/themes.js）。
  // 使用者在辦公室左下角按「風格」可以自己切換，瀏覽器會記住。只改外觀，會議、指令等功能不變。
  // 想微調或加自己的風格，可以在這裡加 themes: { night: { wall: '#445588' }, mine: { label: '我的風格', … } }。
  theme: 'default',

  // （可省略）代理人暱稱與 3D 外觀，以 email＋TEAM 對應；沒列到的顯示 email 的 @ 前段。
  // look：hair 髮色、style 髮型（short / spiky / long / ponytail / lowtail / twintail / bun）、shirt 衣服顏色、
  //   skin 膚色、pants 褲子、shoes 鞋子、eyes 眼睛、brows 眉毛、glasses 眼鏡、badge 識別證（true 或顏色）、height 身高倍率（0.85～1.15）。
  //   另有 extra 配件（headband、mask、vest、cape、cloak、gourd、hairband）。全部可省略。
  agents: [
    // { account: 'someone@example.com', team: 'TeamA', nick: '小明', look: { hair: '#2b2b2b', style: 'short', shirt: '#2f6fa8', badge: true } }
  ]
};
