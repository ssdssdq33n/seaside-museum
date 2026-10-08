# Seaside — Bảo tàng ảnh cưới 3D

Bảo tàng 3D chạy trên web để trưng bày ảnh cưới biển. Đi lại bằng góc nhìn
thứ nhất (WASD + chuột), click vào ảnh để tới xem gần, hỗ trợ điện thoại
(cần gạt cảm ứng) và kính VR (WebXR).

Dựng bằng **Three.js + Vite**. Dữ liệu hoá hoàn toàn: thêm ảnh / sửa chú thích
không cần đụng tới code 3D.

## Chạy thử

```bash
npm install          # cài thư viện (lần đầu)
npm run dev          # mở http://localhost:5173
```

Bản phát hành:

```bash
npm run build        # xuất ra thư mục dist/  (host ở đâu cũng được)
npm run preview      # xem thử bản build
```

## Thêm ảnh mới

1. Chép ảnh gốc vào thư mục `images/` (JPG/PNG, bao nhiêu cũng được).
2. Chạy lại bộ tối ưu ảnh:

   ```bash
   npm run images     # python scripts/process_images.py
   ```

   Lệnh này tạo bản web (≤1600px) + placeholder trong `public/art/`
   và cập nhật danh sách `src/data/photos.json`.
3. `npm run build` lại là xong. Bố cục bảo tàng tự giãn ra theo số ảnh.

> Hiện trường bày tối đa 37 ảnh (sức chứa tường). Khi vượt số này, mở
> `src/gallery/layout.js` để thêm tường/vách hoặc phòng mới — xem phần
> "Mở rộng" bên dưới.

## Sửa tên / chú thích ảnh

Mở `src/data/photos.json`, điền `title` và `caption` cho từng ảnh:

```json
{ "id": "PMT_0429", "title": "Chân sóng", "caption": "Biển Kỳ Co, 2024", ... }
```

Để trống thì bảng thông tin tự hiển thị "Khoảnh khắc № 03".

## Kiểm tra (verify)

```bash
npm run verify             # kiểm tra logic bố cục (vị trí, va chạm, điểm ngắm)
node scripts/shoot.mjs     # chụp ảnh thật bằng trình duyệt headless -> .verify/
```

`shoot.mjs` cần server đang chạy (`npm run preview`) và đã cài Playwright
(`npm i -D playwright && npx playwright install chromium`).

## Cấu trúc

```
images/                 ảnh gốc (nguồn)
public/art/             ảnh đã tối ưu (web + thumb)  ← sinh tự động
scripts/
  process_images.py     tối ưu ảnh + sinh manifest
  verify.mjs            kiểm tra logic bố cục
  shoot.mjs             chụp ảnh verify bằng headless Chrome
src/
  data/photos.json      danh sách ảnh + tên/chú thích  ← sinh tự động, sửa được
  gallery/
    layout.js           HÌNH HỌC bảo tàng: đặt ảnh, va chạm, điểm ngắm (thuần)
    collision.js        va chạm/giới hạn vùng đi (thuần)
    frames.js           dựng khung ảnh + tải ảnh theo khoảng cách
  museum/
    building.js         sàn/tường/trần/vách + ánh sáng + biển tên
    textures.js         vân tường, sàn, chữ (vẽ bằng canvas)
  controls/
    player.js           đi lại ngôi thứ nhất + glide tới điểm ngắm
    touch.js            điều khiển cảm ứng (điện thoại)
  ui/ui.js              intro, bảng thông tin, nhãn khu, tâm ngắm
  main.js               ráp mọi thứ + vòng lặp render
```

`layout.js` và `collision.js` cố ý KHÔNG import three.js nên kiểm tra được
bằng Node (`npm run verify`).

## Thiết kế

- **Màu**: tường trắng ngà ấm, sàn sa thạch nhạt, điểm nhấn xanh ngọc biển —
  lấy từ chính tông màu ảnh (biển seafoam, trời nhiều mây, cát ấm).
- **Khu (zone)**: Khởi đầu → Khoảnh khắc (vách trung tâm) → Biển cả, hiện tên
  khi bước vào từng vùng.
- **Ảnh**: khung gỗ sẫm + passe-partout trắng kiểu bảo tàng; ảnh hiển thị
  "unlit" nên màu đúng như bản gốc. Tải theo khoảng cách để nhẹ máy.

## Mở rộng sau này (nhiều tầng / phòng)

Kiến trúc hiện là sảnh mở + 1 vách trung tâm. Để lên nhiều phòng/tầng:
thêm "wall segments" và "colliders" trong `src/gallery/layout.js`
(hàm `segments()` và mảng `colliders`), rồi thêm tường tương ứng trong
`src/museum/building.js`. `npm run verify` sẽ bắt lỗi chồng ảnh / điểm ngắm
kẹt tường ngay.

VR hiện ở mức "đứng tại chỗ nhìn quanh". Locomotion trong VR (teleport) là
bước kế tiếp.
