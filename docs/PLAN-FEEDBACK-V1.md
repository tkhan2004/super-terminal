# Kế hoạch xử lý feedback bản release đầu tiên (v1.0.0)

**Nguồn:** Feedback thực tế từ Khang sau khi dùng thử bản release Windows đầu tiên.
**Ngày ghi nhận:** 2026-07-14
**Mục đích:** Phân tích từng feedback dựa trên code hiện tại, xếp độ ưu tiên/độ khó, và đưa ra hướng triển khai cụ thể cho các phiên bản tiếp theo. Tài liệu này bổ sung cho [ROADMAP.md](ROADMAP.md) (roadmap tính năng theo phase) — đây là roadmap "sửa lỗi & hoàn thiện UX" dựa trên trải nghiệm dùng thật.

---

## Tóm tắt & độ ưu tiên

| # | Feedback | Độ khó | Ưu tiên | Nhóm |
|---|---|---|---|---|
| 1 | Explorer ẩn dotfile/dot-folder (`.claude`, ...) | Rất thấp | **P0 — sửa ngay** | Bug |
| 2 | Terminal không copy/paste bằng Ctrl+C/V, kiểm tra lại các thao tác bằng phím luôn như ctrl a,z,... | Thấp | **P0 — sửa ngay** | Bug |
| 3 | Git panel: các mục Untracked/Unstaged/Staged không thu gọn được | Thấp | **P1** | UX |
| 4 | Git panel: file/commit đang xem không được highlight | Thấp–Trung bình | **P1** | UX |
| 5 | Không có splash screen khi khởi động app | Thấp | **P2** | Polish |
| 6 | Bản release không lưu lại Timeline | Trung bình | **P1** | Bug (persistence) |
| 7 | Custom theme (màu sắc/font/hiệu ứng), ưu tiên sáng/tối | Lớn | **P2 — cần roadmap riêng** | Feature lớn (MVP) |
| 8 | Terminal bị "đè"/ghosting khi chuyển qua lại giữa 2 project (workspace tab) | Trung bình | **P0 — sửa ngay** | Bug nghiêm trọng |

Đề xuất thứ tự triển khai: **(8) → (1)(2)(3) → (6) → (4) → (5) → (7)**. Mục 8 được nâng lên đầu vì đây là lỗi hiển thị/mất đồng bộ dữ liệu ảnh hưởng trực tiếp tới trải nghiệm lõi (terminal) khi làm việc đa dự án — vốn là use-case chính của app. Ba mục kế (1,2,3) là fix nhỏ, gộp chung một release vá lỗi sẽ mang lại cảm giác "app chững chạc hơn" ngay lập tức với chi phí thấp nhất.

---

## 1. Explorer ẩn dotfile / dot-folder

**Hiện trạng:** [src/main/fs/fsHandlers.ts:27](../src/main/fs/fsHandlers.ts) trong `handleReadDir` đang lọc cứng `entries.filter(name => !name.startsWith('.'))`, và lặp lại logic tương tự ở `getFilesRecursive` (dòng 83, có ngoại lệ riêng cho `.gitignore`). Đây là nguyên nhân trực tiếp khiến `.claude`, `.env`, `.github`, v.v. không hiện trong cây thư mục — dù `fileWatcher.ts` (chokidar) vẫn theo dõi thay đổi bên trong các thư mục này bình thường (danh sách ignore của watcher chỉ gồm `node_modules, .git, dist, build, out, release, .next, coverage`).

**Đề xuất:**
- Bỏ hoàn toàn filter `startsWith('.')` trong `handleReadDir`/`getFilesRecursive` — dotfile là thông tin hữu ích với dev (đặc biệt `.claude`, `.env.example`, `.github/workflows`).
- Giữ nguyên việc ẩn `.git` (đã nằm trong danh sách ignore riêng, không nên hiện icon trong Explorer để tránh nhầm với thao tác Git panel).
- Thêm setting "Hiện file ẩn" (toggle, mặc định **bật**) trong Explorer toolbar — tương tự VS Code — để người dùng có thể tắt nếu cây quá rối, thay vì lọc cứng.

**File cần sửa:** `src/main/fs/fsHandlers.ts`, `src/renderer/components/explorer/ExplorerTree.tsx` (thêm toggle UI + state).

---

## 2. Terminal không copy/paste bằng Ctrl+C/V, kiểm tra lại các thao tác bằng phím luôn như ctrl a,z,...

**Hiện trạng:** [src/renderer/components/terminal/useXtermSession.ts](../src/renderer/components/terminal/useXtermSession.ts) chỉ load `FitAddon` và `WebLinksAddon` (dòng 34–38) — không có `@xterm/addon-clipboard`, cũng không có `terminal.attachCustomKeyEventHandler(...)` ở bất kỳ đâu trong code. `onData` (dòng 52) chuyển thẳng mọi phím gõ tới PTY, nên Ctrl+C luôn được gửi làm byte SIGINT (0x03) kể cả khi đang bôi đen văn bản — đúng hành vi terminal gốc nhưng khác với kỳ vọng "Ctrl+C để copy khi có selection" mà các terminal hiện đại (Windows Terminal, Hyper, VS Code integrated terminal) đều hỗ trợ.

**Đề xuất (theo đúng pattern chuẩn của xterm.js):**
- Dùng `terminal.attachCustomKeyEventHandler` trong `useXtermSession.ts`:
  - `Ctrl+C` **khi có selection** (`terminal.hasSelection()`) → copy vào clipboard hệ điều hành, chặn không cho gửi xuống PTY (`return false`).
  - `Ctrl+C` **khi không có selection** → giữ nguyên hành vi cũ (gửi SIGINT xuống PTY).
  - `Ctrl+V` / `Shift+Insert` → đọc `navigator.clipboard.readText()` rồi gọi `terminal.paste(text)` (xterm.js tự lo bracketed-paste nếu cần).
  - `Ctrl+Shift+C` / `Ctrl+Shift+V` như phương án dự phòng (một số shell dùng Ctrl+C/V cho việc khác) — tham khảo cách Windows Terminal xử lý.
- Cân nhắc thêm right-click context menu (copy/paste) vì đây là hành vi người dùng Windows quen thuộc, dù không phải yêu cầu chính trong feedback này.

**File cần sửa:** `src/renderer/components/terminal/useXtermSession.ts`, `TerminalPane.tsx` (nếu cần UI context menu).

---

## 3. Git panel: các nhóm không thu gọn được

**Hiện trạng:** Git UI hiện nằm trong tab `'git'` của [src/renderer/components/agentManager/AgentManagerPanel.tsx](../src/renderer/components/agentManager/AgentManagerPanel.tsx), không phải component `GitPanel` riêng. Ba khối **Unstaged Changes** (dòng ~570), **Staged Changes** (~592), **Untracked Files** (~614) đều render dạng `<div>` cố định, không có chevron/toggle thu gọn — khác hẳn với **Commit History** (~647) vốn đã có cơ chế expand/collapse (`toggleCommit`, `expandedCommits`) sẵn.

**Đề xuất:** Áp dụng chính pattern collapse đã có ở Commit History cho cả 3 nhóm còn lại — thêm state kiểu `Record<'staged'|'unstaged'|'untracked', boolean>` (mặc định mở), chevron icon giống nhau cho đồng bộ UI, và số lượng file hiển thị ngay trên tiêu đề nhóm (`Unstaged Changes (2)`) kể cả khi thu gọn — để nhìn nhanh mà không cần mở ra.

**File cần sửa:** `src/renderer/components/agentManager/AgentManagerPanel.tsx` (phần JSX + state của tab git).

---

## 4. Git panel: file/commit đang xem chưa được làm nổi bật

**Hiện trạng:** Cùng file với mục 3. Các dòng file/commit chỉ có class `hover:bg-secondary/…` (dòng 580, 602, 624, 660, 697) — không có state "đang chọn" (`selected`/`active`). Khi bấm vào 1 file, app mở modal diff (`diffFile`/`diffContent`, dòng 719–758); sau khi đóng modal, không còn cách nào biết vừa xem file/commit nào từ giao diện danh sách.

**Đề xuất:**
- Thêm state `selectedFilePath` / `selectedCommitHash` ở component, set khi user click vào 1 dòng.
- Áp class nổi bật rõ ràng (nền `bg-primary/10` + viền trái `border-l-2 border-primary`, tương tự file đang mở trong Explorer) cho dòng đang chọn, **giữ nguyên state này sau khi đóng modal diff** (không reset), để người dùng quét mắt lại được đúng vị trí đang xem dở.
- Áp dụng cho cả file trong commit đã expand và file trong Unstaged/Staged/Untracked.

**File cần sửa:** `src/renderer/components/agentManager/AgentManagerPanel.tsx`.

---

## 5. Không có splash screen khi khởi động app

**Hiện trạng:** [src/main/index.ts](../src/main/index.ts) chỉ tạo **một** `BrowserWindow` với `show: false`, hiện ra khi có event `ready-to-show` (dòng 26–46). Không có splash window thứ hai, không có HTML loading riêng. `electron-builder.yml` cũng không có cấu hình splash.

**Đề xuất:** Thêm một `BrowserWindow` nhỏ, không viền (`frame: false`, `transparent: true` hoặc nền solid theo theme), hiện ngay lập tức khi app start, load một file HTML tĩnh nhẹ (logo + tên app + spinner). Khi cửa sổ chính bắn `ready-to-show`, đóng splash và show main window. Vì app hiện khởi động khá nhanh (chỉ 1 renderer, không gọi API nặng lúc đầu), splash không cần thanh tiến trình phức tạp — mục đích chính là che khoảng trắng/giật hình lúc load, đúng cảm giác "app desktop chuyên nghiệp".

**File cần thêm/sửa:** `src/main/index.ts` (tạo splash window trước, quản lý lifecycle), `resources/splash.html` (file tĩnh mới), `electron-builder.yml` (đảm bảo file splash được đóng gói vào `extraResources` hoặc build output).

---

## 6. Bản release không lưu lại Timeline

**Hiện trạng:** [src/renderer/stores/timelineStore.ts](../src/renderer/stores/timelineStore.ts) đã cài đặt đầy đủ — parse output PTY qua regex để phát hiện shell-prompt, git commit, kết quả test (Jest/Vitest PASS/FAIL), gọi từ `TerminalPane.tsx` mỗi khi có `session.onData`. Không có cờ "chỉ chạy ở dev" — logic chạy giống hệt nhau ở cả dev và bản đóng gói. **Vấn đề thật sự:** đây là store Zustand thuần in-memory, không được ghi vào persistence. `src/main/workspace/restoreService.ts` (`saveWorkspaceState`/`restoreWorkspace`) chỉ lưu `workspace`, `sessions`, `layout`, `tasks`, `pinnedFiles` — timeline events không nằm trong payload này. Do đó mỗi lần tắt app (xảy ra thường xuyên hơn nhiều với bản release so với việc luôn để mở khi dev), toàn bộ timeline mất sạch — đúng như feedback mô tả, dù bản chất không phải "release build bug" mà là thiếu tính năng persist cho mọi build.

**Đề xuất:**
- Thêm `timelineEvents` vào kiểu dữ liệu workspace state (`src/shared/types/workspace.ts` hoặc tương đương) và vào payload `saveWorkspaceState`/`restoreWorkspace`.
- Debounce việc ghi (event timeline có thể sinh khá nhiều) — ví dụ ghi mỗi ~2–5 giây hoặc khi có event "cứng" (prompt sent, commit) thay vì ghi theo từng dòng regex match.
- Giới hạn số lượng event lưu trên mỗi session (ví dụ 500 event gần nhất) để tránh phình file JSON — nhất quán với nguyên tắc "scrollback persistence" đã ghi trong ROADMAP.md mục Rủi ro.
- Khi restore, `timelineStore` cần hydrate lại từ dữ liệu đã lưu theo `sessionId`.

**File cần sửa:** `src/renderer/stores/timelineStore.ts`, `src/main/workspace/restoreService.ts`, `src/shared/types/workspace.ts` (hoặc file type liên quan).

---

## 8. Terminal bị "đè"/ghosting khi chuyển qua lại giữa 2 project

**Mô tả lỗi:** Khi mở 2 workspace tab (2 project khác nhau, ví dụ `ikigai-secure-pdf` chạy PowerShell thường và `mcp-harness` chạy Claude Code CLI), rồi bấm chuyển qua lại giữa 2 tab đó, nội dung terminal bị hiển thị sai/đè lên nhau — như 2 ảnh chụp màn hình đã gửi.

**Nguyên nhân (đã trace qua code, không phải suy đoán):**

1. **Thiếu `key` khi render pane → React tái sử dụng nhầm DOM node giữa 2 session khác nhau.** [src/renderer/App.tsx:786](../src/renderer/App.tsx) render `<TerminalSplitView node={layoutTree} .../>` không có prop `key`; bên trong, [src/renderer/components/terminal/TerminalSplitView.tsx:33](../src/renderer/components/terminal/TerminalSplitView.tsx) render `<TerminalPane sessionId={node.sessionId} .../>` cũng không có `key`. Khi 2 workspace có layout dạng giống nhau (đều là 1 pane không chia split — đúng trường hợp trong ảnh), React coi việc chuyển tab là "update prop `sessionId` trên cùng 1 component" thay vì unmount/remount — nên `<div ref={containerRef}>` trong `useXtermSession.ts` bị dùng chung cho 2 session hoàn toàn khác nhau.
2. **`useXtermSession.ts` phản ứng với việc đổi `sessionId` bằng cách dispose + tạo lại `Terminal` trên đúng DOM node cũ** (effect phụ thuộc `[sessionId, onResize, onData]`, dòng 63) — nhưng không có bước `fitAddon.fit()` / refresh bắt buộc khi pane được kích hoạt lại; `TerminalPane.tsx` (dòng 53–57) chỉ gọi `focus()` khi `isActive`, không gọi `fit()`. Terminal mới tạo có thể tạm thời không khớp kích thước với PTY đang chạy phía sau.
3. **PTY luôn khởi tạo cứng 80×24 cột/dòng.** [src/main/ipc/registerIpcHandlers.ts](../src/main/ipc/registerIpcHandlers.ts) hàm `handleSessionCreate` (dòng ~120–129) không truyền `cols`/`rows` thực tế khi gọi `ptyManager.createSession`, nên PTY luôn bắt đầu ở 80×24 ([ptySession.ts](../src/main/pty/ptySession.ts) dòng 53–54) và chỉ được sửa kích thước sau đó qua `ResizeObserver` phía renderer — tạo ra một khoảng thời gian PTY và xterm.js "hiểu" kích thước khác nhau. Với TUI vẽ theo tọa độ tuyệt đối (progress bar/box của Claude Code), lệch kích thước này khiến nội dung redraw sai vị trí, gây cảm giác "đè"/chồng chữ.
4. **Session chạy nền hoàn toàn không nhận output khi tab không active** (vì bị unmount thật, không phải ẩn bằng CSS) — không mất dữ liệu PTY (PTY vẫn chạy), nhưng cũng không có cơ chế "replay" lại nội dung đã bỏ lỡ khi quay lại tab, nên terminal mới dựng lại có thể trông "trống/khác" so với trạng thái thật cho tới khi có output mới.

**Đề xuất fix (ưu tiên xử lý theo đúng thứ tự):**
1. Thêm `key={node.sessionId}` ở `TerminalSplitView.tsx:33` và `key={workspace.id}` (hoặc key tương ứng theo tab) ở chỗ gọi `TerminalSplitView` trong `App.tsx:786` — đảm bảo React unmount/remount đúng khi đổi session/workspace thay vì tái sử dụng nhầm DOM.
2. Trong `TerminalPane.tsx`, khi `isActive` chuyển từ `false → true`, gọi `fitAddon.fit()` và forward kích thước mới qua `onResize` **trước hoặc cùng lúc** với `focus()` (hiện chỉ có `focus()`).
3. Sửa `handleSessionCreate` trong `registerIpcHandlers.ts` để truyền đúng `cols`/`rows` thực tế (đo từ container ngay khi tạo) thay vì mặc định 80×24 — giảm khoảng thời gian lệch kích thước giữa PTY và renderer.
4. (Nice-to-have, không bắt buộc để fix triệt để lỗi này) Cân nhắc mô hình "ẩn bằng CSS thay vì unmount" cho pane không active trong cùng 1 workspace, để tránh phải dispose/recreate `Terminal` liên tục khi chuyển qua lại — nhưng đây là thay đổi kiến trúc lớn hơn, nên làm ở bản sau nếu (1)-(3) chưa giải quyết hết.

**File cần sửa:** `src/renderer/App.tsx` (dòng 786), `src/renderer/components/terminal/TerminalSplitView.tsx` (dòng 33), `src/renderer/components/terminal/TerminalPane.tsx` (dòng 53–57), `src/renderer/components/terminal/useXtermSession.ts` (dòng 44–63), `src/main/ipc/registerIpcHandlers.ts` (`handleSessionCreate`).

---

## 7. Custom theme (màu sắc / font / hiệu ứng) — cần roadmap riêng

Đây là feedback có phạm vi lớn nhất, đúng như Khang ghi nhận. Nên tách thành sáng kiến riêng (không làm chung patch với 6 mục trên), triển khai theo từng bước nhỏ.

### Hiện trạng nền tảng
- `tailwind.config.js` đã dùng `darkMode: 'class'` và map toàn bộ token màu Tailwind (`background`, `foreground`, `primary`, `card`, ...) sang CSS custom properties dạng `hsl(var(--background))` — **kiến trúc theme-ready**, chỉ thiếu phần "nhiều theme" và UI đổi theme.
- `src/renderer/styles.css` hiện chỉ định nghĩa **một** bộ `:root` (theme tối), không có biến thể sáng, không có `.dark`/`.light` class toggle, không có `prefers-color-scheme`.
- Không có store/setting nào liên quan theme (`layoutStore`, `sessionStore`, `taskStore`, `timelineStore`, `workspaceStore` — không có `settingsStore`/theme store), không có cơ chế persist lựa chọn theme.

### Đề xuất chia giai đoạn (khớp tinh thần "MVP" mà Khang đề cập — làm sáng/tối trước)

**Giai đoạn A — Light/Dark mode (MVP theme):**
1. Tạo `settingsStore.ts` (Zustand + persist vào JSON qua `WorkspaceRepository` hiện có, hoặc file settings riêng trong `userData`): `{ themeMode: 'light' | 'dark' | 'system' }`.
2. Viết bộ biến `:root.light { ... }` song song với bộ tối hiện tại trong `styles.css`, đảm bảo đủ tương phản (đặc biệt cho vùng terminal — text/nền của xterm.js cấu hình riêng qua `theme` option của `Terminal`, cần đồng bộ với theme app chứ không tự động ăn theo CSS variable).
3. Toggle class `light`/`dark` trên `<html>` dựa theo `themeMode`, lắng nghe `window.matchMedia('(prefers-color-scheme: dark)')` khi ở chế độ `system`.
4. Thêm mục chọn theme trong Settings (icon Settings đã có ở góc trên UI theo `overview.md` — cần tạo panel Settings nếu chưa có, vì hiện chưa thấy trong danh sách stores/components).
5. Đảm bảo xterm.js instance re-theme động khi đổi mode (gọi `terminal.options.theme = {...}` runtime, không cần tạo lại Terminal).

**Giai đoạn B — Accent color / custom màu:**
- Cho phép chọn 1 trong vài accent color có sẵn (ví dụ 5–6 preset), áp dụng bằng cách override biến `--primary` — chưa cần color picker tự do ở giai đoạn này để tránh việc phải tự kiểm tra tương phản (contrast) cho mọi tổ hợp màu.

**Giai đoạn C — Font & hiệu ứng:**
- Font chữ terminal: cho chọn font monospace (đã cài sẵn hay Google Fonts local-bundle) + cỡ chữ + line-height, áp trực tiếp vào `theme`/`fontFamily` option của xterm.js instance.
- Hiệu ứng: cursor blink/style, animation cho chuyển tab/pane (dùng `framer-motion` nếu chưa có, cần đánh giá bundle-size trade-off) — nên coi là "nice-to-have", làm sau cùng.

**Giai đoạn D — Full custom theme (nâng cao, không bắt buộc cho MVP):**
- Theme editor cho phép chỉnh từng biến CSS + export/import theme dạng JSON (giống VS Code theme file) — chỉ nên làm nếu có nhu cầu thực tế rõ ràng sau khi Giai đoạn A-C đã dùng ổn.

### Vì sao chia nhỏ như trên
Theme là tính năng dễ "phình" nếu làm một lần (dark/light + accent + font + hiệu ứng + editor cùng lúc) — chia giai đoạn giúp có thể ship "sáng/tối" sớm (giá trị cao, effort thấp nhờ nền CSS-variable đã có sẵn), trong khi các phần color picker tự do / theme editor để sau vì rủi ro về kiểm thử contrast và độ phức tạp UI cao hơn hẳn.

**File liên quan:** `tailwind.config.js`, `src/renderer/styles.css`, `src/renderer/stores/settingsStore.ts` (mới), component Settings panel (mới, hiện chưa tồn tại), `useXtermSession.ts` (áp theme runtime cho xterm).

---

## Đề xuất release plan

- **Hotfix ưu tiên cao nhất:** mục 8 (terminal ghosting khi chuyển workspace) — ảnh hưởng trực tiếp tới độ tin cậy của tính năng lõi (chạy nhiều agent/project song song), nên fix và phát hành riêng, không chờ gộp patch.
- **Patch tiếp theo (vá lỗi nhanh):** mục 1, 2, 3 — đều là fix cục bộ, rủi ro thấp, không đổi kiến trúc.
- **Patch sau đó:** mục 6 (timeline persistence) + mục 4 (highlight) — cần thêm field vào schema lưu trữ, nên gộp chung một đợt kiểm thử restore/relaunch.
- **Polish trước bản release kế tiếp:** mục 5 (splash screen).
- **Sáng kiến riêng, theo dõi tiến độ độc lập:** mục 7 (theming), bắt đầu từ Giai đoạn A (Light/Dark).
