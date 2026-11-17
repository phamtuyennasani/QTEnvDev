# Bản macOS nội bộ

Chạy trên máy Mac đã cài Node.js, Yarn, Go và Xcode Command Line Tools:

```sh
# Chỉ cần khi chưa có helper hoặc sau khi sửa mã Go.
cd src/helper-go
bash build.sh
cd ../..

yarn build:mac
```

Lệnh tạo bản **Apple Silicon (arm64)** tại `release/QTEnvDev-Local-<version>.dmg`. Ứng dụng và helper được ký ad-hoc để kiểm tra tính toàn vẹn của gói; bản này chưa có chữ ký Developer ID hoặc notarization của Apple.

Trên máy nhận:

1. Thoát QTEnvDev cũ, mở DMG mới và chép `QTEnvDev.app` vào `/Applications`, thay thế bản cũ.
2. Mở ứng dụng. Nếu macOS chặn bản nội bộ, vào **System Settings → Privacy & Security → Open Anyway**, rồi xác nhận mở ứng dụng.
3. Đồng ý cài helper trong QTEnvDev và nhập mật khẩu quản trị viên khi macOS yêu cầu. Máy nhận không cần cài Go, Node.js hoặc Yarn.

`build:mac` nhúng chế độ nội bộ vào mã main khi biên dịch và đánh dấu trong `Info.plist`. Bộ cài vẫn kiểm tra chữ ký ad-hoc, tài nguyên ứng dụng, phiên bản giao thức và helper trước khi chạy từ thư mục staging riêng của root. Không sửa nội dung `.app` sau khi build vì thao tác đó làm hỏng chữ ký.

`yarn build` giữ chế độ phát hành và yêu cầu chứng chỉ Developer ID đã cấu hình; biến môi trường trên máy nhận không thể chuyển bản phát hành sang chế độ nội bộ. Chữ ký ad-hoc xác nhận tính toàn vẹn, không xác minh danh tính nhà phát hành; chỉ chia sẻ bộ cài nội bộ qua nguồn tin cậy.
