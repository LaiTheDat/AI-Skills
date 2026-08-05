/**
 * Bộ khung dùng chung cho mọi script autotest.
 * Script sinh ra ở autotests/scripts/<dd-mm-yyyy>_<ten>/ require thẳng file này.
 *
 * Không phụ thuộc gói nào trong project — Playwright nạp từ bản cài global.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/** Thư mục gốc project = thư mục chứa .claude/ (đi ngược lên từ file này). */
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');

/** dd-mm-yyyy theo giờ máy (không dùng toISOString kẻo lệch múi giờ). */
function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Tên thư mục 1 lần chạy: 06-08-2026_ghi-nuoc */
const runName = (functionName) => `${today()}_${functionName}`;

/**
 * Playwright KHÔNG được cài vào project. Lấy từ bản global.
 * Node không tự tìm gói global nên phải trỏ tay sang npm root -g.
 */
function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    try {
      const root = execSync('npm root -g', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
      return require(path.join(root, 'playwright'));
    } catch {
      console.error('\n❌ Chưa có Playwright. Cài 1 lần cho mọi project:\n' +
        '   npm i -g playwright && npx playwright install chromium\n');
      process.exit(1);
    }
  }
}

class Evidence {
  /**
   * @param {'ui'|'api'} kind    quyết định bài này vào Phần A hay Phần B của báo cáo
   * @param {string} title       tên hiển thị
   * @param {string} functionName tên chức năng — phải GIỐNG NHAU giữa các bài cùng 1 lần chạy
   */
  constructor(kind, title, functionName) {
    this.kind = kind;
    this.title = title;
    this.functionName = functionName;
    this.resultDir = path.join(PROJECT_ROOT, 'autotests', 'results', runName(functionName));
    this.imageDir = path.join(this.resultDir, 'images');
    this.dataDir = path.join(this.resultDir, 'data');
    this.scenarios = [];
    this.current = null;
    this.startedAt = new Date().toISOString();
    fs.mkdirSync(this.imageDir, { recursive: true });
    fs.mkdirSync(this.dataDir, { recursive: true });
  }

  /** Mở một kịch bản nghiệp vụ; mọi check/capture sau đó thuộc về nó. */
  scenario(id, title, description) {
    this.current = { id, title, description, checks: [], shots: [], logs: [] };
    this.scenarios.push(this.current);
    console.log(`\n▸ ${title}`);
    return this.current;
  }

  /**
   * Ghi 1 điểm kiểm tra.
   * name   = điều mong đợi (lên cột "Mong đợi")
   * detail = giá trị quan sát được — LUÔN lưu, kể cả khi đạt (lên cột "Kết quả thực tế")
   */
  check(name, cond, detail) {
    this.current.checks.push({
      name, ok: !!cond, detail: detail == null ? undefined : String(detail),
    });
    console.log(`  ${cond ? '✅' : '❌'} ${name}${!cond && detail ? ` → ${detail}` : ''}`);
    return !!cond;
  }

  /**
   * Ghi 1 lượt gọi API vào ô "chi tiết kỹ thuật".
   * Cắt còn 400 ký tự: báo cáo có thể gửi ra ngoài, mà response danh sách thường
   * kèm thông tin cá nhân (CCCD, số điện thoại, ngày sinh) — không để lọt vào file.
   */
  log(method, url, reqBody, status, resBody) {
    const trim = (v) => {
      const s = JSON.stringify(v);
      return s && s.length > 400 ? `${s.slice(0, 400)}… (rút gọn)` : s;
    };
    this.current.logs.push({
      method, url, status,
      request: reqBody === undefined ? null : trim(reqBody),
      response: trim(resBody),
    });
  }

  /**
   * Chụp ảnh gắn vào kịch bản hiện tại.
   * target: null → cả viewport · chuỗi selector · hoặc Locator (dùng .nth(i) được).
   * Ưu tiên chụp đúng vùng liên quan — ảnh cả trang dài vừa nặng vừa khó nhìn.
   */
  async capture(page, target, caption) {
    const s = this.current;
    const file = `${s.id}-${s.shots.length + 1}.png`;
    const el = !target ? page
      : typeof target === 'string' ? page.locator(target).first()
      : target;
    try {
      await el.screenshot({ path: path.join(this.imageDir, file) });
      s.shots.push({ file, caption });
    } catch (e) {
      console.log(`  ⚠️  không chụp được "${caption}": ${e.message}`);
    }
  }

  get passed() {
    return this.scenarios.reduce((n, s) => n + s.checks.filter((c) => c.ok).length, 0);
  }
  get failed() {
    return this.scenarios.reduce((n, s) => n + s.checks.filter((c) => !c.ok).length, 0);
  }

  /** Ghi kết quả ra data/<kind>.json để report.js gộp lại. Trả về true nếu sạch lỗi. */
  finish() {
    fs.writeFileSync(path.join(this.dataDir, `${this.kind}.json`), JSON.stringify({
      kind: this.kind,
      title: this.title,
      functionName: this.functionName,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      scenarios: this.scenarios,
    }, null, 2));

    console.log(`\n${'─'.repeat(52)}`);
    console.log(`✅ đạt: ${this.passed}   ❌ chưa đạt: ${this.failed}`);
    if (this.failed) {
      const bad = this.scenarios.flatMap((s) => s.checks.filter((c) => !c.ok).map((c) => c.name));
      console.log('Chưa đạt:\n  - ' + bad.join('\n  - '));
    }
    return this.failed === 0;
  }
}

module.exports = { Evidence, loadPlaywright, PROJECT_ROOT, runName, today };
