<!-- Hallmark · pre-emit critique: P4 H4 E3 S5 R4 V4 · scope: pilot design review; technical acceptance incomplete, broad rollout pending -->

# QTEnvDev — Kế hoạch refactor toàn bộ giao diện

Ngày khảo sát: 17/11/2026 · phiên bản trong `package.json`: 4.21.0 · **trạng thái: foundation và sáu workspace mẫu đã triển khai để duyệt hình thức; chưa nghiệm thu kỹ thuật toàn bộ**.

QTEnvDev chuyển sang một bàn điều khiển phát triển có bố cục rõ, nền graphite, điểm nhấn teal/cyan theo logo, bảng dữ liệu dễ quét và vùng editor/log rộng. Thiết kế lại cấu trúc hiển thị của từng nhóm công việc, thay vì chỉ thay màu hoặc thêm một lớp CSS toàn cục.

Phạm vi là **103 màn hình chính**, cùng toàn bộ tab, biểu mẫu, drawer, dialog và trạng thái của các luồng đang hoạt động. [Danh mục chi tiết](ui-redesign-inventory.md) là checklist triển khai, có đường dẫn đến mã nguồn.

## 1. Quy mô và cách đếm

| Nhóm triển khai | Số màn hình chính | Phạm vi |
| --- | --: | --- |
| Dịch vụ hạ tầng và tiện ích dịch vụ | 37 | Web server, database, cache/queue, search, DNS, tunnel, governance, storage, FTP, mail, MkCert, CliProxyAPI, n8n |
| Ngôn ngữ và dự án | 18 | PHP, Node.js, Python, Go, Java, Flutter và các runtime khác |
| Workspace chuyên biệt | 5 | Startup groups, Hosts, Cron, Git, Podman |
| Trang hệ thống | 2 | Settings và module dịch vụ tùy chỉnh |
| Tools | 39 | 1 danh mục công cụ + 38 màn hình công cụ |
| Cửa sổ phụ | 2 | Tray và lớp chụp/đánh dấu màn hình |
| **Tổng** | **103** | **63 trang route + 38 công cụ con + 2 cửa sổ phụ** |

Các lớp giao diện bên trong cũng nằm trong phạm vi:

- **222 vị trí view/template cấp trang**: 216 trong 61 module, 3 trong Settings và 3 loại template dịch vụ/config/log của module tùy chỉnh. Đây là các tab/chế độ hiển thị nằm trong những trang đã đếm, không cộng thêm vào 103. Con số này chưa bao gồm mọi tab sâu của Podman, ImageCompress hoặc trình soạn thảo tài liệu.
- **99 vị trí khai báo overlay trong 89 file Vue có đường dẫn sử dụng**: dialog, drawer và wrapper chung. Có vị trí dùng lại cùng mẫu, có biến thể nền tảng; đây không phải 99 màn hình thiết kế độc lập. Các dialog gọi động qua `Base.Dialog`/`ElMessageBox` còn cần kiểm tra bằng primitive chung và luồng mở thực tế.
- Shell ứng dụng, onboarding, About, Feedback, app log, helper terminal, toast, menu ngữ cảnh và trạng thái lỗi đều có checklist riêng. Chúng không được coi là các trang route mới.

Danh mục lấy từ `AppModules.ts`, router, `AppTool.ts`, import component và template Vue hiện tại. Đây là khảo sát tĩnh, chưa phải kết quả chạy kiểm thử trực quan. Khi bắt đầu triển khai, cần xác nhận các luồng mở động bằng ứng dụng/fixture; nếu phát hiện giao diện còn thiếu thì bổ sung vào checklist và báo rõ thay đổi phạm vi.

Bản `design.md` cũ ghi 71 module và còn nhắc plugin/AI workspace; đã cập nhật nguồn thiết kế cho phạm vi hiện tại. Bộ đếm mới bao gồm cả module đang được hỗ trợ nhưng người dùng có thể ẩn khỏi sidebar. Các tính năng AI/plugin đã gỡ không thuộc đề xuất này. n8n và CliProxyAPI vẫn được đăng ký nên vẫn có trong phạm vi.

## 2. Kết quả khảo sát hiện trạng

| Ưu tiên | Bằng chứng từ mã nguồn | Hệ quả | Hướng xử lý |
| --- | --- | --- | --- |
| Cao | [Tools/Index.vue](../src/render/components/Tools/Index.vue) bọc toàn bộ workspace trong card; nhiều công cụ lại có card con | Nội dung bị chia nhỏ, nhiều viền và khoảng đệm lặp | Danh mục dạng thư viện; màn hình công cụ có vùng input/output trực tiếp |
| Cao | [ServiceManager](../src/render/components/ServiceManager/index.vue), [LanguageProjects](../src/render/components/LanguageProjects/index.vue) có nhiều cột kích thước cố định và action biểu tượng | Khó phân biệt thao tác chính; bảng chật khi cửa sổ nhỏ | Bảng có ưu tiên cột, status rõ, action chính hiện thường trực, menu cho tác vụ phụ |
| Cao | [Tools/Index.vue](../src/render/components/Tools/Index.vue) và [Podman/left.vue](../src/render/components/Podman/left.vue) chứa action chỉ hiện qua hover | Tính năng khó tìm, tương tác bàn phím thiếu dấu hiệu | Action khả dụng qua focus; thao tác quan trọng có nhãn hoặc menu hiện được bằng bàn phím |
| Cao | Các module lặp lại card + radio tab dù công việc khác nhau | Trang dự án, cấu hình, dịch vụ và log có cùng thứ bậc | Dùng 7 mẫu workspace phù hợp tác vụ, chung typography/token/interaction |
| Vừa | [tokens.css](../src/render/style/tokens.css) đã có semantic token nhưng vẫn tồn tại màu trực tiếp, ví dụ [n8n](../src/render/components/N8N/Index.vue) | Màu trạng thái và độ tương phản thiếu thống nhất | Một bảng token sáng/tối; bridge cho Element Plus, Monaco, xterm và tên legacy |
| Vừa | [StartupGroup/GroupCard.vue](../src/render/components/StartupGroup/GroupCard.vue) có panel lồng nhau và vùng cuộn cố định | Nhóm dịch vụ bị nặng khung, khó nhìn thành viên | Nhóm phẳng, hàng thành viên rõ, tóm tắt trạng thái dựa trên dữ liệu thật |
| Vừa | [style/index.scss](../src/render/style/index.scss) vẫn có `transition: all`; có thêm lớp [workbench.scss](../src/render/style/workbench.scss) | Sửa giao diện dễ tạo cascade khó kiểm soát | Transition theo thuộc tính; layout có class rõ trong component, giới hạn override |
| Vừa | `design.md` và báo cáo Hallmark cũ ghi phạm vi trước khi gỡ tính năng | Dễ nghiệm thu theo danh sách sai | Cập nhật nguồn chuẩn và bằng chứng mới sau khi duyệt |

Các nhận xét trên ghi baseline trước refactor. Foundation và sáu pilot đã có thay đổi thực tế; bằng chứng mới và giới hạn kiểm tra nằm trong [báo cáo pilot](ui-redesign-pilot-review.md). Chưa nghiệm thu các trang ngoài pilot.

### Pre-flight Hallmark

- **Hệ thống hiện có:** [design.md](../design.md:1) là nguồn thiết kế hiện hành; đã cập nhật theo hướng được chấp thuận.
- **Font:** `--font-display`, `--font-body`, `--font-mono` tại [tokens.css](../src/render/style/tokens.css:20); Space Grotesk, Geist và JetBrains Mono đã có file font cục bộ.
- **Màu/spacing:** OKLCH, light/dark, spacing 4 điểm và cầu nối Element Plus đã có trong [tokens.css](../src/render/style/tokens.css:1). [Tailwind](../tailwind.config.ts:7) đã có ánh xạ semantic vào `theme.extend` trong foundation pilot.
- **Framework:** Electron + Vue 3 + Element Plus + Tailwind/SCSS; giữ stack hiện tại.
- **Motion:** không có thư viện motion chuyên dụng trong dependency; dùng CSS ngắn, không bổ sung GSAP cho UI quản lý dịch vụ.
- **Thương hiệu:** [logo SVG](../static/qtenvdev-icon.svg:2) dùng navy, teal `#46E4D2` và lime `#A6E36A`; lấy teal làm màu thao tác, lime chỉ làm chi tiết thương hiệu khi cần.
- **Kích thước sản phẩm:** cửa sổ mặc định 1200×800, tối thiểu 800×600 theo [page.ts](../src/main/configs/page.ts:21).

## 3. Hướng thiết kế đã chấp thuận

**Thể loại:** modern-minimal cho ứng dụng kỹ thuật. **Cảm giác:** chính xác, tập trung, hiện đại; nhận diện QTEnvDev thể hiện qua màu, kiểu chữ và cách trình bày dữ liệu.

### Màu và bề mặt

Dark dùng graphite có sắc navy, panel nâng một cấp sáng, đường phân chia mảnh. Teal/cyan dùng cho hành động chính, lựa chọn đang hoạt động và điểm nhận diện; màu không phủ toàn bộ panel. Light dùng nền xám lạnh rất nhẹ, vùng làm việc trắng và teal đậm để chữ/nút đủ rõ. Giữ tùy chọn theme hiện có của người dùng.

Bảng dưới ghi màu định hướng ban đầu. Giá trị OKLCH thực thi đã được khóa và điều chỉnh tương phản tại [design.md](../design.md) và `tokens.css`; component đọc nguồn này, không sao chép mã hex từ bảng kế hoạch:

| Token semantic hiện có  | Dark đề xuất | Light đề xuất | Vai trò                            |
| ----------------------- | ------------ | ------------- | ---------------------------------- |
| `--color-canvas`        | `#0B1118`    | `#F3F6F8`     | Nền ứng dụng                       |
| `--color-surface`       | `#121C26`    | `#FFFFFF`     | Vùng làm việc                      |
| `--color-surface-muted` | `#0F1720`    | `#EAF0F4`     | Sidebar, vùng phụ                  |
| `--color-surface-hover` | `#1D2B38`    | `#E1EBEF`     | Hover/chọn nhẹ                     |
| `--color-rule`          | `#2B3B4A`    | `#D3DDE4`     | Đường phân chia                    |
| `--color-ink`           | `#E9F1F7`    | `#152534`     | Chữ chính                          |
| `--color-ink-muted`     | `#A5B7C7`    | `#506477`     | Chữ phụ                            |
| `--color-accent`        | `#46E4D2`    | `#087C73`     | Hành động chính                    |
| `--color-accent-ink`    | `#09201E`    | `#FFFFFF`     | Chữ trên nút accent                |
| `--color-focus`         | `#BDD9FF`    | `#244BC1`     | Vòng focus, kiểm tra cả nút accent |
| `--color-success`       | `#87D6A8`    | `#18794E`     | Đang chạy/hoàn tất                 |
| `--color-warning`       | `#EBC27A`    | `#8A5700`     | Cần chú ý                          |
| `--color-danger`        | `#F3919A`    | `#B4233A`     | Lỗi/thao tác nguy hiểm             |

Giá trị được khóa ở một nguồn `tokens.css`, ánh xạ Tailwind + Element Plus. Component chỉ dùng token semantic. Màu trạng thái luôn đi cùng chữ/biểu tượng, không dựa vào màu đơn thuần. Không thêm gradient, glow hoặc hiệu ứng kính vào vùng thao tác.

### Typography và nhịp kích thước

| Thành phần | Đề xuất |
| --- | --- |
| Tiêu đề trang | Space Grotesk 600, 24/30px; tối đa 28/34px ở workspace rộng |
| UI, bảng, form | Geist 400/500/600; mặc định 14/20px; nhãn phụ 12/16px |
| Code, terminal, phiên bản, port, đường dẫn | JetBrains Mono; số dùng tabular figures; giữ tùy chọn font hiện có |
| Khoảng cách | 4 / 8 / 12 / 16 / 24 / 32px qua token; padding trang 24px, cửa sổ hẹp 16px |
| Sidebar | Khoảng 224px, thu gọn 56px; giữ thứ tự/ẩn-hiện module hiện có |
| Header nội dung | Khoảng 64px; tên module, mô tả ngắn khi cần, hành động chính bên phải |
| Control | Input và nút cùng hàng cùng chiều cao; mặc định vùng tương tác 44px, icon 16–18px |
| Bảng | Hàng 44px; tiêu đề 12/16px; tên/phiên bản nổi bật hơn path; action không chen vào dữ liệu |
| Bo góc | Control 8px, panel 10px, dialog 14px; badge trạng thái gọn, không biến mọi nút thành pill |
| Drawer/dialog | Form ngắn khoảng 480–560px; form phức tạp 720px; editor dùng drawer rộng; đều giới hạn theo viewport |

Font heading luôn thẳng, không italic; không dùng tiêu đề marketing lớn trong công cụ. Long path có copy, tooltip/focus reveal hoặc vùng cuộn riêng; không che thông tin quan trọng bằng truncate mà không có cách xem đủ.

### Shell và điều hướng

- Giữ title bar/drag region thực của Electron, có vùng `no-drag` cho control. Nội dung không vẽ lại chrome trình duyệt/IDE giả.
- Sidebar nhẹ, nhóm module phân cấp rõ, active item có nền nhẹ và vạch/biểu tượng. Giữ nhóm, thứ tự và tùy chọn ẩn hiện. Tác vụ cài đặt/công cụ hệ thống được đặt nhất quán, không cạnh tranh với danh sách module.
- Tên trang, trạng thái dịch vụ và hành động chính có vị trí ổn định. Mỗi workspace chỉ có một mức hành động chính theo ngữ cảnh; những tác vụ khác vào nhóm/menu có nhãn rõ.
- Header, tab và toolbar không lặp cùng tiêu đề. Nội dung dùng chiều cao còn lại; editor/log không bị bó vào nhiều lớp padding.
- Nếu workspace cần điều hướng phụ (Podman/Settings), nó nằm trong vùng nội dung; tránh hai sidebar lớn giành cùng nhiệm vụ.
- Chưa thêm command palette, dashboard mới hoặc workflow mới vào phạm vi. Tìm kiếm/lọc hiện có được bố trí lại theo từng trang.

## 4. Bảy mẫu workspace

| Mẫu | Cấu trúc mới | Áp dụng |
| --- | --- | --- |
| Service workbench | Header tên + trạng thái; tab công việc; thanh lọc; danh sách phiên bản cài đặt với start/stop rõ; thông tin phụ theo ngữ cảnh | Phần lớn server, database, runtime |
| Project workbench | Toolbar dự án; bảng tên/path/runtime/port/trạng thái; chỉnh sửa trong drawer có nhóm trường; mở config/log trực tiếp | LanguageProjects, PHP/Node/Python/Go, Flutter, Hosts |
| Version catalogue | Chọn nguồn bằng tab gọn; tìm/lọc; bảng phiên bản; tiến độ và kết quả gắn với đúng item; footer tác vụ khi có | Local, static, Homebrew, MacPorts, SDKMAN và nguồn đặc thù |
| Editor/log workbench | Thanh file/nguồn; vùng editor hoặc log chiếm diện tích chính; save/refresh/open rõ; lỗi/đường dẫn không lấn nội dung | Config, vhost, hosts, log, terminal, package editor |
| Infrastructure explorer | Điều hướng machine/resource gọn; danh sách và vùng detail; action theo resource; biểu mẫu chia nhóm | Podman, DB management, Cloudflare tunnels, n8n users |
| Focused tool | Cấu hình ở đầu hoặc cột phụ; input/output cân bằng; kết quả copy/download rõ; thư viện công cụ riêng | 38 Tools; công cụ ảnh có preview và bảng thiết lập |
| Settings workbench | Điều hướng nhóm bên trái nội dung; chi tiết bên phải; label/helper rõ; vùng nguy hiểm riêng | Common, Modules, UI; onboarding rút gọn theo luồng hiện tại |

Startup groups có bố cục riêng trong họ service: nhóm phẳng, thành viên xếp hàng, thao tác start/stop nhóm rõ, giữ nguyên cách điều phối đang có. Không thêm CPU/RAM/chart nếu ứng dụng chưa có dữ liệu đó.

### Sáu mẫu cần duyệt trước khi mở rộng

| Mẫu            | Cần thấy trong bản mẫu                                                         |
| -------------- | ------------------------------------------------------------------------------ |
| Startup groups | Shell, nhóm nhiều dịch vụ, một dịch vụ lỗi, thao tác nhóm                      |
| PHP            | Danh sách dự án/service, version catalogue và drawer extension/config đại diện |
| Hosts          | Danh sách site, drawer chỉnh site có trường nâng cao                           |
| Podman         | Machine + danh sách container và detail, một form tạo resource                 |
| Tools / JSON   | Danh mục công cụ và workspace input/output; có lỗi parse                       |
| Settings       | Theme/light-dark, nhóm cài đặt, form và focus bàn phím                         |

Đây là 6 workspace đại diện thuộc phạm vi 103, tương ứng 7 ID vì thư viện Tools và JSON có ID riêng; không cộng thêm vào tổng. Bản mẫu dùng dữ liệu fixture có nhãn rõ; duyệt dark + light, kích thước 1200×800 và 800×600. Phần duyệt mẫu đánh giá bố cục thực tế, không chỉ bảng màu.

## 5. Interaction và các trạng thái bắt buộc

- Component có default, hover, focus-visible, pressed, disabled, loading, error và success khi trạng thái đó áp dụng. Control không phát sinh success/error giả chỉ để đủ danh sách.
- Page/list có tải ban đầu, rỗng, không tìm thấy, lỗi fetch, có dữ liệu và đang có operation. Service phân biệt stopped/running/starting/stopping/error/unknown theo dữ liệu thật.
- Loading dùng skeleton nếu cấu trúc danh sách dự đoán được; tác vụ dùng progress/terminal hiện có. Không hiển thị phần trăm khi backend chỉ phát trạng thái.
- Giữ kết quả đã hoàn tất khi một item khác lỗi. Operation đang chạy vẫn nhìn thấy khi quay lại trang; không coi progress là success.
- Input có label hiển thị, helper/error liên kết bằng ARIA, border không đổi độ dày khi focus; nút và input cạnh nhau cùng nhịp.
- Icon action có accessible name, tooltip và vùng tương tác phù hợp. Bàn phím truy cập được thao tác phụ, menu và các mục tab; không phụ thuộc hover.
- Dialog/drawer tiếp tục dùng cơ chế Element Plus/AsyncComponent hiện có, kiểm tra focus trap, Escape theo chính sách hiện tại, restore focus, cuộn nội dung và footer. Không thay thư viện modal chỉ để đổi hình thức; không tự đóng terminal đang thực thi.
- Thao tác xóa/drop/ghi file/quyền quản trị giữ nguyên xác nhận và ý nghĩa bảo vệ. Chỉ chỉnh hierarchy, wording hiển thị và trình bày lỗi trong phạm vi giao diện.
- Toast thành công nhẹ, lỗi phải có ngữ cảnh; kết quả quan trọng lưu ở nơi operation hiện có quản lý. Không phát hai thông báo cho cùng một terminal event.
- Motion 120–180ms cho màu/opacity/transform cần thiết; focus xuất hiện tức thì; hỗ trợ `prefers-reduced-motion`. Không `transition: all`, không animate dữ liệu log theo từng dòng.

## 6. Lộ trình và mốc duyệt

| Giai đoạn | Phạm vi | Đầu ra và điều kiện hoàn tất |
| --- | --- | --- |
| 0 — Duyệt đề xuất | Hai tài liệu này + pre-flight | Đã chấp thuận hướng nhìn, cách đếm, phạm vi và thứ tự |
| 1 — Khóa hệ thống và mẫu | `design.md` mới + 6 mẫu ở trên | Đã cập nhật design system và triển khai mẫu; **đánh giá mẫu trước khi nhân rộng**; xem báo cáo pilot |
| 2 — Foundation | Shell, token, primitives, 7 layout | Light/dark, font, table/form/tabs/menu/dialog/notice/editor/terminal thống nhất; có fixture trạng thái và kiểm tra bàn phím |
| 3 — Dịch vụ | **37 trang** | Các hạ tầng dùng template chung nhưng rà từng config/log/extension/dialog đặc thù; n8n, tunnel và DB management không chỉ đổi wrapper |
| 4 — Ngôn ngữ/dự án | **18 trang** | Dự án, phiên bản, create/edit, npm scripts, PHP extensions, Flutter/Android, GVM/Maven/Rustup theo nền tảng |
| 5 — Workspace và hệ thống | **7 trang** | Startup groups, Hosts, Cron, Git, Podman; Settings, customer module; hoàn tất luồng sâu và overlay tương ứng |
| 6 — Công cụ/cửa sổ phụ | **41 màn hình** | Danh mục + 38 Tools + tray + capturer; hỗ trợ mở Tools qua drawer, custom URL host, overlay hệ thống còn lại |
| 7 — Nghiệm thu toàn bộ | **103 màn hình + checklist view/overlay** | Ảnh/bằng chứng mới, checks phù hợp, checklist nền tảng và trạng thái; không nghiệm thu từ báo cáo cũ |

37 + 18 + 7 + 41 = **103**. Foundation dùng chung và mẫu pilot được tiếp tục hoàn thiện ở batch tương ứng; không đếm hai lần. Mỗi batch bàn giao có danh sách trang/view/overlay đã làm, ảnh light/dark và mục còn chưa xác minh. Ưu tiên các batch vừa đủ review; chưa cam kết thời gian thực hiện khi chưa duyệt mẫu và xác nhận những view động.

## 7. Kế hoạch file và ranh giới kỹ thuật

### Tài liệu theo dõi

- `docs/ui-redesign-plan.md` — đề xuất và tiêu chí duyệt.
- `docs/ui-redesign-inventory.md` — danh mục màn hình, tab và overlay.
- `docs/ui-redesign-pilot-review.md` — bộ ảnh duyệt, bằng chứng chạy mới và mục còn mở.
- `.hallmark/preflight.json` — khảo sát nền tảng thiết kế và tóm tắt kiểm tra có giới hạn; báo cáo thô được lưu cùng bộ ảnh pilot.

Đã cập nhật `design.md`, foundation và template/style sáu pilot theo hướng được chấp thuận. Không xóa file. Router, backend và các thay đổi build macOS có sẵn giữ ngoài phạm vi refactor này.

### Nhóm file triển khai theo batch

| Nhóm | File/đường dẫn dự kiến |
| --- | --- |
| Nguồn thiết kế | `design.md`; danh mục kế hoạch này; `.hallmark/inventory.json`, `.hallmark/log.json`, `.hallmark/acceptance.json` sau khi có bằng chứng mới |
| Token và cầu nối style | `src/render/style/tokens.css`, `src/render/style/workbench.scss`, `src/render/style/index.scss`, `tailwind.config.ts`; `src/render/main.ts` nếu cần thay thứ tự import |
| Shell | `src/render/App.vue`, `src/render/components/Main.vue`, `src/render/components/Native/TitleBar.vue`, `src/render/components/Aside/Index.vue` |
| Component dùng chung | Các file đang dùng trong `AppShell/`, `ServiceManager/`, `VersionManager/`, `LanguageProjects/`, `YbBaseDialog/`, `XTermExecDialog/`, editor/log và notice |
| Trang và luồng sâu | Entry và component có đường dẫn sử dụng được liệt kê trong [inventory](ui-redesign-inventory.md); chỉnh template/style tại chỗ |
| Cửa sổ phụ | `src/render/tray/`, `src/render/capturer/`: chỉnh các file Vue/style đang dùng |
| Bằng chứng/fixture | `scripts/hallmark/preview.ts`, `scripts/hallmark/audit.cjs`, `docs/hallmark-state-matrix.md`, `docs/hallmark-migration.md` nếu cần cho phạm vi hiện tại |

Khi triển khai từng batch, chốt danh sách file cụ thể trước khi sửa. Có thể bổ sung primitive/layout dưới `components/AppShell/` khi chứng minh được dùng chung; không xóa cây component hoặc đổi route. Giữ entry stylesheet/Tailwind directives/import và các token bridge đang cần; không ghi đè cả global stylesheet bằng một bản CSS thay thế.

Vue/Element Plus/Tailwind/Monaco/xterm được giữ. Không thêm thư viện UI hoặc font tải từ mạng. Trang web bên ngoài được mở trong webview chỉ thay khung điều hướng/trạng thái do QTEnvDev sở hữu; nội dung website không thuộc khả năng theme của ứng dụng. Dialog cấp hệ điều hành như UAC, quyền macOS hoặc file picker giữ giao diện OS.

### Contract operation cho việc refactor

Chưa có ủy quyền ngoại lệ về module/state. Không thêm module, Pinia store hoặc dữ liệu mới vào `config.setup` trong đề xuất này. Nếu quá trình làm gặp operation thiếu owner, lập contract riêng và báo thay đổi phạm vi trước khi sửa kiến trúc.

| Họ operation hiện có | Owner/lifetime phải giữ | Sự kiện trung gian và kết thúc | Gọi lặp, tương tác service, kiểm tra |
| --- | --- | --- | --- |
| Start/stop/restart service hoặc project | Lifecycle `ModuleInstalledItem` + đăng ký module; fork giữ PID/port/companion; page chỉ bind | Giữ progress và terminal event của owner hiện có; `code: 200` dạng progress không tự coi là xong | Giữ guard hiện có; không tạo IPC workflow trong page; kiểm tra nhấn lặp, rời/quay lại, lỗi/retry và companion shutdown |
| Download/install/upgrade phiên bản/extension | Controller/store operation đã có, sống theo operation | Progress/source/result theo request; UI chỉ kết thúc ở terminal event của contract đang có | Không phát lại khi mount; không tự cài helper hoặc retry; kiểm tra kết quả riêng từng item và cleanup listener |
| Config/file write, DB/user/resource create/delete | Owner nghiệp vụ hiện tại; input/selection ở component | Validation trước gửi; save/create/delete result giữ đúng thành công/thất bại | Không đổi thứ tự side effect/xác nhận; không cho submit kép; lỗi bước phụ không phủ kết quả chính |
| Terminal, panel/webview, WebSocket/SSE, log subscription | Controller/manager hiện có theo lifetime thực tế | Open/connect/progress/stream khác close/disconnect/error/terminal result | Giữ chính sách close/cancel và cleanup; không đóng operation chỉ vì thay tab; kiểm tra mở lại trang không nhân listener/process |
| Batch nhóm dịch vụ, nén ảnh và các job nhiều item | Runner/controller hiện có; giữ chính sách điều phối | Từng item có trạng thái; batch tổng hợp không làm mất item đã xong | Giữ thứ tự/concurrency đang có; kiểm tra một item lỗi, item khác xong và trạng thái unknown |

Contract chi tiết từng IPC/event name lấy từ owner thật khi vào batch; không bịa protocol trong plan. Phần state hiển thị mới (input, filter, drawer, selection) thuộc Vue component đang mount; state domain tiếp tục ở owner đã có. Nếu cần đổi entry/controller operation thì chạy và cập nhật `test:renderer-operation-boundaries` đúng phạm vi.

### Failure boundaries của lộ trình

- Foundation/token là dependency cần thiết cho batch giao diện; chưa đạt thì chưa lan rộng template đó.
- Các route/batch độc lập giữ kết quả đã hoàn tất; một module không đạt không làm khôi phục hay phát lại operation ở module khác.
- Chụp ảnh, ghi báo cáo và fixture là bằng chứng bổ sung, không được tự kích hoạt install/start/stop/save thật để lấy trạng thái.
- Trong UI nhiều bước, lỗi ghi file hoặc dừng service thật vẫn là lỗi cần báo; lỗi log/refresh phụ không đổi kết quả chính đã hoàn thành. Không thêm retry, truy vấn PID hoặc privilege prompt vì refactor hình thức.

Áp dụng [module boundaries](../.codex/skills/qtenvdev-module-boundaries/SKILL.md) và [failure boundaries](skills/qtenvdev-failure-boundaries/SKILL.md) trong review từng batch.

### Pilot đã triển khai — form StartupGroup

- **File đã chỉnh:** `src/render/components/StartupGroup/GroupEditor.vue`; `src/render/components/StartupGroup/GroupCard.vue` (tooltip đã xác nhận chặn Enter); `src/lang/en/common.json`, `src/lang/vi/common.json`; `scripts/hallmark/preview.ts`; `scripts/hallmark/startup-group-editor.cjs` (mới); bằng chứng và báo cáo pilot. Không xóa file.
- **Phạm vi:** dialog ba bước theo token hiện có, lỗi tên liên kết trường, chọn thành viên bằng Enter/Space, nút đổi thứ tự ngoài thao tác kéo hiện có, form/footer dùng được ở 800×600 và tiếng Việt.
- **Owner/lifetime:** draft/selection/step thuộc component đang mount; candidate policy thuộc `StartupGroupCandidate`, nguồn candidate thuộc runtime; lưu thuộc `StartupGroupStore` qua Storage async hiện có. Không thêm IPC, Pinia/config state, lifecycle hoặc ngoại lệ module.
- **Contract:** mở → đọc candidate (loading → danh sách/rỗng hoặc lỗi hiện có) → chọn → sắp thứ tự → lưu (saving → store resolve/reject). Giữ chính sách chọn một/nhiều phiên bản, lọc item không hợp lệ, thứ tự điều phối và đóng/lưu. Nút đổi thứ tự chỉ sửa draft, không khởi động dịch vụ.
- **Failure boundaries:** đọc candidate và lưu là dependency của chính thao tác đó; giữ lỗi thật từ owner, không thêm retry/replay. Mỗi lần chạy dùng userData tạm, mỗi case fixture có partition bộ nhớ riêng; lỗi một case được ghi và tiếp tục case khác. Ảnh/báo cáo là bổ sung, không thay dữ liệu ứng dụng thật. Save chỉ ghi IndexedDB fixture; không helper/filesystem thật.
- **Kết quả:** Add/Edit/Delete qua launcher thực; ba bước, validation, single/multiple selection, 4 cảnh báo fixture, đổi thứ tự bằng nút, Save, Edit/Escape/trả focus, checkbox mặc định bằng Space và hủy xác nhận Delete. Desktop **8/8** và compact **16/16** pass: light/dark × en/vi × 1200×800/800×600 và 320/375/414/768×600; footer nằm trong viewport, không ghi nhận lỗi renderer/console hoặc tràn ngang đang đo. Focus trap được thử qua 24 lần Tab mỗi case; control được focus bằng API trước kích hoạt, chưa chứng minh toàn bộ Tab order. `yarn typecheck`, `yarn test:startup-group-runner`, `yarn test:renderer-operation-boundaries` và lint riêng đều pass.
- **Lịch sử và phần còn mở:** báo cáo trước sửa giữ Enter Edit chỉ mở tooltip; hai lần thử ma trận bị storage fixture dùng chung và lỗi đóng cửa sổ cuối đã sửa trong harness, không coi là regression ứng dụng. Các báo cáo cuối dùng partition riêng. Hủy draft đã sửa và lỗi đọc candidate/lưu được kiểm tra riêng bên dưới; kéo thả, mọi trạng thái control và operation native còn mở. Chi tiết và ảnh tại [báo cáo pilot](ui-redesign-pilot-review.md).

### Kiểm tra bổ sung — hủy bản nháp StartupGroup

- **File:** `scripts/hallmark/startup-group-editor.cjs`, `scripts/hallmark/preview.ts`; báo cáo và tài liệu pilot. Không cần sửa production cho kiểm tra này.
- **Owner/contract:** tên/mô tả/policy/selection/order vẫn thuộc draft của `GroupEditor`; `StartupGroupStore` và Storage async giữ domain/persistence. Hủy, Escape hoặc nút đóng phải bỏ bản nháp ở cả ba bước, không đổi config trong bộ nhớ hoặc dữ liệu lưu. Mở lại phải khôi phục dữ liệu gốc và nhận focus trong dialog; đóng trả focus về launcher. Không thêm state/module/IPC hoặc ngoại lệ kiến trúc.
- **Kiểm tra:** bật tùy chọn fixture `HALLMARK_DISCARD=1`; đổi tên, mô tả, policy; ở bước chọn bỏ một thành viên, ở bước thứ tự đổi chỗ và xóa một thành viên. Chạy cả ba cách đóng ở mỗi bước; đọc Storage async trước/sau thay vì chỉ nhìn DOM. Mỗi case theme/locale/viewport độc lập. Candidate loading là dependency trước tương tác, lỗi assertion chỉ làm case đó thất bại; ảnh/report là bổ sung. Không dùng storage thật hoặc operation native.
- **Kết quả:** [desktop](ui-redesign/pilots/reports/pilot-startup-editor-discard-desktop.json) **8/8** và [compact](ui-redesign/pilots/reports/pilot-startup-editor-discard-compact.json) **16/16**, cùng hai theme/en/vi và sáu kích thước của ma trận form. Tổng **216/216** tổ hợp ba bước × ba cách đóng × 24 case giữ nguyên toàn bộ config trong bộ nhớ và Storage async, trả focus về Edit. Mở lại khôi phục tên/mô tả/policy, đủ bốn thành viên và thứ tự đã lưu. Không có root Vue/window error, renderer console error hoặc lỗi harness; smoke VI light 800×600 cũng pass. `yarn typecheck`, ESLint riêng harness/preview, Prettier và `git diff --check` pass. Control được API focus trước native input; kéo thả, lỗi candidate/save và toàn bộ Tab order vẫn ngoài phép kiểm tra này. Không thêm ảnh vào gallery vì không đổi hình thức.

### Kiểm tra bổ sung — lỗi tải và lưu form StartupGroup

- **File đã chỉnh:** `src/render/components/StartupGroup/GroupEditor.vue`, `src/lang/en/common.json`, `src/lang/vi/common.json`, `scripts/hallmark/preview.ts`, `scripts/hallmark/startup-group-editor.cjs`; tài liệu và bằng chứng pilot. Không xóa file, không đổi runtime/store/IPC hoặc chính sách candidate.
- **Owner/lifetime:** input, lỗi hiển thị và loading của dialog thuộc `GroupEditor`; đọc candidate vẫn qua runtime hiện có, domain/persistence vẫn qua `StartupGroupStore` và Storage async. Đây là form đọc/lưu cục bộ, không process/progress dài; không thêm controller, Pinia, shared config hoặc ngoại lệ kiến trúc.
- **Contract:** mở → tải candidate → loaded/empty/error; khi pending/error chưa cho sang bước phụ thuộc. Retry chỉ từ nút người dùng, giữ draft; kết quả load của lượt mở cũ không ghi đè lượt mới. Save chụp draft, chặn gọi kép/đổi bước/đóng trong lúc chờ → resolve mới đóng và phát `saved`, reject giữ draft và hiện lỗi; người dùng có thể sửa, hủy hoặc gửi lại. Unmount/đóng không tạo replay hoặc listener mới.
- **Failure boundaries:** candidate load là dependency trước chọn/lưu, lỗi không bị trình bày như danh sách rỗng và không lọc mất thành viên khi chưa có kết quả đáng tin cậy. Persistence là dependency của save; rejection trước write không đổi live/persisted config. Refresh sau `saved` không nằm trong catch persistence và không biến một save đã xong thành lỗi lưu. Ảnh/report là bổ sung; fixture dùng storage/partition riêng, không service/helper/privilege thật.
- **Kiểm chứng:** fault injection tại dependency candidate/storage của fixture; giữ [baseline](ui-redesign/pilots/reports/pilot-startup-editor-failures-baseline.json) và [chi tiết baseline](ui-redesign/pilots/reports/pilot-startup-editor-failures-baseline-detail.json): thiếu status/alert, Next vẫn bật khi pending và candidate rejection chưa được nhận. Sau sửa kiểm load pending/reject/retry, stale rejection sau đóng/mở, save add/update pending/reject/resubmit, giữ tên/mô tả/policy/membership/order, config live/persisted, không submit kép/tự retry/unhandled rejection.
- **Kết quả:** [desktop](ui-redesign/pilots/reports/pilot-startup-editor-failures-desktop-final.json) **8/8** và [compact](ui-redesign/pilots/reports/pilot-startup-editor-failures-compact-final.json) **16/16**; light/dark × en/vi và sáu kích thước của form. Cả ba đường lỗi được kiểm trong mỗi case; không quy đổi thành số màn hình. Không có root Vue/window error, renderer console error hoặc lỗi harness; layout/footer và focus lỗi lưu đạt các assertion đã đo. Ảnh chờ animation hữu hạn kết thúc trước khi chụp. `yarn typecheck`, test StartupGroup runner/renderer operation boundaries, scoped ESLint, Prettier, kiểm tra cú pháp harness và `git diff --check` pass. Gallery thêm tám PNG và bốn file JSON. Kết quả chỉ bao phủ rejection trước write và retry có chủ ý; chưa nghiệm thu lỗi native, mọi loại persistence failure, kéo thả hoặc toàn bộ Tab order.

## 8. Tiêu chí nghiệm thu

| Phần | Điều kiện |
| --- | --- |
| Bao phủ | Cả 103 ID màn hình có trạng thái review; 222 view slots và các luồng sâu có người kiểm tra; 99 overlay placements được rà, dialog động có kiểm tra mở thực tế |
| Đồng bộ | Theme, font, spacing, control, icon stroke và vị trí action theo `design.md`; không còn màu thương hiệu gán riêng trong component đã refactor |
| Kích thước desktop | Kiểm tra 800×600, 1024×768, 1200×800, 1440×900 và 1920px; không tràn root/cắt footer; bảng/code chỉ cuộn trong vùng của chúng |
| Responsive fixture | Primitive/layout cô lập kiểm tra 320/375/414/768px theo Hallmark; compact mode xếp panel, không coi đây là cam kết một sản phẩm mobile mới |
| Sáng/tối | Kiểm tra cả hai theme, tooltip/popover/dialog/Monaco/xterm/tray; chữ thường ≥ 4.5:1, icon/focus ≥ 3:1 theo WCAG; đo cặp màu thực tế |
| Tương tác | Bàn phím, focus-visible, focus restore, accessible name, menu và action; target 44px cho vùng chạm; reduced motion; không layout shift khi focus/loading |
| Trạng thái | Có dữ liệu, rỗng, tải, lỗi, disabled, progress, thành công, partial/unknown khi backend có; dữ liệu dài, nhiều hàng và nhãn ngôn ngữ dài |
| Nền tảng | macOS thực trên máy này; Windows/Linux có fixture đúng cờ nền tảng; nghiệm thu hành vi native/installer trên máy đích hoặc CI tương ứng, ghi rõ mục chưa chạy |
| Regression | Chạy `yarn typecheck`, lint cho file thay đổi, các test hiện có phù hợp batch và `test:renderer-operation-boundaries` khi chạm entry/controller; smoke các thao tác thật trên môi trường kiểm thử riêng |
| An toàn fixture | Stub IPC/side effect; không sửa hosts, start service, cài package, gửi request ngoài hoặc chạy lệnh quản trị khi render ảnh |
| Bằng chứng | Ảnh/báo cáo gắn với batch hiện tại; kết quả pass/fail/chưa chạy ghi đúng; không dùng báo cáo 73 route cũ làm kết quả lần này |

Pilot có kiểm tra renderer riêng và checks mã nguồn, xem [báo cáo](ui-redesign-pilot-review.md). Chưa chạy production build hoặc nghiệm thu native. Bảng kế hoạch không thay thế bằng chứng kiểm tra từng batch; không tuyên bố toàn bộ103 màn hình đã đạt Hallmark.

## 9. Mốc duyệt mẫu

1. Đã chấp thuận hướng **graphite + teal/cyan, technical workbench**, có light mode tương ứng.
2. Đã chấp thuận phạm vi **103 màn hình chính + toàn bộ view/dialog/drawer/trạng thái trong inventory**.
3. Bước hiện tại: đánh giá **6 mẫu đại diện** trước khi rollout theo batch.

Hướng refactor đã được chấp thuận theo yêu cầu “tiến hành refactor giao diện như plan”. Hallmark multi-page tại [`verbs/redesign.md`](/Users/phamtuyen/.agents/skills/hallmark/references/verbs/redesign.md): “Wait for confirmation. Only after the user confirms (or says ‘go ahead’) do you write `design.md` and start redesigning pages.” `design.md` đã được khóa theo hướng này và sáu workspace mẫu đã triển khai để duyệt hình thức. Chưa triển khai đại trà. Xem [báo cáo pilot](ui-redesign-pilot-review.md) để biết bộ 58 ảnh, 25 file báo cáo JSON và phần chưa nghiệm thu.

## 10. Tiến độ hiện tại

- Hướng và phạm vi: đã chấp thuận.
- Foundation và sáu mẫu: đã triển khai để duyệt hình thức; đã sửa vòng đời Monaco và toolbar JSON bị cắt ở 1024px; đã đo bổ sung đúng 1024×768/1440×900, còn tương tác sâu, mọi view/overlay và nghiệm thu native.
- Bằng chứng pilot: 58 ảnh và 25 file báo cáo JSON, gồm lịch sử thất bại và kết quả sau sửa. Vòng đời editor 8/8 pass; năm luồng nút mở/đóng thực tế 40/40 pass; kiểm tra Search PHP bổ sung 8/8 pass; form StartupGroup 24/24 ca cuối pass ở hai theme, en/vi và sáu kích thước. Hai ma trận bổ sung đạt 216/216 lần hủy draft đã sửa qua 24 case, không đổi domain/persistence fixture. Lượt fault injection tải candidate và lưu Add/Edit riêng đạt 24/24 case, giữ draft và kiểm retry/chặn gửi trùng. Lần chạy đầy đủ sau sửa editor, lần Tools responsive cuối và hai kích thước desktop chính xác không ghi nhận lỗi đang đo. Typecheck, test StartupGroup runner và renderer operation boundaries pass. ESLint riêng form/harness mới có 0 lỗi/cảnh báo; lần toàn phạm vi pilot trước đó có 0 lỗi, 5 cảnh báo có sẵn; giới hạn chi tiết ở báo cáo pilot.
- Rollout toàn bộ 103 màn hình: chưa bắt đầu; chờ đánh giá mẫu theo mốc này. Sáu workspace tương ứng bảy ID inventory vì Tools gồm thư viện R58 và JSON T18; không dùng số mẫu làm tỷ lệ hoàn thành.
- Các nhận xét khảo sát phía trên là baseline source; kết quả chạy mới được ghi riêng trong báo cáo pilot.

### Kiểm tra bổ sung — vòng đời editor trong pilot

Phạm vi trước rollout: `src/render/util/Editor.ts`, `patches/monaco-editor+0.55.1.patch`, `scripts/hallmark/editor-lifecycle.cjs` và các tài liệu/bằng chứng pilot. Không xóa file hoặc thêm workflow nghiệp vụ.

- **Owner/lifetime:** component đang mount sở hữu editor; editor sở hữu model tự tạo từ `value`. Model được truyền vào thuộc caller, không được giải phóng cùng editor mượn nó. Cache DOM chỉ tồn tại đến khi editor bị dispose; gọi destroy lặp hoặc không có instance không tác động editor khác.
- **Sự kiện:** create/reuse → focus/cursor/highlight → dispose. Highlight bị hủy khi dispose là kết thúc bình thường của công việc phụ; lỗi thật vẫn đi qua error handler của Monaco. Không lọc lỗi ở `window`, không đổi renderer IPC, Pinia, process hoặc service.
- **Phân loại:** giải phóng đúng editor/model là yêu cầu bắt buộc; highlight là tác vụ phụ. Hủy highlight không được tạo unhandled rejection hoặc xóa model của editor đang hoạt động. Không thêm chờ/retry để che race.
- **Kiểm tra:** hai editor đồng thời, destroy một editor vẫn sửa được editor còn lại; destroy không có instance; destroy lặp; tạo lại trên cùng DOM; model mượn; focus/đổi cursor rồi đóng ngay; lặp Settings/UI → Hosts. Bằng chứng trước/sau lưu riêng, báo cáo lỗi cũ giữ nguyên.
- **Kết quả:** 8/8 pass trong `pilot-editor-final-verified`; bài chèn lỗi thật vẫn nhận được lỗi gốc. `pilot-post-editor` kiểm tra lại sáu workspace ở 1200/800px, không ghi nhận lỗi renderer hoặc vấn đề hình học đã đo. Patch Monaco được reverse/apply bằng `patch-package`; cần rà lại khi nâng phiên bản.
- **Layout bổ sung:** `src/render/style/workbench.scss` cho toolbar JSON xuống hàng khi thiếu chỗ. `pilot-desktop-wide` giữ bốn bản ghi nút Save bị cắt ở 1024px trước sửa; `pilot-tools-responsive-final` kiểm tra lại chín chiều rộng từ 320 đến 1920px và không ghi nhận lỗi. Chiều cao thực tế của fixture là 600px ở rộng ≤800px, 800px ở các chiều rộng lớn hơn; không tự đánh dấu đạt toàn bộ ma trận chiều cao desktop.
- **Kích thước desktop chính xác:** `scripts/hallmark/audit.cjs` nhận thêm `HALLMARK_SIZES`, đợi cả `innerWidth` và `innerHeight`, ghi chiều cao trong từng phép đo và kích thước trong tên ảnh. Không truyền cờ này thì giữ chiều cao/tên ảnh cũ. Lần `pilot-desktop-exact` ở 1024×768/1440×900 có 24 route, 32 tab, 40 scenario và 20 overlay, exit 0; 20/20 focus trap/Escape và 74/74 cặp token đạt. Đây là kiểm tra các view mẫu, không thay nghiệm thu focus restore qua nút mở thực tế, mọi trạng thái cuộn hoặc main/fork/helper.

### Kiểm tra bổ sung — nút mở và focus overlay

- **Phạm vi:** `src/render/components/PHP/Extends.vue`, `scripts/hallmark/pilot-interactions.cjs` và tài liệu/bằng chứng pilot. Tooltip bao nút `php.ini` đang chặn Enter; sửa tại tooltip đó để nút giữ hành vi bàn phím chuẩn. Không thêm cơ chế focus toàn cục.
- **Owner/lifetime:** focus và tooltip thuộc component đang mount; drawer tiếp tục dùng `AsyncComponentShow`/Element Plus. Không đổi IPC, nghiệp vụ đọc/lưu cấu hình, service, process, Pinia hoặc persistence; không có ngoại lệ module/state.
- **Contract:** focus nút → Enter/click → drawer nhận focus → Escape/nút đóng → focus về nút mở đang hiển thị (hoặc trigger menu khi item menu đã ẩn). Đóng config con phải giữ Extensions cha. Không thay re-entry hoặc chính sách đóng hiện có.
- **Failure boundaries:** từng case/theme/kích thước độc lập và reload fixture; lỗi một case được giữ trong báo cáo rồi tiếp tục case còn lại. Không replay tác vụ thật. Root Vue/window errors và console error của renderer đều được thu nhận, gồm overlay mount bằng Vue app riêng.
- **Kiểm tra:** Hosts Add/Edit qua menu, Podman Add machine/container và PHP Extensions → php.ini; Enter/Escape và click/nút đóng; light/dark; 1200×800 và 800×600. `pilot-interactions-final`: 40/40 pass, không có root Vue/window error hoặc console error. Parent Extensions vẫn do fixture mở trực tiếp, chưa kiểm service menu → Extensions; nút được focus bằng API trước input, không chứng minh toàn bộ Tab order hoặc Space.
- **Trước/sau:** `pilot-interactions-php-before` giữ Enter bị chặn (`defaultPrevented: true`), click đạt; bản cuối Enter không bị chặn và config mở. Đã xem ảnh mở/đóng 1200×800 dark và 800×600 light. Ảnh phát hiện Search của bảng Extensions bị cắt chiều dọc; lỗi đã được đo và sửa riêng bên dưới, không suy ra kết quả layout từ focus pass.
- **Source:** chạy lại typecheck và renderer operation boundaries đạt; Prettier/ESLint cho script và `PHP/Extends.vue` đạt, không có cảnh báo tại hai file này.
- **Layout đã sửa:** `src/render/style/workbench.scss` chỉ áp dụng cho Search của bảng trong `.app-workbench-drawer .php-extensions .el-table .name-cell`. Trước sửa: input 26px chứa wrapper 44px trong cell 31.6px; cả hai kiểm tra containment thất bại. Sau sửa: input/wrapper/cell đều 44px theo `--size-control`, không dùng `!important` hoặc đổi input legacy toàn cục. Harness đo trước khi mở config, mỗi case độc lập. [Báo cáo trước sửa](ui-redesign/pilots/reports/pilot-php-search-before.json): 0/2; [báo cáo cuối](ui-redesign/pilots/reports/pilot-php-search-final.json): **8/8** theo hai theme, hai kích thước và hai cách đóng; focus và parent overlay vẫn đúng, không có lỗi renderer/console. Lần selector đầu chưa đủ specificity được giữ trong `tmp/hallmark/audit/pilot-php-search-after`, không tính là pass. Đã xem ảnh cuối 800×600 light và 1200×800 dark.
