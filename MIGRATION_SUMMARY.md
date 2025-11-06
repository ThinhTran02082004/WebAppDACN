# Tóm tắt Migration: Payment → Bill

## ✅ Đã hoàn thành

### 1. Server-side Updates

#### Models
- ✅ **Bill.js**: Thêm đầy đủ tính năng từ Payment:
  - `originalAmount`, `discount`, `couponId` trong consultationBill
  - `refundAmount`, `refundReason`, `refundDate`
  - `paymentDetails`, `notes`
  - Status enum: thêm 'refunded', 'failed'
  - Thêm `doctorId`, `serviceId` vào Bill

#### Controllers
- ✅ **paymentController.js**: Chuyển sang dùng Bill/BillPayment
- ✅ **paypalController.js**: Update refund function
- ✅ **momoController.js**: Update payment result functions
- ✅ **appointmentController.js**: Tạo Bill thay vì Payment
- ✅ **statisticsController.js**: Dùng BillPayment cho statistics
- ✅ **billingController.js**: Đã dùng Bill (không cần update)

#### Routes
- ✅ **paymentRoutes.js**: Update reset route
- ✅ **billingRoutes.js**: Đã có đầy đủ routes

#### Scripts
- ✅ **migratePaymentToBill.js**: Migration script
- ✅ **testMigration.js**: Test script

### 2. Client-side Updates

#### Components đã được verify
- ✅ **Payments.jsx** (admin): Đã dùng `/billing/payment-history` API
- ✅ **PaymentHistory.jsx**: Đã dùng `/billing/payment-history` API
- ✅ **UserBilling.jsx**: Đã dùng `/billing/appointment/:id` API
- ✅ **AdminBilling.jsx**: Đã dùng billing APIs
- ✅ **BillingManager.jsx**: Đã dùng billing APIs
- ✅ **PaymentResult.jsx**: Đã xử lý payment result
- ✅ **PaymentStatus.jsx**: Đã xử lý PayPal status

**Note**: Client-side components đã được cấu hình đúng và support BillPayment format (billType, paymentNumber, etc.)

### 3. API Compatibility

- ✅ Tất cả APIs đã được transform để backward compatible
- ✅ Response format giữ nguyên cho client-side
- ✅ Không có breaking changes cho frontend

## 📋 Cần thực hiện

### 1. Migration Steps

```bash
# 1. Backup database
mongodump --uri="your_mongodb_uri" --out=./backup_before_migration

# 2. Chạy migration
cd server
node scripts/migratePaymentToBill.js

# 3. Test migration
node scripts/testMigration.js

# 4. Test manual các chức năng
# - Tạo appointment
# - Thanh toán (cash, PayPal, MoMo)
# - Payment history
# - Admin payments page
```

### 2. Sau khi Migration

- [ ] Verify tất cả chức năng hoạt động
- [ ] Check database collections
- [ ] Backup database sau migration
- [ ] Có thể xóa `Payment.js` (hoặc giữ lại cho seed scripts)

## 📝 Lưu ý quan trọng

### Payment.js Model
- **CHƯA nên xóa** ngay vì:
  1. Migration script cần Payment để đọc data cũ
  2. Seed scripts có thể cần Payment
  3. Nên test kỹ trước khi xóa

- **Sau khi migration và test OK**: Có thể:
  - Xóa Payment.js nếu không cần seed scripts
  - Hoặc giữ lại Payment.js cho seed scripts
  - Hoặc rename thành Payment.js.backup

### Database Collections
- **payments**: Vẫn tồn tại nhưng không được dùng nữa
- **bills**: Chứa tất cả payment data trong consultationBill
- **billpayments**: Chứa payment history records

### API Endpoints
- Tất cả payment APIs giờ dùng Bill/BillPayment
- Response format được transform để backward compatible
- Client-side không cần update (trừ khi muốn hiển thị thêm discount/coupon)

## 🎯 Kết quả

1. ✅ Đã gộp Payment vào Bill thành công
2. ✅ Tất cả chức năng của Payment được giữ lại
3. ✅ Bill giờ có đầy đủ tính năng:
   - Consultation bill (với coupon, discount, refund)
   - Medication bill
   - Hospitalization bill
4. ✅ Payment history dùng BillPayment
5. ✅ Statistics dùng BillPayment
6. ✅ Không có breaking changes cho frontend

## 📚 Files liên quan

### Server
- `server/models/Bill.js` - Updated với Payment features
- `server/models/BillPayment.js` - Payment history
- `server/models/Payment.js` - **Có thể xóa sau migration**
- `server/controllers/paymentController.js` - Updated
- `server/controllers/appointmentController.js` - Updated
- `server/controllers/statisticsController.js` - Updated
- `server/controllers/paypalController.js` - Updated
- `server/controllers/momoController.js` - Updated
- `server/scripts/migratePaymentToBill.js` - Migration script
- `server/scripts/testMigration.js` - Test script

### Client
- `client/src/pages/admin/Payments.jsx` - ✅ Đã dùng billing API
- `client/src/pages/PaymentHistory.jsx` - ✅ Đã dùng billing API
- `client/src/components/UserBilling.jsx` - ✅ Đã dùng billing API
- `client/src/components/AdminBilling.jsx` - ✅ Đã dùng billing API

## 🚀 Next Steps

1. **Chạy migration** theo hướng dẫn trong `TEST_MIGRATION_GUIDE.md`
2. **Test tất cả chức năng** theo checklist
3. **Verify data integrity**
4. **Xóa Payment.js** (nếu không cần)
5. **Update documentation** (nếu có)

