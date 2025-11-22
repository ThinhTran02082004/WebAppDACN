const { paypal, convertVndToUsd } = require('../config/paypal');
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');

/**
 * @desc    Khởi tạo thanh toán PayPal
 * @route   POST /api/payments/paypal/create
 * @access  Private (User)
 */
exports.createPaypalPayment = async (req, res) => {
  try {
    const { appointmentId, amount, billType = 'consultation', prescriptionId } = req.body;
    
    if (!appointmentId || !mongoose.Types.ObjectId.isValid(appointmentId)) {
      return res.status(400).json({
        success: false,
        message: 'ID cuộc hẹn không hợp lệ'
      });
    }
    
    // Tìm thông tin cuộc hẹn
    const appointment = await Appointment.findById(appointmentId)
      .populate('patientId', 'fullName email')
      .populate('doctorId')
      .populate('serviceId', 'name price');
    
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin cuộc hẹn'
      });
    }
    
    // Kiểm tra trạng thái phần thanh toán theo Bill (thanh toán từng phần)
    try {
      const Bill = require('../models/Bill');
      const bill = await Bill.findOne({ appointmentId });
      if (bill) {
        if (bill.overallStatus === 'paid') {
          return res.status(400).json({ success: false, message: 'Cuộc hẹn này đã được thanh toán đủ' });
        }
        if (billType === 'consultation' && bill.consultationBill?.status === 'paid') {
          return res.status(400).json({ success: false, message: 'Khoản phí khám đã được thanh toán' });
        }
        if (billType === 'medication') {
          if (prescriptionId) {
            // Check individual prescription payment status
            const prescriptionPayment = bill.medicationBill?.prescriptionPayments?.find(
              p => (p.prescriptionId?._id?.toString() || p.prescriptionId?.toString()) === prescriptionId
            );
            if (prescriptionPayment?.status === 'paid') {
              return res.status(400).json({ success: false, message: 'Đơn thuốc này đã được thanh toán' });
            }
          } else if (bill.medicationBill?.status === 'paid') {
            return res.status(400).json({ success: false, message: 'Khoản tiền thuốc đã được thanh toán' });
          }
        }
        if (billType === 'hospitalization' && bill.hospitalizationBill?.status === 'paid') {
          return res.status(400).json({ success: false, message: 'Khoản phí nội trú đã được thanh toán' });
        }
      }
    } catch (billCheckError) {
      // Không chặn luồng nếu lỗi kiểm tra bill, chỉ log
      console.error('Bill check error:', billCheckError);
    }
    
    // Chuẩn bị thông tin thanh toán
    const totalAmount = amount || appointment.fee?.totalAmount || 0;
    
    if (totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Số tiền thanh toán không hợp lệ (phải lớn hơn 0)'
      });
    }
    
    // Đổi từ VND sang USD
    const usdAmount = convertVndToUsd(totalAmount);
    
    // Cấu hình PayPal
    const createPaymentJson = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      redirect_urls: {
        return_url: `${process.env.FRONTEND_URL}/payment/paypal/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/paypal/cancel`
      },
      transactions: [{
        item_list: {
          items: [{
            name: `Thanh toán (${billType}) - ${appointment.serviceId?.name || 'Dịch vụ'}`,
            sku: appointmentId.toString(),
            price: usdAmount,
            currency: 'USD',
            quantity: 1
          }]
        },
        amount: {
          currency: 'USD',
          total: usdAmount
        },
        description: `Thanh toán cho lịch hẹn #${appointment.bookingCode || appointmentId.toString()}${prescriptionId ? ` (Đơn thuốc ${prescriptionId.substring(0, 8)})` : ''}`
      }]
    };
    
      // Get or create Bill before creating PayPal payment
      const Bill = require('../models/Bill');
      let bill = await Bill.findOne({ appointmentId });
      if (!bill) {
        bill = await Bill.create({
          appointmentId,
          patientId: appointment.patientId._id || appointment.patientId,
          doctorId: appointment.doctorId._id || appointment.doctorId,
          serviceId: appointment.serviceId._id || appointment.serviceId,
          consultationBill: {
            amount: totalAmount,
            originalAmount: totalAmount,
            discount: 0,
            status: 'pending',
            paymentMethod: 'paypal'
          }
        });
        console.log(`Created Bill for PayPal payment: ${bill._id}`);
      } else {
        // Update consultationBill if billType is consultation
        if (billType === 'consultation' && bill.consultationBill.status !== 'paid') {
          bill.consultationBill.amount = totalAmount;
          bill.consultationBill.originalAmount = totalAmount;
          bill.consultationBill.status = 'pending';
          bill.consultationBill.paymentMethod = 'paypal';
          await bill.save();
        }
      }
      
      // Gọi PayPal API để tạo thanh toán
      paypal.payment.create(createPaymentJson, async (error, paypalPayment) => {
        if (error) {
          return res.status(500).json({
            success: false,
            message: 'Lỗi khi tạo thanh toán PayPal',
            error: error.message || 'PayPal API Error'
          });
        }
        
        // Create pending BillPayment to track the payment
        try {
          const BillPayment = require('../models/BillPayment');
          await BillPayment.create({
            billId: bill._id,
            appointmentId,
            patientId: appointment.patientId._id || appointment.patientId,
            billType: billType,
            amount: totalAmount,
            paymentMethod: 'paypal',
            paymentStatus: 'pending',
            transactionId: paypalPayment.id, // Use PayPal payment ID as transactionId
            paymentDetails: {
              paypalPaymentId: paypalPayment.id,
              billType: billType,
              prescriptionId: prescriptionId || null,
              createdAt: new Date().toISOString()
            }
          });
          console.log(`Created pending BillPayment for PayPal payment ${paypalPayment.id}`);
        } catch (billPaymentError) {
          console.error('Error creating BillPayment for PayPal:', billPaymentError);
          // Don't fail the request, payment can still proceed
        }
        
        // Lấy URL chấp thuận thanh toán và trích xuất token (EC-XXX) cho SDK
        let approvalUrl = '';
        let approvalToken = null;
        for (let i = 0; i < paypalPayment.links.length; i++) {
          if (paypalPayment.links[i].rel === 'approval_url') {
            approvalUrl = paypalPayment.links[i].href;
            // Trích xuất token từ URL: https://www.sandbox.paypal.com/checkoutnow?token=EC-XXXXX
            const tokenMatch = approvalUrl.match(/[?&]token=([^&]+)/);
            if (tokenMatch && tokenMatch[1]) {
              approvalToken = tokenMatch[1];
            }
            break;
          }
        }
      
      // Check if client wants SDK format (from query param or header)
      const useSDK = req.query.useSDK === 'true' || req.headers['x-paypal-sdk'] === 'true';
      
      // Store mapping of order token (EC-XXX) to payment ID (PAY-XXX) for execute
      // Also store prescriptionId if provided
      // Use a simple in-memory cache (in production, use Redis or database)
      if (approvalToken && !global.paypalTokenMapping) {
        global.paypalTokenMapping = new Map();
      }
      if (approvalToken) {
        global.paypalTokenMapping.set(approvalToken, {
          paymentId: paypalPayment.id,
          appointmentId,
          billType,
          prescriptionId: prescriptionId || null
        });
        // Cleanup after 1 hour
        setTimeout(() => {
          if (global.paypalTokenMapping) {
            global.paypalTokenMapping.delete(approvalToken);
          }
        }, 3600000);
      }

      // Also index metadata by paymentId so execute step can recover context
      if (!global.paypalPaymentMetadata) {
        global.paypalPaymentMetadata = new Map();
      }
      global.paypalPaymentMetadata.set(paypalPayment.id, {
        paymentId: paypalPayment.id,
        appointmentId,
        billType,
        prescriptionId: prescriptionId || null,
        approvalToken: approvalToken || null
      });
      setTimeout(() => {
        if (global.paypalPaymentMetadata) {
          global.paypalPaymentMetadata.delete(paypalPayment.id);
        }
      }, 3600000);
      
      // Return order ID (EC-XXX token) for SDK, payment ID and approvalUrl for redirect
      return res.status(200).json({
        success: true,
        data: {
          paymentId: paypalPayment.id,
          orderId: approvalToken || paypalPayment.id, // For PayPal SDK (EC-XXX token)
          approvalUrl: approvalUrl, // For redirect flow
          approvalToken: approvalToken // Explicit token for SDK
        },
        message: 'Khởi tạo thanh toán PayPal thành công'
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xử lý yêu cầu thanh toán',
      error: error.message
    });
  }
};

/**
 * @desc    Execute PayPal payment after user approval
 * @route   POST /api/payments/paypal/execute
 * @access  Private
 */
exports.executePaypalPayment = async (req, res) => {
  try {
    let { paymentId, orderId, PayerID, billType, prescriptionId } = req.body;
    
    // SDK có thể gửi orderId (EC-XXX) thay vì paymentId (PAY-XXX)
    // Cần tìm payment ID từ order ID thông qua mapping
    let actualPaymentId = paymentId;
    
    let mappingData = null;
    if (orderId && orderId.startsWith('EC-')) {
      // Lookup payment ID from mapping
      if (global.paypalTokenMapping && global.paypalTokenMapping.has(orderId)) {
        mappingData = global.paypalTokenMapping.get(orderId);
        if (!actualPaymentId) {
          actualPaymentId = mappingData.paymentId || mappingData;
        }
        console.log(`Mapped order ID ${orderId} -> payment ID ${actualPaymentId}`);
      } else if (!actualPaymentId) {
        // No mapping found, fallback to using orderId directly (likely to fail but logs help)
        console.warn(`No mapping found for order ID: ${orderId}`);
        actualPaymentId = orderId;
      }
    }

    // Fallback: Lookup metadata using paymentId when clients do not send orderId
    if (!mappingData && actualPaymentId && global.paypalPaymentMetadata && global.paypalPaymentMetadata.has(actualPaymentId)) {
      mappingData = global.paypalPaymentMetadata.get(actualPaymentId);
      console.log(`Found metadata for payment ID ${actualPaymentId}`);
    }

    if (mappingData && typeof mappingData === 'object') {
      // Extract prescriptionId from mapping if not provided in body
      if (!prescriptionId && mappingData.prescriptionId) {
        prescriptionId = mappingData.prescriptionId;
      }
      if (!billType && mappingData.billType) {
        billType = mappingData.billType;
      }
    }

    console.log(`Xử lý thanh toán PayPal: ${actualPaymentId} với PayerID: ${PayerID}`);
    
    if (!actualPaymentId || !PayerID) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin thanh toán'
      });
    }
    
    // PayPal REST SDK chỉ chấp nhận payment ID (PAY-XXX), không phải order ID (EC-XXX)
    if (actualPaymentId.startsWith('EC-')) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tìm thấy payment ID từ order ID. Vui lòng tải lại trang thanh toán và thử lại, hoặc khởi tạo thanh toán PayPal mới.'
      });
    }
    
    // Execute the PayPal payment
    const executePaymentJson = {
      payer_id: PayerID
    };
    
    console.log('Gửi yêu cầu xử lý thanh toán đến PayPal');
    
    paypal.payment.execute(actualPaymentId, executePaymentJson, async (error, paypalPayment) => {
      if (error) {
        console.error('PayPal execute payment error:', error);
        
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi xác nhận thanh toán PayPal. Vui lòng thử lại hoặc chọn phương thức khác.',
          error: error.message
        });
      }
      
      console.log(`PayPal kết quả xử lý: ${paypalPayment.state}`);
      
      // Check if payment was completed
      if (paypalPayment.state === 'approved') {
        try {
          // Suy ra appointmentId từ sku trong item list
          const sku = paypalPayment.transactions?.[0]?.item_list?.items?.[0]?.sku;
          const derivedAppointmentId = sku && mongoose.Types.ObjectId.isValid(sku) ? sku : null;
          const appointment = derivedAppointmentId ? await Appointment.findById(derivedAppointmentId) : null;
          
          if (!appointment) {
            console.error(`Không tìm thấy cuộc hẹn từ PayPal sku`);
            return res.status(404).json({
              success: false,
              message: 'Không tìm thấy thông tin cuộc hẹn'
            });
          }
          
          console.log(`Tìm thấy cuộc hẹn: ${appointment._id}, trạng thái hiện tại: ${appointment.status}, thanh toán: ${appointment.paymentStatus}`);
          
          // Cập nhật trạng thái thanh toán
          appointment.paymentStatus = 'completed';
          appointment.paymentMethod = 'paypal';
          
          // Nếu cuộc hẹn đang ở trạng thái pending, pending_payment hoặc rescheduled, tự động chuyển sang confirmed
          if (appointment.status === 'pending' || appointment.status === 'pending_payment' || appointment.status === 'rescheduled') {
            console.log(`Tự động xác nhận cuộc hẹn do đã thanh toán: ${appointment._id}`);
            appointment.status = 'confirmed';
          }
          
          await appointment.save();
          console.log(`Đã cập nhật cuộc hẹn: ${appointment._id}, trạng thái mới: ${appointment.status}, paymentStatus: ${appointment.paymentStatus}`);
          
          // Extract appointment details for the response
          const appointmentDetails = {
            bookingCode: appointment.bookingCode || appointment._id,
            service: appointment.serviceId?.name || 'Dịch vụ khám',
            doctor: (appointment.doctorId && appointment.doctorId.user && appointment.doctorId.user.fullName) ? appointment.doctorId.user.fullName : 'Bác sĩ',
            date: new Date(appointment.appointmentDate).toLocaleDateString('vi-VN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            time: appointment.timeSlot?.startTime 
                   ? `${appointment.timeSlot.startTime} - ${appointment.timeSlot.endTime}`
                   : 'Theo lịch hẹn'
          };
          
          // Update Bill sections for partial payment (based on billType sent from client via description name)
          try {
            const Bill = require('../models/Bill');
            const BillPayment = require('../models/BillPayment');
            let bill = await Bill.findOne({ appointmentId: appointment._id });
            
            // Create Bill if doesn't exist
            if (!bill) {
              bill = await Bill.create({
                appointmentId: appointment._id,
                patientId: appointment.patientId,
                doctorId: appointment.doctorId,
                serviceId: appointment.serviceId,
                consultationBill: {
                  amount: appointment.fee?.totalAmount || 0,
                  originalAmount: (appointment.fee?.consultationFee || 0) + (appointment.fee?.additionalFees || 0),
                  discount: appointment.fee?.discount || 0,
                  status: 'pending',
                  paymentMethod: 'paypal'
                }
              });
              console.log(`Created new Bill for appointment ${appointment._id}`);
            }
            
            if (bill) {
              // Use billType from request body, or infer from item name as fallback
              let finalBillType = billType;
              if (!finalBillType) {
                const itemName = paypalPayment.transactions?.[0]?.item_list?.items?.[0]?.name || '';
                const lower = itemName.toLowerCase();
                finalBillType = 'consultation';
                if (lower.includes('hospitalization') || lower.includes('nội trú')) finalBillType = 'hospitalization';
                else if (lower.includes('medication') || lower.includes('thuốc')) finalBillType = 'medication';
              }

              if (finalBillType === 'consultation' && bill.consultationBill.amount > 0) {
                bill.consultationBill.status = 'paid';
                bill.consultationBill.paymentMethod = 'paypal';
                bill.consultationBill.paymentDate = new Date();
                bill.consultationBill.transactionId = paypalPayment.id;
                bill.consultationBill.paymentDetails = {
                  paypalPaymentId: paypalPayment.id,
                  payerId: PayerID,
                  state: paypalPayment.state,
                  transactions: paypalPayment.transactions
                };
              } else if (finalBillType === 'medication') {
                // If prescriptionId is provided, pay individual prescription
                if (prescriptionId) {
                  const billingController = require('./billingController');
                  try {
                    // Call payPrescription endpoint logic
                    await billingController.payPrescription({
                      body: {
                        prescriptionId,
                        paymentMethod: 'paypal',
                        transactionId: paypalPayment.id,
                        paymentDetails: { ...paypalPayment, payerId: PayerID }
                      },
                      user: req.user
                    }, {
                      json: (data) => {},
                      status: () => ({ json: () => {} })
                    });
                  } catch (prescriptionPayError) {
                    console.error('Error paying prescription via PayPal:', prescriptionPayError);
                    // Fallback to old medication bill payment
                    if (bill.medicationBill.amount > 0) {
                      bill.medicationBill.status = 'paid';
                      bill.medicationBill.paymentMethod = 'paypal';
                      bill.medicationBill.paymentDate = new Date();
                      bill.medicationBill.transactionId = paypalPayment.id;
                    }
                  }
                } else if (bill.medicationBill.amount > 0) {
                  // Legacy: pay entire medication bill
                  bill.medicationBill.status = 'paid';
                  bill.medicationBill.paymentMethod = 'paypal';
                  bill.medicationBill.paymentDate = new Date();
                  bill.medicationBill.transactionId = paypalPayment.id;
                }
              } else if (finalBillType === 'hospitalization' && bill.hospitalizationBill.amount > 0) {
                bill.hospitalizationBill.status = 'paid';
                bill.hospitalizationBill.paymentMethod = 'paypal';
                bill.hospitalizationBill.paymentDate = new Date();
                bill.hospitalizationBill.transactionId = paypalPayment.id;
              }
              await bill.save();

              // Find existing pending BillPayment or create new one
              let billPayment = await BillPayment.findOne({
                billId: bill._id,
                billType: finalBillType,
                transactionId: paypalPayment.id,
                paymentStatus: 'pending'
              });
              
              // Get amount from Bill (already in VND) instead of converting from PayPal USD
              let paymentAmount = 0;
              if (finalBillType === 'consultation') {
                paymentAmount = bill.consultationBill.amount || 0;
              } else if (finalBillType === 'medication') {
                paymentAmount = bill.medicationBill.amount || 0;
              } else if (finalBillType === 'hospitalization') {
                paymentAmount = bill.hospitalizationBill.amount || 0;
              }
              
              if (billPayment) {
                // Update existing pending payment to completed
                billPayment.paymentStatus = 'completed';
                billPayment.amount = paymentAmount || billPayment.amount; // Use amount from Bill (VND)
                billPayment.paymentDetails = {
                  ...billPayment.paymentDetails,
                  ...paypalPayment,
                  payerId: PayerID,
                  executedAt: new Date().toISOString(),
                  usdAmount: paypalPayment.transactions?.[0]?.amount?.total || 0 // Store USD amount for reference
                };
                await billPayment.save();
                console.log(`Updated BillPayment ${billPayment._id} from pending to completed`);
              } else {
                // Check if completed payment already exists (avoid duplicate)
                const existingCompleted = await BillPayment.findOne({
                  billId: bill._id,
                  billType: finalBillType,
                  transactionId: paypalPayment.id,
                  paymentStatus: 'completed'
                });
                
                if (!existingCompleted) {
                  await BillPayment.create({
                    paymentNumber: undefined,
                    billId: bill._id,
                    appointmentId: bill.appointmentId,
                    patientId: bill.patientId,
                    billType: finalBillType,
                    amount: paymentAmount, // Use amount from Bill (already in VND)
                    paymentMethod: 'paypal',
                    paymentStatus: 'completed',
                    transactionId: paypalPayment.id,
                    paymentDetails: {
                      ...paypalPayment,
                      payerId: PayerID,
                      executedAt: new Date().toISOString(),
                      usdAmount: paypalPayment.transactions?.[0]?.amount?.total || 0 // Store USD amount for reference
                    }
                  });
                  console.log(`Created BillPayment for PayPal payment ${paypalPayment.id}`);
                } else {
                  console.log(`BillPayment already exists for PayPal payment ${paypalPayment.id}`);
                }
              }
            }
          } catch (e) {
            console.error('Failed to update Bill from PayPal execute:', e);
          }

          // Clean cached mapping entries once payment is finalized
          if (orderId && global.paypalTokenMapping) {
            global.paypalTokenMapping.delete(orderId);
          }
          if (actualPaymentId && global.paypalPaymentMetadata) {
            global.paypalPaymentMetadata.delete(actualPaymentId);
          }


          return res.status(200).json({
            success: true,
            data: {
              paymentId: paypalPayment.id,
              status: 'approved',
              transactionDetails: paypalPayment.transactions[0],
              appointmentDetails
            },
            message: 'Thanh toán PayPal thành công'
          });
        } catch (dbError) {
          console.error('Database error:', dbError);
          return res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật dữ liệu',
            error: dbError.message
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: 'Thanh toán PayPal không thành công',
          status: paypalPayment.state
        });
      }
    });
  } catch (error) {
    console.error('Execute PayPal payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xác nhận thanh toán PayPal',
      error: error.message
    });
  }
};

/**
 * @desc    Get PayPal payment details
 * @route   GET /api/payments/paypal/:paymentId
 * @access  Private
 */
exports.getPaypalPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    paypal.payment.get(paymentId, (error, payment) => {
      if (error) {
        console.error('PayPal get payment error:', error);
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi lấy thông tin thanh toán PayPal',
          error: error.message
        });
      }
      
      res.status(200).json({
        success: true,
        data: payment,
        message: 'Lấy thông tin thanh toán PayPal thành công'
      });
    });
  } catch (error) {
    console.error('Get PayPal payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin thanh toán PayPal',
      error: error.message
    });
  }
};

/**
 * @desc    Refund a PayPal payment
 * @route   POST /api/payments/paypal/refund
 * @access  Private (Admin only)
 */
exports.refundPaypalPayment = async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'ID thanh toán là bắt buộc'
      });
    }
    
    // Find the BillPayment in our database
    const BillPayment = require('../models/BillPayment');
    const payment = await BillPayment.findById(paymentId).populate('appointmentId billId');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin thanh toán'
      });
    }
    
    if (payment.paymentMethod !== 'paypal' || payment.paymentStatus !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hoàn tiền cho thanh toán PayPal đã hoàn thành'
      });
    }
    
    // Get the PayPal sale ID
    paypal.payment.get(payment.transactionId, (error, paypalPayment) => {
      if (error) {
        console.error('PayPal get payment error:', error);
        return res.status(500).json({
          success: false,
          message: 'Lỗi khi lấy thông tin thanh toán PayPal',
          error: error.message
        });
      }
      
      // Get the sale ID from the transactions
      const saleId = paypalPayment.transactions[0].related_resources[0].sale.id;
      
      // Prepare refund data
      const refundAmount = amount || payment.amount || 0;
      const refundData = {
        amount: {
          currency: 'USD',
          total: refundAmount.toFixed(2)
        },
        description: reason || 'Hoàn tiền cho khách hàng'
      };
      
      // Process the refund
      paypal.sale.refund(saleId, refundData, async (refundError, refundDetails) => {
        if (refundError) {
          console.error('PayPal refund error:', refundError);
          return res.status(500).json({
            success: false,
            message: 'Lỗi khi hoàn tiền PayPal',
            error: refundError.message
          });
        }
        
        // Update payment status to REFUNDED
        payment.paymentStatus = 'failed'; // Use failed status for refunded
        await payment.save();
        
        // Update bill consultationBill status
        const Bill = require('../models/Bill');
        if (payment.billId) {
          const bill = await Bill.findById(payment.billId);
          if (bill && payment.billType === 'consultation') {
            bill.consultationBill.status = 'refunded';
            bill.consultationBill.refundAmount = amount || payment.amount;
            bill.consultationBill.refundReason = reason || 'Hoàn tiền cho khách hàng';
            bill.consultationBill.refundDate = new Date();
            await bill.save();
          }
        }
        
        // Update appointment status
        await Appointment.findByIdAndUpdate(
          payment.appointmentId._id || payment.appointmentId,
          { 
            $set: { 
              paymentStatus: 'refunded',
              status: 'cancelled',
              cancellationReason: reason || 'Hoàn tiền thanh toán',
              cancelledBy: 'admin'
            } 
          }
        );
        
        res.status(200).json({
          success: true,
          data: {
            refundId: refundDetails.id,
            status: refundDetails.state
          },
          message: 'Hoàn tiền PayPal thành công'
        });
      });
    });
  } catch (error) {
    console.error('Refund PayPal payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi hoàn tiền PayPal',
      error: error.message
    });
  }
}; 
