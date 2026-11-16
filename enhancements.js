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
    const sw = window.screen && window.screen.width || window.innerWidth;
    const sh = window.screen && window.screen.height || window.innerHeight;
    const ratio = sw / Math.max(sh, 1);
    const profile = ratio > 1.12 ? "landscape" : ratio < 0.88 ? "portrait" : "square";
    document.documentElement.dataset.screenProfile = profile;
    let chip = document.getElementById("resolutionChip");
    if (!chip) {
      chip = document.createElement("span");
      chip.id = "resolutionChip";
      chip.className = "resolution-chip";
      const header = document.querySelector("header");
      if (header) header.appendChild(chip);
    }
    if (chip) chip.textContent = sw + " × " + sh + " · " + (profile === "landscape" ? "横屏" : profile === "portrait" ? "竖屏" : "方屏");
  }
  applyScreenProfile();
  window.addEventListener("resize", applyScreenProfile);
  if (window.screen && window.screen.orientation) {
    window.screen.orientation.addEventListener("change", applyScreenProfile);
  }

  // 主题方案：仅覆盖 CSS 变量，不改变数据或页面结构。
  const THEMES = {
    midnight: {name:"午夜黑",bg:"#101319",panel:"#191f29",panel2:"#252e3b",line:"#394656",text:"#e9eef5",muted:"#9aa9ba",accent:"#7bceb7"},
    orange: {name:"阳光橙",bg:"#21170f",panel:"#302116",panel2:"#49301e",line:"#705039",text:"#fff0dc",muted:"#c5a98d",accent:"#ffad55"},
    blue: {name:"远峰蓝",bg:"#101b2a",panel:"#192a3e",panel2:"#233b55",line:"#385875",text:"#e5f1ff",muted:"#9eb5cc",accent:"#78b9f2"},
    jade: {name:"青瓷绿",bg:"#111d1b",panel:"#1b2c28",panel2:"#294039",line:"#45675d",text:"#e5f4ed",muted:"#a1bdb1",accent:"#8bd3b1"},
    sakura: {name:"樱花粉",bg:"#211820",panel:"#30232f",panel2:"#493244",line:"#6c4a62",text:"#fff0f7",muted:"#c9aabb",accent:"#f0a6c8"},
    ivory: {name:"暖玉白",bg:"#e9e3d8",panel:"#f7f2e9",panel2:"#e6ded0",line:"#c9bda9",text:"#302b25",muted:"#766d62",accent:"#b87943"}
  };
  const THEME_KEY = "stronghold_ui_theme";
  function applyTheme(key) {
    const theme = THEMES[key] || THEMES.midnight;
    const root = document.documentElement.style;
    Object.entries(theme).forEach(([k,v]) => {
      if (k !== "name") root.setProperty("--" + k, v);
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
    ["ban","Ban 管理"],
    ["waves","敌人波次"],
    ["enemyTypes","敌人类型"],
    ["theme","主题设置"]
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

  function renderThemePage() {
    $("#list").innerHTML = '<div class="ban-section"><h2>主题色设置</h2><p class="wave-note">选择一套配色，设置会保存在当前浏览器中。</p><div class="theme-grid">' +
      Object.entries(THEMES).map(([key,t]) => '<button type="button" class="theme-choice ' + (activeTheme === key ? "active" : "") + '" data-theme-choice="' + key + '"><span class="theme-swatch" style="background:linear-gradient(135deg,' + t.bg + ' 0 33%, ' + t.panel + ' 33% 66%, ' + t.accent + ' 66%)"></span><span><strong>' + t.name + '</strong><small class="wave-note">界面配色预览</small></span></button>').join("") +
      '</div></div>';
    $("#detail").innerHTML = '<h2>界面显示</h2><p>当前主题：' + (THEMES[activeTheme] || THEMES.midnight).name + '</p><p class="wave-note">主题仅影响网页颜色，不会修改上游资料。</p>';
  }

  function renderEnemyTypesPage() {
    const types = typeData || {};
    const entries = TYPE_ORDER.map(code => {
      const data = types[code] || {};
      const first = data.firstHalfVariants || [];
      const second = data.secondHalfVariants || [];
      return {
        code,
        name: data.typeName || TYPE_LABEL[code],
        icon: data.typeIconPath ? ASSET + data.typeIconPath : ASSET + "data/enemy_types/" + code + ".webp",
        first,
        second
      };
    });
    $("#list").innerHTML = '<div class="ban-section"><h2>敌人特征分类</h2><p class="wave-note">分类名称、图标及对应敌人均读取上游 enemy_types.json，共 ' + entries.length + ' 类。</p><div class="enemy-grid">' +
      entries.map(t => '<div class="enemy-card"><img src="' + t.icon + '" alt=""><div><strong>' + esc(t.name) + '</strong><small>前半程 ' + t.first.length + ' 种 · 后半程 ' + t.second.length + ' 种</small></div></div>').join("") +
      '</div></div>';
    $("#detail").innerHTML = '<h2>各类特征包含的敌人</h2>' +
      entries.map(t => '<div class="trait"><strong><img src="' + t.icon + '" style="width:20px;height:20px;object-fit:contain;vertical-align:middle;margin-right:6px" alt="">' + esc(t.name) + '</strong><p class="wave-note">前半程：' + (t.first.map(x => esc(x.enemyName)).join("、") || "无") + '</p><p class="wave-note">后半程：' + (t.second.map(x => esc(x.enemyName)).join("、") || "无") + '</p></div>').join("");
  }

  // 覆盖切换逻辑，保证所有新增页面都能进入且工具栏状态正确。
  const previousSwitchTab = switchTab;
  switchTab = function(tab) {
    if (!["ban","waves","enemyTypes","theme"].includes(tab)) return previousSwitchTab(tab);
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
    if (currentTab === "enemyTypes") { renderEnemyTypesPage(); return; }
    if (currentTab === "theme") { renderThemePage(); return; }
    return previousRenderList();
  };

  // 对旧 updateToolbar 的隐藏状态作统一修正，离开特殊页时恢复搜索与盟约栏。
  const previousUpdateToolbar = updateToolbar;
  updateToolbar = function() {
    previousUpdateToolbar();
    const special = ["ban","waves","enemyTypes","theme"].includes(currentTab);
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
  renderDetail = function(item) {
    let html = previousRenderDetail(item);
    if (item && item.iconPath) {
      html = '<img class="detail-avatar" src="' + ASSET + item.iconPath + '" alt="">' + html;
    } else if (item && item.bondType) {
      html = '<img class="detail-avatar" src="' + bondImg(item.name) + '" alt="">' + html;
    }
    return html;
  };

  const previousRenderListWithIcons = renderList;
  renderList = function() {
    if (currentTab === "enemyTypes") { renderEnemyTypesPage(); return; }
    if (currentTab === "theme") { renderThemePage(); return; }
    if (["ban","waves"].includes(currentTab)) return previousRenderListWithIcons();
    if (["equipment","strategies","covenants"].includes(currentTab)) {
      const records = getRecords(currentTab);
      const keyword = $("#search").value.trim().toLowerCase();
      const filtered = records.map((item,index) => ({item,index})).filter(x => !keyword || getSearchText(x.item).includes(keyword));
      $("#list").innerHTML = filtered.map(x => {
        const item = x.item;
        const icon = item.iconPath ? ASSET + item.iconPath : currentTab === "covenants" ? bondImg(item.name) : "";
        return '<div class="item ' + (selectedName === getName(item) ? "selected" : "") + '" data-index="' + x.index + '">' +
          (icon ? '<img class="data-icon" src="' + icon + '" alt="" loading="lazy">' : '') +
          '<span><strong>' + esc(getName(item)) + '</strong><small>' + esc(item.initiator || item.bondType || item.description || "") + '</small></span></div>';
      }).join("") || '<div class="empty-message">没有找到匹配资料</div>';
      const selected = records.find(item => getName(item) === selectedName);
      $("#detail").innerHTML = renderDetail(selected);
      return;
    }
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

  // 新版导航及主题初始化。
  const tabState = currentTab;
  if (tabState === "operators") {
    renderStats();
    renderCovenantButtons();
  }

})();