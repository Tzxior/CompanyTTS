"use strict";

(function () {
  const ASSET = "https://raw.githubusercontent.com/LBEILC/StrongholdAssistant/main/src/ui/public/assets/";
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
    let rows = validOps().filter(op => !banned.has(op.name));
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
    const filtered = selectedTypes.length ? candidates.filter(e => selectedTypes.includes(e.type)) : candidates;
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
    if (currentTab === "ban" || currentTab === "waves") {
      $("#search").style.display = "none";
      $("#covenantToolbar").style.display = "none";
    }
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
})();