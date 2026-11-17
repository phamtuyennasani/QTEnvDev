<!-- Hallmark · pre-emit critique: P5 H4 E4 S5 R5 V4 · design system specification; implementation acceptance is tracked separately -->

# QTEnvDev design system

Hệ thống thiết kế thống nhất cho QTEnvDev. Hướng refactor đã được chấp thuận; foundation và sáu workspace mẫu đã triển khai để duyệt hình thức trước khi triển khai đại trà. Xem [bộ ảnh và báo cáo pilot](docs/ui-redesign-pilot-review.md). Đây là quy chuẩn cần đạt, chưa phải nghiệm thu kỹ thuật toàn bộ.

## Phạm vi và nguồn chuẩn

**103 màn hình chính = 63 route + 38 công cụ + 2 cửa sổ phụ.** Bao phủ 222 view/template cấp trang và 99 vị trí overlay trong 89 file có đường dẫn sử dụng. Không cộng tab/dialog thêm vào 103. Danh sách và cách đếm nằm trong [inventory](docs/ui-redesign-inventory.md); trạng thái triển khai ở [plan](docs/ui-redesign-plan.md).

Không đưa các tính năng AI/plugin đã gỡ trở lại. n8n và CliProxyAPI hiện còn đăng ký nên thuộc phạm vi. Nội dung website bên ngoài, file picker, UAC và dialog macOS thuộc giao diện nền tảng; QTEnvDev chỉ theme phần khung do ứng dụng sở hữu.

Nguồn token thực thi: [tokens.css](src/render/style/tokens.css). Bridge Element Plus, alias legacy và font cục bộ nằm cùng file. [Tailwind 3](tailwind.config.ts) ánh xạ các role semantic; không thêm thư viện UI hoặc font từ mạng.

## Genre, cấu trúc và nhận diện

**Modern-minimal technical workbench.** Dành cho lập trình viên quản lý môi trường, cấu hình và dịch vụ: chính xác, rõ trạng thái, ưu tiên nội dung. Dùng graphite/navy và teal của QTEnvDev; không dùng glow, gradient, kính mờ hoặc số liệu trang trí.

App pages dùng họ **Workbench**, sidebar **N3 side rail**, không có footer marketing. Status/footer chỉ xuất hiện khi tác vụ đang có thông tin cần hiển thị. Không xoay theme theo từng trang; sự khác biệt đến từ cấu trúc công việc.

| Họ layout | Cấu trúc | Áp dụng |
| --- | --- | --- |
| Service | Header + trạng thái, tab công việc, danh sách cài đặt, action chính rõ | Server, database, runtime; Startup groups dùng nhóm phẳng và hàng thành viên |
| Project | Toolbar, bảng path/runtime/port/status, drawer chỉnh theo nhóm trường | LanguageProjects, PHP/Node/Python/Go, Flutter, Hosts |
| Catalogue | Nguồn phiên bản, tìm/lọc, bảng version, tiến độ theo item | Static, local, Homebrew, MacPorts, SDKMAN |
| Editor/log | Toolbar gọn, editor/log chiếm diện tích chính, save/refresh theo ngữ cảnh | Config, hosts, vhost, terminal, log |
| Infrastructure | Điều hướng resource, danh sách/detail, form theo nhóm | Podman, DB management, tunnel, n8n users |
| Focused tool | Input/output, cấu hình cần thiết, copy/download kết quả rõ | Thư viện Tools và 38 công cụ |
| Settings | Điều hướng nhóm + detail, label/helper rõ, khu vực nguy hiểm riêng | Common, Modules, UI và onboarding hiện có |

Chia batch độc lập: 37 dịch vụ, 18 ngôn ngữ/dự án, 7 workspace/hệ thống, 41 Tools/cửa sổ. Sáu pilot là StartupGroup, PHP, Hosts, Podman, Tools/JSON và Settings; là một phần của 103.

## Theme và token màu

Mọi màu mới trong component phải tham chiếu role semantic. Accent dành cho primary action/lựa chọn; success, warning, danger có chữ hoặc biểu tượng đi kèm. Divider nhẹ phục vụ phân nhóm; focus/control boundary cần role mạnh đủ rõ. Không dùng border divider yếu để thay indicator trạng thái.

| Role `--color-*` | Light                         | Dark                          |
| ---------------- | ----------------------------- | ----------------------------- |
| `canvas`         | `oklch(97.14% 0.0042 236.5)`  | `oklch(17.5% 0.0174 252.64)`  |
| `surface`        | `oklch(100% 0 89.88)`         | `oklch(22.18% 0.0245 248.98)` |
| `surface-muted`  | `oklch(95.17% 0.0084 236.56)` | `oklch(20.12% 0.0218 251.84)` |
| `surface-hover`  | `oklch(93.37% 0.012 223.53)`  | `oklch(28.25% 0.0307 247.1)`  |
| `ink`            | `oklch(25.79% 0.0358 247.82)` | `oklch(95.38% 0.0118 239.91)` |
| `ink-muted`      | `oklch(49.42% 0.039 247.29)`  | `oklch(77.07% 0.0304 245.01)` |
| `ink-faint`      | `oklch(51.5% 0.0379 244.46)`  | `oklch(69.88% 0.0385 245.82)` |
| `rule`           | `oklch(89.2% 0.0145 238.03)`  | `oklch(34.49% 0.0337 247.19)` |
| `rule-strong`    | `oklch(59% 0.0315 237.15)`    | `oklch(57.81% 0.0416 243.7)`  |
| `accent`         | `oklch(50% 0.086 185.89)`     | `oklch(83.38% 0.1313 183.96)` |
| `accent-hover`   | `oklch(46.29% 0.0798 185.46)` | `oklch(87.66% 0.109 184.49)`  |
| `accent-ink`     | `oklch(100% 0 89.88)`         | `oklch(22.44% 0.0292 187.67)` |
| `accent-soft`    | `oklch(94.9% 0.0207 181.87)`  | `oklch(30.55% 0.0418 185.35)` |
| `focus`          | `oklch(46.38% 0.1899 265.33)` | `oklch(87.73% 0.0608 256.1)`  |
| `success`        | `oklch(50% 0.108 158.44)`     | `oklch(81.24% 0.1022 157.6)`  |
| `warning`        | `oklch(50.18% 0.1084 70.54)`  | `oklch(83.44% 0.1017 80.73)`  |
| `danger`         | `oklch(50.46% 0.179 18.67)`   | `oklch(76.13% 0.1187 14.36)`  |

## Typography

- Heading: `--font-display` = Space Grotesk, 600, roman; fallback Segoe UI Variable/sans-serif. Tracking tự nhiên, không chữ nghiêng hoặc all caps dài.
- Nội dung/control: `--font-body` = Geist, 400–500; giữ lựa chọn font người dùng qua `--app-font`.
- Path, version, port, code/log: `--font-mono` = JetBrains Mono, tabular figures. Không dùng mono cho cả đoạn hướng dẫn dài.
- Thang chữ: xs 12, sm 13, md 14, lg 16, xl 20, 2xl 24 CSS px. Tiêu đề desktop 20–24px; công cụ quản lý không dùng hero khổng lồ.
- Tiêu đề có `min-width: 0` và wrap dài; action một dòng. Tên/path bị ellipsis cần title hoặc cách xem đầy đủ.

## Spacing, kích thước và bề mặt

Spacing 4 điểm: 4/8/12/16/24/32/48/72px, tương ứng `--space-3xs` đến `--space-2xl`. Component mới dùng token thay raw value khi role đã có.

Control và hàng dữ liệu tối thiểu 44px; icon action có vùng tương tác 44px khi có thể, không chỉ SVG nhỏ. Sidebar 224px hoặc 56px thu gọn. Titlebar native giữ nguyên chính sách nền tảng. Radius control 8px, panel 10px, drawer/dialog14px. Panel phẳng; chỉ overlay có shadow phục vụ phân lớp. Không card lồng card nếu không có nhóm nội dung riêng.

## Interaction và các trạng thái

- Primary: nền accent, chữ accent-ink, động từ cụ thể. Secondary: bề mặt/viền nhẹ. Destructive dùng danger và giữ xác nhận hiện có.
- Default/hover/focus-visible/active/disabled/loading/error/success phải thể hiện khi có nghĩa. Disabled không dựa duy nhất vào đổi hue. Loading không làm đổi kích thước control.
- Trang/list cần loaded, empty, no results, fetching, fetch error và operation in progress; phân biệt unknown với stopped. Không tạo phần trăm hoặc success giả.
- Input có label hiển thị; lỗi liên kết trường bằng ARIA. Icon action có tên truy cập và tooltip. Không lồng button trong button; menu chính truy cập bằng bàn phím/click.
- Dialog/drawer giữ Element Plus/AsyncComponent: kiểm tra focus trap, Escape theo chính sách hiện tại, restore focus, nội dung cuộn và footer luôn tới được. Không tự đóng terminal đang làm việc.
- Success nhẹ, lỗi có ngữ cảnh; không phát lại toast khi mount. Batch giữ kết quả từng item và trạng thái partial/unknown từ owner thật.
- Hover tooltip trì hoãn 600–800ms; focus hiện tức thì. Motion màu/opacity/transform120–180ms, easing `--ease-out`; không `transition: all`, không reveal khi mở trang.
- Reduced motion bỏ chuyển động không gian; opacity tối đa150ms. Focus outline không animate.

## Responsive và accessibility

Sản phẩm desktop: mặc định1200×800, tối thiểu800×600. Kiểm tra thêm1024×768,1440×900,1920px. Bảng/code được cuộn trong container riêng; root không tràn ngang, footer không bị cắt. Panel xếp dọc khi vùng nội dung thiếu chỗ; sidebar thu gọn ở cửa sổ hẹp.

Primitive/layout cô lập kiểm tra320/375/414/768px theo Hallmark. Đây là kiểm tra độ bền layout, không thay đổi giới hạn cửa sổ desktop. Grid dùng `minmax(0, 1fr)`, root `overflow-x: clip`, không che lỗi tràn bằng `hidden`. Chữ thường ≥4.5:1, focus/control indicator≥3:1; đo cặp màu thực tế. Không coi chưa kiểm tra là pass.

## Ownership và failure boundaries

Chỉ chỉnh visual/interaction trong ranh giới hiện có. Giữ route, copy intent, logic, IPC, confirmation và lifecycle. Không thêm Pinia/shared config/module state. Input/selection/dialog thuộc component; domain/operation vẫn thuộc store/controller hiện có; fork giữ nguồn sự thật về PID/port/liveness.

Service/project gọi lifecycle hiện có; download/install giữ owner/progress/terminal event/re-entry guard/cleanup. Không coi progress là hoàn tất. Lỗi phụ không phủ kết quả chính; item lỗi không làm mất item đã xong. Không thêm retry, PID query hoặc privilege prompt vì refactor UI. Contract ở [plan](docs/ui-redesign-plan.md); tuân theo module/failure-boundaries của dự án.

## Trạng thái bàn giao

Foundation và sáu workspace mẫu đã có bản triển khai, 58 ảnh duyệt và 25 file báo cáo JSON tại [báo cáo pilot](docs/ui-redesign-pilot-review.md). Vòng đời Monaco, toolbar JSON ở 1024px, Enter mở php.ini và Search trong PHP Extensions đã được sửa, có bằng chứng trước/sau. Search đạt 8/8 ca bổ sung: input/wrapper/header cell cùng cao 44px, nhận/trả focus vẫn đúng. Đã bổ sung đúng 1024×768/1440×900 cho sáu mẫu và năm overlay đại diện; 40/40 lượt qua năm nút mở thực tế đã kiểm nhận/trả focus ở hai theme và 1200×800/800×600.

Form StartupGroup ba bước đã chỉnh: validation tên, chọn bằng bàn phím, cảnh báo, đổi thứ tự, nội dung cuộn và footer trong viewport. Hai ma trận form đạt 24/24 ca: light/dark × en/vi ở 1200×800, 800×600 và primitive 320/375/414/768×600. Hai ma trận bổ sung cũng đạt 24/24 ca, gồm 216 lần Cancel/Escape/nút đóng sau khi sửa draft ở cả ba bước: config trong bộ nhớ và Storage async không đổi, mở lại khôi phục dữ liệu/thứ tự gốc, đóng trả focus. Lượt fault injection riêng đạt 24/24 ca cho lỗi tải candidate, lỗi lưu Add và lỗi lưu Edit: giữ draft, thử lại theo yêu cầu, bỏ kết quả tải của lượt mở cũ, chặn gửi trùng/đóng khi đang lưu và focus lỗi lưu. Rejection trước write không đổi live/persisted config; gửi lại thành công mới đóng. Save chỉ ghi storage fixture; mỗi ca có partition bộ nhớ riêng. Chưa kiểm toàn bộ Tab order, kéo thả, mọi loại lỗi persistence/runtime hoặc thao tác dịch vụ thật. Mốc hiện tại là duyệt hình thức; mọi luồng tương tác, view/overlay và native chưa hoàn tất. Các trang ngoài mẫu chưa được nghiệm thu riêng.

Sau khi duyệt mẫu, mỗi batch tiếp tục có danh sách route/view/overlay, ảnh light/dark, kiểm tra kích thước/bàn phím và giới hạn chưa xác minh. Bằng chứng fixture dùng IPC stub, không chứng minh hành vi service/helper native. Không dùng báo cáo 73 route cũ để nghiệm thu 103 màn hình hiện tại.

## Exports

### tokens.css

Import nguồn đầy đủ, gồm hai theme, typography, spacing, motion và bridge; không chép bảng màu thứ hai vào component:

```css
@import './src/render/style/tokens.css';
```

### Tailwind v4 `@theme` — mapping di động

Ứng dụng vẫn dùng Tailwind3. Block dưới chỉ để mang hệ thống sang dự án v4. Đổi prefix token nguồn từ `--color-*` sang `--qte-*`, `--font-*` sang `--qte-font-*`, giữ override dark rồi dùng mapping này. `inline` tránh tham chiếu vòng hoặc khai báo font lần nữa.

```css
@theme inline {
  --color-canvas: var(--qte-canvas);
  --color-surface: var(--qte-surface);
  --color-surface-muted: var(--qte-surface-muted);
  --color-surface-hover: var(--qte-surface-hover);
  --color-ink: var(--qte-ink);
  --color-ink-muted: var(--qte-ink-muted);
  --color-ink-faint: var(--qte-ink-faint);
  --color-rule: var(--qte-rule);
  --color-rule-strong: var(--qte-rule-strong);
  --color-accent: var(--qte-accent);
  --color-accent-hover: var(--qte-accent-hover);
  --color-accent-ink: var(--qte-accent-ink);
  --color-accent-soft: var(--qte-accent-soft);
  --color-focus: var(--qte-focus);
  --color-success: var(--qte-success);
  --color-warning: var(--qte-warning);
  --color-danger: var(--qte-danger);
  --font-display: var(--qte-font-display);
  --font-body: var(--qte-font-body);
  --font-mono: var(--qte-font-mono);
  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --spacing-2xl: 4.5rem;
}
```

### DTCG `tokens.json` — light subset

JSON hợp lệ theo cấu trúc DTCG với OKLCH chuẩn hóa L0–1; dark lấy từ bảng role/source trên. Đây là export cho công cụ token, không phải dependency mới.

```json
{
  "$description": "Light theme subset. Full light/dark values: src/render/style/tokens.css.",
  "color": {
    "canvas": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.9714, 0.0042, 236.5],
        "alpha": 1
      }
    },
    "surface": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [1.0, 0.0, 89.88],
        "alpha": 1
      }
    },
    "surface-muted": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.9517, 0.0084, 236.56],
        "alpha": 1
      }
    },
    "surface-hover": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.9337000000000001, 0.012, 223.53],
        "alpha": 1
      }
    },
    "ink": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.2579, 0.0358, 247.82],
        "alpha": 1
      }
    },
    "ink-muted": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.49420000000000003, 0.039, 247.29],
        "alpha": 1
      }
    },
    "ink-faint": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.515, 0.0379, 244.46],
        "alpha": 1
      }
    },
    "rule": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.892, 0.0145, 238.03],
        "alpha": 1
      }
    },
    "rule-strong": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.59, 0.0315, 237.15],
        "alpha": 1
      }
    },
    "accent": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.5, 0.086, 185.89],
        "alpha": 1
      }
    },
    "accent-hover": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.4629, 0.0798, 185.46],
        "alpha": 1
      }
    },
    "accent-ink": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [1.0, 0.0, 89.88],
        "alpha": 1
      }
    },
    "accent-soft": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.9490000000000001, 0.0207, 181.87],
        "alpha": 1
      }
    },
    "focus": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.46380000000000005, 0.1899, 265.33],
        "alpha": 1
      }
    },
    "success": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.5, 0.108, 158.44],
        "alpha": 1
      }
    },
    "warning": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.5018, 0.1084, 70.54],
        "alpha": 1
      }
    },
    "danger": {
      "$type": "color",
      "$value": {
        "colorSpace": "oklch",
        "components": [0.5046, 0.179, 18.67],
        "alpha": 1
      }
    }
  },
  "font": {
    "display": {
      "$type": "fontFamily",
      "$value": ["Space Grotesk", "Segoe UI Variable", "sans-serif"]
    },
    "body": {
      "$type": "fontFamily",
      "$value": ["Geist", "Segoe UI Variable", "sans-serif"]
    },
    "mono": {
      "$type": "fontFamily",
      "$value": ["JetBrains Mono", "Cascadia Code", "monospace"]
    }
  },
  "space": {
    "3xs": {
      "$type": "dimension",
      "$value": {
        "value": 0.25,
        "unit": "rem"
      }
    },
    "2xs": {
      "$type": "dimension",
      "$value": {
        "value": 0.5,
        "unit": "rem"
      }
    },
    "xs": {
      "$type": "dimension",
      "$value": {
        "value": 0.75,
        "unit": "rem"
      }
    },
    "sm": {
      "$type": "dimension",
      "$value": {
        "value": 1.0,
        "unit": "rem"
      }
    },
    "md": {
      "$type": "dimension",
      "$value": {
        "value": 1.5,
        "unit": "rem"
      }
    },
    "lg": {
      "$type": "dimension",
      "$value": {
        "value": 2.0,
        "unit": "rem"
      }
    },
    "xl": {
      "$type": "dimension",
      "$value": {
        "value": 3.0,
        "unit": "rem"
      }
    },
    "2xl": {
      "$type": "dimension",
      "$value": {
        "value": 4.5,
        "unit": "rem"
      }
    }
  }
}
```

### shadcn/ui — mapping OKLCH hiện đại

Dùng giá trị màu đầy đủ `oklch()`, giữ tên nguồn `--color-*`; theme dark kế thừa từ cùng token source. Không dùng các bộ ba này như HSL.

```css
:root {
  --background: var(--color-canvas);
  --foreground: var(--color-ink);
  --card: var(--color-surface);
  --card-foreground: var(--color-ink);
  --popover: var(--color-surface);
  --popover-foreground: var(--color-ink);
  --primary: var(--color-accent);
  --primary-foreground: var(--color-accent-ink);
  --secondary: var(--color-surface-muted);
  --secondary-foreground: var(--color-ink);
  --muted: var(--color-surface-muted);
  --muted-foreground: var(--color-ink-muted);
  --accent: var(--color-accent-soft);
  --accent-foreground: var(--color-ink);
  --destructive: var(--color-danger);
  --border: var(--color-rule);
  --input: var(--color-rule-strong);
  --ring: var(--color-focus);
  --radius: var(--radius-md);
}
```
