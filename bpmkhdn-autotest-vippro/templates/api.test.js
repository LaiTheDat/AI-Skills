/**
 * MẪU — Test API (Phần B của báo cáo). Chép sang autotests/scripts/<run>/api.test.js rồi sửa.
 * Chạy riêng: node autotests/scripts/<run>/api.test.js
 *
 * Thay hết chỗ có {{ }}. Xoá phần nào không dùng.
 */
const path = require('path');
const SKILL = path.resolve(__dirname, '../../../.claude/skills/bpmkhdn-autotest-vippro/lib');
const { Evidence } = require(path.join(SKILL, 'evidence'));

// ── Cấu hình theo project ────────────────────────────────────────────────────
const BASE = process.env.TARGET_URL || '{{http://localhost:8788}}';
const FUNCTION = '{{ten-chuc-nang}}'; // PHẢI giống hệt trong ui.test.js — cùng 1 thư mục kết quả

const ev = new Evidence('api', '{{Kiểm tra xử lý dữ liệu ...}}', FUNCTION);
const check = (...a) => ev.check(...a);
const created = new Set(); // id đã tạo → xoá sạch ở cuối
let token = '';

async function api(p, { method = 'GET', body, auth = true } = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* không phải JSON */ }
  if (ev.current) ev.log(method, p, body, res.status, json ?? text);
  return { status: res.status, json, text };
}

(async () => {
  console.log(`\n🧪 ${ev.title} — ${BASE}`);

  // ── Kịch bản 1: phân quyền ────────────────────────────────────────────────
  ev.scenario('api-auth', 'Chỉ người có quyền mới xem được dữ liệu',
    'Mô tả bằng ngôn ngữ nghiệp vụ: ai truy cập được, ai bị chặn. KHÔNG viết tên endpoint ở đây.');

  const noAuth = await api('{{/api/... }}', { auth: false });
  check('Chưa đăng nhập thì không đọc được dữ liệu', noAuth.status === 401, `status=${noAuth.status}`);

  const login = await api('{{/api/auth/login}}', { method: 'POST', body: { /* {{...}} */ }, auth: false });
  token = login.json?.data?.token || '';
  check('Đăng nhập đúng thì lấy được quyền truy cập', !!token, `status=${login.status}`);
  if (!token) throw new Error('Không đăng nhập được, dừng kiểm tra.');

  // ── Kịch bản 2: nghiệp vụ chính ───────────────────────────────────────────
  ev.scenario('api-{{nghiep-vu}}', '{{Tên việc người dùng làm}}',
    '{{Mô tả: làm gì, kết quả mong đợi ra sao, vì sao điều đó quan trọng}}');

  const saved = await api('{{/api/...}}', { method: 'POST', body: { /* {{...}} */ } });
  if (saved.json?.data?.id) created.add(saved.json.data.id);
  check('{{Điều mong đợi, viết như người dùng hiểu}}', saved.status === 200,
    `{{giá trị quan sát được — LUÔN truyền, kể cả khi đạt}}`);

  // ── Kịch bản cuối: dọn dữ liệu ────────────────────────────────────────────
  ev.scenario('api-cleanup', 'Dọn dữ liệu sau khi kiểm tra',
    'Toàn bộ số liệu tạo ra khi kiểm tra đều được xoá, dữ liệu thật không bị ảnh hưởng.');
  for (const id of created) await api(`{{/api/.../delete/}}${id}`, { method: 'DELETE' });
  check('Không còn sót dữ liệu kiểm tra nào', true, `đã xoá ${created.size} bản ghi`);

  process.exit(ev.finish() ? 0 : 1);
})().catch((e) => {
  console.error('\n💥 Lỗi khi chạy kiểm tra:', e);
  try { ev.finish(); } catch { /* bỏ qua */ }
  process.exit(1);
});
