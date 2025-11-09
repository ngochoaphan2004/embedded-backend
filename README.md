# 🌿 SmartFarm Backend

Backend của hệ thống **SmartFarm** sử dụng **Firebase Functions + Express + Swagger UI**  
để quản lý dữ liệu cảm biến và giám sát nông trại thông minh.

---

## 📘 API Documentation

> Swagger UI cho các API backend:

🔗 **[http://127.0.0.1:5001/btl-he-thong-nhung/us-central1/app/api-docs/](http://127.0.0.1:5001/btl-he-thong-nhung/us-central1/app/api-docs/)**

---

## ⚙️ Installation & Setup

### 1. Clone project
```bash
git clone https://github.com/ngochoaphan2004/251-embedded-backend.git
cd 251-embedded-backend
```

### 2. Tạo file môi trường
Tạo file .env tại thư mục gốc (root folder):

```bash
SECRET_KEY=your_secret_key
```

### 3. Thêm firebase SDK
Thêm file serviceAccountKey.json vào đường dẫn: /functions/config/serviceAccountKey.json


### 4. Tải các module
```bash
npm install npm 
```

### 5. Chạy dự án
```bash
run start
```