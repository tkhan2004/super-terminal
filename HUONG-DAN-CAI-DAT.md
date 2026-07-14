# 📖 Hướng dẫn cài đặt & sử dụng — Super Terminal

## 1. Tải về

Trong thư mục Drive này có 2 file để bạn chọn:

| File | Dùng khi nào |
|---|---|
| `Super Terminal Setup x.x.x.exe` | Muốn cài đặt hẳn vào máy, có icon Start Menu / Desktop (khuyến nghị) |
| `SuperTerminal-x.x.x-portable.exe` | Không muốn cài, chỉ chạy trực tiếp (dùng USB, máy dùng chung...) |

Chỉ cần tải **1 trong 2** file, không cần cả hai.

---

## 2. ⚠️ Windows chặn app — xử lý thế nào?

Vì Super Terminal là app build độc lập, **chưa có chữ ký số (code signing)**, nên khi chạy lần đầu Windows có thể cảnh báo hoặc chặn. Đây là chuyện **bình thường** với app nguồn mở/tự build, không phải app có virus. Tùy máy bạn sẽ gặp 1 trong 2 tình huống sau:

### Tình huống A — "Windows protected your PC" (SmartScreen)

Hộp thoại xanh, có nút xem thêm.

1. Bấm **"More info"**
2. Bấm **"Run anyway"**

Xong, app chạy bình thường.

### Tình huống B — "Smart App Control blocked an app that may be unsafe"

Hộp thoại đen, **không có nút "Run anyway"**. Đây là do tính năng **Smart App Control** trên Windows 11 đang bật, nó chặn cứng mọi app chưa được Microsoft xác minh.

Cách xử lý:

1. Mở **Windows Security** (gõ trong Start Menu).
2. Vào **App & browser control**.
3. Kéo xuống mục **Smart App Control** → bấm **Off**.
4. Chạy lại file `.exe`.

> ⚠️ **Lưu ý quan trọng**: Một khi tắt Smart App Control, **không thể bật lại** trừ khi cài lại Windows từ đầu (theo thông báo chính thức của Microsoft). Nếu bạn không muốn đánh đổi này, chỉ nên dùng máy phụ/máy test để chạy app cho đến khi có bản ký số chính thức.

---

## 3. Cài đặt

**Với bản Setup (installer):**

1. Chạy `Super Terminal Setup x.x.x.exe`
2. Xử lý cảnh báo Windows như mục 2 (nếu có)
3. Chọn nơi cài đặt → Install
4. App tự mở sau khi cài xong (có shortcut ở Desktop + Start Menu)

**Với bản Portable:**

1. Chạy trực tiếp `SuperTerminal-x.x.x-portable.exe`
2. Xử lý cảnh báo Windows như mục 2 (nếu có)
3. App mở ngay, không cần cài

---

## 4. Sử dụng cơ bản

Giao diện chia 3 cột:

```
┌──────────────────────────────────────────────────────────────────────┐
│ Project                                      Search        Settings │
├──────────────┬───────────────────────────────┬──────────────────────┤
│ Explorer     │                               │ Agents               │
│ (Files)      │        Terminal chính         │ (Sessions đang chạy) │
├──────────────┴───────────────────────────────┴──────────────────────┤
│ Prompt Builder                                              Send    │
└──────────────────────────────────────────────────────────────────────┘
```

- **Explorer (trái)**: duyệt file trong project, kéo thả file vào ô prompt thay vì gõ tay đường dẫn.
- **Terminal (giữa)**: terminal thật (giống Windows Terminal/Git Bash), chạy Claude Code, Codex CLI, Gemini CLI, hoặc lệnh bash bình thường.
- **Agents (phải)**: danh sách các agent/session đang chạy, trạng thái, thời gian chạy — click để chuyển qua lại tức thì.
- **Prompt Builder (dưới)**: gõ prompt, đính kèm file, dùng lại prompt cũ.

### Tạo workspace mới
Mở app → chọn thư mục project (git repo) → app tự nhận diện branch, file thay đổi, và lưu lại toàn bộ trạng thái để lần sau mở lại là có ngay.

### Chạy nhiều agent cùng lúc
Mở nhiều tab terminal trong cùng 1 workspace — mỗi tab là 1 PTY độc lập, có thể chạy Claude Code ở tab này, Codex CLI ở tab khác, theo dõi song song bằng chế độ split view.

### Đóng app, mở lại
Mọi session, terminal, layout đang mở sẽ được khôi phục lại y như lúc đóng app.

---

## 5. Gặp lỗi khi chạy?

Nếu app báo lỗi ngay khi mở (ví dụ lỗi thiếu module), hãy:

1. Đảm bảo bạn tải **đúng file mới nhất** từ Drive này, không dùng lại bản cũ đã tải trước đó.
2. Thử tải lại (file có thể tải lỗi giữa chừng).
3. Nếu vẫn lỗi, chụp lại màn hình lỗi và báo lại cho người phát triển.

---

*Super Terminal — Keep the real terminal. Improve everything around it.*
