"use strict";

(function () {
  const ASSET = "https://raw.githubusercontent.com/LBEILC/StrongholdAssistant/main/src/ui/public/assets/";
  const styleNode = document.createElement("style");
  styleNode.textContent = "\n.operator-card{gap:6px;justify-content:flex-start;padding:5px 8px}\n.operator-avatar{width:34px;height:34px;object-fit:cover;border-radius:6px;flex:0 0 34px;background:#141a21}\n.operator-card.banned{opacity:.58;filter:grayscale(1);border-style:dashed}\n.ban-mark{position:absolute;left:5px;top:4px;background:#7b3038;color:#fff;border-radius:4px;padding:1px 4px;font-size:10px;z-index:1}\n.covenant-button{display:inline-flex;align-items:center;gap:5px}\n.bond-icon{width:20px;height:20px;object-fit:contain;vertical-align:middle}\n.detail-avatar{width:88px;height:88px;object-fit:cover;border-radius:10px;float:right;margin:0 0 12px 14px;background:#141a21}\n.ban-panel{display:flex;flex-direction:column;gap:12px}\n.ban-section,.enemy-card{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:12px}\n.ban-grid,.wave-type-row,.wave-rounds{display:flex;flex-wrap:wrap;gap:7px}\n.ban-op{display:inline-flex;align-items:center;gap:6px;padding:5px 8px}\n.ban-op img{width:26px;height:26px;object-fit:cover;border-radius:5px}\n.ban-op.banned,.ban-covenant.banned{border-color:#d65b67;background:#48272e}\n.wave-type{display:inline-flex;align-items:center;gap:6px}\n.wave-type img{width:23px;height:23px;object-fit:contain}\n.wave-type.active{background:#285044;border-color:var(--accent)}\n.wave-round-button{min-width:42px}\n.enemy-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:8px}\n.enemy-card{display:flex;align-items:center;gap:9px;min-width:0}\n.enemy-card img{width:54px;height:54px;object-fit:contain;flex:0 0 54px;background:#141a21;border-radius:6px}\n.enemy-card.highlighted{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}\n.enemy-card.dimmed{opacity:.35}\n.enemy-card small,.wave-note{display:block;color:var(--muted);margin-top:4px;font-size:12px}\n";
  document.head.appendChild(styleNode);
  const BOND = {
    "乌萨斯":"ursus","伊比利亚":"iberia","卡西米尔":"kazimierz","叙拉古":"siracusa","炎":"yan","维多利亚":"victoria","莱塔尼亚":"lethania","萨尔贡":"sargon","谢拉格":"kjerag","阿戈尔":"egir","不屈":"indom","助力":"deput","协防干员":"empty","坚守":"stead","奇迹":"mira","奥术":"arcane","投资人":"invest","灵巧":"skillful","独行":"solo","突袭":"raid","精准":"preci","绝技":"sunt","聚合":"doc","调和":"mani","迅捷":"swift","远见":"visi"
  };
  const TYPE_ORDER = ["SPECIAL","FLY","TIMES","ELEMENT","DOT","INVISIBLE","REFLECTION","CRITIC","REBORN"];
  const TYPE_LABEL = {SPECIAL:"特异",FLY:"飞行",TIMES:"频次",ELEMENT:"元素",DOT:"持续",INVISIBLE:"隐匿",REFLECTION:"折射",CRITIC:"致命",REBORN:"复苏"};
  const banned = new Set();
  let selectedTypes = [];
  let selectedRound = "1";
  let spawnData = null;
  let typeData = null;
  const $ = s => document.querySelector(s);
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const opImg = name => ASSET + "data/operators/" + encodeURIComponent(name) + ".webp";
  const enemyImg = id => ASSET + "data/enemies/" + id + ".webp";
  const bossImg = id => ASSET + "data/bosses/" + id + ".webp";
  const bondImg = name => ASSET + "game/bond/" + (BOND[name] || "empty") + ".png";
  const validOps = () => (DATABASE.operators && DATABASE.operators.operators || []).filter(op => (op.normal && op.normal.traits || []).length || (op.elite && op.elite.traits || []).length);
  const covenantOps = name => validOps().filter(op => (op.coreCovenants || []).includes(name) || (op.additionalCovenants || []).includes(name));
  const oldRenderStats = renderStats;
  const oldRenderCovenants = renderCovenantButtons;
  const oldRenderDetail = renderDetail;
  const oldRenderCards = renderOperatorCards;
  const oldRenderList = renderList;
  const oldSwitchTab = switchTab;
  const oldUpdateToolbar = updateToolbar;
  const oldGetOperatorRecords = getOperatorRecords;
  const oldGetRecords = getRecords;
  const oldGetOperatorByName = getOperatorByName;

  function filterOutExtras() {
    if (DATABASE.operators && Array.isArray(DATABASE.operators.operators)) {
      DATABASE.operators.operators = validOps();
    }
  }

  renderStats = function () {
    filterOutExtras();
    return oldRenderStats();
  };

  renderCovenantButtons = function () {
    oldRenderCovenants();
    document.querySelectorAll("[data-core-covenant],[data-additional-covenant]").forEach(btn => {
      const name = btn.dataset.coreCovenant || btn.dataset.additionalCovenant;
      btn.insertAdjacentHTML("afterbegin", '<img class="bond-icon" src="' + bondImg(name) + '" alt="">');
    });
  };

  getOperatorRecords = function () {
    let rows = validOps();
    if (selectedCoreCovenant) rows = rows.filter(op => (op.coreCovenants || []).includes(selectedCoreCovenant));
    if (selectedAdditionalCovenant) rows = rows.filter(op => (op.additionalCovenants || []).includes(selectedAdditionalCovenant));
    return rows;
  };

  getRecords = function (type) {
    if (type === "operators") return validOps();
    if (type === "favorites") return validOps().filter(op => favoriteOperators.has(op.name));
    return oldGetRecords(type);
  };

  getOperatorByName = function (name) {
    return validOps().find(op => op.name === name);
  };

  renderTags = function (values, clickable) {
    if (!Array.isArray(values)) return "";
    return values.map(value => '<span class="pill"' + (clickable ? ' data-open-covenant="' + esc(value) + '"' : "") + '><img src="' + bondImg(value) + '" style="width:17px;height:17px;object-fit:contain;vertical-align:middle;margin-right:4px" alt="">' + esc(value) + '</span>').join("");
  };

  renderDetail = function (item) {
    let html = oldRenderDetail(item);
    if (item && item.coreCovenants) {
      html = '<img class="detail-avatar" src="' + opImg(item.name) + '" alt=""><div class="ban-state">' +
        (banned.has(item.name) ? '<b style="color:#ff8994">⛔ 已加入 Ban 名单</b>' : '<span style="color:var(--muted)">当前未 Ban</span>') +
        '<button type="button" id="toggleDetailBan" style="display:block;margin:9px 0">' + (banned.has(item.name) ? "取消 Ban" : "Ban 此干员") + '</button></div>' + html;
    } else if (item && item.enemyId) {
      html = '<img class="detail-avatar" src="' + bossImg(item.enemyId) + '" alt="">' + html;
    }
    return html;
  };

  renderOperatorCards = function (records) {
    const keyword = $("#search").value.trim().toLowerCase();
    let filtered = records.filter(op => !keyword || getSearchText(op).includes(keyword));
    if (currentTab === "favorites") filtered = filtered.filter(op => favoriteOperators.has(op.name));
    let html = "";
    for (let tier = 1; tier <= 6; tier++) {
      const rows = filtered.filter(op => Number(op.tier) === tier);
      if (!rows.length) continue;
      html += '<div class="tier-group"><div class="tier-heading tier-' + tier + '">' + tier + ' 阶干员 <span class="tier-count">' + rows.length + ' 人</span></div><div class="operator-grid">';
      rows.forEach(op => {
        const fav = favoriteOperators.has(op.name);
        const isBanned = banned.has(op.name);
        html += '<div class="operator-card tier-' + tier + (selectedName === op.name ? ' selected' : '') + (isBanned ? ' banned' : '') + '" data-operator="' + esc(op.name) + '" title="' + esc(op.name) + '">' +
          (isBanned ? '<span class="ban-mark">BAN</span>' : '') +
          '<img class="operator-avatar" src="' + opImg(op.name) + '" alt="" loading="lazy">' +
          '<span class="operator-name">' + esc(op.name) + '</span>' +
          '<span class="operator-heart ' + (fav ? '' : 'empty') + '" data-favorite="' + esc(op.name) + '" title="' + (fav ? "取消收藏" : "收藏干员") + '">' + (fav ? "❤️" : "🩶") + '</span></div>';
      });
      html += '</div></div>';
    }
    return html || '<div class="empty-message">没有找到符合条件的干员</div>';
  };

  function toggleBan(name) {
    if (banned.has(name)) banned.delete(name);
    else banned.add(name);
  }

  function toggleCovenantBan(name) {
    const members = covenantOps(name);
    const allBanned = members.length > 0 && members.every(op => banned.has(op.name));
    members.forEach(op => allBanned ? banned.delete(op.name) : banned.add(op.name));
  }

  function renderBanPage() {
    const covenants = DATABASE.covenants && DATABASE.covenants.covenants || [];
    const ops = validOps();
    const bannedOps = ops.filter(op => banned.has(op.name));
    $("#list").innerHTML = '<div class="ban-panel">' +
      '<div class="ban-section"><h3>按盟约 Ban</h3><p class="wave-note">点击盟约，将其覆盖的全部干员加入或移出 Ban 名单。</p><div class="ban-grid">' +
      covenants.map(c => {
        const members = covenantOps(c.name);
        const count = members.filter(op => banned.has(op.name)).length;
        return '<button type="button" class="ban-covenant ' + (count === members.length && count ? "banned" : "") + '" data-ban-covenant="' + esc(c.name) + '"><img class="bond-icon" src="' + bondImg(c.name) + '" alt="">' + esc(c.name) + ' <small>' + count + '/' + members.length + '</small></button>';
      }).join("") +
      '</div></div><div class="ban-section"><h3>单独 Ban 干员</h3><div class="ban-grid">' +
      ops.map(op => '<button type="button" class="ban-op ' + (banned.has(op.name) ? "banned" : "") + '" data-ban-operator="' + esc(op.name) + '"><img src="' + opImg(op.name) + '" alt="" loading="lazy">' + esc(op.name) + '</button>').join("") +
      '</div></div></div>';
    $("#detail").innerHTML = '<h2>当前 Ban 名单（' + bannedOps.length + '）</h2><button type="button" id="clearBansButton">一键清空 Ban</button>' +
      (bannedOps.length ? '<div class="ban-grid" style="margin-top:12px">' + bannedOps.map(op => '<button type="button" class="ban-op banned" data-ban-operator="' + esc(op.name) + '"><img src="' + opImg(op.name) + '" alt="">' + esc(op.name) + ' ×</button>').join("") + '</div>' : '<p class="empty-message">当前没有 Ban 干员</p>');
  }

  function renderWavePage() {
    if (!spawnData || !typeData) {
      $("#list").innerHTML = '<div class="empty-message">敌人波次数据加载中……</div>';
      $("#detail").innerHTML = '<p class="wave-note">正在读取上游波次资料。</p>';
      return;
    }
    const rounds = Object.keys(spawnData.rounds || {}).sort((a,b) => Number(a)-Number(b));
    const candidates = (spawnData.rounds && spawnData.rounds[selectedRound]) || [];
    const filtered = candidates;
    $("#list").innerHTML = '<div class="wave-panel">' +
      '<div class="ban-section"><h3>敌人特征（最多同时高亮 3 类）</h3><div class="wave-type-row">' +
      TYPE_ORDER.map(code => '<button type="button" class="wave-type ' + (selectedTypes.includes(code) ? "active" : "") + '" data-enemy-type="' + code + '"><img src="' + ASSET + 'data/enemy_types/' + code + '.webp" alt="">' + esc(TYPE_LABEL[code]) + '</button>').join("") +
      '<button type="button" id="clearEnemyTypes">取消全部高亮</button></div></div>' +
      '<div class="ban-section"><h3>波次</h3><div class="wave-rounds">' +
      rounds.map(n => '<button type="button" class="wave-round-button ' + (selectedRound === n ? "active" : "") + '" data-round="' + n + '">' + n + '</button>').join("") +
      '<button type="button" class="wave-round-button ' + (selectedRound === "14" ? "active" : "") + '" data-round="14">14 · 首领</button><button type="button" class="wave-round-button ' + (selectedRound === "15" ? "active" : "") + '" data-round="15">15 · 首领</button>' +
      '</div></div>';
    if (selectedRound === "14" || selectedRound === "15") {
      const bosses = spawnData.endgame && spawnData.endgame[selectedRound] || [];
      $("#list").innerHTML += '<div class="ban-section"><h3>第 ' + selectedRound + ' 回合首领</h3><div class="enemy-grid">' +
        bosses.map(b => '<div class="enemy-card"><img src="' + bossImg(b.bossKey) + '" alt=""><div><strong>' + esc(b.name) + '</strong><small>' + esc(b.stageId || "") + '</small></div></div>').join("") + '</div></div></div>';
      $("#detail").innerHTML = '<h2>首领回合</h2><p>该回合首领及其关卡标识来自上游 endgame 数据。</p>' +
        bosses.map(b => '<div class="trait"><strong>' + esc(b.name) + '</strong><p class="wave-note">' + (b.actions || []).map(a => esc(a.enemy) + ' × ' + a.count + '（' + esc(a.gate) + '）').join("；") + '</p></div>').join("");
      return;
    }
    $("#list").innerHTML += '<div class="ban-section"><h3>第 ' + selectedRound + ' 波 · ' + filtered.length + ' 种候选敌人</h3><p class="wave-note">权重与概率采用上游数据；选择特征后，符合的敌人高亮显示，其余候选仍保留。</p><div class="enemy-grid">' +
      filtered.map(e => '<div class="enemy-card ' + (selectedTypes.length ? (selectedTypes.includes(e.type) ? "highlighted" : "dimmed") : "") + '"><img src="' + enemyImg(e.key) + '" alt="" loading="lazy"><div><strong>' + esc(e.name) + '</strong><small>' + esc(TYPE_LABEL[e.type] || e.type) + ' · 权重 ' + esc(e.weight) + ' · 概率 ' + (Number(e.prob || 0) * 100).toFixed(1) + '%</small></div></div>').join("") +
      '</div></div></div>';
    $("#detail").innerHTML = '<h2>第 ' + selectedRound + ' 波次详情</h2><p>候选敌人共 ' + candidates.length + ' 种。点击敌人特征按钮可同时选择最多三类进行高亮筛选。</p>' +
      filtered.slice(0, 35).map(e => '<div class="trait"><strong>' + esc(e.name) + '</strong><p class="wave-note">' + (e.acts || []).map(a => esc(a.enemy) + ' × ' + a.count + '（' + esc(a.gate) + '）').join("；") + '</p></div>').join("");
  }

  renderList = function () {
    if (currentTab === "ban") { renderBanPage(); return; }
    if (currentTab === "waves") { renderWavePage(); return; }
    if (currentTab === "bosses") {
      const records = getRecords("bosses");
      const keyword = $("#search").value.trim().toLowerCase();
      const filtered = records.map((item,index) => ({item,index})).filter(x => !keyword || getSearchText(x.item).includes(keyword));
      $("#list").innerHTML = filtered.map(x => '<div class="item ' + (selectedName === getName(x.item) ? "selected" : "") + '" data-index="' + x.index + '"><img src="' + bossImg(x.item.enemyId) + '" style="width:42px;height:42px;object-fit:contain;vertical-align:middle;margin-right:9px" alt=""><strong style="display:inline">' + esc(getName(x.item)) + '</strong></div>').join("");
      const selected = records.find(x => getName(x) === selectedName);
      $("#detail").innerHTML = renderDetail(selected);
      return;
    }
    return oldRenderList();
  };

  updateToolbar = function () {
    oldUpdateToolbar();
    const specialTab = currentTab === "ban" || currentTab === "waves";
    $("#search").style.display = specialTab ? "none" : "";
    if (specialTab) $("#covenantToolbar").style.display = "none";
  };

  switchTab = function (tab) {
    if (tab !== "ban" && tab !== "waves") return oldSwitchTab(tab);
    currentTab = tab;
    selectedName = null;
    $("#search").value = "";
    updateTabButtons();
    updateToolbar();
    renderList();
  };

  // Capture clicks first so banned operators cannot be selected.
  $("#list").addEventListener("click", function (event) {
    const card = event.target.closest("[data-operator]");
    if (card && banned.has(card.dataset.operator)) {
      event.stopImmediatePropagation();
      return;
    }
  }, true);

  $("#list").addEventListener("click", function (event) {
    const covenant = event.target.closest("[data-ban-covenant]");
    if (covenant) { toggleCovenantBan(covenant.dataset.banCovenant); renderBanPage(); return; }
    const operator = event.target.closest("[data-ban-operator]");
    if (operator) { toggleBan(operator.dataset.banOperator); renderBanPage(); return; }
    const type = event.target.closest("[data-enemy-type]");
    if (type) {
      const code = type.dataset.enemyType;
      if (selectedTypes.includes(code)) selectedTypes = selectedTypes.filter(x => x !== code);
      else if (selectedTypes.length < 3) selectedTypes.push(code);
      renderWavePage(); return;
    }
    const round = event.target.closest("[data-round]");
    if (round) { selectedRound = round.dataset.round; renderWavePage(); return; }
    if (event.target.closest("#clearEnemyTypes")) { selectedTypes = []; renderWavePage(); }
  });

  $("#detail").addEventListener("click", function (event) {
    if (event.target.closest("#clearBansButton")) { banned.clear(); renderBanPage(); return; }
    if (event.target.closest("#toggleDetailBan")) {
      const op = getOperatorByName(selectedName);
      if (op) { toggleBan(op.name); renderList(); }
    }
  });

  // The upstream JSON contains temporary/out-of-roster entries with no traits.
  // Filter them once the original database fetch has completed.
  const poll = window.setInterval(function () {
    if (DATABASE.operators && DATABASE.operators.operators && DATABASE.covenants) {
      filterOutExtras();
      window.clearInterval(poll);
      renderStats();
      renderCovenantButtons();
      if (currentTab === "operators") renderList();
    }
  }, 100);

  Promise.all([
    fetch("https://raw.githubusercontent.com/LBEILC/StrongholdAssistant/main/data/garrison_spawns.json").then(r => { if (!r.ok) throw new Error("garrison_spawns.json"); return r.json(); }),
    fetch("https://raw.githubusercontent.com/LBEILC/StrongholdAssistant/main/data/enemy_types.json").then(r => { if (!r.ok) throw new Error("enemy_types.json"); return r.json(); })
  ]).then(values => {
    spawnData = values[0];
    typeData = values[1].types || {};
    if (currentTab === "waves") renderWavePage();
  }).catch(error => {
    console.error("敌人资料加载失败", error);
    if (currentTab === "waves") $("#list").innerHTML = '<div class="empty-message">敌人资料加载失败，请检查网络连接。</div>';
  });

  // ===== 固定视口布局、屏幕方向检测、主题、补齐导航与图标 =====
  const layoutStyle = document.createElement("style");
  layoutStyle.textContent = `
    html,body{width:100%;height:100%;height:100dvh;overflow:hidden}
    body{display:flex;flex-direction:column;min-height:0}
    header{flex:0 0 auto;padding:8px 16px;display:flex;align-items:center;gap:12px;min-height:46px}
    header h1{font-size:18px;white-space:nowrap}
    header p{margin:0;font-size:11px;line-height:1.35}
    main{width:100%;max-width:none;flex:1 1 auto;min-height:0;overflow:hidden;padding:8px 14px;display:flex;flex-direction:column;gap:7px}
    #status{flex:0 0 auto;margin:0;padding:5px 9px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .stats{flex:0 0 auto;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px;margin:0}
    .stat{padding:5px 9px;border-radius:6px}
    .stat b{font-size:16px}.stat span{font-size:10px}
    .tabs{flex:0 0 auto;gap:5px;margin:0;flex-wrap:nowrap;overflow-x:auto;overflow-y:hidden;padding-bottom:2px}
    .tabs button{flex:0 0 auto;padding:6px 11px;font-size:12px;white-space:nowrap}
    .toolbar{flex:0 0 auto;gap:5px;margin:0;min-height:0}
    #search{padding:7px 9px;font-size:12px}
    .covenant-row{gap:4px}.covenant-row-label{flex-basis:64px;padding:5px 0;font-size:11px}
    .covenant-buttons{gap:4px}.covenant-button{padding:4px 7px;font-size:11px}
    .toolbar-bottom{gap:5px}.toolbar-bottom button{padding:5px 8px;font-size:11px}
    .content{flex:1 1 auto;min-height:0;overflow:hidden;grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);gap:8px;align-items:stretch}
    .list,.detail{min-height:0;height:100%;max-height:none;overflow:auto;overscroll-behavior:contain;padding:10px}
    .detail{padding:12px}
    .detail h2{font-size:18px}.detail h3{margin:13px 0 7px;font-size:13px}
    footer{display:none}
    .ban-section{padding:9px}.ban-section h3{margin:2px 0 7px}
    .theme-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:9px}
    .theme-choice{display:flex;align-items:center;gap:9px;text-align:left;padding:10px}
    .theme-swatch{width:38px;height:38px;flex:0 0 38px;border-radius:8px;border:1px solid #ffffff55;display:block}
    .theme-choice.active{outline:2px solid var(--accent);outline-offset:1px}
    .resolution-chip{margin-left:auto;color:var(--muted);font-size:10px;white-space:nowrap}
    .data-icon{width:42px;height:42px;object-fit:contain;vertical-align:middle;margin-right:10px;border-radius:6px}
    .item{display:flex;align-items:center;gap:4px;padding:8px 10px}
    .item strong{display:inline}
    .operator-card{min-height:48px}
    .wave-panel,.ban-panel{min-width:0}
    @media(max-aspect-ratio: 0.88){
      header{padding:6px 10px;min-height:38px}
      header h1{font-size:15px}
      header p{display:none}
      main{padding:6px;gap:5px}
      .stats{grid-template-columns:repeat(6,minmax(50px,1fr));overflow-x:auto}
      .stat{padding:4px 6px}.stat b{font-size:13px}.stat span{font-size:9px}
      .content{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:5px}
      .list,.detail{padding:8px}
      .tabs button{padding:6px 9px}
      .covenant-row-label{flex-basis:48px;font-size:10px}
    }
    @media(max-height:650px){
      header{min-height:34px;padding:4px 10px}
      header h1{font-size:15px}
      main{padding:5px 8px;gap:4px}
      .stats{gap:4px}.stat{padding:3px 6px}
      .stat b{font-size:13px}.stat span{font-size:9px}
      .tabs button{padding:4px 8px}
      .toolbar{gap:3px}
      #search{padding:5px 8px}
      .covenant-button{padding:3px 5px}
    }
  `;
  document.head.appendChild(layoutStyle);

  // 读取设备显示分辨率，按物理屏幕方向/比例设置布局类别。
  function applyScreenProfile() {
    const dpr = window.devicePixelRatio || 1;
    const sw = Math.round((window.screen && window.screen.width || window.innerWidth) * dpr);
    const sh = Math.round((window.screen && window.screen.height || window.innerHeight) * dpr);
    const ratio = sw / Math.max(sh, 1);
    const profile = ratio > 1.12 ? "landscape" : ratio < 0.88 ? "portrait" : "square";
    document.documentElement.dataset.screenProfile = profile;
  }
  applyScreenProfile();
  window.addEventListener("resize", applyScreenProfile);
  if (window.screen && window.screen.orientation) {
    window.screen.orientation.addEventListener("change", applyScreenProfile);
  }

  // 主题方案：仅覆盖 CSS 变量，不改变数据或页面结构。
  const THEMES = {
    midnight:{name:"午夜黑",bg:"#101319",panel:"#191f29",panel2:"#252e3b",line:"#394656",text:"#e9eef5",muted:"#9aa9ba",accent:"#7bceb7",headerBg:"#090c11",activeBg:"#244a40",activeText:"#f1fff9",tagBg:"#202c32",tagText:"#dcece5",tagHoverBg:"#285044",cardBg:"#202833",cardHoverBg:"#303c49",selectedBg:"#30483f"},
    orange:{name:"阳光橙",bg:"#21170f",panel:"#302116",panel2:"#49301e",line:"#705039",text:"#fff0dc",muted:"#c5a98d",accent:"#ffad55",headerBg:"#160e09",activeBg:"#714018",activeText:"#fff8ed",tagBg:"#49301e",tagText:"#fff0dc",tagHoverBg:"#714018",cardBg:"#39281d",cardHoverBg:"#59402b",selectedBg:"#62401f"},
    blue:{name:"远峰蓝",bg:"#101b2a",panel:"#192a3e",panel2:"#233b55",line:"#385875",text:"#e5f1ff",muted:"#9eb5cc",accent:"#78b9f2",headerBg:"#0a1320",activeBg:"#244c70",activeText:"#f0f8ff",tagBg:"#203a50",tagText:"#e5f1ff",tagHoverBg:"#315d80",cardBg:"#1d3045",cardHoverBg:"#2a4662",selectedBg:"#244c70"},
    jade:{name:"青瓷绿",bg:"#111d1b",panel:"#1b2c28",panel2:"#294039",line:"#45675d",text:"#e5f4ed",muted:"#a1bdb1",accent:"#8bd3b1",headerBg:"#091411",activeBg:"#285a48",activeText:"#f0fff7",tagBg:"#233b33",tagText:"#e5f4ed",tagHoverBg:"#356b54",cardBg:"#20352e",cardHoverBg:"#315344",selectedBg:"#285a48"},
    sakura:{name:"樱花粉",bg:"#211820",panel:"#30232f",panel2:"#493244",line:"#6c4a62",text:"#fff0f7",muted:"#c9aabb",accent:"#f0a6c8",headerBg:"#160f16",activeBg:"#70415d",activeText:"#fff5fa",tagBg:"#493244",tagText:"#fff0f7",tagHoverBg:"#70415d",cardBg:"#3b2b3b",cardHoverBg:"#59405a",selectedBg:"#70415d"},
    ivory:{name:"暖玉白",bg:"#e9e3d8",panel:"#f7f2e9",panel2:"#e6ded0",line:"#c9bda9",text:"#302b25",muted:"#766d62",accent:"#b87943",headerBg:"#d9d0c1",activeBg:"#e6c5a3",activeText:"#302319",tagBg:"#e3d8c8",tagText:"#393027",tagHoverBg:"#d5b48e",cardBg:"#f1eadd",cardHoverBg:"#e6d6c2",selectedBg:"#e6c5a3"},
    violet:{name:"暮色紫",bg:"#171426",panel:"#242039",panel2:"#353052",line:"#514a75",text:"#f0edff",muted:"#b2accd",accent:"#b8a0ff",headerBg:"#0e0b1b",activeBg:"#51417d",activeText:"#faf7ff",tagBg:"#353052",tagText:"#f0edff",tagHoverBg:"#51417d",cardBg:"#2b2744",cardHoverBg:"#40395f",selectedBg:"#51417d"},
    crimson:{name:"赤焰",bg:"#211315",panel:"#321d22",panel2:"#4a292f",line:"#754149",text:"#ffedf0",muted:"#c9a4aa",accent:"#f07883",headerBg:"#160b0e",activeBg:"#74313b",activeText:"#fff5f5",tagBg:"#48272e",tagText:"#ffedf0",tagHoverBg:"#74313b",cardBg:"#3b242a",cardHoverBg:"#5c3039",selectedBg:"#74313b"},
    ocean:{name:"深海青",bg:"#0d1b22",panel:"#142b35",panel2:"#1e3d49",line:"#355d69",text:"#e2f7fb",muted:"#9bbbc3",accent:"#62c9df",headerBg:"#071218",activeBg:"#1b5868",activeText:"#f0fdff",tagBg:"#1e3d49",tagText:"#e2f7fb",tagHoverBg:"#1b5868",cardBg:"#193440",cardHoverBg:"#245263",selectedBg:"#1b5868"},
    graphite:{name:"石墨灰",bg:"#191b1e",panel:"#25292e",panel2:"#343a42",line:"#4d565f",text:"#f0f2f4",muted:"#aab2ba",accent:"#c0c8d0",headerBg:"#101215",activeBg:"#48545f",activeText:"#ffffff",tagBg:"#343a42",tagText:"#f0f2f4",tagHoverBg:"#48545f",cardBg:"#2b3036",cardHoverBg:"#414950",selectedBg:"#48545f"},
    lavender:{name:"薰衣草",bg:"#1c1a27",panel:"#292638",panel2:"#3d3951",line:"#5d5677",text:"#f4f0ff",muted:"#b8b0ce",accent:"#c5a9ff",headerBg:"#11101a",activeBg:"#574775",activeText:"#fffaff",tagBg:"#3d3951",tagText:"#f4f0ff",tagHoverBg:"#574775",cardBg:"#302c43",cardHoverBg:"#49415f",selectedBg:"#574775"},
    sunset:{name:"落日余晖",bg:"#241a19",panel:"#382622",panel2:"#52372d",line:"#795344",text:"#fff1e5",muted:"#c9a995",accent:"#ff9b72",headerBg:"#170f0e",activeBg:"#82442f",activeText:"#fff7f0",tagBg:"#52372d",tagText:"#fff1e5",tagHoverBg:"#82442f",cardBg:"#432b25",cardHoverBg:"#684332",selectedBg:"#82442f"},
    sapphire:{name:"极夜蓝",bg:"#111629",panel:"#1c2440",panel2:"#293457",line:"#465581",text:"#edf1ff",muted:"#a8b3d2",accent:"#8da8ff",headerBg:"#080d1c",activeBg:"#344e91",activeText:"#f6f8ff",tagBg:"#293457",tagText:"#edf1ff",tagHoverBg:"#344e91",cardBg:"#222c4b",cardHoverBg:"#35466f",selectedBg:"#344e91"},
    wine:{name:"葡萄酒红",bg:"#21151d",panel:"#34212e",panel2:"#4b3041",line:"#76516a",text:"#fff0f8",muted:"#c7a8ba",accent:"#df8bb5",headerBg:"#160d13",activeBg:"#713e5c",activeText:"#fff7fb",tagBg:"#4b3041",tagText:"#fff0f8",tagHoverBg:"#713e5c",cardBg:"#3d2939",cardHoverBg:"#5b3b55",selectedBg:"#713e5c"},
    glacier:{name:"冰川蓝",bg:"#14212a",panel:"#203541",panel2:"#2e4856",line:"#527181",text:"#edfaff",muted:"#acc8d2",accent:"#9ce3f2",headerBg:"#0b151c",activeBg:"#3c7184",activeText:"#ffffff",tagBg:"#2e4856",tagText:"#edfaff",tagHoverBg:"#3c7184",cardBg:"#263f4b",cardHoverBg:"#3a5b6b",selectedBg:"#3c7184"},
    amber:{name:"琥珀金",bg:"#211b10",panel:"#332916",panel2:"#4c3a1e",line:"#76603a",text:"#fff5dc",muted:"#c8b58a",accent:"#f2c35e",headerBg:"#171207",activeBg:"#79551d",activeText:"#fff9e9",tagBg:"#4c3a1e",tagText:"#fff5dc",tagHoverBg:"#79551d",cardBg:"#3e301b",cardHoverBg:"#5e4824",selectedBg:"#79551d"},
    rose:{name:"玫瑰金",bg:"#211a1a",panel:"#342727",panel2:"#4b3939",line:"#765b5b",text:"#fff2ef",muted:"#cbb0aa",accent:"#e6a18d",headerBg:"#171010",activeBg:"#825044",activeText:"#fff8f5",tagBg:"#4b3939",tagText:"#fff2ef",tagHoverBg:"#825044",cardBg:"#3d2e2e",cardHoverBg:"#5c4140",selectedBg:"#825044"},
    royal:{name:"皇家紫",bg:"#171323",panel:"#251d36",panel2:"#382b52",line:"#5b467e",text:"#f5efff",muted:"#b9a9d2",accent:"#c29bff",headerBg:"#0d0917",activeBg:"#65469a",activeText:"#fffaff",tagBg:"#382b52",tagText:"#f5efff",tagHoverBg:"#65469a",cardBg:"#2e2344",cardHoverBg:"#4a356b",selectedBg:"#65469a"},
    sand:{name:"沙漠沙色",bg:"#28231c",panel:"#3b3328",panel2:"#514637",line:"#796a52",text:"#fff7e9",muted:"#c7b99f",accent:"#e4c18a",headerBg:"#19150f",activeBg:"#806344",activeText:"#fffaf1",tagBg:"#514637",tagText:"#fff7e9",tagHoverBg:"#806344",cardBg:"#443a2d",cardHoverBg:"#66543d",selectedBg:"#806344"},
    magenta:{name:"霓虹洋红",bg:"#201221",panel:"#321e35",panel2:"#4c2b50",line:"#784b7c",text:"#fff0ff",muted:"#c9a7ce",accent:"#f08aff",headerBg:"#140a16",activeBg:"#793d83",activeText:"#fff8ff",tagBg:"#4c2b50",tagText:"#fff0ff",tagHoverBg:"#793d83",cardBg:"#3c2541",cardHoverBg:"#603a68",selectedBg:"#793d83"}
  };
  const THEME_KEY = "stronghold_ui_theme";
  function applyTheme(key) {
    const theme = THEMES[key] || THEMES.midnight;
    const root = document.documentElement.style;
    Object.entries(theme).forEach(([k,v]) => {
      if (k !== "name") {
        const cssName = k.replace(/[A-Z]/g, letter => "-" + letter.toLowerCase());
        root.setProperty("--" + cssName, v);
      }
    });
    document.body.dataset.theme = key;
    try { localStorage.setItem(THEME_KEY, key); } catch (_) {}
    document.querySelectorAll("[data-theme-choice]").forEach(btn => btn.classList.toggle("active", btn.dataset.themeChoice === key));
  }
  let activeTheme = "midnight";
  try { activeTheme = localStorage.getItem(THEME_KEY) || "midnight"; } catch (_) {}
  applyTheme(activeTheme);

  // 增加缺失的导航入口；原页面事件代理可直接处理这些按钮。
  const nav = $("#tabs");
  const extraTabs = [
    ["ban","Ban干员"],
    ["waves","敌人"],
    ["theme","主题色"]
  ];
  extraTabs.forEach(([id,label]) => {
    if (!nav.querySelector('[data-tab="' + id + '"]')) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.tab = id;
      button.textContent = label;
      nav.appendChild(button);
    }
  });

  // Navigation order: operators, favorites, ban, then the reference-data pages.
  const tabLabels = {
    operators:"干员", favorites:"收藏干员", ban:"Ban干员",
    covenants:"盟约", equipment:"装备", strategies:"策略",
    bosses:"首领", maps:"地图", waves:"敌人", theme:"主题色"
  };
  Object.entries(tabLabels).forEach(([id,label]) => {
    const button = nav.querySelector('[data-tab="' + id + '"]');
    if (button) button.textContent = label;
  });
  const tabOrder = ["operators","favorites","ban","covenants","equipment","strategies","bosses","maps","waves","theme"];
  tabOrder.forEach(id => {
    const button = nav.querySelector('[data-tab="' + id + '"]');
    if (button) nav.appendChild(button);
  });

  function renderThemePage() {
    $("#list").innerHTML = '<div class="ban-section"><h2>主题色设置</h2><p class="wave-note">选择一套配色，设置会保存在当前浏览器中。</p><div class="theme-grid">' +
      Object.entries(THEMES).map(([key,t]) => '<button type="button" class="theme-choice ' + (activeTheme === key ? "active" : "") + '" data-theme-choice="' + key + '"><span class="theme-swatch" style="background:linear-gradient(135deg,' + t.bg + ' 0 33%, ' + t.panel + ' 33% 66%, ' + t.accent + ' 66%)"></span><span><strong>' + t.name + '</strong><small class="wave-note">界面配色预览</small></span></button>').join("") +
      '</div></div>';
    $("#detail").innerHTML = '<h2>界面显示</h2><p>当前主题：' + (THEMES[activeTheme] || THEMES.midnight).name + '</p><p class="wave-note">主题仅影响网页颜色，不会修改上游资料。</p>';
  }


  // 覆盖切换逻辑，保证所有新增页面都能进入且工具栏状态正确。
  const previousSwitchTab = switchTab;
  switchTab = function(tab) {
    if (!["ban","waves","theme"].includes(tab)) return previousSwitchTab(tab);
    currentTab = tab;
    selectedName = null;
    $("#search").value = "";
    updateTabButtons();
    updateToolbar();
    $("#search").style.display = "none";
    $("#covenantToolbar").style.display = "none";
    $("#filter").style.display = "none";
    renderList();
  };

  const previousRenderList = renderList;
  renderList = function() {
    if (currentTab === "theme") { renderThemePage(); return; }
    return previousRenderList();
  };

  // 对旧 updateToolbar 的隐藏状态作统一修正，离开特殊页时恢复搜索与盟约栏。
  const previousUpdateToolbar = updateToolbar;
  updateToolbar = function() {
    previousUpdateToolbar();
    const special = ["ban","waves","theme"].includes(currentTab);
    $("#search").style.display = special ? "none" : "";
    $("#covenantToolbar").style.display = currentTab === "operators" ? "" : "none";
  };

  // Ban 列表：每个已 Ban 干员都可单独移除，盟约按钮再次点击则批量取消。
  const previousRenderBanPage = renderBanPage;
  renderBanPage = function() {
    const covenants = DATABASE.covenants && DATABASE.covenants.covenants || [];
    const ops = validOps();
    const bannedOps = ops.filter(op => banned.has(op.name));
    $("#list").innerHTML = '<div class="ban-panel">' +
      '<div class="ban-section"><h3>按盟约批量 Ban / 取消</h3><p class="wave-note">按钮显示已 Ban 人数 / 盟约覆盖人数。再次点击同一盟约可整组取消；部分成员已 Ban 时再次点击会补齐整组。</p><div class="ban-grid">' +
      covenants.map(c => {
        const members = covenantOps(c.name);
        const count = members.filter(op => banned.has(op.name)).length;
        return '<button type="button" class="ban-covenant ' + (count ? "banned" : "") + '" data-ban-covenant="' + esc(c.name) + '"><img class="bond-icon" src="' + bondImg(c.name) + '" alt="">' + esc(c.name) + ' <small>' + count + '/' + members.length + '</small></button>';
      }).join("") +
      '</div></div><div class="ban-section"><h3>单独添加 / 取消干员 Ban</h3><input id="banSearch" placeholder="搜索干员名称……" style="width:100%;padding:8px;margin:5px 0 9px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:6px"><div class="ban-grid" id="banOperatorGrid">' +
      ops.map(op => '<button type="button" class="ban-op ' + (banned.has(op.name) ? "banned" : "") + '" data-ban-operator="' + esc(op.name) + '"><img src="' + opImg(op.name) + '" alt="" loading="lazy">' + esc(op.name) + (banned.has(op.name) ? " ✓" : "") + '</button>').join("") +
      '</div></div></div>';
    $("#detail").innerHTML = '<h2>当前 Ban 名单（' + bannedOps.length + '）</h2><button type="button" id="clearBansButton">清空全部 Ban</button>' +
      (bannedOps.length ? '<div class="ban-grid" style="margin-top:12px">' + bannedOps.map(op => '<button type="button" class="ban-op banned" data-ban-operator="' + esc(op.name) + '"><img src="' + opImg(op.name) + '" alt="">' + esc(op.name) + '　取消 ×</button>').join("") + '</div>' : '<p class="empty-message">当前没有 Ban 干员</p>');
  };

  // 盟约、装备、策略和首领列表统一补上原始资源图标。
  const previousRenderDetail = renderDetail;
  function getDataIcon(item, tab) {
    if (!item) return "";
    if (tab === "equipment") return ASSET + "data/equipment/" + encodeURIComponent(item.name) + ".webp";
    if (tab === "strategies") return ASSET + "data/strategies/" + encodeURIComponent(item.id) + ".webp";
    if (tab === "covenants") return bondImg(item.name);
    return "";
  }
  renderDetail = function(item) {
    // Use the original detail renderer as the base. Operator details get exactly one WEBP portrait.
    let html = oldRenderDetail(item);
    if (!item) return html;
    if (item.coreCovenants) {
      html = '<img class="detail-avatar" src="' + opImg(item.name) + '" alt="">' +
        '<div class="ban-state">' +
        (banned.has(item.name) ? '<b style="color:#ff8994">⛔ 已加入 Ban 名单</b>' : '<span style="color:var(--muted)">当前未 Ban</span>') +
        '<button type="button" id="toggleDetailBan" style="display:block;margin:9px 0">' + (banned.has(item.name) ? "取消 Ban" : "Ban 此干员") + '</button></div>' + html;
    } else if (item.enemyId) {
      html = '<img class="detail-avatar" src="' + bossImg(item.enemyId) + '" alt="">' + html;
    } else {
      const icon = getDataIcon(item, currentTab);
      if (icon) html = '<img class="detail-avatar" src="' + icon + '" alt="">' + html;
      else if (item.bondType) html = '<img class="detail-avatar" src="' + bondImg(item.name) + '" alt="">' + html;
    }

    // Add WEBP portraits to the "covered operators" buttons inside covenant details.
    if (currentTab === "covenants" && item.bondType) {
      html = html.replace(
        /(<button\b(?=[^>]*class="operator-link-card")(?=[^>]*data-open-operator="([^"]+)")[^>]*>)/g,
        (tag, _unused, name) => tag + '<img class="operator-link-avatar" src="' + opImg(name) + '" alt="" loading="lazy">'
      );
    }
    return html;
  };
  const previousRenderListWithIcons = renderList;
  function renderDataListWithIcons() {
    const records = getRecords(currentTab);
    const keyword = $("#search").value.trim().toLowerCase();
    const filtered = records.map((item,index) => ({item,index}))
      .filter(x => !keyword || getSearchText(x.item).includes(keyword));
    $("#list").innerHTML = filtered.map(x => {
      const item = x.item;
      const icon = getDataIcon(item, currentTab);
      return '<div class="item ' + (selectedName === getName(item) ? "selected" : "") + '" data-index="' + x.index + '">' +
        (icon ? '<img class="data-icon" src="' + icon + '" alt="" loading="lazy">' : '') +
        '<span><strong>' + esc(getName(item)) + '</strong><small>' + esc(item.initiator || item.bondType || item.description || "") + '</small></span></div>';
    }).join("") || '<div class="empty-message">没有找到匹配资料</div>';
    const selected = records.find(item => getName(item) === selectedName);
    $("#detail").innerHTML = renderDetail(selected);
  }
  renderList = function() {
    if (currentTab === "theme") { renderThemePage(); return; }
    if (currentTab === "waves") { renderWavePage(); return; }
    if (currentTab === "ban") { renderBanPage(); return; }
    if (["equipment","strategies","covenants"].includes(currentTab)) { renderDataListWithIcons(); return; }
    return previousRenderListWithIcons();
  };
  // 新增按钮、主题切换、Ban 搜索和取消操作。
  $("#list").addEventListener("click", function(event) {
    const theme = event.target.closest("[data-theme-choice]");
    if (theme) { activeTheme = theme.dataset.themeChoice; applyTheme(activeTheme); renderThemePage(); return; }
  });

  $("#list").addEventListener("input", function(event) {
    if (event.target.id !== "banSearch") return;
    const q = event.target.value.trim().toLowerCase();
    $("#banOperatorGrid").querySelectorAll("[data-ban-operator]").forEach(btn => {
      btn.style.display = btn.dataset.banOperator.toLowerCase().includes(q) ? "" : "none";
    });
  });

  $("#detail").addEventListener("click", function(event) {
    const op = event.target.closest("[data-ban-operator]");
    if (op) {
      toggleBan(op.dataset.banOperator);
      renderBanPage();
    }
  });


  // ===== 本次界面修订：主题、导航顺序、顶部精简、图标与间距 =====
  const refinementStyle = document.createElement("style");
  refinementStyle.textContent = `
    header{background:var(--header-bg)!important;padding:10px 16px!important;min-height:42px!important;border-bottom:1px solid var(--line)}
    html[data-screen-profile="portrait"] .content,html[data-screen-profile="square"] .content{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr)}
    html[data-screen-profile="landscape"] .content{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr);grid-template-rows:minmax(0,1fr)}
    header h1{font-size:19px!important;margin:0!important;line-height:1.2}
    header p,#resolutionChip,#status,#stats{display:none!important}
    body{display:flex;flex-direction:column;height:100vh;height:100dvh;overflow:hidden}
    #tabs{order:0;flex:0 0 auto;margin:0!important;padding:6px 12px!important;background:var(--header-bg);border-bottom:1px solid var(--line);gap:6px!important;flex-wrap:nowrap!important;overflow-x:auto;overflow-y:hidden}
    #tabs button{flex:0 0 auto;padding:7px 12px!important;border-radius:6px!important;white-space:nowrap}
    #tabs button.active{background:var(--active-bg)!important;border-color:var(--accent)!important;color:var(--text)!important;box-shadow:inset 0 -2px 0 var(--accent)}
    #tabs button:hover{background:var(--panel2);border-color:var(--accent)}
    main{padding-top:8px!important;gap:6px!important;min-height:0;flex:1 1 auto}
    .covenant-row{align-items:flex-start;margin-bottom:5px;row-gap:6px}
    .covenant-row-label{padding-top:7px!important}
    .covenant-buttons{row-gap:7px!important;column-gap:6px!important}
    .covenant-button{line-height:1.4;transition:background .15s,border-color .15s,transform .15s,box-shadow .15s}
    .covenant-button:hover{background:var(--active-bg)!important;border-color:var(--accent)!important;color:var(--text)!important;transform:translateY(-1px);box-shadow:0 2px 8px #0003}
    .covenant-button.active{background:var(--active-bg)!important;border-color:var(--accent)!important}
    .operator-link-card{display:flex;align-items:center;justify-content:flex-start;gap:7px;text-align:left;padding:6px 8px!important;min-height:48px}
    .operator-link-avatar{width:34px;height:34px;object-fit:cover;flex:0 0 34px;border-radius:5px;background:var(--bg)}
    .operator-link-card small{margin-left:auto}
    .data-icon{width:44px;height:44px;object-fit:contain;flex:0 0 44px;background:var(--panel2);padding:3px}
    .item{min-height:56px;line-height:1.45}
    .item span{min-width:0;display:flex;flex-direction:column;gap:3px}
    .item small{line-height:1.35}
    .detail-avatar{width:78px;height:78px}
    .theme-grid{grid-template-columns:repeat(auto-fill,minmax(165px,1fr))}
    .theme-choice{border-color:var(--line);background:var(--panel2)}
    .theme-choice:hover{border-color:var(--accent);background:var(--active-bg)}
    .theme-choice.active{background:var(--active-bg);border-color:var(--accent);color:var(--text)}
    @media(max-aspect-ratio:0.88){
      header{padding:8px 11px!important;min-height:36px!important}
      header h1{font-size:16px!important}
      #tabs{padding:5px 7px!important}
      #tabs button{padding:6px 9px!important;font-size:11px}
    }
  `;
  document.head.appendChild(refinementStyle);

  // Header contains only the title. Navigation follows it immediately.
  const titleHeader = document.querySelector("header");
  if (titleHeader) {
    titleHeader.querySelectorAll("p,#resolutionChip").forEach(node => node.remove());
    const heading = titleHeader.querySelector("h1");
    Array.from(titleHeader.children).forEach(node => { if (node !== heading) node.remove(); });
  }
  const appMain = document.querySelector("main");
  if (nav && appMain && nav.parentElement !== document.body) {
    document.body.insertBefore(nav, appMain);
  }

  // Remove old screen-resolution display; detection remains active for layout profile.
  const resolutionChip = document.getElementById("resolutionChip");
  if (resolutionChip) resolutionChip.remove();

  // Refresh theme variables now that header and selected-tab variables are styled.
  applyTheme(activeTheme);

  // Ensure renamed pages are routed to their intended renderers.
  const finalSwitchTab = switchTab;
  switchTab = function(tab) {
    if (tab === "ban" || tab === "waves" || tab === "theme") {
      currentTab = tab;
      selectedName = null;
      $("#search").value = "";
      updateTabButtons();
      updateToolbar();
      $("#search").style.display = "none";
      $("#covenantToolbar").style.display = "none";
      $("#filter").style.display = "none";
      renderList();
      return;
    }
    finalSwitchTab(tab);
  };

  // Final navigation and theme initialization.
  const tabState = currentTab;
  if (tabState === "operators") {
    renderStats();
    renderCovenantButtons();
  }


  const semanticThemeStyle = document.createElement("style");
  semanticThemeStyle.textContent = `
    /* 全部导航标签统一使用当前主题，选中标签使用独立高对比文字色 */
    #tabs button{background:var(--panel2)!important;color:var(--text)!important;border-color:var(--line)!important}
    #tabs button.active,#tabs button.active:hover{background:var(--active-bg)!important;color:var(--active-text)!important;border-color:var(--accent)!important}
    #tabs button:hover{background:var(--tag-hover-bg)!important;color:var(--active-text)!important;border-color:var(--accent)!important}
    /* 盟约筛选按钮及详情中的盟约标签 */
    .covenant-button{background:var(--tag-bg)!important;color:var(--tag-text)!important;border-color:var(--line)!important}
    .covenant-button.active,.covenant-button:hover{background:var(--tag-hover-bg)!important;color:var(--active-text)!important;border-color:var(--accent)!important}
    .pill{background:var(--tag-bg)!important;color:var(--tag-text)!important;border-color:var(--line)!important}
    .pill:hover{background:var(--tag-hover-bg)!important;color:var(--active-text)!important;border-color:var(--accent)!important}
    /* 干员卡片、盟约覆盖干员及 Ban 控件 */
    .operator-card,.operator-link-card,.ban-op,.ban-covenant{background:var(--card-bg)!important;color:var(--text)!important;border-color:var(--line)}
    .operator-card:hover,.operator-link-card:hover,.ban-op:hover,.ban-covenant:hover{background:var(--card-hover-bg)!important;color:var(--text)!important;border-color:var(--accent)}
    .operator-card.selected,.operator-link-card.selected{background:var(--selected-bg)!important;color:var(--active-text)!important;border-color:var(--accent)!important}
    .ban-op.banned,.ban-covenant.banned{background:var(--active-bg)!important;color:var(--active-text)!important;border-color:var(--accent)!important}
    .operator-name,.operator-link-card,.ban-op,.ban-covenant{color:var(--text)}
    .ban-mark{background:var(--active-bg)!important;color:var(--active-text)!important}
    /* 盟约/干员图标周围不再残留旧色底 */
    .bond-icon,.operator-avatar,.operator-link-avatar{background:var(--panel)!important}
    .theme-choice{background:var(--card-bg)!important;color:var(--text)!important;border-color:var(--line)!important}
    .theme-choice:hover,.theme-choice.active{background:var(--active-bg)!important;color:var(--active-text)!important;border-color:var(--accent)!important}
  `;
  document.head.appendChild(semanticThemeStyle);
  applyTheme(activeTheme);

})();