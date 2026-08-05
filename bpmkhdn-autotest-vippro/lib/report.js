/**
 * Sinh báo cáo HTML tự chứa từ kết quả 1 lần chạy.
 * Dùng: node lib/report.js <dd-mm-yyyy>_<ten-chuc-nang>
 * Đọc  : autotests/results/<run>/data/*.json + images/
 * Ghi  : autotests/results/<run>/bao-cao.html
 */
const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT } = require('./evidence');

const runArg = process.argv[2];
if (!runArg) {
  console.error('Thiếu tham số. Ví dụ: node lib/report.js 06-08-2026_ghi-nuoc');
  process.exit(1);
}
const RUN_DIR = path.join(PROJECT_ROOT, 'autotests', 'results', runArg);
const DATA_DIR = path.join(RUN_DIR, 'data');
const IMG_DIR = path.join(RUN_DIR, 'images');
if (!fs.existsSync(DATA_DIR)) {
  console.error(`Không thấy ${DATA_DIR} — chạy script test trước.`);
  process.exit(1);
}

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

const read = (kind) => {
  const f = path.join(DATA_DIR, `${kind}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
};
const img = (file) => {
  const p = path.join(IMG_DIR, file);
  return fs.existsSync(p) ? `data:image/png;base64,${fs.readFileSync(p).toString('base64')}` : '';
};
const count = (run) => (run ? run.scenarios : []).reduce(
  (a, s) => ({
    ok: a.ok + s.checks.filter((c) => c.ok).length,
    bad: a.bad + s.checks.filter((c) => !c.ok).length,
  }), { ok: 0, bad: 0 });

const checkTable = (checks) => `<table class="checks">
  <thead><tr><th>Mong đợi</th><th>Kết quả thực tế</th></tr></thead>
  <tbody>${checks.map((c) => `
    <tr class="${c.ok ? 'ok' : 'bad'}">
      <td data-th="Mong đợi">${esc(c.name)}</td>
      <td data-th="Kết quả thực tế">
        <span class="verdict">${c.ok ? '✔ Đạt' : '✕ Không đạt'}</span>
        ${c.detail ? `<span class="observed">${esc(c.detail)}</span>` : ''}
      </td>
    </tr>`).join('')}
  </tbody></table>`;

const shotBlock = (shots) => shots.length ? `<div class="shots">${shots.map((s) => `
  <figure><img src="${img(s.file)}" alt="${esc(s.caption)}"><figcaption>${esc(s.caption)}</figcaption></figure>
`).join('')}</div>` : '';

const logBlock = (logs) => logs.length ? `<details class="tech">
  <summary>Chi tiết kỹ thuật (${logs.length} lượt gọi)</summary>
  ${logs.map((l) => `<div class="call">
    <div class="line"><b>${esc(l.method)}</b> ${esc(l.url)} <span class="status s${String(l.status)[0]}">${l.status}</span></div>
    ${l.request != null ? `<pre>gửi đi: ${esc(l.request)}</pre>` : ''}
    <pre>nhận về: ${esc(l.response)}</pre>
  </div>`).join('')}
</details>` : '';

const scenarioBlock = (s, i, withShots) => {
  const bad = s.checks.filter((c) => !c.ok).length;
  return `<section class="scenario${bad ? ' has-issue' : ''}" id="${esc(s.id)}">
    <h3><span class="num">${i}</span> ${esc(s.title)}${bad ? '<span class="flag">còn tồn đọng</span>' : ''}</h3>
    <p class="desc">${rich(s.description)}</p>
    ${withShots ? shotBlock(s.shots) : ''}
    ${checkTable(s.checks)}
    ${logBlock(s.logs)}
  </section>`;
};

// ─────────────────────────────────────────────────────────────────────────────
const ui = read('ui');
const api = read('api');
if (!ui && !api) {
  console.error(`Không có dữ liệu trong ${DATA_DIR}`);
  process.exit(1);
}
const cUi = count(ui);
const cApi = count(api);
const total = { ok: cUi.ok + cApi.ok, bad: cUi.bad + cApi.bad };
const scenarios = [...(ui ? ui.scenarios : []), ...(api ? api.scenarios : [])];

// Anchor trùng nhau khiến mục lục nhảy sai chỗ mà không ai phát hiện.
const ids = scenarios.map((s) => s.id);
const dup = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
if (dup.length) {
  console.error(`⚠️  Trùng mã kịch bản: ${dup.join(', ')} — đổi id trong script test.`);
  process.exit(1);
}

const issues = scenarios.flatMap((s) =>
  s.checks.filter((c) => !c.ok).map((c) => ({ scenario: s.title, anchor: s.id, ...c })));

const tocPart = (run, label) => !run ? '' : `<div class="idx-part">
  <h4>${label}</h4>
  <ol>${run.scenarios.map((s, i) => {
    const bad = s.checks.filter((c) => !c.ok).length;
    return `<li><a href="#${esc(s.id)}" class="${bad ? 'bad' : 'ok'}">
      <span class="dot">${bad ? '✕' : '✔'}</span>${i + 1}. ${esc(s.title)}</a></li>`;
  }).join('')}</ol>
</div>`;

const feature = (ui || api).functionName;
const ranAt = new Date((ui || api).startedAt);
const stamp = ranAt.toLocaleString('vi-VN', { dateStyle: 'full', timeStyle: 'short' });

const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Biên bản kiểm thử — ${esc(feature)}</title>
<style>
  :root{--ink:#1a2027;--muted:#5b6b7c;--line:#e3e8ee;--bg:#f6f8fa;--card:#fff;
        --ok:#1a7f4b;--ok-bg:#eaf7f0;--bad:#c0392b;--bad-bg:#fdecea;--accent:#0b6bcb}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
       font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
       -webkit-text-size-adjust:100%}
  .wrap{max-width:900px;margin:0 auto;padding:24px 16px 64px}
  .nav{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.94);
       backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
  .nav-in{max-width:900px;margin:0 auto;padding:0 16px;display:flex;align-items:center;
          gap:4px;flex-wrap:wrap;min-height:48px}
  .nav a{color:var(--muted);text-decoration:none;font-size:13.5px;font-weight:600;
         padding:10px 12px;border-radius:8px;white-space:nowrap}
  .nav a:hover{background:#eef2f6;color:var(--accent)}
  .nav-score{margin-left:auto;font-weight:700;font-size:13.5px;padding:5px 12px;border-radius:20px}
  .nav-score.ok{background:var(--ok-bg);color:var(--ok)}
  .nav-score.bad{background:var(--bad-bg);color:var(--bad)}
  .scenario,h2{scroll-margin-top:60px}
  header{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:24px;margin-bottom:16px}
  h1{margin:0 0 6px;font-size:26px;line-height:1.25}
  .sub{color:var(--muted);margin:0 0 18px;font-size:14px}
  .meta{display:flex;flex-wrap:wrap;gap:8px 28px;font-size:14px;color:var(--muted);margin-bottom:18px}
  .meta b{color:var(--ink);font-weight:600}
  .score{display:flex;flex-wrap:wrap;gap:10px}
  .pill{padding:10px 16px;border-radius:10px;font-weight:700;font-size:15px}
  .pill.ok{background:var(--ok-bg);color:var(--ok)}
  .pill.bad{background:var(--bad-bg);color:var(--bad)}
  .pill.neutral{background:#eef2f6;color:var(--ink)}
  .idx{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 20px;margin-top:16px}
  .idx summary{cursor:pointer;font-weight:600;font-size:15px}
  .idx-body{display:flex;flex-wrap:wrap;gap:12px 32px;margin-top:14px}
  .idx-part{flex:1 1 300px;min-width:0}
  .idx-part h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
  .idx-part ol{margin:0;padding:0;list-style:none}
  .idx-part a{display:flex;gap:8px;align-items:baseline;text-decoration:none;color:var(--ink);
              font-size:14px;padding:5px 8px;border-radius:6px}
  .idx-part a:hover{background:#eef2f6}
  .idx-part a.bad{color:var(--bad);font-weight:600}
  .idx .dot{flex:none;font-weight:700;color:var(--ok)}
  .idx a.bad .dot{color:var(--bad)}
  h2{font-size:20px;margin:36px 0 6px;padding-bottom:10px;border-bottom:2px solid var(--line)}
  h2 .hint{display:block;font-size:13px;font-weight:400;color:var(--muted);margin-top:4px}
  .scenario{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:20px;margin-top:16px}
  .scenario.has-issue{border-color:#f0b7b0;background:#fffbfa}
  .scenario h3{margin:0 0 8px;font-size:17px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .num{flex:none;width:28px;height:28px;border-radius:50%;background:var(--accent);color:#fff;
       font-size:14px;display:inline-flex;align-items:center;justify-content:center}
  .flag{background:var(--bad-bg);color:var(--bad);font-size:12px;padding:3px 9px;border-radius:20px;font-weight:600}
  .desc{margin:0 0 16px;color:#3d4a57}
  .shots{display:flex;flex-wrap:wrap;gap:16px;margin-bottom:16px}
  figure{margin:0;flex:0 1 auto;max-width:min(340px,100%)}
  figure img{width:100%;height:auto;display:block;border:1px solid var(--line);border-radius:10px;background:#fff}
  figcaption{font-size:13px;color:var(--muted);margin-top:6px}
  .checks{width:100%;border-collapse:collapse;font-size:14.5px;table-layout:fixed}
  .checks th{text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.04em;
             color:var(--muted);font-weight:600;padding:0 10px 8px;border-bottom:2px solid var(--line)}
  .checks th:last-child{width:38%}
  .checks td{padding:10px;vertical-align:top;border-bottom:1px solid var(--line);overflow-wrap:anywhere}
  .checks tr:last-child td{border-bottom:none}
  .checks tr.ok td:first-child{border-left:3px solid var(--ok)}
  .checks tr.bad{background:var(--bad-bg)}
  .checks tr.bad td:first-child{border-left:3px solid var(--bad)}
  .verdict{font-weight:700;white-space:nowrap}
  .ok .verdict{color:var(--ok)}
  .bad .verdict{color:var(--bad)}
  .observed{display:block;font-size:13px;color:var(--muted);margin-top:3px;
            font-family:ui-monospace,Menlo,monospace}
  @media(max-width:560px){
    .checks,.checks tbody,.checks tr,.checks td{display:block;width:100%}
    .checks thead{display:none}
    .checks tr{border:1px solid var(--line);border-radius:8px;margin-bottom:10px;padding:4px 0}
    .checks td{border:none;padding:6px 12px}
    .checks tr.ok td:first-child,.checks tr.bad td:first-child{border-left:none}
    .checks td::before{content:attr(data-th);display:block;font-size:11px;
                       text-transform:uppercase;color:var(--muted);margin-bottom:2px}
  }
  .tech{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}
  .tech summary{cursor:pointer;font-size:13px;color:var(--muted)}
  .call{margin-top:10px;font-size:12px}
  .call .line{font-family:ui-monospace,Menlo,monospace;margin-bottom:4px;word-break:break-all}
  .status{padding:1px 6px;border-radius:4px;font-size:11px}
  .status.s2{background:var(--ok-bg);color:var(--ok)}
  .status.s4,.status.s5{background:var(--bad-bg);color:var(--bad)}
  pre{margin:2px 0;padding:8px 10px;background:#f2f5f8;border-radius:6px;overflow-x:auto;
      font-family:ui-monospace,Menlo,monospace;font-size:11.5px;white-space:pre-wrap;word-break:break-all}
  .issues{background:#fffbfa;border:1px solid #f0b7b0;border-radius:12px;padding:20px;margin-top:16px}
  .issues h3{margin:0 0 12px;font-size:17px;color:var(--bad)}
  .issues li{margin-bottom:6px}
  footer{margin-top:40px;padding-top:20px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
  footer code{background:#eef2f6;padding:2px 6px;border-radius:4px;font-size:12px}
  @media print{body{background:#fff}.scenario,header{break-inside:avoid}
               .tech,.nav{display:none}.idx{break-inside:avoid}}
</style></head><body id="top">

<nav class="nav"><div class="nav-in">
  <a href="#top">▲ Đầu trang</a>
  ${ui ? '<a href="#phan-a">Phần A · UI</a>' : ''}
  ${api ? '<a href="#phan-b">Phần B · API</a>' : ''}
  <span class="nav-score ${total.bad ? 'bad' : 'ok'}">${total.ok}/${total.ok + total.bad}</span>
</div></nav>

<div class="wrap">
<header>
  <h1>Biên bản kiểm thử — ${esc(feature)}</h1>
  <p class="sub">Kiểm thử tự động · ảnh chụp và số liệu bên dưới sinh trực tiếp từ lần chạy này</p>
  <div class="meta">
    <span>Thời điểm chạy: <b>${esc(stamp)}</b></span>
    <span>Môi trường: <b>${esc(process.env.TARGET_URL || 'http://localhost:8788')}</b></span>
    <span>Mã lần chạy: <b>${esc(runArg)}</b></span>
  </div>
  <div class="score">
    <span class="pill ${total.bad ? 'bad' : 'ok'}">${total.ok}/${total.ok + total.bad} mục đạt</span>
    <span class="pill neutral">${scenarios.length} kịch bản</span>
    ${total.bad ? `<span class="pill bad">${total.bad} mục còn tồn đọng</span>` : ''}
  </div>
</header>

${issues.length ? `<div class="issues">
  <h3>Còn tồn đọng (${issues.length})</h3>
  <ul>${issues.map((i) => `<li><a href="#${esc(i.anchor)}"><b>${esc(i.scenario)}</b></a> — ${esc(i.name)}${i.detail ? `<br><span class="observed">${esc(i.detail)}</span>` : ''}</li>`).join('')}</ul>
</div>` : ''}

<details class="idx">
  <summary>Mục lục — ${scenarios.length} kịch bản</summary>
  <div class="idx-body">
    ${tocPart(ui, 'Phần A — Test UI')}
    ${tocPart(api, 'Phần B — Test API')}
  </div>
</details>

${ui ? `<h2 id="phan-a">Phần A — Test UI
  <span class="hint">Thao tác trên trình duyệt đúng như người dùng làm, mỗi kịch bản kèm ảnh chụp màn hình. Đạt ${cUi.ok}/${cUi.ok + cUi.bad}.</span>
</h2>
${ui.scenarios.map((s, i) => scenarioBlock(s, i + 1, true)).join('')}` : ''}

${api ? `<h2 id="phan-b">Phần B — Test API
  <span class="hint">Kiểm tra phần tính toán và lưu trữ phía sau, không qua giao diện. Đạt ${cApi.ok}/${cApi.ok + cApi.bad}.</span>
</h2>
${api.scenarios.map((s, i) => scenarioBlock(s, i + 1, false)).join('')}` : ''}

<footer>
  <p><b>Tự kiểm chứng lại:</b> khởi động hệ thống rồi chạy lại script trong <code>autotests/scripts/${esc(runArg)}/</code>. Báo cáo này sẽ được tạo lại từ đầu.</p>
  <p>Toàn bộ số liệu phát sinh khi kiểm tra đã được xoá sau mỗi lần chạy — dữ liệu thật không bị ảnh hưởng.</p>
</footer>
</div></body></html>`;

const out = path.join(RUN_DIR, 'bao-cao.html');
fs.writeFileSync(out, html);
console.log(`\n📄 ${path.relative(PROJECT_ROOT, out)}  (${Math.round(fs.statSync(out).size / 1024)} KB)`);
console.log(`   ${total.ok}/${total.ok + total.bad} mục đạt · ${scenarios.length} kịch bản · ${issues.length} tồn đọng`);
