# 🌿 Embedded Backend

Backend của hệ thống **nhúng** sử dụng **Firebase Functions + Express + Swagger UI**
để quản lý dữ liệu cảm biến và giám sát hệ thống nhúng.

---

## 📘 API Documentation

> Swagger UI cho các API backend:

🔗 **[http://127.0.0.1:5001/btl-he-thong-nhung/us-central1/app/api-docs/](http://127.0.0.1:5001/btl-he-thong-nhung/us-central1/app/api-docs/)**

---

## ⚙️ Installation & Setup

### 1. Clone project

### 2. Thêm firebase SDK
Thêm file serviceAccountKey.json vào đường dẫn: /firebase/serviceAccountKey.json


### 3. Tải các module
```bash
npm install 
```

### 4. Chạy dự án
```bash
npm run start
```

---

## 🛠️ Tools

### Insert Sample Data (`insert-temp.js`)

Script để chèn dữ liệu mẫu vào các collection Firestore cho mục đích testing và demo.

#### Cách sử dụng:
```bash
node insert-temp.js
```

#### Chức năng:
- **Xóa dữ liệu cũ**: Xóa toàn bộ dữ liệu trong các collection `device1`, `device2`, `device3`, `device4`, và `history_sensor_data`.
- **Chèn dữ liệu mẫu**: Tạo 50 bản ghi mẫu với timestamp cách nhau 10-15 phút, từ thời điểm hiện tại về quá khứ.
- **Dữ liệu đa dạng**: Mỗi collection nhận dữ liệu hơi khác nhau (biến động nhỏ) để mô phỏng các thiết bị khác nhau.
- **Giá trị thực tế**: Các thông số nằm trong khoảng điều kiện bình thường (nhiệt độ 20-30°C, độ ẩm 60-90%, độ ẩm đất 30-60%, mức nước 10-30cm, lượng mưa 0-20mm).

#### Cấu trúc dữ liệu:
```json
{
  "temperature": 27.5,
  "humidity": 75.2,
  "soilMoisture": 42.8,
  "waterLevel": 18.3,
  "rainfall": 3.1,
  "dateTime": "2025-11-29T08:00:00.000Z",
  "timestamp": 1732867200000
}
```

#### Lưu ý:
- Script sẽ chạy tự động xóa dữ liệu cũ trước khi chèn mới.
- Dữ liệu được tạo với sự thay đổi dần dần để mô phỏng điều kiện thực tế.