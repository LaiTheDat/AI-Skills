/**
 * MẪU — Test UI (Phần A của báo cáo). Chép sang autotests/scripts/<run>/ui.test.js rồi sửa.
 * Chạy riêng: node autotests/scripts/<run>/ui.test.js
 *
 * Thay hết chỗ có {{ }}. Xoá phần nào không dùng.
 */
const path = require('path');
const SKILL = path.resolve(__dirname, '../../../.claude/skills/bpmkhdn-autotest-vippro/lib');
const { Evidence, loadPlaywright } = require(path.join(SKILL, 'evidence'));
const { chromium } = loadPlaywright(); // Playwright global, KHÔNG cài vào project

// ── Cấu hình theo project ────────────────────────────────────────────────────
const BASE = process.env.TARGET_URL || '{{http://localhost:8788}}';
const FUNCTION = '{{ten-chuc-nang}}'; // PHẢI giống hệt trong api.test.js

const ev = new Evidence('ui', '{{Kiểm tra màn ...}}', FUNCTION);
const check = (...a) => ev.check(...a);

// ── Trợ giúp ─────────────────────────────────────────────────────────────────
// Chờ theo ĐIỀU KIỆN, không bao giờ chờ cứng bằng waitForTimeout — đó là nguồn flaky số 1.
async function until(fn, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

// Gọi API để dựng/dọn dữ liệu — nhanh và chắc hơn thao tác qua giao diện.
async function api(p, method = 'GET', body) {
  const res = await fetch(BASE + p, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer {{token}}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.json().catch(() => null);
}
async function cleanup() {
  // {{ Xoá sạch dữ liệu do lần chạy này tạo ra }}
}

// {{ Trợ giúp theo UI framework — ví dụ Angular Material:
// async function snackText(page, timeout = 6000) {
//   const bar = page.locator('simple-snack-bar, .mat-mdc-snack-bar-label').first();
//   await bar.waitFor({ state: 'visible', timeout });
//   return (await bar.innerText()).trim();
// } }}

(async () => {
  console.log(`\n🧪 ${ev.title} — ${BASE}`);
  await cleanup(); // dọn TRƯỚC khi chạy, phòng lần trước chết giữa chừng

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  try {
    // ── Kịch bản 1 ──────────────────────────────────────────────────────────
    ev.scenario('{{ma-kich-ban}}', '{{Tên việc người dùng làm}}',
      '{{Mô tả bằng ngôn ngữ người dùng: bấm gì, mong đợi thấy gì, vì sao quan trọng. ' +
      'Dùng **in đậm** cho ý then chốt. KHÔNG viết tên hàm hay selector ở đây.}}');

    await page.goto(`${BASE}{{/duong-dan}}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('{{selector-cho-biet-trang-da-tai-xong}}', { timeout: 20000 });

    check('{{Điều mong đợi}}', {{dieu_kien}}, `{{giá trị quan sát được}}`);

    // Chụp ĐÚNG VÙNG liên quan, không chụp cả trang dài.
    await ev.capture(page, '{{.vung-can-chup}}', '{{Chú thích ảnh}}');
    // Cần 1 thẻ cụ thể trong danh sách thì truyền Locator:
    // await ev.capture(page, page.locator('.row').nth(0), '{{Chú thích}}');
    // Cần cả màn hình thì truyền null:
    // await ev.capture(page, null, '{{Toàn màn hình}}');

    // ── Kịch bản cuối: không có lỗi ngầm ────────────────────────────────────
    ev.scenario('khong-loi-ngam', 'Không có lỗi ngầm trong quá trình sử dụng',
      'Suốt toàn bộ thao tác ở trên, trình duyệt không ghi nhận lỗi kỹ thuật nào.');
    const real = consoleErrors.filter((e) => !/favicon|404 \(Not Found\)/i.test(e));
    check('Không có lỗi kỹ thuật nào phát sinh', real.length === 0, real.slice(0, 3).join(' | '));
  } catch (e) {
    if (!ev.current) ev.scenario('loi', 'Lỗi khi chạy kiểm tra', String(e.message));
    check('Chạy hết kịch bản không bị gián đoạn', false, e.message);
    await ev.capture(page, null, 'Trạng thái màn hình lúc gặp lỗi').catch(() => {});
  } finally {
    await browser.close();
    // Dọn trong finally để chạy cả khi test văng giữa chừng.
    ev.scenario('don-du-lieu', 'Dọn dữ liệu sau khi kiểm tra',
      'Toàn bộ số liệu tạo ra khi kiểm tra đều được xoá, dữ liệu thật không bị ảnh hưởng.');
    await cleanup();
    check('Không còn sót dữ liệu kiểm tra nào', true, '{{số bản ghi còn lại}}');
  }

  process.exit(ev.finish() ? 0 : 1);
})();
