---
name: bpmkhdn-autotest-vippro
description: Use when the user asks to test a feature they just finished, verify a change works, or produce test evidence for handover or acceptance — anything phrased as "viết test cho chức năng X", "test lại tính năng vừa làm", "kiểm thử commit này", "làm biên bản kiểm thử", "cần bằng chứng đã test".
---

# Autotest + biên bản kiểm thử

Chạy Playwright kiểm thử một chức năng vừa hoàn thành, rồi xuất ra **một file HTML tự chứa**
mà người không đụng code đọc được: mỗi kịch bản có ảnh chụp, bảng "Mong đợi / Kết quả thực tế",
và số liệu trung thực.

**Nguyên tắc bất di bất dịch: KHÔNG cài bất cứ thứ gì vào project.** Playwright dùng bản global.
Bộ khung và template nằm trong skill này.

## Cách gọi

| Gọi thế nào | Xử lý |
|---|---|
| `/bpmkhdn-autotest-vippro <git-hash>` | Lấy luôn hash đó làm phạm vi test. Chạy `git show --stat <hash>` ở bước 2, **không hỏi lại người dùng commit nào**. |
| `/bpmkhdn-autotest-vippro <tên chức năng>` | Tham số không giống hash (không phải chuỗi hex ≥ 7 ký tự) thì hiểu là tên chức năng — tự tìm commit liên quan bằng `git log --oneline -20`, rồi xác nhận với người dùng. |
| `/bpmkhdn-autotest-vippro` không tham số | Hỏi người dùng: test chức năng nào, hoặc commit nào. |
| Gọi tự nhiên ("viết test cho chức năng X") | Như dòng trên. |

Dù gọi kiểu nào, **bước 1 vẫn chạy trước tiên** — có hash sẵn không có nghĩa là bỏ qua kiểm môi trường.

## Quy trình — 3 bước, làm đúng thứ tự

### Bước 1 — Kiểm tra môi trường

Chạy trước tiên, trước cả khi đọc code:

```bash
node .claude/skills/bpmkhdn-autotest-vippro/lib/check-env.js [baseUrl]
```

Kiểm 6 thứ: Node ≥ 18 · Playwright global · Chromium mở được · `package.json` **không** có
playwright · **`autotests/` đã bị git loại trừ** · server project đang chạy.
Thiếu gì nó in đúng lệnh cần gõ.

Riêng phần git: nếu `autotests/` chưa bị bỏ qua, script **tự thêm vào `.git/info/exclude`** —
file loại trừ chỉ có trên máy hiện tại, không commit, nên không đụng `.gitignore` chung của team.
Kết quả test có ảnh chụp kèm dữ liệu thật, tuyệt đối không được đẩy lên remote.

**Không đủ môi trường thì DỪNG, báo người dùng.** Không tự `npm install` vào project để đi tiếp.

### Bước 2 — Chốt danh sách case TRƯỚC khi viết code

1. Đọc code đã sửa: `git show --stat <hash>` (hash lấy từ tham số nếu có) hoặc `git diff`.
   Không có hash và không đoán được thì hỏi.
2. Tách 2 nhóm:
   - **Phần A (UI)** — chứng minh được qua giao diện: thao tác, hiển thị, cảnh báo, điều hướng
   - **Phần B (API)** — chỉ kiểm được ở tầng dữ liệu: tính toán, lưu trữ, phân quyền, ràng buộc
3. Tìm **vùng dữ liệu an toàn**: khoảng tháng / dải ID / bản ghi không đụng dữ liệu thật.
   Nghĩ ngay ở bước này, không phải nghĩ sau khi viết xong.
4. **Trình bày danh sách case cho người dùng xác nhận trước khi viết dòng code nào.**
   Viết **đầy đủ mọi case có thể**, kể cả case biên và case lỗi — đừng tự cắt bớt.

**Chọn loại test theo đúng chức năng — không máy móc làm cả hai.**

| Chức năng đụng tới | Viết file |
|---|---|
| Cả giao diện lẫn xử lý dữ liệu | `api.test.js` + `ui.test.js` |
| Chỉ backend (endpoint mới, sửa công thức tính, cron, ràng buộc dữ liệu) | chỉ `api.test.js` |
| Chỉ frontend (đổi layout, thêm cảnh báo, sửa hiển thị, điều hướng) | chỉ `ui.test.js` |

Báo cáo tự bỏ phần không có dữ liệu — chỉ có UI thì không hiện Phần B, và ngược lại.
Tạo file rỗng cho phần không dùng là **sai**: báo cáo sẽ có mục trống.

Xác nhận xong mới viết script:

```
autotests/scripts/<dd-mm-yyyy>_<ten-chuc-nang>/
  api.test.js     ← chép từ templates/api.test.js   (nếu có phần dữ liệu)
  ui.test.js      ← chép từ templates/ui.test.js    (nếu có phần giao diện)
```

`<ten-chuc-nang>` là slug kebab-case, ví dụ `06-08-2026_ghi-nuoc`.
Khi viết cả hai file, hằng số `FUNCTION` **phải giống hệt nhau**, nếu không kết quả rơi vào
hai thư mục khác nhau và báo cáo bị tách đôi.

### Bước 3 — Chạy và xuất báo cáo

```bash
node .claude/skills/bpmkhdn-autotest-vippro/lib/run.js <dd-mm-yyyy>_<ten-chuc-nang>
```

Chạy `api.test.js` trước rồi `ui.test.js`, sau đó sinh báo cáo. Kết quả:

```
autotests/results/<dd-mm-yyyy>_<ten-chuc-nang>/
  images/      ảnh chụp từng kịch bản
  data/        api.json, ui.json (dữ liệu thô)
  bao-cao.html báo cáo giao cho người xem
```

Chạy xong `run.js` **tự mở `bao-cao.html` trên trình duyệt**. Thêm `--no-open` để tắt;
trên CI (`process.env.CI`) tự bỏ qua.

**Bắt buộc xem báo cáo trước khi báo là xong** — kiểm ảnh có hiện không, có thông tin
cá nhân nào lọt vào phần "chi tiết kỹ thuật" không.

## 4 quy tắc viết kịch bản

| Quy tắc | Đúng | Sai |
|---|---|---|
| Gom assertion thành **kịch bản nghiệp vụ** | 13 kịch bản cho 47 điểm kiểm | 47 mục rời rạc |
| Mô tả bằng **ngôn ngữ người dùng** | "Đổi đơn giá không làm sai phiếu tháng cũ" | "PUT /api/configs trả 200" |
| Ảnh **crop đúng vùng**, 1–2 ảnh/kịch bản | `ev.capture(page, '.row-card', ...)` | `fullPage: true` cả trang dài |
| Kỳ vọng theo **hành vi**, không theo tên class | "Bấm Lưu bị chặn, nêu rõ phòng sai" | "`.row-invalid` tồn tại" |

Tham số thứ 3 của `check()` là **giá trị quan sát được** — luôn truyền, kể cả khi đạt.
Nó lên cột "Kết quả thực tế"; không truyền thì cột đó chỉ có chữ "Đạt", báo cáo mất giá trị.

## Sai lầm thường gặp

| Sai | Hậu quả thật đã gặp |
|---|---|
| `waitForTimeout` chờ cứng | Test chập chờn, lúc pass lúc fail. Dùng `until()` trong template. |
| Chụp `fullPage` trang dài | Ảnh 470 KB, người xem phải dò mắt tìm chỗ cần nhìn |
| In nguyên response API | Lọt CCCD, số điện thoại, ngày sinh vào file gửi ra ngoài (`ev.log` đã tự cắt 400 ký tự) |
| Cài devDependency khi server đang chạy | `npm install` ghi đè runtime, giết luôn dev server |
| Chạy test khi bản build cũ hơn code | Test bản cũ mà tưởng đang test code mới. Kiểm `dist/` trước. |
| Không dọn dữ liệu | Lần chạy sau thấy rác của lần trước, kết quả sai. Dọn cả **trước** lẫn **sau**, đặt trong `finally`. |
| Làm tròn thành "đạt hết" | Báo cáo mất giá trị. Có case fail thì ghi đúng số, để nguyên trong mục "Còn tồn đọng". |

## Cờ đỏ — dừng lại nếu định làm những điều này

- `npm install` / `npm i -D` bất cứ gói nào vào project → **sai nguyên tắc skill**
- Viết script khi chưa cho người dùng xác nhận danh sách case
- Bỏ bớt case vì "chắc không sao"
- Báo "đã xong" mà chưa mở `bao-cao.html` ra xem
- Sửa code sản phẩm để test pass — test sai thì sửa test, code sai thì **báo cáo**, không lặng lẽ vá

## Tệp trong skill

| Tệp | Việc |
|---|---|
| `lib/check-env.js` | Bước 1 — kiểm môi trường |
| `lib/evidence.js` | Bộ khung: `Evidence`, `loadPlaywright()`, đường dẫn kết quả |
| `lib/report.js` | Sinh HTML (mục lục, bảng 2 cột, ảnh nhúng base64) |
| `lib/run.js` | Bước 3 — chạy hết script rồi xuất báo cáo |
| `templates/api.test.js` | Mẫu Phần B |
| `templates/ui.test.js` | Mẫu Phần A |

Template và bộ khung dùng chung cho mọi project — **chỉ sửa file trong `autotests/`, không sửa `lib/`
để chiều một project cụ thể.**
