/**
 * BƯỚC 3 — Chạy toàn bộ script của 1 lần test rồi sinh báo cáo.
 * Dùng: node lib/run.js <dd-mm-yyyy>_<ten-chuc-nang>
 *
 * Chạy api.test.js trước (nhanh, không cần trình duyệt), rồi ui.test.js.
 * Một bài fail vẫn chạy tiếp bài sau — báo cáo phải phản ánh đầy đủ, không dừng nửa chừng.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT } = require('./evidence');

const run = process.argv[2];
if (!run) {
  console.error('Thiếu tham số. Ví dụ: node lib/run.js 06-08-2026_ghi-nuoc');
  process.exit(1);
}

const scriptDir = path.join(PROJECT_ROOT, 'autotests', 'scripts', run);
if (!fs.existsSync(scriptDir)) {
  console.error(`Không thấy ${path.relative(PROJECT_ROOT, scriptDir)} — viết script test trước.`);
  process.exit(1);
}

// api trước, ui sau; các file khác chạy theo thứ tự tên.
const order = (f) => (f.startsWith('api') ? 0 : f.startsWith('ui') ? 1 : 2);
const files = fs.readdirSync(scriptDir)
  .filter((f) => f.endsWith('.test.js'))
  .sort((a, b) => order(a) - order(b) || a.localeCompare(b));

if (!files.length) {
  console.error(`Không có file *.test.js nào trong ${path.relative(PROJECT_ROOT, scriptDir)}`);
  process.exit(1);
}

let anyFailed = false;
for (const f of files) {
  console.log(`\n${'═'.repeat(56)}\n▶ ${f}\n${'═'.repeat(56)}`);
  const r = spawnSync(process.execPath, [path.join(scriptDir, f)], {
    stdio: 'inherit',
    cwd: PROJECT_ROOT,
    env: process.env,
  });
  if (r.status !== 0) anyFailed = true;
}

console.log(`\n${'═'.repeat(56)}\n▶ Sinh báo cáo\n${'═'.repeat(56)}`);
spawnSync(process.execPath, [path.join(__dirname, 'report.js'), run], {
  stdio: 'inherit', cwd: PROJECT_ROOT, env: process.env,
});

// Mở báo cáo bằng trình duyệt mặc định. Bỏ qua trên CI và khi truyền --no-open.
const reportPath = path.join(PROJECT_ROOT, 'autotests', 'results', run, 'bao-cao.html');
if (fs.existsSync(reportPath) && !process.env.CI && !process.argv.includes('--no-open')) {
  const opener = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  const r = spawnSync(opener, [reportPath], { stdio: 'ignore', shell: process.platform === 'win32' });
  console.log(r.error ? `\n(không tự mở được báo cáo: ${r.error.message})` : '\n🌐 Đã mở báo cáo trên trình duyệt');
}

// Thoát khác 0 khi có mục chưa đạt — để CI hoặc người chạy biết ngay, nhưng báo cáo vẫn được sinh.
process.exit(anyFailed ? 1 : 0);
