/* M1 SNIPER BOT — estilos do painel (aplicados via adoptedStyleSheets dentro do Shadow DOM). */
(function (root) {
  root.M1 = root.M1 || {};
  root.M1.PANEL_CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.m1 {
  --bg: #0a0f1c; --bg2: #111a2e; --line: #1e2a44; --tx: #e6ecf7; --mut: #7d8aa6;
  --call: #16c784; --call-bg: rgba(22,199,132,.12); --put: #ea3943; --put-bg: rgba(234,57,67,.12);
  --warn: #f5b041; --acc: #3d7cff;
  position: fixed; z-index: 2147483646; width: 292px; color: var(--tx);
  font: 12px/1.35 "Inter", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
  background: linear-gradient(180deg, rgba(13,20,38,.97), rgba(8,12,24,.97));
  border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.45);
  user-select: none; overflow: hidden; backdrop-filter: blur(6px);
  display: flex; flex-direction: column; max-height: calc(100vh - 16px);
}
.m1.min { width: auto; }
.hd { display: flex; align-items: center; gap: 6px; padding: 7px 8px 7px 10px; cursor: grab;
  background: rgba(255,255,255,.02); border-bottom: 1px solid var(--line); }
.m1.min .hd { border-bottom: 0; }
.hd:active { cursor: grabbing; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #4a5470; flex: none; }
.dot.on { background: var(--call); box-shadow: 0 0 0 3px rgba(22,199,132,.18); animation: pulse 1.6s infinite; }
.dot.lock { background: var(--warn); }
@keyframes pulse { 50% { box-shadow: 0 0 0 5px rgba(22,199,132,.05); } }
.title { font-weight: 800; letter-spacing: .06em; font-size: 11.5px; white-space: nowrap; }
.title i { font-style: normal; color: var(--call); }
.badge { font-size: 9.5px; font-weight: 700; padding: 2px 6px; border-radius: 6px; letter-spacing: .05em;
  background: #1b2540; color: #9fb3dd; border: 1px solid var(--line); }
.badge.real { background: rgba(245,176,65,.15); color: var(--warn); border-color: rgba(245,176,65,.4); }
.mini { display: none; font-size: 11px; color: var(--mut); white-space: nowrap; }
.m1.min .mini { display: inline; }
.sp { flex: 1; }
.ib { all: unset; cursor: pointer; width: 22px; height: 22px; display: grid; place-items: center; border-radius: 6px;
  color: var(--mut); font-size: 13px; }
.ib:hover { background: #18223a; color: var(--tx); }
.body { padding: 8px 10px 9px; display: grid; gap: 6px; overflow: auto; scrollbar-width: thin; }
.m1.cfg .body { display: none; }
.m1.min .body, .m1.min .set { display: none !important; }
.meta { display: flex; justify-content: space-between; color: var(--mut); font-size: 11px; gap: 6px; }
.meta b { color: var(--tx); font-weight: 600; }
.meta .cd { font-variant-numeric: tabular-nums; }
.row { display: flex; gap: 6px; align-items: center; }
.power { all: unset; cursor: pointer; flex: 1; text-align: center; padding: 8px 0; border-radius: 9px; font-weight: 800;
  letter-spacing: .08em; font-size: 12px; background: #17213a; color: var(--tx); border: 1px solid var(--line); }
.power:hover { filter: brightness(1.15); }
.power.on { background: rgba(234,57,67,.14); color: #ff8c93; border-color: rgba(234,57,67,.4); }
.power.off { background: rgba(22,199,132,.14); color: #5df0b3; border-color: rgba(22,199,132,.4); }
.power.locked { opacity: .6; cursor: not-allowed; }
.status { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; min-width: 82px; text-align: center; color: var(--mut); }
.status.on { color: var(--call); } .status.lock { color: var(--warn); }
.stake { display: flex; align-items: center; gap: 4px; }
.stake label { color: var(--mut); font-size: 11px; margin-right: 2px; }
.inp { all: unset; width: 58px; padding: 4px 6px; border-radius: 7px; background: #0d1426; border: 1px solid var(--line);
  color: var(--tx); font-weight: 700; font-variant-numeric: tabular-nums; user-select: text; }
.inp:focus { border-color: var(--acc); }
.chip { all: unset; cursor: pointer; padding: 3px 7px; border-radius: 6px; background: #141d33; color: #a9b6d3; font-size: 11px;
  border: 1px solid var(--line); }
.chip:hover { color: var(--tx); } .chip.sel { border-color: var(--acc); color: #fff; }
.chip:disabled, .chip.dis { opacity: .35; cursor: not-allowed; }
.cnt { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.box { background: var(--bg2); border: 1px solid var(--line); border-radius: 9px; padding: 5px 8px; }
.box .k { font-size: 9.5px; color: var(--mut); letter-spacing: .08em; font-weight: 700; }
.box .v { font-size: 16px; font-weight: 800; font-variant-numeric: tabular-nums; }
.box.g .v { color: var(--call); } .box.l .v { color: var(--put); }
.box .v small { font-size: 11px; color: var(--mut); font-weight: 600; }
.bar { height: 3px; border-radius: 3px; background: #1a2440; margin-top: 3px; overflow: hidden; }
.bar > span { display: block; height: 100%; width: 0; transition: width .3s; }
.box.g .bar > span { background: var(--call); } .box.l .bar > span { background: var(--put); }
.an { background: var(--bg2); border: 1px solid var(--line); border-radius: 9px; padding: 6px 8px; }
.an .t { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.spin { width: 9px; height: 9px; border-radius: 50%; border: 2px solid #2b3a60; border-top-color: var(--acc); flex: none; }
.spin.run { animation: rot .9s linear infinite; }
@keyframes rot { to { transform: rotate(360deg); } }
.an .d { color: var(--mut); font-size: 10.5px; margin-top: 3px; min-height: 13px; }
.ind { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px; }
.ind span { font-size: 10px; padding: 1px 5px; border-radius: 5px; background: #0d1426; border: 1px solid var(--line); color: #9fb0d4;
  font-variant-numeric: tabular-nums; }
.ind span.up { color: var(--call); border-color: rgba(22,199,132,.35); } .ind span.dn { color: var(--put); border-color: rgba(234,57,67,.35); }
.sig { border-radius: 10px; padding: 8px; border: 1px solid var(--line); display: none; }
.sig.show { display: block; }
.sig.CALL { background: var(--call-bg); border-color: rgba(22,199,132,.45); }
.sig.PUT { background: var(--put-bg); border-color: rgba(234,57,67,.45); }
.sig .top { display: flex; align-items: center; gap: 8px; }
.sig .top .as { font-weight: 700; color: #c6d1ea; }
.sig .dir { font-size: 20px; font-weight: 900; letter-spacing: .04em; }
.sig.CALL .dir { color: var(--call); } .sig.PUT .dir { color: var(--put); }
.score { margin-left: auto; text-align: right; }
.score b { font-size: 18px; font-weight: 900; font-variant-numeric: tabular-nums; } .score small { color: var(--mut); }
.sig .when { color: #fff; font-size: 11px; margin-top: 4px; font-weight: 600; font-variant-numeric: tabular-nums; }
.sig ul { margin: 6px 0 0; padding-left: 14px; color: #b5c1dc; font-size: 10.5px; }
.sig li { margin: 1px 0; }
.acts { display: flex; gap: 6px; margin-top: 7px; }
.acts.first { margin-top: 0; }
.btn { all: unset; cursor: pointer; flex: 1; text-align: center; padding: 6px 0; border-radius: 8px; font-weight: 800; font-size: 11.5px;
  letter-spacing: .05em; background: #18223a; border: 1px solid var(--line); color: var(--tx); }
.btn:hover { filter: brightness(1.2); }
.btn.call { background: var(--call); color: #04140d; border-color: var(--call); }
.btn.put { background: var(--put); color: #fff; border-color: var(--put); }
.btn.ghost { background: transparent; color: var(--mut); }
.btn.sm { flex: none; padding: 4px 8px; font-size: 10.5px; }
.sug { font-size: 10.5px; color: var(--mut); margin-top: 4px; }
.sug b.GREEN { color: var(--call); } .sug b.LOSS { color: var(--put); }
.last { color: var(--mut); font-size: 10.5px; display: flex; justify-content: space-between; gap: 6px; }
.last b { color: var(--tx); font-weight: 600; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--line); }
.tab { all: unset; cursor: pointer; padding: 3px 6px; font-size: 10.5px; color: var(--mut); font-weight: 700; letter-spacing: .04em;
  border-bottom: 2px solid transparent; }
.tab.sel { color: var(--tx); border-color: var(--acc); }
.list { max-height: 104px; overflow: auto; display: grid; gap: 2px; scrollbar-width: thin; }
.it { display: grid; grid-template-columns: 38px 1fr 34px 26px 54px; gap: 4px; font-size: 10.5px; padding: 2px 2px;
  border-radius: 4px; font-variant-numeric: tabular-nums; align-items: center; }
.it.as { grid-template-columns: 1fr 52px 48px 58px; }
.it:nth-child(odd) { background: rgba(255,255,255,.02); }
.it .CALL { color: var(--call); font-weight: 700; } .it .PUT { color: var(--put); font-weight: 700; }
.res { font-weight: 800; text-align: right; } .res.GREEN { color: var(--call); } .res.LOSS { color: var(--put); } .res.mut { color: var(--mut); font-weight: 600; }
.empty { color: var(--mut); font-size: 10.5px; text-align: center; padding: 6px 0; }
.st { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; font-size: 10.5px; }
.st div { background: #0d1426; border: 1px solid var(--line); border-radius: 6px; padding: 3px 5px; }
.st span { display: block; color: var(--mut); font-size: 9.5px; } .st b { font-variant-numeric: tabular-nums; }
.bal { font-size: 10.5px; color: var(--mut); display: flex; justify-content: space-between; }
.msg { font-size: 10.5px; color: #c9d6f2; background: rgba(61,124,255,.1); border: 1px solid rgba(61,124,255,.25); border-radius: 7px;
  padding: 4px 7px; display: none; }
.msg.show { display: block; }
.ft { font-size: 9.5px; color: #59647e; text-align: center; }
.set { padding: 8px 10px 10px; display: none; gap: 6px; overflow: auto; scrollbar-width: thin; }
.set.show { display: grid; }
.set h4 { margin: 4px 0 0; font-size: 10px; color: var(--mut); letter-spacing: .08em; }
.fld { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 11px; }
.fld select, .fld input[type=text], .fld input[type=number] { all: unset; background: #0d1426; border: 1px solid var(--line); border-radius: 6px;
  padding: 3px 6px; color: var(--tx); width: 120px; font-size: 11px; user-select: text; }
.fld select option { background: #0d1426; }
.fld input[type=checkbox] { accent-color: var(--acc); }
textarea { all: unset; display: block; width: 100%; height: 70px; background: #0d1426; border: 1px solid var(--line); border-radius: 6px;
  padding: 5px; color: var(--tx); font: 10px/1.3 ui-monospace, Menlo, monospace; white-space: pre; overflow: auto; user-select: text; }
.note { font-size: 10px; color: var(--mut); }
.note.warn { color: var(--warn); }
.val { font-size: 10.5px; background: #0d1426; border: 1px solid var(--line); border-radius: 6px; padding: 5px 7px; }
.val .ok { color: var(--call); font-weight: 700; } .val .no { color: var(--warn); font-weight: 700; }
.conn { display: grid; gap: 2px; font-size: 10px; }
.conn .y { color: var(--call); } .conn .n { color: var(--warn); }
`;
})(typeof globalThis !== 'undefined' ? globalThis : this);
