// 辦公環境規劃（待老闆裁示）：整理自會議 M202611030011skun〈討論公司辦公室、會議室、茶水間、其他空間的需求〉的發言與結論。
// 各項 approved：true 核准 / false 不做 / 'later' 暫緩 / null 未定。
// 2026-11-03 老師核准 A 辦公室升級，再核准 B+ 與 D，其他項目暫緩；3D 已呈現 B+、D、A。
window.AGENT_OFFICE_PLAN = {
  title: '辦公環境規劃',
  status: '已裁示',
  meetingId: 'M202611030011skun',
  host: { account: 'dof.liu@gmail.com', team: 'DofGM' },
  decided: '2026/11/03 02:08',
  summary: '11 位代理人投票（每人 2 票，主持人未投），前三名為 B+ 會議／試播室、D 錄課棚、A 辦公室升級。E 檢核站與 F 整合桌併入 B+；預算依優先序分三級（必要／優先／可延後），G 專注區與成果交付區另議，交老闆裁示。H、I 是會議討論中提出、未列入結論決議的項目，一併列出供參考。',
  ranking: [
    { id: 'B+', name: '會議／試播室', votes: 10, inFloor: true },
    { id: 'D', name: '錄課／錄音棚', votes: 8, inFloor: true },
    { id: 'A', name: '辦公室升級', votes: 3, inFloor: true },
    { id: 'C', name: '茶水間', votes: 1, inFloor: true, note: '現有茶水間已具備' }
  ],
  tiers: [
    { level: '必要', items: [
      { id: 'B+', name: '會議／試播室', approved: true, detail: '8 人座；觸控大螢幕＋視訊鏡頭＋全向麥克風；1 台 1080p 原生 16:9 投影或大螢幕（試播、QA 截圖比對）；HDMI／USB-C 切換器；可旋轉直立副螢幕；可書寫玻璃白板牆；看板牆（代理人進度、研究雷達、論文工廠）。E 檢核站、F 整合桌併入。' },
      { id: '電源', name: '網路與電源', approved: 'later', detail: 'B+ 影音＋網路一條獨立迴路接 UPS；H GPU 模擬運算站另一條獨立迴路＋自己的 UPS；I A3 事務機接突波保護插座、不接 UPS（開機湧浪電流易讓 UPS 跳脫）。' }
    ] },
    { level: '優先', items: [
      { id: 'D', name: '錄課／錄音棚', approved: true, detail: '隔音、補光；旁白收音（電容麥克風＋小型隔音罩）；直式拍攝位（9:16 補光燈、手機／相機直立架、背景布），Shorts 與動畫館旁白同棚錄；預留燈光與收音接線，方便接自動化錄製腳本。' },
      { id: 'H', name: 'GPU 模擬運算站', approved: 'later', detail: '（會議中由自來也提出，未列入結論決議）Blender 建模、液壓／變槳模擬、影片算圖；放 B+ 旁。' },
      { id: 'I', name: '文件輸出站', approved: 'later', detail: '（會議中由鼬提出，未列入結論決議）A3 彩色多功能事務機（雙面、自動送稿）＋可上鎖文件櫃；放成果交付區旁。' }
    ] },
    { level: '可延後', items: [
      { id: 'A', name: '辦公室升級', approved: true, detail: '每人雙螢幕＋電動升降桌、2 間單人隔音電話亭。' },
      { id: '其他', name: '作品展示牆、休憩沙發區', approved: 'later', detail: '' }
    ] },
    { level: '另議', items: [
      { id: 'G', name: '專注區', approved: 'later', detail: '4 個靠窗禁止通話座位，可調色溫檯燈與降噪隔板，與電話亭相鄰、吵靜分流。' },
      { id: '交付', name: '成果交付區', approved: 'later', detail: '實體一區＋雲端一份（對應各會議的共用交付資料夾）。' }
    ] }
  ]
};
