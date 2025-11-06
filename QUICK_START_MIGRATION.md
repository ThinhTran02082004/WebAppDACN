# Quick Start: Payment → Bill Migration

## 🚀 Chạy Migration (3 bước)

### Bước 1: Backup Database
```bash
mongodump --uri="mongodb://localhost:27017/hospital" --out=./backup_before_migration
```

### Bước 2: Chạy Migration
```bash
cd server
node scripts/migratePaymentToBill.js
```

### Bước 3: Test Migration
```bash
node scripts/testMigration.js
```

## ✅ Checklist nhanh

Sau khi migration, test các chức năng sau:

- [ ] Tạo appointment mới → Bill được tạo
- [ ] Thanh toán cash → BillPayment được tạo
- [ ] Thanh toán PayPal → Hoạt động
- [ ] Thanh toán MoMo → Hoạt động
- [ ] Payment history → Hiển thị đúng
- [ ] Admin payments page → Hiển thị đúng
- [ ] Statistics → Hiển thị đúng

## 📝 Lưu ý về Payment.js

**CHƯA xóa** Payment.js cho đến khi:
1. ✅ Migration script chạy thành công
2. ✅ Test script pass 100%
3. ✅ Test manual tất cả chức năng
4. ✅ Verify data integrity

**Sau đó có thể:**
- Xóa Payment.js (nếu không cần seed scripts)
- Hoặc giữ lại cho seed scripts
- Hoặc rename thành Payment.js.backup

## 🔍 Verify nhanh

```javascript
// MongoDB shell
// 1. Check số lượng
db.payments.countDocuments({})  // Số cũ
db.bills.countDocuments({})     // Số mới (nên >= số cũ)
db.billpayments.countDocuments({}) // Payment history

// 2. Check một Bill
db.bills.findOne({ appointmentId: ObjectId("...") })
// Verify consultationBill có: amount, originalAmount, discount, couponId, status
```

## 📚 Tài liệu chi tiết

- `server/scripts/TEST_MIGRATION_GUIDE.md` - Hướng dẫn test chi tiết
- `MIGRATION_SUMMARY.md` - Tóm tắt toàn bộ migration
- `server/scripts/migratePaymentToBill.js` - Migration script
- `server/scripts/testMigration.js` - Test script

## 🆘 Nếu có lỗi

1. **Restore database:**
   ```bash
   mongorestore --uri="mongodb://localhost:27017/hospital" ./backup_before_migration
   ```

2. **Check logs:**
   - `server/logs/errors.log`
   - Console output từ migration script

3. **Verify:**
   - Payment.js vẫn còn trong project
   - Database connection OK
   - MongoDB version compatible

