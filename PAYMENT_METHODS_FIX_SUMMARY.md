# Tóm tắt sửa lỗi Payment Methods: MoMo, PayPal, Cash

## ✅ Đã sửa

### 1. MoMo Payment

#### Vấn đề:
- Khi tạo MoMo payment, không tạo BillPayment record
- Khi callback về, không tìm thấy payment với orderId → 404 error
- Payment thành công nhưng không cập nhật Bill và Appointment

#### Giải pháp:
- ✅ **createMomoPayment**: Tạo Bill và BillPayment với status `pending` ngay khi tạo payment request
- ✅ **momoPaymentResult**: Tìm BillPayment bằng nhiều cách (paymentDetails.orderId, transactionId)
- ✅ **momoIPN**: Update existing pending BillPayment thay vì tạo mới (tránh duplicate)
- ✅ **Appointment status**: Xử lý cả `pending` và `pending_payment`

### 2. PayPal Payment

#### Vấn đề:
- Khi tạo PayPal payment, không tạo BillPayment record
- Khi execute, có thể tạo duplicate BillPayment
- Amount conversion không đúng (USD vs VND)

#### Giải pháp:
- ✅ **createPaypalPayment**: Tạo Bill và BillPayment với status `pending` ngay khi tạo payment request
- ✅ **executePaypalPayment**: 
  - Tìm và update existing pending BillPayment thay vì tạo mới
  - Lưu amount từ Bill (VND) thay vì convert từ PayPal USD
  - Tạo Bill nếu chưa tồn tại
- ✅ **Appointment status**: Xử lý cả `pending` và `pending_payment`
- ✅ **Amount**: Lưu đúng amount VND từ Bill, lưu USD amount trong paymentDetails để reference

### 3. Cash Payment

#### Vấn đề:
- BillPayment được tạo nhưng thiếu transactionId và notes

#### Giải pháp:
- ✅ **appointmentController**: Tạo BillPayment với:
  - `transactionId`: `CASH-${Date.now()}`
  - `notes`: 'Thanh toán tiền mặt khi đặt lịch'
  - `paymentStatus`: 'completed' (ngay lập tức)

## 📋 Flow hoạt động

### MoMo Payment Flow:
1. User tạo appointment với paymentMethod = 'momo'
2. **createMomoPayment**:
   - Tạo/update Bill với consultationBill.status = 'pending'
   - Tạo BillPayment với status = 'pending', lưu orderId trong paymentDetails
3. User thanh toán trên MoMo
4. MoMo callback về **momoPaymentResult**:
   - Tìm BillPayment bằng orderId
   - Update BillPayment.status = 'completed'
   - Update Bill.consultationBill.status = 'paid'
   - Update Appointment.paymentStatus = 'completed', status = 'confirmed'
5. MoMo IPN (nếu có):
   - Tìm existing pending BillPayment
   - Update thành completed (tránh duplicate)

### PayPal Payment Flow:
1. User tạo appointment với paymentMethod = 'paypal'
2. **createPaypalPayment**:
   - Tạo/update Bill với consultationBill.status = 'pending'
   - Tạo BillPayment với status = 'pending', lưu paypalPaymentId trong transactionId
3. User thanh toán trên PayPal
4. PayPal redirect về **executePaypalPayment**:
   - Tìm BillPayment bằng transactionId (paypalPaymentId)
   - Update BillPayment.status = 'completed'
   - Update Bill.consultationBill.status = 'paid'
   - Update Appointment.paymentStatus = 'completed', status = 'confirmed'

### Cash Payment Flow:
1. User tạo appointment với paymentMethod = 'cash'
2. **createAppointment**:
   - Tạo Bill với consultationBill.status = 'paid'
   - Tạo BillPayment với status = 'completed' ngay lập tức
   - Update Appointment.paymentStatus = 'completed', status = 'completed'

## 🔍 Key Changes

### momoController.js:
- `createMomoPayment`: Tạo Bill và BillPayment với pending status
- `momoPaymentResult`: Tìm BillPayment bằng nhiều cách, update Bill và Appointment
- `momoIPN`: Update existing BillPayment thay vì tạo mới

### paypalController.js:
- `createPaypalPayment`: Tạo Bill và BillPayment với pending status
- `executePaypalPayment`: Tìm và update pending BillPayment, lưu đúng amount VND
- Create Bill nếu chưa tồn tại

### appointmentController.js:
- `createAppointment`: Tạo BillPayment với transactionId và notes cho cash payment

## ✅ Testing Checklist

### MoMo:
- [ ] Tạo appointment với MoMo → BillPayment được tạo với status 'pending'
- [ ] Thanh toán MoMo thành công → BillPayment được update thành 'completed'
- [ ] Bill.consultationBill.status = 'paid'
- [ ] Appointment.paymentStatus = 'completed', status = 'confirmed'
- [ ] Payment history hiển thị đúng

### PayPal:
- [ ] Tạo appointment với PayPal → BillPayment được tạo với status 'pending'
- [ ] Thanh toán PayPal thành công → BillPayment được update thành 'completed'
- [ ] Bill.consultationBill.status = 'paid'
- [ ] Appointment.paymentStatus = 'completed', status = 'confirmed'
- [ ] Payment history hiển thị đúng
- [ ] Amount được lưu đúng (VND)

### Cash:
- [ ] Tạo appointment với cash → BillPayment được tạo với status 'completed'
- [ ] Bill.consultationBill.status = 'paid'
- [ ] Appointment.paymentStatus = 'completed', status = 'completed'
- [ ] BillPayment có transactionId và notes

## 📝 Notes

- Tất cả payment methods đều tạo BillPayment records để track payment history
- Pending payments được tạo khi tạo payment request (MoMo, PayPal)
- Completed payments được tạo ngay khi cash payment
- Tránh duplicate BillPayment bằng cách tìm existing pending payment trước khi tạo mới
- Amount được lưu đúng currency (VND) từ Bill, không convert từ PayPal/MoMo response

