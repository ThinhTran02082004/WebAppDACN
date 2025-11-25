const crypto = require('crypto');
const https = require('https');
// Payment model removed from flow; rely on Bill/BillPayment
const Appointment = require('../models/Appointment');
const Prescription = require('../models/Prescription');
const Bill = require('../models/Bill');
const BillPayment = require('../models/BillPayment');
const mongoose = require('mongoose');

// MoMo API configuration
const momoConfig = {
  // Use environment variables in production
  accessKey: process.env.MOMO_ACCESS_KEY ,
  secretKey: process.env.MOMO_SECRET_KEY ,
  partnerCode: process.env.MOMO_PARTNER_CODE ,
  endpoint: process.env.MOMO_ENDPOINT ,
  redirectUrl: process.env.MOMO_REDIRECT_URL ,
  ipnUrl: process.env.MOMO_IPN_URL ,
};

const decodeMomoExtraData = (rawExtraData) => {
  if (!rawExtraData) return null;
  if (typeof rawExtraData === 'object') return rawExtraData;
  try {
    const decoded = Buffer.from(rawExtraData, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (error) {
    console.warn('Failed to decode MoMo extraData:', error.message);
    return null;
  }
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

    if ((!appointmentId && !prescriptionId) || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin thanh toán cần thiết'
      });
    }

    if (billType === 'medication' && !prescriptionId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin thanh toán cần thiết'
      });
    }

    const userId = req.user?._id || req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Không xác định được người dùng'
      });
    }

    let appointment = null;
    let patientId = userId;
    // Find appointment to verify it exists
    if (appointmentId) {
      console.log('Finding appointment with ID:', appointmentId);
      appointment = await Appointment.findById(appointmentId);

      if (!appointment) {
        console.error('Appointment not found:', appointmentId);
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy lịch hẹn'
        });
      }

      patientId = appointment.patientId;

      console.log('Appointment found:', {
        id: appointment._id,
        status: appointment.status
      });
    }

    // Safely access related IDs with proper error handling
    let doctorId = null;
    let serviceId = null;
    let prescription = null;
    
    try {
      if (appointment) {
        // Handle potential different data structures
        doctorId = appointment.doctorId;
        serviceId = appointment.serviceId;
        
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
        const requiresServiceId = billType === 'consultation';
        if (!doctorId || !userId || (requiresServiceId && !serviceId)) {
          console.error('Missing required IDs:', { doctorId, serviceId, userId, requiresServiceId });
          throw new Error('Thiếu thông tin bắt buộc (doctorId, serviceId hoặc userId)');
        }

        if (!serviceId && !requiresServiceId) {
          console.warn('ServiceId is missing but not required for this billType', { billType });
        }
      } else if (billType === 'medication' && prescriptionId) {
        prescription = await Prescription.findById(prescriptionId)
          .populate('patientId', '_id')
          .populate('doctorId', '_id');

        if (!prescription) {
          return res.status(404).json({
            success: false,
            message: 'Không tìm thấy đơn thuốc'
          });
        }

        const prescriptionPatientId = prescription.patientId?._id?.toString() || prescription.patientId?.toString();
        if (prescriptionPatientId && prescriptionPatientId !== userId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Bạn không có quyền thanh toán đơn thuốc này'
          });
        }

        patientId = prescription.patientId?._id || prescription.patientId;
        doctorId = prescription.doctorId?._id || prescription.doctorId || null;
        serviceId = null;
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
    const extraDataObj = { appointmentId: appointmentId || null, billType };
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
          // Get or create Bill
          let bill = null;
          if (appointmentId) {
            bill = await Bill.findOne({ appointmentId });
          } else if (prescriptionId) {
            bill = await Bill.findOne({
              appointmentId: null,
              'medicationBill.prescriptionIds': prescriptionId
            });
          }

          if (!bill) {
            if (appointmentId) {
              bill = await Bill.create({
                appointmentId,
                patientId,
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
              bill = await Bill.create({
                appointmentId: null,
                patientId,
                doctorId,
                consultationBill: {
                  amount: 0,
                  originalAmount: 0,
                  status: 'paid'
                },
                medicationBill: {
                  prescriptionIds: [prescriptionId],
                  amount: amount,
                  status: 'pending',
                  prescriptionPayments: [{
                    prescriptionId,
                    amount: amount,
                    status: 'pending'
                  }]
                }
              });
            }
          } else {
            // Update bill info
            if (!bill.doctorId && doctorId) bill.doctorId = doctorId;
            if (!bill.serviceId && serviceId) bill.serviceId = serviceId;

            if (billType === 'consultation' && appointmentId) {
              if (bill.consultationBill.status !== 'paid') {
                bill.consultationBill.amount = amount;
                bill.consultationBill.originalAmount = amount;
                bill.consultationBill.status = 'pending';
                bill.consultationBill.paymentMethod = 'momo';
              }
            }

            if (billType === 'medication' && prescriptionId) {
              bill.medicationBill = bill.medicationBill || {};
              bill.medicationBill.prescriptionIds = bill.medicationBill.prescriptionIds || [];
              bill.medicationBill.prescriptionPayments = bill.medicationBill.prescriptionPayments || [];

              if (!bill.medicationBill.prescriptionIds.some(id => id.toString() === prescriptionId.toString())) {
                bill.medicationBill.prescriptionIds.push(prescriptionId);
              }

              const existingPaymentEntry = bill.medicationBill.prescriptionPayments.find(
                (p) => p.prescriptionId?.toString() === prescriptionId.toString()
              );

              if (!existingPaymentEntry) {
                bill.medicationBill.prescriptionPayments.push({
                  prescriptionId,
                  amount: amount,
                  status: 'pending'
                });
              }
            }

            await bill.save();
          }

          // Create BillPayment record with pending status
          await BillPayment.create({
            billId: bill._id,
            appointmentId: appointmentId || null,
            patientId: patientId,
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
      const extraData = decodeMomoExtraData(req.body.extraData);
      const billType = extraData?.billType;
      const appointmentId = extraData?.appointmentId;
      const prescriptionId = extraData?.prescriptionId;
      
      if (billType && resultCode === 0) {
        const Bill = require('../models/Bill');
        const BillPayment = require('../models/BillPayment');

        let bill = null;
        if (appointmentId) {
          bill = await Bill.findOne({ appointmentId });
        }
        if (!bill && prescriptionId) {
          bill = await Bill.findOne({
            'medicationBill.prescriptionIds': prescriptionId
          });
        }

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
          
          if (billType === 'consultation' && bill.consultationBill?.amount > 0) {
            bill.consultationBill.status = 'paid';
            bill.consultationBill.paymentMethod = 'momo';
            bill.consultationBill.paymentDate = new Date();
            bill.consultationBill.transactionId = req.body.transId || req.body.orderId;
            bill.consultationBill.paymentDetails = req.body;
          } else if (billType === 'medication') {
            // If prescriptionId is provided, pay individual prescription
            if (prescriptionId) {
              const billingController = require('./billingController');
              try {
                await billingController.payPrescription({
                  body: {
                    prescriptionId: prescriptionId,
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
                if (bill.medicationBill?.amount > 0) {
                  bill.medicationBill.status = 'paid';
                  bill.medicationBill.paymentMethod = 'momo';
                  bill.medicationBill.paymentDate = new Date();
                  bill.medicationBill.transactionId = req.body.transId;
                }
              }
            } else if (bill.medicationBill?.amount > 0) {
              // Legacy: pay entire medication bill
              bill.medicationBill.status = 'paid';
              bill.medicationBill.paymentMethod = 'momo';
              bill.medicationBill.paymentDate = new Date();
              bill.medicationBill.transactionId = req.body.transId;
            }
          } else if (billType === 'hospitalization' && bill.hospitalizationBill?.amount > 0) {
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
        } else {
          console.error('Không tìm thấy hóa đơn tương ứng trong IPN', { appointmentId, prescriptionId });
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
    
    const extraData =
      decodeMomoExtraData(req.query.extraData) ||
      decodeMomoExtraData(payment.paymentDetails?.extraData) ||
      decodeMomoExtraData(payment.paymentDetails?.momoResponse?.extraData);
    const resolvedBillType = extraData?.billType || payment.billType;
    const resolvedAppointmentId = extraData?.appointmentId || (payment.appointmentId?._id || payment.appointmentId);
    const resolvedPrescriptionId = extraData?.prescriptionId;
    
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
          let bill = null;
          if (payment.billId) {
            bill = await Bill.findById(payment.billId);
          }
          if (!bill && resolvedAppointmentId) {
            bill = await Bill.findOne({ appointmentId: resolvedAppointmentId });
          }
          
          if (bill && resolvedBillType) {
            const transactionId = req.query.transId || payment.transactionId || orderId;
            if (resolvedBillType === 'consultation' && bill.consultationBill?.amount > 0) {
              if (bill.consultationBill.status !== 'paid') {
                bill.consultationBill.status = 'paid';
                bill.consultationBill.paymentMethod = 'momo';
                bill.consultationBill.paymentDate = new Date();
                bill.consultationBill.transactionId = transactionId;
                bill.consultationBill.paymentDetails = {
                  ...bill.consultationBill.paymentDetails,
                  ...payment.paymentDetails,
                  resultCode: resultCode,
                  processedAt: new Date().toISOString()
                };
              }
            } else if (resolvedBillType === 'medication') {
              if (resolvedPrescriptionId) {
                const billingController = require('./billingController');
                const patientId = (payment.patientId && payment.patientId._id) ? payment.patientId._id : payment.patientId;
                try {
                  await billingController.payPrescription({
                    body: {
                      prescriptionId: resolvedPrescriptionId,
                      paymentMethod: 'momo',
                      transactionId,
                      paymentDetails: payment.paymentDetails
                    },
                    user: { id: patientId || bill.patientId }
                  }, {
                    json: () => {},
                    status: () => ({ json: () => {} })
                  });
                } catch (prescriptionPayError) {
                  console.error('Error paying prescription via MoMo result:', prescriptionPayError);
                  if (bill.medicationBill?.amount > 0) {
                    bill.medicationBill.status = 'paid';
                    bill.medicationBill.paymentMethod = 'momo';
                    bill.medicationBill.paymentDate = new Date();
                    bill.medicationBill.transactionId = transactionId;
                    bill.medicationBill.paymentDetails = payment.paymentDetails;
                  }
                }
              } else if (bill.medicationBill?.amount > 0) {
                bill.medicationBill.status = 'paid';
                bill.medicationBill.paymentMethod = 'momo';
                bill.medicationBill.paymentDate = new Date();
                bill.medicationBill.transactionId = transactionId;
                bill.medicationBill.paymentDetails = payment.paymentDetails;
              }
            } else if (resolvedBillType === 'hospitalization' && bill.hospitalizationBill?.amount > 0) {
              bill.hospitalizationBill.status = 'paid';
              bill.hospitalizationBill.paymentMethod = 'momo';
              bill.hospitalizationBill.paymentDate = new Date();
              bill.hospitalizationBill.transactionId = transactionId;
              bill.hospitalizationBill.paymentDetails = payment.paymentDetails;
            }
            
            await bill.save();
            console.log('Bill updated successfully');
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
