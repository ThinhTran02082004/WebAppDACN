# Hướng dẫn Test Migration: Payment → Bill

## Các bước thực hiện

### Bước 1: Backup Database
```bash
# Windows PowerShell
mongodump --uri="mongodb://localhost:27017/hospital" --out=./backup_before_migration

# Hoặc nếu dùng MongoDB Atlas
mongodump --uri="mongodb+srv://username:password@cluster.mongodb.net/hospital" --out=./backup_before_migration
```

### Bước 2: Chạy Migration Script
```bash
cd server
node scripts/migratePaymentToBill.js
```

**Kết quả mong đợi:**
```
Connected to MongoDB
Found X payments to migrate
✓ Migrated payment ... -> bill ...

=== Migration Summary ===
Total payments: X
Migrated: X
Skipped: 0
Errors: 0
```

### Bước 3: Chạy Test Script
```bash
node scripts/testMigration.js
```

**Kết quả mong đợi:**
```
✅ Connected to MongoDB

📋 Test 1: Checking Payment → Bill migration...
   Found X Payment records
   Found Y Bill records
   ✅ X/X Payments have corresponding Bills

📋 Test 2: Checking BillPayment records...
   Found Z BillPayment records
   ✅ BillPayment records look good

📋 Test 3: Verifying Bill consultationBill structure...
   ✅ Bill structure is valid

📋 Test 4: Verifying appointment references...
   ✅ Appointment references are valid

📋 Test 5: Checking data consistency...
   ✅ Data consistency looks good

📊 TEST SUMMARY
✅ Passed: 5
❌ Failed: 0
📈 Success Rate: 100.00%
✅ No errors found! Migration looks successful.
```

### Bước 4: Test Manual

#### Test 1: Tạo Appointment mới với Payment
1. Đăng nhập vào hệ thống
2. Tạo appointment mới với payment method = cash
3. Verify:
   - Bill được tạo tự động
   - consultationBill có đầy đủ thông tin
   - BillPayment record được tạo

#### Test 2: Thanh toán PayPal
1. Tạo appointment với payment method = paypal
2. Complete PayPal payment flow
3. Verify:
   - Bill.consultationBill.status = 'paid'
   - BillPayment record có paymentStatus = 'completed'
   - Appointment.paymentStatus = 'completed'

#### Test 3: Thanh toán MoMo
1. Tạo appointment với payment method = momo
2. Complete MoMo payment flow
3. Verify tương tự PayPal

#### Test 4: Payment History
1. Vào `/payment-history` (user)
2. Verify:
   - Hiển thị đúng các payments
   - Filter theo billType hoạt động
   - Pagination hoạt động

#### Test 5: Admin Payments Page
1. Vào `/admin/payments` (admin)
2. Verify:
   - Hiển thị đúng payments
   - Search và filter hoạt động
   - Update payment status hoạt động

#### Test 6: Bill với Coupon/Discount
1. Tạo appointment với coupon code
2. Verify:
   - Bill.consultationBill.couponId được set
   - Bill.consultationBill.discount được tính đúng
   - Bill.consultationBill.originalAmount và amount đúng

#### Test 7: Refund
1. Refund một payment (nếu có chức năng)
2. Verify:
   - Bill.consultationBill.status = 'refunded'
   - refundAmount, refundReason, refundDate được set

### Bước 5: Verify Data Integrity

#### Check Database Collections
```javascript
// MongoDB shell hoặc MongoDB Compass
// 1. Check Payments collection
db.payments.countDocuments({})
// Nếu có data, các records này đã được migrate

// 2. Check Bills collection
db.bills.countDocuments({})
// Số lượng nên >= số lượng Payments đã migrate

// 3. Check BillPayments collection
db.billpayments.countDocuments({})
// Số lượng nên >= số lượng completed Payments

// 4. Verify một Bill cụ thể
db.bills.findOne({ appointmentId: ObjectId("...") })
// Check consultationBill có đầy đủ fields:
// - amount, originalAmount, discount, couponId
// - status, paymentMethod, paymentDate, transactionId
```

## Rollback Plan (nếu cần)

Nếu migration có vấn đề:

```bash
# 1. Restore database
mongorestore --uri="mongodb://localhost:27017/hospital" ./backup_before_migration

# 2. Revert code changes (git)
git checkout HEAD -- server/models/Payment.js
git checkout HEAD -- server/controllers/
# etc.

# 3. Restart server
```

## Troubleshooting

### Lỗi: "Cannot find module 'Payment'"
- **Nguyên nhân**: Migration script chưa chạy hoặc Payment model đã bị xóa
- **Giải pháp**: Giữ Payment.js cho đến khi migration xong

### Lỗi: "Duplicate key error" khi tạo Bill
- **Nguyên nhân**: Bill đã tồn tại cho appointment đó
- **Giải pháp**: Migration script sẽ update existing bill, không tạo duplicate

### Lỗi: Payment history không hiển thị
- **Nguyên nhân**: API endpoint hoặc data format không đúng
- **Giải pháp**: Check browser console và network tab, verify API response

### Lỗi: Statistics không đúng
- **Nguyên nhân**: StatisticsController vẫn query từ Payment
- **Giải pháp**: Đã update statisticsController để dùng BillPayment

## Checklist sau Migration

- [ ] Migration script chạy thành công
- [ ] Test script pass 100%
- [ ] Tạo appointment mới hoạt động
- [ ] Thanh toán cash hoạt động
- [ ] Thanh toán PayPal hoạt động
- [ ] Thanh toán MoMo hoạt động
- [ ] Payment history hiển thị đúng
- [ ] Admin payments page hoạt động
- [ ] Coupon/discount hoạt động
- [ ] Statistics hiển thị đúng
- [ ] No console errors
- [ ] Database collections không có orphaned records

## Sau khi verify thành công

1. **Backup lại database sau migration**
2. **Có thể xóa Payment.js** (nếu không cần seed scripts)
3. **Update documentation**
4. **Commit changes**

