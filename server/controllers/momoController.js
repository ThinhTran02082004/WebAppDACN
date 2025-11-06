const crypto = require('crypto');
const https = require('https');
// Payment model removed from flow; rely on Bill/BillPayment
const Appointment = require('../models/Appointment');
const mongoose = require('mongoose');

// MoMo API configuration
const momoConfig = {
  // Use environment variables in production
  accessKey: process.env.MOMO_ACCESS_KEY || 'F8BBA842ECF85',
  secretKey: process.env.MOMO_SECRET_KEY || 'K951B6PE1waDMi640xX08PD3vg6EkVlz',
  partnerCode: process.env.MOMO_PARTNER_CODE || 'MOMO',
  endpoint: process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create',
  redirectUrl: process.env.MOMO_REDIRECT_URL || 'http://localhost:3000/payment/result',
  ipnUrl: process.env.MOMO_IPN_URL || 'http://localhost:5000/api/payments/momo/ipn',
};

/**
 * Create MoMo payment request
 * @route POST /api/payments/momo/create
 * @access Private
 */
exports.createMomoPayment = async (req, res) => {
  try {
    console.log('MoMo payment request received:', req.body);
    
    const { appointmentId, amount, billType = 'consultation', prescriptionId, orderInfo = 'Thanh toán dịch vụ khám bệnh' } = req.body;

    if (!appointmentId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin thanh toán cần thiết'
      });
    }

    // Find appointment to verify it exists
    console.log('Finding appointment with ID:', appointmentId);
    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      console.error('Appointment not found:', appointmentId);
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }
    
    console.log('Appointment found:', {
      id: appointment._id,
      status: appointment.status
    });
    
    // Safely access related IDs with proper error handling
    let doctorId, serviceId, userId;
    
    try {
      // Handle potential different data structures
      doctorId = appointment.doctorId;
      serviceId = appointment.serviceId;
      userId = req.user._id;
      
      // Log the actual data structure for debugging
      console.log('Data structure check:', {
        appointmentData: {
          doctorId: appointment.doctorId,
          serviceId: appointment.serviceId,
          doctorIdType: typeof appointment.doctorId
        },
        userId: userId
      });
      
      // Convert to string if it's an object with _id
      if (doctorId && typeof doctorId === 'object' && doctorId._id) {
        doctorId = doctorId._id;
      }
      
      if (serviceId && typeof serviceId === 'object' && serviceId._id) {
        serviceId = serviceId._id;
      }
      
      // Verify IDs exist
      if (!doctorId || !serviceId || !userId) {
        console.error('Missing required IDs:', { doctorId, serviceId, userId });
        throw new Error('Thiếu thông tin bắt buộc (doctorId, serviceId hoặc userId)');
      }
    } catch (error) {
      console.error('Error processing appointment data:', error);
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu lịch hẹn không hợp lệ',
        error: error.message
      });
    }

    // Generate unique order ID
    const orderId = `HOSWEB${Date.now()}`;
    const requestId = orderId;

    // Create request body - use dynamic URLs or fallback to config
    const redirectUrl = req.body.redirectUrl || momoConfig.redirectUrl;
    const ipnUrl = momoConfig.ipnUrl;
    
    console.log('Using URLs:', { redirectUrl, ipnUrl });
    
    // Generate raw signature
    const extraDataObj = { appointmentId, billType };
    if (prescriptionId) {
      extraDataObj.prescriptionId = prescriptionId;
    }
    const extraDataB64 = Buffer.from(JSON.stringify(extraDataObj)).toString('base64');
    const rawSignature = `accessKey=${momoConfig.accessKey}&amount=${amount}&extraData=${extraDataB64}&ipnUrl=${ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${momoConfig.partnerCode}&redirectUrl=${redirectUrl}&requestId=${requestId}&requestType=payWithMethod`;
    
    console.log('Raw signature:', rawSignature);
    
    // Create HMAC SHA256 signature
    const signature = crypto.createHmac('sha256', momoConfig.secretKey)
      .update(rawSignature)
      .digest('hex');
      
    console.log('Generated signature:', signature);

    // Do not persist temporary Payment; rely on IPN to update Bill/BillPayment

    // Prepare request body
    const requestBody = JSON.stringify({
      partnerCode: momoConfig.partnerCode,
      partnerName: "Hospital Web",
      storeId: "HOSWEB",
      requestId: requestId,
      amount: parseInt(amount), // Ensure amount is an integer
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: redirectUrl,
      ipnUrl: ipnUrl,
      lang: "vi",
      requestType: "payWithMethod",
      autoCapture: true,
      extraData: extraDataB64,
      orderGroupId: '',
      signature: signature
    });
    
    console.log('MoMo request payload (sanitized):', {
      ...JSON.parse(requestBody),
      signature: '***' // Hide signature in logs
    });

    // Make request to MoMo API
    const options = {
      hostname: 'test-payment.momo.vn',
      port: 443,
      path: '/v2/gateway/api/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    // Create promise for HTTP request
    try {
      const momoResponse = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              console.log('MoMo API response:', jsonData);
              resolve(jsonData);
            } catch (error) {
              console.error('Error parsing MoMo response:', error, data);
              reject(error);
            }
          });
        });
        
        req.on('error', (error) => {
          console.error('HTTPS request error:', error);
          reject(error);
        });
        
        req.write(requestBody);
        req.end();
      });

      // Check MoMo response
      if (momoResponse.resultCode === 0) {
        // Create BillPayment record with pending status to track the payment
        try {
          const Bill = require('../models/Bill');
          const BillPayment = require('../models/BillPayment');
          
          // Get or create Bill
          let bill = await Bill.findOne({ appointmentId });
          if (!bill) {
            bill = await Bill.create({
              appointmentId,
              patientId: userId,
              doctorId,
              serviceId,
              consultationBill: {
                amount: amount,
                originalAmount: amount,
                status: 'pending',
                paymentMethod: 'momo'
              }
            });
          } else {
            // Update consultationBill if billType is consultation
            if (billType === 'consultation') {
              if (bill.consultationBill.status !== 'paid') {
                bill.consultationBill.amount = amount;
                bill.consultationBill.originalAmount = amount;
                bill.consultationBill.status = 'pending';
                bill.consultationBill.paymentMethod = 'momo';
              }
            }
            if (!bill.doctorId) bill.doctorId = doctorId;
            if (!bill.serviceId) bill.serviceId = serviceId;
            await bill.save();
          }
          
          // Create BillPayment record with pending status
          await BillPayment.create({
            billId: bill._id,
            appointmentId,
            patientId: userId,
            billType: billType,
            amount: amount,
            paymentMethod: 'momo',
            paymentStatus: 'pending',
            transactionId: orderId, // Use orderId as transactionId temporarily
            paymentDetails: {
              orderId: orderId,
              requestId: requestId,
              extraData: extraDataB64,
              momoResponse: momoResponse
            }
          });
          
          console.log(`Created pending BillPayment for orderId: ${orderId}`);
        } catch (billError) {
          console.error('Error creating BillPayment for MoMo payment:', billError);
          // Don't fail the request, payment can still proceed
        }
        
        // Return success with payment URL
        return res.status(200).json({
          success: true,
          message: 'Tạo thanh toán MoMo thành công',
          orderId: orderId,
          payUrl: momoResponse.payUrl
        });
      } else {
        // Handle failed MoMo payment creation
        console.error('MoMo API returned error:', momoResponse);
        return res.status(400).json({
          success: false,
          message: `Không thể tạo thanh toán MoMo: ${momoResponse.message || 'Lỗi không xác định'}`,
          error: momoResponse
        });
      }
    } catch (apiError) {
      console.error('Error communicating with MoMo API:', apiError);
      return res.status(500).json({
        success: false,
        message: 'Lỗi kết nối đến cổng thanh toán MoMo',
        error: apiError.message
      });
    }
  } catch (error) {
    console.error('MoMo payment creation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi tạo thanh toán MoMo',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/**
 * Handle MoMo IPN (Instant Payment Notification)
 * @route POST /api/payments/momo/ipn
 * @access Public
 */
exports.momoIPN = async (req, res) => {
  try {
    const { orderId, resultCode, message, transId, amount } = req.body;
    
    // Log the IPN data
    console.log('MoMo IPN received:', req.body);
    
    // Validate signature (important for security)
    // TODO: Implement proper signature validation
    
    // Update payment status based on resultCode
    if (resultCode === 0) {
      // Payment successful - update Bill/BillPayment
    } else {
      // Payment failed - do nothing
    }
    // Update Bill and BillPayment for partial billType payments
    try {
      const { billType, appointmentId } = (() => {
        try {
          const parsed = JSON.parse(Buffer.from(req.body.extraData || '', 'base64').toString('utf8'));
          return parsed || {};
        } catch (_) { return {}; }
      })();
      
      if (billType && resultCode === 0 && appointmentId) {
        const Bill = require('../models/Bill');
        const BillPayment = require('../models/BillPayment');
        const extra = JSON.parse(Buffer.from(req.body.extraData || '', 'base64').toString('utf8'));
        const bill = await Bill.findOne({ appointmentId: extra.appointmentId });
        if (bill) {
          const amount = Number(req.body.amount) || 0;
          
          // Find existing pending BillPayment by orderId
          let billPayment = await BillPayment.findOne({
            $or: [
              { 'paymentDetails.orderId': req.body.orderId },
              { transactionId: req.body.orderId }
            ],
            billId: bill._id,
            billType: billType,
            paymentStatus: 'pending'
          });
          
          if (billType === 'consultation' && bill.consultationBill.amount > 0) {
            bill.consultationBill.status = 'paid';
            bill.consultationBill.paymentMethod = 'momo';
            bill.consultationBill.paymentDate = new Date();
            bill.consultationBill.transactionId = req.body.transId || req.body.orderId;
            bill.consultationBill.paymentDetails = req.body;
          } else if (billType === 'medication') {
            // If prescriptionId is provided, pay individual prescription
            if (extra.prescriptionId) {
              const billingController = require('./billingController');
              try {
                await billingController.payPrescription({
                  body: {
                    prescriptionId: extra.prescriptionId,
                    paymentMethod: 'momo',
                    transactionId: req.body.transId,
                    paymentDetails: req.body
                  },
                  user: { id: bill.patientId } // Use patient as user for IPN
                }, {
                  json: (data) => {},
                  status: () => ({ json: () => {} })
                });
              } catch (prescriptionPayError) {
                console.error('Error paying prescription via MoMo IPN:', prescriptionPayError);
                // Fallback to old medication bill payment
                if (bill.medicationBill.amount > 0) {
                  bill.medicationBill.status = 'paid';
                  bill.medicationBill.paymentMethod = 'momo';
                  bill.medicationBill.paymentDate = new Date();
                  bill.medicationBill.transactionId = req.body.transId;
                }
              }
            } else if (bill.medicationBill.amount > 0) {
              // Legacy: pay entire medication bill
              bill.medicationBill.status = 'paid';
              bill.medicationBill.paymentMethod = 'momo';
              bill.medicationBill.paymentDate = new Date();
              bill.medicationBill.transactionId = req.body.transId;
            }
          } else if (billType === 'hospitalization' && bill.hospitalizationBill.amount > 0) {
            bill.hospitalizationBill.status = 'paid';
            bill.hospitalizationBill.paymentMethod = 'momo';
            bill.hospitalizationBill.paymentDate = new Date();
            bill.hospitalizationBill.transactionId = req.body.transId;
          }
          await bill.save();

          // Update existing BillPayment or create new one
          if (billPayment) {
            // Update existing pending payment
            billPayment.paymentStatus = 'completed';
            billPayment.transactionId = req.body.transId || req.body.orderId;
            billPayment.paymentDetails = {
              ...billPayment.paymentDetails,
              ...req.body,
              ipnReceived: true,
              ipnReceivedAt: new Date().toISOString()
            };
            await billPayment.save();
            console.log(`Updated BillPayment ${billPayment._id} to completed via IPN`);
          } else {
            // Create new BillPayment if not found (shouldn't happen, but just in case)
            await BillPayment.create({
              paymentNumber: undefined, // auto-generated by pre-validate
              billId: bill._id,
              appointmentId: bill.appointmentId,
              patientId: bill.patientId,
              billType,
              amount: amount,
              paymentMethod: 'momo',
              paymentStatus: 'completed',
              transactionId: req.body.transId || req.body.orderId,
              paymentDetails: {
                ...req.body,
                ipnReceived: true,
                ipnReceivedAt: new Date().toISOString()
              }
            });
            console.log(`Created new BillPayment via IPN for orderId: ${req.body.orderId}`);
          }
        }
      }
    } catch (e) {
      console.error('Failed to update Bill from MoMo IPN:', e);
    }
    
    // Always return 200 for IPN
    return res.status(200).json({ message: 'IPN received successfully' });
  } catch (error) {
    console.error('MoMo IPN processing error:', error);
    // Always return 200 for IPN even if there's an error
    return res.status(200).json({ message: 'IPN received, but encountered an error' });
  }
};

/**
 * Process MoMo payment result
 * @route GET /api/payments/momo/result
 * @access Public
 */
exports.momoPaymentResult = async (req, res) => {
  try {
    const { orderId, resultCode } = req.query;
    
    // Log the incoming data for debugging
    console.log('MoMo result received:', { 
      orderId, 
      resultCode, 
      resultCodeType: typeof resultCode,
      allParams: req.query 
    });
    
    // Find payment in database (BillPayment)
    const BillPayment = require('../models/BillPayment');
    // Try multiple ways to find the payment
    let payment = await BillPayment.findOne({ 
      $or: [
        { 'paymentDetails.orderId': orderId },
        { transactionId: orderId },
        { 'paymentDetails.momoResponse.orderId': orderId }
      ]
    }).populate('appointmentId billId');
    
    if (!payment) {
      console.error('Payment not found for orderId:', orderId);
      console.error('Trying to find by transactionId...');
      // Try one more time with just transactionId
      payment = await BillPayment.findOne({ transactionId: orderId }).populate('appointmentId billId');
      
      if (!payment) {
        // If still not found, try to create from IPN data or extraData
        console.error('Payment not found, checking if we can recover from extraData...');
        // This should be handled by IPN, but if IPN hasn't run yet, we need to wait
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thông tin thanh toán. Vui lòng đợi vài giây và thử lại.',
          orderId: orderId
        });
      }
    }

    console.log('Found payment:', { 
      id: payment._id, 
      status: payment.paymentStatus,
      appointmentId: payment.appointmentId
    });
    
    // Update payment status if not already updated by IPN
    if (payment.paymentStatus === 'pending') {
      // Check resultCode as string or number (MoMo returns as string in URL param)
      if (resultCode === '0' || resultCode === 0) {
        payment.paymentStatus = 'completed';
        payment.paymentDetails = { 
          ...payment.paymentDetails, 
          ...req.query,
          processedAt: new Date().toISOString() 
        };
        
        try {
          // Save payment first
          await payment.save();
          console.log('BillPayment updated successfully');
          
          // Update Bill if exists
          const Bill = require('../models/Bill');
          if (payment.billId) {
            const bill = await Bill.findById(payment.billId);
            if (bill) {
              if (payment.billType === 'consultation') {
                if (bill.consultationBill.status !== 'paid') {
                  bill.consultationBill.status = 'paid';
                  bill.consultationBill.paymentMethod = 'momo';
                  bill.consultationBill.paymentDate = new Date();
                  bill.consultationBill.transactionId = orderId;
                  bill.consultationBill.paymentDetails = {
                    ...bill.consultationBill.paymentDetails,
                    ...payment.paymentDetails,
                    resultCode: resultCode,
                    processedAt: new Date().toISOString()
                  };
                }
              }
              await bill.save();
              console.log('Bill updated successfully');
            }
          }
          
          // Find appointment
          const appointmentId = payment.appointmentId?._id || payment.appointmentId;
          console.log('Looking for appointment with ID:', appointmentId);
          
          // Update appointment status - with better error handling
          try {
            const appointment = await Appointment.findById(appointmentId);
            
            if (appointment) {
              console.log('Found appointment:', { 
                id: appointment._id, 
                status: appointment.status,
                paymentStatus: appointment.paymentStatus
              });
              
              appointment.paymentStatus = 'completed';
              appointment.paymentMethod = 'momo';
              
              // Automatically confirm appointment if it's pending or pending_payment
              if (appointment.status === 'pending' || appointment.status === 'pending_payment') {
                appointment.status = 'confirmed';
              }
              
              await appointment.save();
              console.log('Appointment updated successfully');
            } else {
              console.error('Appointment not found for ID:', appointmentId);
            }
          } catch (appointmentError) {
            console.error('Error updating appointment:', appointmentError);
            // Continue execution even if appointment update fails
          }
        } catch (saveError) {
          console.error('Error saving payment:', saveError);
          return res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái thanh toán',
            error: saveError.message
          });
        }
      } else {
        payment.paymentStatus = 'failed';
        payment.paymentDetails = { ...payment.paymentDetails, ...req.query };
        
        try {
          await payment.save();
          console.log('Payment marked as failed');
        } catch (saveError) {
          console.error('Error saving failed payment:', saveError);
          return res.status(500).json({
            success: false,
            message: 'Lỗi khi cập nhật trạng thái thanh toán thất bại',
            error: saveError.message
          });
        }
      }
    } else {
      console.log('Payment already processed, status:', payment.paymentStatus);
    }
    
    // Return payment status with more details
    const responseData = {
      success: true,
      paymentStatus: payment.paymentStatus,
      appointmentId: payment.appointmentId?._id || payment.appointmentId,
      message: (resultCode === '0' || resultCode === 0) ? 'Thanh toán thành công' : 'Thanh toán thất bại',
      orderId: orderId
    };
    
    // If payment was just completed, include bill info
    if (payment.paymentStatus === 'completed' && payment.billId) {
      const Bill = require('../models/Bill');
      const bill = await Bill.findById(payment.billId);
      if (bill) {
        responseData.bill = {
          _id: bill._id,
          billNumber: bill.billNumber,
          overallStatus: bill.overallStatus
        };
      }
    }
    
    return res.status(200).json(responseData);
  } catch (error) {
    console.error('MoMo payment result processing error:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi xử lý kết quả thanh toán',
      error: error.message
    });
  }
};

/**
 * Verify MoMo payment status
 * @route GET /api/payments/momo/status/:orderId
 * @access Private
 */
exports.checkMomoPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    // Find payment in database (BillPayment)
    const BillPayment = require('../models/BillPayment');
    const payment = await BillPayment.findOne({ 'paymentDetails.orderId': orderId }).populate('appointmentId billId');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin thanh toán'
      });
    }
    
    return res.status(200).json({
      success: true,
      payment: {
        id: payment._id,
        status: payment.paymentStatus,
        amount: payment.amount,
        appointmentId: payment.appointmentId,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt
      }
    });
  } catch (error) {
    console.error('Check MoMo payment status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi khi kiểm tra trạng thái thanh toán',
      error: error.message
    });
  }
}; 