// 辦公室風格（主題）：只管 3D 辦公室「長什麼樣子」，不影響會議、指令、專案等協作功能。
// 預設用哪一個由 config.js 的 theme 決定；使用者在辦公室左下角按「風格」可以切換（記在瀏覽器），網址加 ?theme=night 也可以。
// 新增風格：在這裡加一組，只要寫和 default 不同的欄位，其餘沿用 default。config.js 的 themes 也可以加或覆蓋。
// 顏色一律寫 '#rrggbb'。
// 有 scene 的風格是「場景」：除了配色，還把外面的環境、牆、門框、地板換掉（畫法在 js/scenes.js）。
window.AGENT_OFFICE_THEMES = {
  // ---- 預設：明亮辦公室（原本的樣子）----
  default: {
    label: '明亮辦公室',
    bg: null,              // 3D 背景色；null = 跟著頁面的淺色／深色（CSS 的 --office-bg）
    ground: null,          // 樓層外圍地板；null = 背景色調暗一點
    corridor: '#c9d2d9',   // 走廊地板
    wall: '#e9ecef',       // 隔間牆
    roomTint: .16,         // 房間地板染上房間顏色的濃度（0～1）
    outline: 0,            // 房間地板外框的發光線條寬度（公尺）；0 = 不畫
    sign: { opacity: .55, tint: '#ffffff', amount: 0 },   // 地板上的房間名稱：透明度；amount > 0 時往 tint 的顏色靠
    light: { sky: '#ffffff', floor: '#556677', ambient: 1.15, sun: '#ffffff', sunPower: 1.4 },   // 環境光（上／下）與主光
    modelTint: null,       // 場景庫模型（桌椅、會議室、茶水間…）整體乘上的顏色；null = 原色
    frame: '#222a33',      // 牆面螢幕的外框與腳架
    bezel: '#1d242c',      // 座位螢幕的外框
    lift: '#3a424c',       // 升降桌的桌腳
    table: '#9b7b57',      // 會議桌、專案桌的桌面
    tableLeg: '#39414b',
    rooms: { meet: '#b88a3e', meetSign: '#a0701f', project: '#5b6fd6', projectSign: '#4a5bc0', studio: '#c0392b', pantry: '#3f86a6', lounge: '#7a5cc4' },   // 各種房間的代表色（地板、名稱、外框線）
    tag: { bg: 'rgba(255,255,255,.92)', line: 'rgba(20,32,43,.35)', ink: '#14202b' },      // 設備名牌
    bubble: { bg: '#ffffff', line: 'rgba(20,32,43,.45)', ink: '#14202b' },                  // 對話泡泡
    // 螢幕上的畫面（座位螢幕、投影幕、看板牆、會議室與專案看板）
    ui: {
      // 亮底畫面：投影幕、會議簡報、座位主螢幕、小會議室螢幕
      paper: '#f6f8fa', slide: '#ffffff', card: '#eef3f7', line: '#d5dce3',
      ink: '#14202b', inkHi: '#0b141c', ink2: '#33414e', mute: '#566676', mute2: '#9aa8b5',
      brand: '#3f86a6', brandDark: '#173d55', onBrand: '#ffffff', accent: '#0f7f97',
      ok: '#2c8547', warn: '#b8700c', bad: '#c0392b',
      // 暗底畫面：看板牆、座位右側小螢幕
      dBg: '#0f1a24', dBg2: '#16232f', dCard: '#15222f', dLine: '#253647', dTrack: '#22364a',
      dInk: '#e3ecf3', dInk2: '#b9c7d3', dMute: '#8ea1b2', dMute2: '#6f8496', dAccent: '#5ec1d8', gold: '#ffcf5a',
      off: '#0d1218',      // 沒人坐的螢幕
      // 螢幕保護（風機）
      saver1: '#1f5f86', saver2: '#5fa8c8', saverInk: '#ffffff', saverInk2: '#cfe2ee', saverInk3: '#9fb7c6',
      // 專案看板
      projPaper: '#f4f6fd', proj: '#4a5bc0', projInk: '#2a3346', projTrack: '#d9def2'
    }
  },

  // ---- 夜間霓虹：深色樓層、房間地板有發光外框、螢幕改深色介面 ----
  night: {
    label: '夜間霓虹',
    bg: '#070b14', ground: '#0b1122', corridor: '#1a2540', wall: '#5666a6',
    roomTint: .3, outline: .07,
    sign: { opacity: .8, tint: '#ffffff', amount: .45 },
    light: { sky: '#aebdff', floor: '#2a2050', ambient: 1.3, sun: '#c6d0ff', sunPower: .9 },
    modelTint: '#b4c0ee',
    frame: '#0c111c', bezel: '#0c111c', lift: '#1b2233', table: '#3b3350', tableLeg: '#161b29',
    rooms: { meet: '#ffb020', meetSign: '#ffb020', project: '#8f7bff', projectSign: '#8f7bff', studio: '#ff4d6d', pantry: '#2ee6c8', lounge: '#d06bff' },
    tag: { bg: 'rgba(12,18,32,.9)', line: 'rgba(53,208,240,.7)', ink: '#e8eef8' },
    bubble: { bg: '#0e1626', line: 'rgba(53,208,240,.85)', ink: '#f1f6ff' },
    ui: {
      paper: '#0e1626', slide: '#0b1220', card: '#16203a', line: '#26324a',
      ink: '#e8eef8', inkHi: '#ffffff', ink2: '#b4c0d4', mute: '#8391ab', mute2: '#55627a',
      brand: '#35d0f0', brandDark: '#2a8fd6', onBrand: '#06101c', accent: '#35d0f0',
      ok: '#3ddc84', warn: '#ffb020', bad: '#ff5c7a',
      dBg: '#080d1a', dBg2: '#0c1424', dCard: '#111a30', dLine: '#26324a', dTrack: '#1c2742',
      dInk: '#e8eef8', dInk2: '#b4c0d4', dMute: '#8391ab', dMute2: '#5d6a84', dAccent: '#35d0f0', gold: '#ffd166',
      off: '#04070d',
      saver1: '#1a1040', saver2: '#4a2a9a', saverInk: '#ffffff', saverInk2: '#cfc8ff', saverInk3: '#a096e0',
      projPaper: '#0e1626', proj: '#8f7bff', projInk: '#dfe6f5', projTrack: '#232b4a'
    }
  },

  // ---- 離岸風場運維中心：海上平台，外面是海、風機、直升機甲板、吊車、運維船 ----
  // 場景風格多了幾個欄位：scene 場景名稱（js/scenes.js）、fog 遠方的霧、wallStyle 牆的花紋、floor 地板花紋、viewPad 全景時鏡頭多退一點
  offshore: {
    label: '離岸風場運維中心',
    scene: 'offshore', bg: '#bfe1f1', fog: { color: '#bfe1f1', near: 90, far: 330 }, viewPad: 1.1,
    wallStyle: { tex: 'bulkhead', cap: '#f08a24', post: '#39454c' }, floor: { room: 'rubber', corridor: 'grate' },
    wall: '#e6ecef', roomTint: .2, sign: { opacity: .85, tint: '#0d2b3f', amount: .45 },
    light: { sky: '#ffffff', floor: '#4d7f9a', ambient: 1.2, sun: '#fff6e2', sunPower: 1.7 },
    modelTint: '#eef4f7', frame: '#1b262e', bezel: '#1b262e', lift: '#39454c', table: '#8d999f', tableLeg: '#2c363d',
    rooms: { meet: '#e2711d', meetSign: '#b9530b', project: '#1f6fb0', projectSign: '#17548a', studio: '#c8322b', pantry: '#17877a', lounge: '#5b6fd6' },
    tag: { bg: 'rgba(255,255,255,.94)', line: 'rgba(240,138,36,.9)', ink: '#12222e' },
    bubble: { bg: '#ffffff', line: 'rgba(13,43,63,.55)', ink: '#12222e' },
    ui: {
      paper: '#f2f6f8', slide: '#ffffff', card: '#e4edf2', line: '#cbd8df',
      ink: '#12222e', inkHi: '#07141d', ink2: '#33475a', mute: '#5b7083', mute2: '#96a8b6',
      brand: '#1f7ea6', brandDark: '#0d3b5c', onBrand: '#ffffff', accent: '#c9580d',
      ok: '#1f8a55', warn: '#c9580d', bad: '#c8322b',
      dBg: '#071826', dBg2: '#0c2233', dCard: '#0f2a3f', dLine: '#1f4460', dTrack: '#173a54',
      dInk: '#e6f2f8', dInk2: '#b3cbd9', dMute: '#86a3b5', dMute2: '#5f7d90', dAccent: '#4fd6c4', gold: '#ffb703',
      off: '#050f18',
      saver1: '#0d3b5c', saver2: '#3f9cc4', saverInk: '#ffffff', saverInk2: '#d3e9f4', saverInk3: '#a3c8da',
      projPaper: '#f2f6f8', proj: '#1f6fb0', projInk: '#12222e', projTrack: '#d3e0ea'
    }
  },

  // ---- 和風町屋：木造屋、榻榻米、紙拉門、屋簷，外面是枯山水庭園、錦鯉池、松與楓 ----
  machiya: {
    label: '和風町屋',
    scene: 'machiya', bg: '#dfe9d8', fog: { color: '#dfe9d8', near: 70, far: 260 }, viewPad: 1.1,
    wallStyle: { tex: 'shoji', cap: '#4a3122', post: '#4a3122' }, floor: { room: 'tatami', corridor: 'planks' },
    wall: '#f5f0e2', roomTint: .12, sign: { opacity: .8, tint: '#2b2118', amount: .5 },
    light: { sky: '#fff6e6', floor: '#6b5a44', ambient: 1.15, sun: '#ffe9c4', sunPower: 1.5 },
    modelTint: '#f0dcb8', frame: '#3a2a1e', bezel: '#2b2118', lift: '#4a3122', table: '#7a4f2e', tableLeg: '#3a2a1e',
    rooms: { meet: '#b5651d', meetSign: '#8c4a12', project: '#40607a', projectSign: '#2f4a60', studio: '#b3261e', pantry: '#2f6b4f', lounge: '#7a4f8a' },
    tag: { bg: 'rgba(251,247,236,.95)', line: 'rgba(74,49,34,.6)', ink: '#2b2118' },
    bubble: { bg: '#fbf7ec', line: 'rgba(74,49,34,.6)', ink: '#2b2118' },
    ui: {
      paper: '#f5efe0', slide: '#fbf7ec', card: '#ece3cd', line: '#d8ccb0',
      ink: '#2b2118', inkHi: '#1a130c', ink2: '#4a3c2e', mute: '#7a6a56', mute2: '#a89a84',
      brand: '#8c2f1b', brandDark: '#3a2a1e', onBrand: '#fbf7ec', accent: '#2f6b4f',
      ok: '#4f7a3a', warn: '#b5651d', bad: '#b3261e',
      dBg: '#1f1711', dBg2: '#2a2018', dCard: '#2e241b', dLine: '#4a3b2c', dTrack: '#3c2f23',
      dInk: '#f1e7d2', dInk2: '#cdbfa5', dMute: '#a39479', dMute2: '#7d6f59', dAccent: '#d9a441', gold: '#e6b450',
      off: '#15100b',
      saver1: '#3a2a1e', saver2: '#8c5a3c', saverInk: '#fbf7ec', saverInk2: '#e8d9bd', saverInk3: '#c9b596',
      projPaper: '#f5efe0', proj: '#40607a', projInk: '#2b2118', projTrack: '#ddd3bd'
    }
  }
};
