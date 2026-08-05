/**
 * BƯỚC 1 — Kiểm tra môi trường trước khi làm bất cứ việc gì khác.
 * Dùng: node lib/check-env.js [baseUrl]
 *
 * Nguyên tắc: KHÔNG cài gì vào project. Playwright phải là bản global.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PROJECT_ROOT } = require('./evidence');

const BASE = process.argv[2] || process.env.TARGET_URL || 'http://localhost:8788';
const fixes = [];

function line(ok, msg, fix) {
  console.log(`  ${ok ? '✅' : '❌'} ${msg}`);
  if (!ok && fix) fixes.push(fix);
}

function sh(cmd) {
  try { return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return null; }
}

/**
 * Bảo đảm autotests/ bị git bỏ qua. Nếu chưa thì tự thêm vào .git/info/exclude —
 * file này chỉ có trên máy hiện tại và không bao giờ được commit, nên không đụng
 * tới .gitignore chung của team.
 */
function ensureGitExclude() {
  const gitDir = sh('git rev-parse --git-dir');
  if (!gitDir) {
    line(true, 'Không phải git repo — bỏ qua bước loại trừ');
    return;
  }
  // git check-ignore là nguồn phán quyết duy nhất: gộp .gitignore + info/exclude + global.
  const ignored = (() => {
    try {
      execSync('git check-ignore -q autotests', { stdio: 'ignore', cwd: PROJECT_ROOT });
      return true;
    } catch { return false; }
  })();

  if (ignored) {
    line(true, 'autotests/ đã được git bỏ qua');
    return;
  }

  const excludePath = path.resolve(PROJECT_ROOT, gitDir, 'info', 'exclude');
  try {
    fs.mkdirSync(path.dirname(excludePath), { recursive: true });
    const prev = fs.existsSync(excludePath) ? fs.readFileSync(excludePath, 'utf8') : '';
    const sep = prev && !prev.endsWith('\n') ? '\n' : '';
    fs.appendFileSync(excludePath,
      `${sep}\n# Kết quả autotest — ảnh chụp kèm dữ liệu thật, không đẩy lên remote\nautotests/\n`);
    line(true, 'autotests/ vừa được thêm vào .git/info/exclude (chỉ máy này)');
  } catch (e) {
    line(false, `Không ghi được .git/info/exclude: ${e.message}`,
      'Thêm tay dòng "autotests/" vào .git/info/exclude trước khi chạy test.');
  }
}

(async () => {
  console.log('\n🔍 KIỂM TRA MÔI TRƯỜNG\n');

  // 1. Node phải có fetch sẵn (>= 18)
  const major = Number(process.versions.node.split('.')[0]);
  line(major >= 18, `Node ${process.versions.node}`, 'Nâng Node lên bản 18 trở lên.');

  // 2. Playwright phải nằm ở global, không phải trong project
  const globalRoot = sh('npm root -g');
  const pwPath = globalRoot && path.join(globalRoot, 'playwright');
  const hasGlobal = !!(pwPath && fs.existsSync(pwPath));
  let version = '';
  if (hasGlobal) {
    try { version = ` v${require(path.join(pwPath, 'package.json')).version}`; } catch { /* bỏ qua */ }
  }
  line(hasGlobal, `Playwright global${version}`,
    'npm i -g playwright && npx playwright install chromium');

  // 3. Trình duyệt đã tải chưa — thử mở rồi đóng ngay, rẻ hơn chạy cả bài test mới biết thiếu
  if (hasGlobal) {
    try {
      const { chromium } = require(pwPath);
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      line(true, 'Chromium mở được');
    } catch (e) {
      line(false, `Chromium chưa mở được: ${String(e.message).split('\n')[0].slice(0, 90)}`,
        'npx playwright install chromium');
    }
  }

  // 4. package.json của project phải sạch — skill này không cài gì vào project
  const pkgPath = path.join(PROJECT_ROOT, 'package.json');
  const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : {};
  const dirty = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .filter((d) => /^(@playwright\/|playwright)$|^@playwright\//.test(d));
  line(dirty.length === 0, 'package.json sạch (không có playwright)',
    `npm uninstall ${dirty.join(' ')} — skill này không cài gì vào project.`);

  // 5. autotests/ PHẢI được git bỏ qua — kết quả test có ảnh chụp kèm dữ liệu thật,
  //    tuyệt đối không để lọt lên remote. Dùng .git/info/exclude (chỉ máy này, không commit).
  ensureGitExclude();

  // 6. Server của project đã chạy chưa
  try {
    const res = await fetch(BASE);
    line(true, `Server phản hồi tại ${BASE} (HTTP ${res.status})`);
  } catch {
    line(false, `Không kết nối được ${BASE}`,
      'Khởi động server của project trước (ví dụ: npm run dev:full).');
  }

  console.log();
  if (fixes.length) {
    console.log('❌ Chưa đủ môi trường. Cần làm:');
    fixes.forEach((f) => console.log(`   • ${f}`));
    process.exit(1);
  }
  console.log('✅ Môi trường sẵn sàng.\n');
})();
