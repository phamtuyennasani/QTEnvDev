<!-- Hallmark · pre-emit critique: P4 H4 E3 S5 R4 V4 · scope: source inventory and bounded pilot evidence; whole-app acceptance pending -->

# QTEnvDev — Danh mục giao diện cần refactor

Ngày khảo sát: 17/11/2026 · **phạm vi đã chấp thuận; sáu workspace mẫu sẵn sàng duyệt hình thức** · dùng cùng [kế hoạch thiết kế](ui-redesign-plan.md) và [báo cáo pilot](ui-redesign-pilot-review.md).

## 1. Quy tắc đếm và độ tin cậy

- **R01–R63: 63 trang route** = 61 module đăng ký + Settings + customer module. Route `/` chỉ là shell/redirect, không tính thêm một màn hình.
- **T01–T38: 38 màn hình công cụ** bên trong trang Tools. Danh mục Tools đã nằm trong R, từng công cụ có input/output và workflow riêng nên được tính riêng.
- **W01–W02: 2 cửa sổ phụ** = tray và lớp chụp/đánh dấu màn hình. Trang Capturer trong Tools là thiết lập/khởi chạy, khác với lớp chụp.
- **Tổng: 103 màn hình chính.** Các tab, form và overlay nằm trong những màn hình này được liệt kê riêng để kiểm soát độ sâu, không cộng lẫn vào tổng.
- **216 + 3 + 3 = 222 view slots/template cấp trang**: module + Settings + template customer module. Đây là số lượng vị trí view cần rà, không phải 222 layout thiết kế độc lập. Các tab sâu và số instance tài liệu/dự án còn được bao phủ ở mục 4.
- **99 khai báo overlay trong 89 file có đường dẫn sử dụng** từ static import graph + module globs. Có wrapper, biến thể nền tảng và dialog chứa nhiều trạng thái; không quy đổi thành 99 mẫu UX độc lập.
- Mã nguồn dùng glob/import động và một số dialog tổng quát: các con số overlay/reachability là bằng chứng tĩnh, cần xác nhận luồng mở bằng fixture/runtime trước nghiệm thu. Không coi mọi file Vue là một màn hình.

Nguồn: [AppModules](../src/render/core/AppModules.ts), [router](../src/render/router/index.ts), [AppTool](../src/render/core/AppTool.ts). Module bị ẩn bằng cấu hình vẫn thuộc phạm vi hỗ trợ. Các file không có đường dẫn sử dụng ở mục 7 không tự động được khôi phục.

Các cột “GĐ” khớp giai đoạn 3–6 trong plan; pilot là phần xem trước của các ID này, không cộng thêm.

## 2. Toàn bộ 63 trang route

| ID | Trang / chức năng | Route | View cấp trang cần rà | Số view | GĐ | Entry |
| --- | --- | --- | --- | --: | --: | --- |
| R01 | Apache · Web server | `/apache` | Dịch vụ; Phiên bản; Cấu hình; Error log; Log | 5 | 3 | [Vue](../src/render/components/Apache/Index.vue) |
| R02 | Bun · Ngôn ngữ/runtime | `/bun` | Dự án Bun; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/Bun/Index.vue) |
| R03 | Caddy · Web server | `/caddy` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Caddy/Index.vue) |
| R04 | CliProxyAPI · Ứng dụng/tiện ích | `/cliproxyapi` | Dịch vụ; Phiên bản; Cấu hình; Biến môi trường; Log | 5 | 3 | [Vue](../src/render/components/CliProxyAPI/Index.vue) |
| R05 | ClickHouse · Database | `/clickhouse` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/ClickHouse/Index.vue) |
| R06 | Cloudflare Tunnel · Tunnel | `/cloudflare-tunnel` | Dịch vụ | 1 | 3 | [Vue](../src/render/components/CloudflareTunnel/Index.vue) |
| R07 | Cloudflared · Tunnel | `/cloudflared` | Dịch vụ; Phiên bản | 2 | 3 | [Vue](../src/render/components/Cloudflared/Index.vue) |
| R08 | Consul · Governance | `/consul` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Consul/Index.vue) |
| R09 | Cron · Ứng dụng/tiện ích | `/cron` | Tác vụ Cron; Tác vụ hệ thống | 2 | 5 | [Vue](../src/render/components/Cron/Index.vue) |
| R10 | DNS · DNS | `/dns` | Dịch vụ; Cấu hình | 2 | 3 | [Vue](../src/render/components/DNS/Index.vue) |
| R11 | Deno · Ngôn ngữ/runtime | `/deno` | Dự án Deno; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/Deno/Index.vue) |
| R12 | .NET · Ngôn ngữ/runtime | `/dotnet` | Dự án .NET; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/DotNet/Index.vue) |
| R13 | Elasticsearch · Search | `/elasticsearch` | Dịch vụ; Phiên bản; elasticsearch.yml; jvm.options; log4j2.properties; Log | 6 | 3 | [Vue](../src/render/components/Elasticsearch/Index.vue) |
| R14 | Erlang · Ngôn ngữ/runtime | `/erlang` | Dự án Erlang; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/Erlang/Index.vue) |
| R15 | Etcd · Governance | `/etcd` | Dịch vụ; Phiên bản; Cấu hình; Log; Error log | 5 | 3 | [Vue](../src/render/components/Etcd/Index.vue) |
| R16 | FTP · FTP | `/pure-ftpd` | Dịch vụ; Phiên bản; Cấu hình | 3 | 3 | [Vue](../src/render/components/FTP/Index.vue) |
| R17 | FTP-SRV · FTP | `/ftp-srv` | Dịch vụ | 1 | 3 | [Vue](../src/render/components/FTPSRV/Index.vue) |
| R18 | Flutter · Ngôn ngữ/runtime | `/flutter` | Tổng quan Flutter; Dự án Flutter; Dịch vụ; Phiên bản; Android | 5 | 4 | [Vue](../src/render/components/Flutter/Index.vue) |
| R19 | FrankenPHP · Web server | `/frankenphp` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/FrankenPHP/Index.vue) |
| R20 | Git · Ứng dụng/tiện ích | `/git` | Git | 1 | 5 | [Vue](../src/render/components/Git/Index.vue) |
| R21 | Go · Ngôn ngữ/runtime | `/golang` | Dự án Go; Dịch vụ; Phiên bản; Tạo dự án; GVM (macOS/Linux) | 5 | 4 | [Vue](../src/render/components/GoLang/Index.vue) |
| R22 | Gradle · Ngôn ngữ/runtime | `/gradle` | Dịch vụ; Phiên bản | 2 | 4 | [Vue](../src/render/components/Gradle/Index.vue) |
| R23 | Hosts / Sites · Website/chứng chỉ | `/hosts` | Site web/PHP; Site Tomcat | 2 | 5 | [Vue](../src/render/components/Host/Index.vue) |
| R24 | HTTP Server · Web server | `/httpserver` | HTTP server | 1 | 3 | [Vue](../src/render/components/HttpServe/Index.vue) |
| R25 | Java · Ngôn ngữ/runtime | `/java` | Dự án Java; Dịch vụ; Phiên bản; Maven | 4 | 4 | [Vue](../src/render/components/Java/Index.vue) |
| R26 | Mailpit · Mail | `/mailpit` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/MailPit/Index.vue) |
| R27 | MariaDB · Database | `/mariadb` | Dịch vụ; Phiên bản; Cấu hình; Log; Slow log | 5 | 3 | [Vue](../src/render/components/MariaDB/Index.vue) |
| R28 | MeiliSearch · Search | `/meilisearch` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/MeiliSearch/Index.vue) |
| R29 | Memcached · Cache/queue | `/memcached` | Dịch vụ; Phiên bản | 2 | 3 | [Vue](../src/render/components/Memcached/Index.vue) |
| R30 | MinIO · Object storage | `/minio` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Minio/Index.vue) |
| R31 | MkCert · Website/chứng chỉ | `/mkcert` | Dịch vụ; Phiên bản; Chứng chỉ | 3 | 3 | [Vue](../src/render/components/MkCert/Index.vue) |
| R32 | MongoDB · Database | `/mongodb` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/MongoDB/Index.vue) |
| R33 | MySQL · Database | `/mysql` | Dịch vụ; Phiên bản; Cấu hình; Log; Slow log; Nhóm MySQL | 6 | 3 | [Vue](../src/render/components/Mysql/Index.vue) |
| R34 | n8n · Ứng dụng/tiện ích | `/n8n` | Dịch vụ; Phiên bản; Cấu hình; Người dùng; Log | 5 | 3 | [Vue](../src/render/components/N8N/Index.vue) |
| R35 | Neo4j · Database | `/neo4j` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Neo4j/Index.vue) |
| R36 | Nginx · Web server | `/nginx` | Dịch vụ; Phiên bản; Cấu hình; Error log; Log | 5 | 3 | [Vue](../src/render/components/Nginx/Index.vue) |
| R37 | Node.js · Ngôn ngữ/runtime | `/node` | Dự án Node.js; Dịch vụ; Phiên bản; .npmrc; Tạo dự án | 5 | 4 | [Vue](../src/render/components/Nodejs/Index.vue) |
| R38 | Numa DNS · DNS | `/numa` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Numa/Index.vue) |
| R39 | PHP · Ngôn ngữ/runtime | `/php` | Dự án PHP; Dịch vụ; Phiên bản; Composer; Tạo dự án | 5 | 4 | [Vue](../src/render/components/PHP/Index.vue) |
| R40 | PHP-FPM · Ngôn ngữ/runtime | `/php-fpm` | Dịch vụ; Phiên bản | 2 | 4 | [Vue](../src/render/components/PHPFPM/Index.vue) |
| R41 | Perl · Ngôn ngữ/runtime | `/perl` | Dự án Perl; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/Perl/Index.vue) |
| R42 | Podman · Container | `/podman` | Workspace Podman | 1 | 5 | [Vue](../src/render/components/Podman/Index.vue) |
| R43 | PostgreSQL · Database | `/postgresql` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/PostgreSql/Index.vue) |
| R44 | Python · Ngôn ngữ/runtime | `/python` | Dự án Python; Dịch vụ; Phiên bản; Tạo dự án | 4 | 4 | [Vue](../src/render/components/Python/Index.vue) |
| R45 | Qdrant · Database | `/qdrant` | Dịch vụ; Phiên bản; Cấu hình; Log; Error log | 5 | 3 | [Vue](../src/render/components/Qdrant/Index.vue) |
| R46 | RabbitMQ · Cache/queue | `/rabbitmq` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/RabbitMQ/Index.vue) |
| R47 | Redis · Cache/queue | `/redis` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Redis/Index.vue) |
| R48 | Rnacos · Governance | `/rnacos` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Rnacos/Index.vue) |
| R49 | RoadRunner · Ngôn ngữ/runtime | `/roadrunner` | Dự án RoadRunner; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/RoadRunner/Index.vue) |
| R50 | Ruby · Ngôn ngữ/runtime | `/ruby` | Dự án Ruby; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/Ruby/Index.vue) |
| R51 | Rust · Ngôn ngữ/runtime | `/rust` | Dự án Rust; Dịch vụ; Phiên bản; Rustup | 4 | 4 | [Vue](../src/render/components/Rust/Index.vue) |
| R52 | RustFS · Object storage | `/rustfs` | Dịch vụ; Phiên bản; Cấu hình; Log; Error log | 5 | 3 | [Vue](../src/render/components/Rustfs/Index.vue) |
| R53 | Startup groups · Điều phối dịch vụ | `/startup-group` | Nhóm khởi động | 1 | 5 | [Vue](../src/render/components/StartupGroup/Index.vue) |
| R54 | Swoole CLI · Ngôn ngữ/runtime | `/swoole-cli` | Dự án Swoole CLI; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/SwooleCli/Index.vue) |
| R55 | Temporal · Governance | `/temporal` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Temporal/Index.vue) |
| R56 | Temporal CLI · Governance | `/temporal-cli` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/TemporalCli/Index.vue) |
| R57 | Tomcat · Web server | `/tomcat` | Dịch vụ; Phiên bản; server.xml; web.xml; Log | 5 | 3 | [Vue](../src/render/components/Tomcat/Index.vue) |
| R58 | Tools · Ứng dụng/tiện ích | `/tools` | Danh mục Tools | 1 | 6 | [Vue](../src/render/components/Tools/Index.vue) |
| R59 | Typesense · Search | `/typesense` | Dịch vụ; Phiên bản; Cấu hình; Log | 4 | 3 | [Vue](../src/render/components/Typesense/Index.vue) |
| R60 | Zig · Ngôn ngữ/runtime | `/zig` | Dự án Zig; Dịch vụ; Phiên bản | 3 | 4 | [Vue](../src/render/components/Zig/Index.vue) |
| R61 | ZincSearch · Search | `/zincsearch` | Dịch vụ; Phiên bản; Cấu hình; Log; Error log | 5 | 3 | [Vue](../src/render/components/ZincSearch/Index.vue) |
| R62 | Settings | `/setup` | Common; Modules; UI | 3 | 5 | [Vue](../src/render/components/Setup/Index.vue) |
| R63 | Dịch vụ tùy chỉnh | `/customer-module` | Dịch vụ; cấu hình; log — template theo định nghĩa của người dùng | 3 loại | 5 | [Vue](../src/render/components/CustomerModule/Index.vue) |

**Theo nền tảng:** ClickHouse, pure-ftpd và Typesense chỉ khai báo macOS/Linux; Windows có 58 module + 2 trang hệ thống. Go GVM là view macOS/Linux. macOS/Linux có thể dùng nguồn package manager khác nhau; không tạo trang nguồn không được module/nền tảng hỗ trợ.

Custom module có thể có nhiều instance và nhiều file config/log theo dữ liệu. Refactor template và kiểm tra tình huống 0/1/nhiều tab; không coi mỗi instance của người dùng là một màn hình thiết kế mới.

## 3. Toàn bộ 38 màn hình công cụ

Các công cụ phải dùng được cả trong trang Tools lẫn drawer mở Tools từ shell. Công cụ tùy chỉnh/URL dùng lại host của Tools; nội dung website bên ngoài không thuộc phạm vi theme của QTEnvDev.

| ID | Công cụ | Nhóm | Bố cục/điểm cần thiết kế | Entry |
| --- | --- | --- | --- | --- |
| T01 | Base64 file | Converter | Vùng chọn/drop file + kết quả encode/decode, file metadata và lưu/copy | [Vue](../src/render/components/Tools/Base64FileConverter/index.vue) |
| T02 | Base64 text | Converter | Hai pane văn bản, encode/decode, copy và lỗi dữ liệu | [Vue](../src/render/components/Tools/Base64StringConverter/index.vue) |
| T03 | BOM cleaner | Development | Danh sách file, lựa chọn, tiến độ và kết quả riêng từng file | [Vue](../src/render/components/Tools/BomClean/Index.vue) |
| T04 | Capturer settings | Images | Thiết lập và khởi chạy chụp; khác cửa sổ overlay W02 | [Vue](../src/render/components/Tools/Capturer/index.vue) |
| T05 | Chmod calculator | Development | Ma trận quyền, chuỗi số và lệnh sao chép | [Vue](../src/render/components/Tools/ChmodCalculator/index.vue) |
| T06 | Code library | Code | Nhóm/ngôn ngữ, danh sách snippet, code detail và thêm/sửa/chuyển nhóm | [Vue](../src/render/components/Tools/CodeLibrary/index.vue) |
| T07 | Code playground | Code | Tab tài liệu, editor + kết quả; đổi kích thước và trạng thái lỗi | [Vue](../src/render/components/Tools/CodePlayground/index.vue) |
| T08 | Cron parser | Development | Biểu thức, diễn giải và danh sách lần chạy nếu có trong dữ liệu hiện tại | [Vue](../src/render/components/Tools/CronParser/Index.vue) |
| T09 | Diff compare | Development | Hai nguồn đầu vào, vùng diff, đồng bộ cuộn và copy | [Vue](../src/render/components/Tools/DiffCompare/Index.vue) |
| T10 | Encrypt/decrypt text | Crypto | Thuật toán/key/input/output; che dữ liệu nhạy cảm theo control hiện có | [Vue](../src/render/components/Tools/Encryption/index.vue) |
| T11 | Escape HTML | Converter | Hai pane, encode/decode và copy | [Vue](../src/render/components/Tools/EscapeHTML/index.vue) |
| T12 | File information | Development | Chọn/drop file và thuộc tính được phân nhóm | [Vue](../src/render/components/Tools/FileInfo/Index.vue) |
| T13 | Git cheatsheet | Development | Điều hướng nội dung, tìm/lọc hiện có và copy lệnh | [Vue](../src/render/components/Tools/GitCheatsheet/index.vue) |
| T14 | HTTP status codes | Web | Danh sách mã, mô tả và bộ lọc hiện có | [Vue](../src/render/components/Tools/HTTPStatusCodes/index.vue) |
| T15 | Hash text | Crypto | Đầu vào, thuật toán và kết quả hash dễ copy | [Vue](../src/render/components/Tools/HashText/index.vue) |
| T16 | Image compress | Images | Batch, basic, compress, effects, watermark, texture; preview và job outcomes | [Vue](../src/render/components/Tools/ImageCompress/index.vue) |
| T17 | JWT encoder/decoder | Crypto | Token, header/payload/signature và cảnh báo/lỗi hiện có | [Vue](../src/render/components/Tools/JWT/Index.vue) |
| T18 | JSON workspace | Development | Tab tài liệu, editor + cấu trúc/kết quả và lỗi parse | [Vue](../src/render/components/Tools/Json/Index.vue) |
| T19 | Keycode information | Web | Vùng nhận phím và bảng thông tin; focus rõ | [Vue](../src/render/components/Tools/KeycodeInfo/index.vue) |
| T20 | MIME types | Web | Danh sách tra cứu/tìm kiếm và copy | [Vue](../src/render/components/Tools/MIMETypes/index.vue) |
| T21 | Markdown preview | Code | Tab tài liệu, source + preview và vùng cuộn | [Vue](../src/render/components/Tools/MarkdownPreview/index.vue) |
| T22 | PHP obfuscator | Development | Nguồn/đích, cấu hình, tiến độ, drawer config/log | [Vue](../src/render/components/Tools/PhpObfuscator/Index.vue) |
| T23 | Port processes | Development | Port, danh sách process, nhận diện và xác nhận thao tác hiện có | [Vue](../src/render/components/Tools/PortKill/Index.vue) |
| T24 | Process manager | Development | Lọc process, nhận diện, hành động và kết quả riêng từng item | [Vue](../src/render/components/Tools/ProcessKill/Index.vue) |
| T25 | QR code generator | Images | Input và tùy chọn một bên, preview/export một bên | [Vue](../src/render/components/Tools/QRCodeGenerator/index.vue) |
| T26 | RSA key generator | Crypto | Tùy chọn sinh, cặp key và copy/export | [Vue](../src/render/components/Tools/RSAKeyGenerator/index.vue) |
| T27 | Regex cheatsheet | Development | Danh mục biểu thức, diễn giải và copy | [Vue](../src/render/components/Tools/RegexCheatsheet/index.vue) |
| T28 | Regex tester | Development | Pattern/flags, mẫu đầu vào và kết quả match/error | [Vue](../src/render/components/Tools/RegexTester/index.vue) |
| T29 | Request timing | Development | Thiết lập request, kết quả thời gian theo dữ liệu thật và lỗi | [Vue](../src/render/components/Tools/RequestTime/Index.vue) |
| T30 | SSL certificate maker | Development | Thông số chứng chỉ, tác vụ sinh và kết quả/file output | [Vue](../src/render/components/Tools/SSLMake/Index.vue) |
| T31 | Site downloader | Development | URL/đích, drawer setting, tiến độ và kết quả | [Vue](../src/render/components/Tools/SiteSucker/Index.vue) |
| T32 | System environment | Development | Danh sách key/value; editor khác nhau macOS/Linux và Windows | [Vue](../src/render/components/Tools/SystenEnv/main.vue) |
| T33 | Timestamp converter | Converter | Mốc thời gian, định dạng/timezone hiện có và kết quả copy | [Vue](../src/render/components/Tools/Timestamp/Index.vue) |
| T34 | Token generator | Crypto | Tùy chọn, kết quả và copy; không lưu thêm bí mật | [Vue](../src/render/components/Tools/TokenGenerator/index.vue) |
| T35 | URL parser | Web | Đầu vào URL và các phần đã phân tách | [Vue](../src/render/components/Tools/URLParse/index.vue) |
| T36 | URL encoder | Converter | Input/output, encode/decode và copy | [Vue](../src/render/components/Tools/UrlEncode/index.vue) |
| T37 | WebSocket / SSE | Development | Request composer, params/headers/auth/options, connect state và event stream | [Vue](../src/render/components/Tools/WebSocketSSE/Index.vue) |
| T38 | Wi-Fi QR code | Images | Thông số mạng và QR preview/export | [Vue](../src/render/components/Tools/WifiQRCodeGenerator/index.vue) |

Capturer chỉ đăng ký macOS/Windows; Linux có 37 Tools. Các tab JSON/Markdown/CodePlayground và nhóm/ngôn ngữ CodeLibrary là instance dữ liệu, không tạo thêm màn hình thiết kế vô hạn. Chưa thêm tính năng mới cho các công cụ.

## 4. Luồng sâu cần làm đầy đủ

| Chủ sở hữu | Giao diện/biến thể phải kiểm tra | Mẫu thiết kế |
| --- | --- | --- |
| Shell | Title bar, sidebar mở/thu gọn, category, action hệ thống, Tools drawer, context menu, trạng thái page | Shell + primitives |
| ServiceManager | Danh sách local/service; custom path; xóa/xóa cưỡng chế; phpMyAdmin; env/EXT; alias và alias edit; version error tips | Service table + form/dialog + trạng thái |
| VersionManager | 5 view nguồn đang dùng: local, static, Homebrew, MacPorts, SDKMAN; index/all là wrapper dùng lại; source availability theo module/nền tảng | Version catalogue + operation footer |
| LanguageProjects | Danh sách, aside, sắp xếp, ProjectEdit, config, config viewer, log viewer | Project table + drawer/editor |
| PHP | Dự án/service/version/Composer/create; php.ini, FPM config, log/error log, disable functions; drawer extension | Project/service + editor |
| PHP extension | 5 view nguồn có import thực: Loaded, Homebrew, MacPorts, Local, Windows; 2 dialog preparation/operation của Windows; nguồn qtenvdev có nhánh trống trong mã hiện tại | Catalogue + progress; giữ nhánh chưa có nội dung như hiện tại |
| PHP-FPM | Danh sách service/version; hộp thoại FastCGI workers | Service + dialog |
| Node.js | Local/default, FNM, NVM; package editor với scripts/dependencies; tạo dự án | Version catalogue + package workbench |
| Flutter | General, project, service, version, Android; tạo/sửa project, dialog xem thay đổi | Project workspace + form/preview |
| Go / Java / Rust | Go create + GVM macOS/Linux; Java Maven; Rust Rustup; project/view dùng chung | Catalogue/project workbench |
| RoadRunner / Swoole CLI | Project edit riêng cùng danh sách/service/version dùng chung | Project form riêng |
| Hosts | Danh sách site web/PHP và Tomcat; site edit/Tomcat edit, hosts file, vhost, template edit, rewrite editor, log và link | Site table + editor/drawer |
| Host create project | Picker; mẫu PHP, Node.js, Python, Go; các form Windows riêng; dùng lại với create từ trang ngôn ngữ | Form theo runtime + terminal hiện có |
| MySQL / MariaDB | DB management drawer dùng chung; danh sách DB, create DB, password, backup directory; MySQL group + add/config/log | Infrastructure list/detail + dialog/editor |
| PostgreSQL | Extension drawer và action extension hiện có | Catalogue + trạng thái |
| Podman | Machine list; Dashboard, Compose, Images, Containers; config drawer | Resource explorer |
| Podman resource | Machine add/edit, image pull, container create/info/command preview, Compose add/build và YAML preview | Resource forms + preview |
| Podman Compose builder | 29 file Vue form ở thư mục gốc: Base + 28 recipe theo service; các component docRoot/wwwRoot/base/preview dùng chung | Một hệ form có biến thể, không 29 trang route mới |
| Cloudflare Tunnel | Tunnel add/edit; DNS add/edit; logs; trạng thái runtime đang có | Table + form + log |
| FTP / FTP-SRV | List và add form; config/nguồn theo route đang dùng | Service + form |
| Cron | Danh sách tác vụ và system tasks; add/edit; output; schedule helper | Task list + scheduler form |
| n8n | Users view, 8 dialog: scan data directory, user actions, đổi tên, đổi role, reset password, thêm user, invite URL, đổi owner password | User list + contextual forms |
| Startup groups | Group card/list, GroupEditor, member picker và progress/kết quả từng thành viên đang có | Flat group workspace |
| Tools / ImageCompress | 6 tab: batch/basic/compress/effects/watermark/texture; 4 format JPEG/PNG/WebP/AVIF; preview và từng job | Media workspace |
| Tools / WebSocket-SSE | Protocol; Params, Headers, Auth, WS Options, SSE Options; event/message stream và connection error | Request/event workspace |
| Tools / CodeLibrary | Ngôn ngữ/nhóm, list/detail, snippet add/edit, group change | Library + code pane |
| Tools / document editors | JSON, CodePlayground, Markdown: tạo/chọn/đóng tab theo workflow đang có, nội dung dài, lỗi và kết quả | Document tabs + editor |
| Tools / tác vụ dài | ImageCompress, SiteSucker, PhpObfuscator, BOM clean, SSL, process/port actions: trạng thái thực tế, terminal/result và các form setting/log | Focused tool + operation state |
| Tools / custom tool | Add/edit, host webview, loading/error/back nếu đang có; không theme vào website bên ngoài | Tool host + form |
| Tools / env | macOS/Linux edit drawer; Windows edit dialog; tên biến/value dài | Platform form |
| Settings Common | Ngôn ngữ, theme, proxy; macOS Brew/MacPorts source + helper; Windows elevation method; auto launch/hide/tray theo nền tảng | Settings detail |
| Settings Modules | Danh sách built-in ẩn/hiện; customer modules; add/edit module; command form | Settings list + nested form |
| Settings UI | App font, code font, external editor đang có | Settings detail |
| Customer module | Template service, số config/log động, config/log drawer và hoạt động operation đang có | Service + dynamic editor/log |
| System overlays | Module onboarding; helper install terminal; AppLog; About qua menu; Feedback qua About; generic confirm/message/terminal | Dialog/drawer primitives + content |

**28 recipe Compose**: Apache, Bun, Caddy, Consul, Deno, Elasticsearch, Erlang, Etcd, Go, Java, Mailpit, MariaDB, Meilisearch, Memcached, MinIO, MongoDB, MySQL, Nginx, NodeJS, PHP, Perl, PostgreSQL, Python, RabbitMQ, Redis, Ruby, Rust, Tomcat.

Các trang web/panel ngoài ứng dụng được giữ nội dung của nhà cung cấp; thiết kế lại phần host/status do QTEnvDev quản lý. Nội dung OS dialog không chỉnh bằng renderer CSS.

## 5. Cửa sổ phụ và lớp hệ thống

| ID / lớp | Chức năng | Entry/chủ sở hữu | Nội dung review |
| --- | --- | --- | --- |
| W01 | Tray popup | [tray/App.vue](../src/render/tray/App.vue) | Danh sách/nhóm, trạng thái, action, kích thước cửa sổ và light/dark |
| W02 | Chụp/đánh dấu màn hình | [capturer/App.vue](../src/render/capturer/App.vue) | Vùng chọn, kích thước, zoom/magnifier, toolbar, màu/độ dày, text/mask và focus/shortcut hiện có |
| Shell | Navigation/title bar | [App.vue](../src/render/App.vue), [Main.vue](../src/render/components/Main.vue), [Aside](../src/render/components/Aside/Index.vue), [TitleBar](../src/render/components/Native/TitleBar.vue) | Không tính trang mới; kiểm tra drag/no-drag, collapsed/expanded, tab/focus và Tools drawer |
| Onboarding | Chọn module lần đầu | [ModuleOnboarding](../src/render/components/ModuleOnboarding/index.vue) | Danh mục/lựa chọn, không tự khôi phục module đã gỡ |
| Helper | Cài helper / terminal | [QTEnvDevHelper](../src/render/components/QTEnvDevHelper/index.vue) | Nội dung app sở hữu và trạng thái; prompt quản trị của OS giữ nguyên |
| App log | Nhật ký ứng dụng | [AppLog](../src/render/components/AppLog/log.vue) | Log controls, nội dung dài, lỗi và copy |
| About | Thông tin ứng dụng | [About](../src/render/components/About/index.vue) | Mở qua Base.Dialog/menu; không phải trang Setup/About cũ |
| Feedback | Biểu mẫu feedback | [Feedback](../src/render/components/Feedback/index.vue) | Luồng mở từ About, form và trạng thái sẵn có |
| Shared overlays | Confirm, notice, context menu, terminal | [YbBaseDialog](../src/render/components/YbBaseDialog/index.vue), [XTermExecDialog](../src/render/components/XTermExecDialog/index.vue), tiện ích Element | Focus, z-index, scroll, lỗi/thành công và cleanup theo owner hiện tại |

## 6. Danh sách overlay từ source

89 file / 99 vị trí dưới đây là checklist review, không phải số màn hình độc lập. `YbBaseDialog` là wrapper; Tools drawer dùng lại màn hình Tools. Bốn cặp form tạo project trong Hosts và cặp editor SystemEnv là biến thể nền tảng. `N8N/Users.vue` khai báo 8 dialog. Dialog động qua API tổng quát cần kiểm tra thêm ở luồng mở; không có trong phép đếm tag dưới đây.

| ID | File có overlay | Số vị trí | Loại khai báo |
| --- | --- | --: | --- |
| O01 | [components/AppLog/log.vue](../src/render/components/AppLog/log.vue) | 1 | el-drawer |
| O02 | [components/CloudflareTunnel/Logs.vue](../src/render/components/CloudflareTunnel/Logs.vue) | 1 | el-drawer |
| O03 | [components/CloudflareTunnel/add.vue](../src/render/components/CloudflareTunnel/add.vue) | 1 | el-dialog |
| O04 | [components/CloudflareTunnel/addDNS.vue](../src/render/components/CloudflareTunnel/addDNS.vue) | 1 | el-dialog |
| O05 | [components/CloudflareTunnel/edit.vue](../src/render/components/CloudflareTunnel/edit.vue) | 1 | el-dialog |
| O06 | [components/CloudflareTunnel/editDNS.vue](../src/render/components/CloudflareTunnel/editDNS.vue) | 1 | el-dialog |
| O07 | [components/Cron/DialogAdd.vue](../src/render/components/Cron/DialogAdd.vue) | 1 | el-dialog |
| O08 | [components/Cron/DialogOutput.vue](../src/render/components/Cron/DialogOutput.vue) | 1 | el-dialog |
| O09 | [components/Cron/ScheduleHelper.vue](../src/render/components/Cron/ScheduleHelper.vue) | 1 | el-dialog |
| O10 | [components/CustomerModule/ConfigPoper.vue](../src/render/components/CustomerModule/ConfigPoper.vue) | 1 | el-drawer |
| O11 | [components/CustomerModule/LogsPoper.vue](../src/render/components/CustomerModule/LogsPoper.vue) | 1 | el-drawer |
| O12 | [components/FTP/Add.vue](../src/render/components/FTP/Add.vue) | 1 | el-dialog |
| O13 | [components/FTPSRV/Add.vue](../src/render/components/FTPSRV/Add.vue) | 1 | el-dialog |
| O14 | [components/Feedback/index.vue](../src/render/components/Feedback/index.vue) | 1 | el-dialog |
| O15 | [components/Flutter/CreateProject.vue](../src/render/components/Flutter/CreateProject.vue) | 1 | el-drawer |
| O16 | [components/Flutter/EditProject.vue](../src/render/components/Flutter/EditProject.vue) | 2 | el-drawer, el-dialog |
| O17 | [components/Host/CreateProject/go/create.vue](../src/render/components/Host/CreateProject/go/create.vue) | 1 | el-dialog |
| O18 | [components/Host/CreateProject/go/create.win.vue](../src/render/components/Host/CreateProject/go/create.win.vue) | 1 | el-dialog |
| O19 | [components/Host/CreateProject/new.vue](../src/render/components/Host/CreateProject/new.vue) | 1 | el-dialog |
| O20 | [components/Host/CreateProject/nodejsCreate.vue](../src/render/components/Host/CreateProject/nodejsCreate.vue) | 1 | el-dialog |
| O21 | [components/Host/CreateProject/nodejsCreate.win.vue](../src/render/components/Host/CreateProject/nodejsCreate.win.vue) | 1 | el-dialog |
| O22 | [components/Host/CreateProject/phpCreate.vue](../src/render/components/Host/CreateProject/phpCreate.vue) | 1 | el-dialog |
| O23 | [components/Host/CreateProject/phpCreate.win.vue](../src/render/components/Host/CreateProject/phpCreate.win.vue) | 1 | el-dialog |
| O24 | [components/Host/CreateProject/python/create.vue](../src/render/components/Host/CreateProject/python/create.vue) | 1 | el-dialog |
| O25 | [components/Host/CreateProject/python/create.win.vue](../src/render/components/Host/CreateProject/python/create.win.vue) | 1 | el-dialog |
| O26 | [components/Host/Edit.vue](../src/render/components/Host/Edit.vue) | 1 | el-drawer |
| O27 | [components/Host/Hosts.vue](../src/render/components/Host/Hosts.vue) | 1 | el-drawer |
| O28 | [components/Host/Link.vue](../src/render/components/Host/Link.vue) | 1 | el-dialog |
| O29 | [components/Host/Logs.vue](../src/render/components/Host/Logs.vue) | 1 | el-drawer |
| O30 | [components/Host/Tomcat/Edit.vue](../src/render/components/Host/Tomcat/Edit.vue) | 1 | el-drawer |
| O31 | [components/Host/Tomcat/Logs.vue](../src/render/components/Host/Tomcat/Logs.vue) | 1 | el-drawer |
| O32 | [components/Host/Vhost.vue](../src/render/components/Host/Vhost.vue) | 1 | el-drawer |
| O33 | [components/Host/VhostTmpl/edit.vue](../src/render/components/Host/VhostTmpl/edit.vue) | 1 | el-drawer |
| O34 | [components/LanguageProjects/ConfigViewer.vue](../src/render/components/LanguageProjects/ConfigViewer.vue) | 1 | el-drawer |
| O35 | [components/LanguageProjects/LogViewer.vue](../src/render/components/LanguageProjects/LogViewer.vue) | 1 | el-drawer |
| O36 | [components/LanguageProjects/ProjectEdit.vue](../src/render/components/LanguageProjects/ProjectEdit.vue) | 1 | el-drawer |
| O37 | [components/LanguageProjects/config.vue](../src/render/components/LanguageProjects/config.vue) | 1 | el-drawer |
| O38 | [components/Main.vue](../src/render/components/Main.vue) | 1 | el-drawer |
| O39 | [components/ModuleOnboarding/index.vue](../src/render/components/ModuleOnboarding/index.vue) | 1 | el-dialog |
| O40 | [components/Mysql/Group/Add.vue](../src/render/components/Mysql/Group/Add.vue) | 1 | el-dialog |
| O41 | [components/Mysql/Group/Config.vue](../src/render/components/Mysql/Group/Config.vue) | 1 | el-drawer |
| O42 | [components/Mysql/Group/Logs.vue](../src/render/components/Mysql/Group/Logs.vue) | 1 | el-drawer |
| O43 | [components/Mysql/Manage/addDatabase.vue](../src/render/components/Mysql/Manage/addDatabase.vue) | 1 | el-dialog |
| O44 | [components/Mysql/Manage/index.vue](../src/render/components/Mysql/Manage/index.vue) | 1 | el-drawer |
| O45 | [components/Mysql/Manage/setBackupDir.vue](../src/render/components/Mysql/Manage/setBackupDir.vue) | 1 | el-dialog |
| O46 | [components/Mysql/Manage/setPassword.vue](../src/render/components/Mysql/Manage/setPassword.vue) | 1 | el-dialog |
| O47 | [components/N8N/Users.vue](../src/render/components/N8N/Users.vue) | 8 | el-dialog × 8 |
| O48 | [components/Nodejs/projects/package.vue](../src/render/components/Nodejs/projects/package.vue) | 1 | el-drawer |
| O49 | [components/PHP/Config.vue](../src/render/components/PHP/Config.vue) | 1 | el-drawer |
| O50 | [components/PHP/DisableFunction.vue](../src/render/components/PHP/DisableFunction.vue) | 1 | el-drawer |
| O51 | [components/PHP/ErrorLog.vue](../src/render/components/PHP/ErrorLog.vue) | 1 | el-drawer |
| O52 | [components/PHP/Extends.vue](../src/render/components/PHP/Extends.vue) | 1 | el-drawer |
| O53 | [components/PHP/Extension/Windows/index.vue](../src/render/components/PHP/Extension/Windows/index.vue) | 2 | el-dialog × 2 |
| O54 | [components/PHP/FpmConfig.vue](../src/render/components/PHP/FpmConfig.vue) | 1 | el-drawer |
| O55 | [components/PHP/Logs.vue](../src/render/components/PHP/Logs.vue) | 1 | el-drawer |
| O56 | [components/PHPFPM/FastCgiWorkers.vue](../src/render/components/PHPFPM/FastCgiWorkers.vue) | 1 | el-dialog |
| O57 | [components/Podman/compose-build/components/preview.vue](../src/render/components/Podman/compose-build/components/preview.vue) | 1 | el-dialog |
| O58 | [components/Podman/compose/composeAdd.vue](../src/render/components/Podman/compose/composeAdd.vue) | 1 | el-dialog |
| O59 | [components/Podman/compose/composeBuild.vue](../src/render/components/Podman/compose/composeBuild.vue) | 1 | el-dialog |
| O60 | [components/Podman/config.vue](../src/render/components/Podman/config.vue) | 1 | el-drawer |
| O61 | [components/Podman/container/containerCreate.vue](../src/render/components/Podman/container/containerCreate.vue) | 1 | el-dialog |
| O62 | [components/Podman/container/info.vue](../src/render/components/Podman/container/info.vue) | 1 | el-dialog |
| O63 | [components/Podman/container/preview.vue](../src/render/components/Podman/container/preview.vue) | 1 | el-dialog |
| O64 | [components/Podman/image/imageAdd.vue](../src/render/components/Podman/image/imageAdd.vue) | 1 | el-dialog |
| O65 | [components/Podman/machine/machineAdd.vue](../src/render/components/Podman/machine/machineAdd.vue) | 1 | el-dialog |
| O66 | [components/PostgreSql/Extension/index.vue](../src/render/components/PostgreSql/Extension/index.vue) | 1 | el-drawer |
| O67 | [components/QTEnvDevHelper/index.vue](../src/render/components/QTEnvDevHelper/index.vue) | 1 | el-dialog |
| O68 | [components/RoadRunner/ProjectEdit.vue](../src/render/components/RoadRunner/ProjectEdit.vue) | 1 | el-drawer |
| O69 | [components/ServiceManager/EXT/alias.vue](../src/render/components/ServiceManager/EXT/alias.vue) | 1 | el-dialog |
| O70 | [components/ServiceManager/EXT/aliasEdit.vue](../src/render/components/ServiceManager/EXT/aliasEdit.vue) | 1 | el-dialog |
| O71 | [components/ServiceManager/customPath.vue](../src/render/components/ServiceManager/customPath.vue) | 1 | el-dialog |
| O72 | [components/ServiceManager/delDialog.vue](../src/render/components/ServiceManager/delDialog.vue) | 2 | el-dialog × 2 |
| O73 | [components/ServiceManager/phpMyAdmin.vue](../src/render/components/ServiceManager/phpMyAdmin.vue) | 1 | el-dialog |
| O74 | [components/Setup/Module/module/moduleAdd.vue](../src/render/components/Setup/Module/module/moduleAdd.vue) | 1 | el-drawer |
| O75 | [components/Setup/Module/module/moduleExecItemAdd.vue](../src/render/components/Setup/Module/module/moduleExecItemAdd.vue) | 1 | el-drawer |
| O76 | [components/Setup/WindowsElevationMethod/Choice.vue](../src/render/components/Setup/WindowsElevationMethod/Choice.vue) | 1 | el-dialog |
| O77 | [components/StartupGroup/GroupEditor.vue](../src/render/components/StartupGroup/GroupEditor.vue) | 1 | el-dialog |
| O78 | [components/SwooleCli/ProjectEdit.vue](../src/render/components/SwooleCli/ProjectEdit.vue) | 1 | el-drawer |
| O79 | [components/Tools/CodeLibrary/codeAdd.vue](../src/render/components/Tools/CodeLibrary/codeAdd.vue) | 1 | el-dialog |
| O80 | [components/Tools/CodeLibrary/groupChange.vue](../src/render/components/Tools/CodeLibrary/groupChange.vue) | 1 | el-dialog |
| O81 | [components/Tools/PhpObfuscator/Config.vue](../src/render/components/Tools/PhpObfuscator/Config.vue) | 1 | el-drawer |
| O82 | [components/Tools/PhpObfuscator/Logs.vue](../src/render/components/Tools/PhpObfuscator/Logs.vue) | 1 | el-drawer |
| O83 | [components/Tools/SiteSucker/setup.vue](../src/render/components/Tools/SiteSucker/setup.vue) | 1 | el-drawer |
| O84 | [components/Tools/SystenEnv/edit.vue](../src/render/components/Tools/SystenEnv/edit.vue) | 1 | el-drawer |
| O85 | [components/Tools/SystenEnv/edit.win.vue](../src/render/components/Tools/SystenEnv/edit.win.vue) | 1 | el-dialog |
| O86 | [components/Tools/add.vue](../src/render/components/Tools/add.vue) | 1 | el-dialog |
| O87 | [components/VersionManager/brew/index.vue](../src/render/components/VersionManager/brew/index.vue) | 1 | el-dialog |
| O88 | [components/XTermExecDialog/index.vue](../src/render/components/XTermExecDialog/index.vue) | 1 | el-dialog |
| O89 | [components/YbBaseDialog/index.vue](../src/render/components/YbBaseDialog/index.vue) | 1 | el-dialog |

Cách rà: bắt đầu từ renderer main/tray/capturer và các entry glob `components/*/Module.ts`, `Tools/*/Module.ts`, theo import có thể giải quyết tĩnh; bỏ nội dung script rồi đếm tag mở `el-dialog`, `el-drawer`, `YbBaseDialog`, `AppDrawer`. Các component dùng chung có nhiều caller chỉ đếm khai báo một lần. Đây là phép rà bảo thủ, không chứng minh mọi branch đã mở được ở runtime.

## 7. File cũ không đưa thành màn hình đang hoạt động

Chưa thấy đường dẫn sử dụng từ entry/import graph hiện tại. Không xóa hoặc khôi phục trong task lập kế hoạch; khi có bằng chứng runtime khác thì cập nhật checklist.

| Nhóm | File/nhánh không tính vào scope active |
| --- | --- |
| Preview/dead helper | `APPTest.vue`, `Tools/flowButton.vue`, `AppLog/btn.vue`, `AppShell/AppSurface.vue`, `AppDrawer/index.vue`, `XRadioGroup/index.vue`, `FloatBtn/index.vue` |
| Nội dung thay thế/cũ | `About/update.vue`, `MkCert/Setup.vue`, `FTPSRV/Config.vue`, `VersionManager/podman/index.vue`, `ServiceManager/Pgsql/index.vue`, `PHP/Extension/Lib/index.vue` |
| Setup cũ | `Setup/ForceStart`, `Setup/Licenses`, `Setup/AutoUpdate`, `Setup/About`, `Setup/AutoStartService`, `Setup/Tool` |
| Tool không đăng ký | `Tools/CodeMake/index.vue`, `choose.vue`, `connect.vue` |
| Tính năng đã gỡ | AI workspace, MCP/plugin system và các route enum còn dư nhưng không có Module.ts đang đăng ký |

## 8. Trạng thái bàn giao theo batch

Toàn bộ ID đã được khảo sát source. Foundation và sáu workspace mẫu đã triển khai để duyệt hình thức, với phạm vi kiểm tra bên dưới. Các ID khác **chưa được refactor và review độc lập**; nhận token dùng chung không đồng nghĩa hoàn thành. Đánh dấu riêng theo từng R/T/W: layout, light, dark, empty/loading/error, keyboard, view sâu, overlay, platform và evidence. Một route pass không tự làm mọi dialog của route đó pass.

| ID / workspace mẫu | Trạng thái và bằng chứng hiện có | Phần chưa nghiệm thu |
| --- | --- | --- |
| R53 — Startup groups | Header/nhóm/hàng thành viên và GroupEditor ba bước đã triển khai; 24/24 ca form cuối ở light/dark, en/vi, desktop/compact; validation/chọn/thứ tự/save fixture, Enter/Space, Escape/trả focus và hủy Delete; bổ sung 216/216 lần hủy draft đã sửa, domain/persistence không đổi và mở lại đúng dữ liệu gốc; thêm 24/24 ca fault injection cho tải candidate và lưu Add/Edit, giữ draft, retry có chủ ý và chặn gửi trùng | Kéo thả, mọi loại lỗi persistence/runtime, progress/partial/error đầy đủ, toàn bộ Tab order và thao tác dịch vụ thật |
| R39 — PHP | Header/tab, bảng dự án và drawer config/extensions đã chỉnh; ảnh sáng/tối, năm tab được mở, overlay đại diện | Create/edit, mọi nguồn extension/version và operation thật |
| R23 — Hosts | Header, search, bảng có dữ liệu và drawer edit đã chỉnh; assertion site xuất hiện trước khi chụp; đo chiều rộng 320–1920px | Tomcat, mọi tổ hợp advanced/SSL/vhost/template, import/export/ghi file thật |
| R42 — Podman | Workspace machine/container và form tạo đại diện đã chỉnh; ảnh sáng/tối, một số trạng thái và hai dialog | Toàn bộ detail/image/compose/terminal và resource operation thật |
| R58 + T18 — Tools/JSON | Thư viện công cụ và editor JSON đã chỉnh; valid/invalid, sáng/tối; lần cuối đo 9 chiều rộng 320–1920px sau sửa toolbar Save | 37 công cụ còn lại, drawer/custom host và mọi chế độ editor |
| R62 — Settings | Navigation/detail đã chỉnh; ba nhóm Common/Modules/UI được mở, ảnh sáng/tối và compact; vòng đời editor 8/8 pass, không còn `Canceled` trong chuỗi đã kiểm tra | Mọi trường/overlay/tùy chọn nền tảng |

Sáu workspace gồm **bảy ID** vì Tools library và JSON có ID riêng; đây là phạm vi mẫu có độ sâu khác nhau, không dùng làm tỷ lệ hoàn thành. Bộ [58 ảnh và 25 file báo cáo JSON](ui-redesign-pilot-review.md) ghi rõ giới hạn: tương phản chỉ đo cặp token semantic, bàn phím và form có phạm vi case cụ thể, chưa smoke main/fork/helper native hoặc toàn bộ luồng nghiệp vụ. Các lần thất bại Monaco, toolbar và Enter Edit StartupGroup vẫn được giữ cùng báo cáo sau sửa. Ma trận form và hủy draft StartupGroup dùng partition bộ nhớ riêng mỗi case, Save chỉ tác động fixture; 24 case bổ sung kiểm Cancel/Escape/nút đóng ở cả ba bước. Ma trận fault injection riêng đạt 24/24 case cho lỗi tải candidate và rejection trước write khi lưu Add/Edit; không nghiệm thu mọi loại lỗi persistence/runtime. Đã bổ sung 1024×768/1440×900 cho sáu workspace và năm overlay đại diện, chưa nghiệm thu mọi view/overlay hoặc trạng thái cuộn dọc.

| Batch | R/T/W chính | Tổng | Checklist đi kèm |
| --- | --- | --: | --- |
| 3 — Dịch vụ | R01, R03, R04, R05, R06, R07, R08, R10, R13, R15, R16, R17, R19, R24, R26, R27, R28, R29, R30, R31, R32, R33, R34, R35, R36, R38, R43, R45, R46, R47, R48, R52, R55, R56, R57, R59, R61 | 37 | View, luồng sâu và overlay thuộc owner tương ứng |
| 4 — Ngôn ngữ/dự án | R02, R11, R12, R14, R18, R21, R22, R25, R37, R39, R40, R41, R44, R49, R50, R51, R54, R60 | 18 | View, luồng sâu và overlay thuộc owner tương ứng |
| 5 — Workspace/hệ thống | R09, R20, R23, R42, R53, R62, R63 | 7 | View, luồng sâu và overlay thuộc owner tương ứng |
| 6 — Tools/cửa sổ phụ | R58, T01, T02, T03, T04, T05, T06, T07, T08, T09, T10, T11, T12, T13, T14, T15, T16, T17, T18, T19, T20, T21, T22, T23, T24, T25, T26, T27, T28, T29, T30, T31, T32, T33, T34, T35, T36, T37, T38, W01, W02 | 41 | View, luồng sâu và overlay thuộc owner tương ứng |

Các con số được đối chiếu giữa danh mục và plan. Đây là checklist phạm vi và trạng thái pilot, chưa phải nghiệm thu toàn bộ giao diện.
