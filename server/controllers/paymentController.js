const mongoose = require('mongoose');
const Bill = require('../models/Bill');
const BillPayment = require('../models/BillPayment');
const Appointment = require('../models/Appointment');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Service = require('../models/Service');
const { validationResult } = require('express-validator');

// Get all payments with filtering options (Admin only)
// Now using BillPayment for payment history
exports.getAllPayments = async (req, res) => {
  try {
    const { 
      userId, 
      doctorId, 
      serviceId, 
      status, 
      fromDate, 
      toDate, 
      method,
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    const query = {};

    // Apply filters if provided
    if (userId && userId !== 'all') query.patientId = new mongoose.Types.ObjectId(userId);
    if (status && status !== 'all') {
      // Map payment status
      if (status === 'completed') query.paymentStatus = 'completed';
      else if (status === 'pending') query.paymentStatus = 'pending';
      else if (status === 'failed') query.paymentStatus = 'failed';
      else if (status === 'cancelled') query.paymentStatus = 'cancelled';
    }
    if (method && method !== 'all') query.paymentMethod = method;
    
    // Date range filter
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDateObj;
      }
    }

    // Count total documents for pagination
    const total = await BillPayment.countDocuments(query);
    
    // Sort options
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Execute query with pagination
    const payments = await BillPayment.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate({
        path: 'patientId',
        select: 'fullName email phoneNumber avatarUrl',
      })
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate status bookingCode doctorId serviceId',
        populate: [
          {
            path: 'doctorId',
            select: 'user title specialtyId',
            populate: [
              { path: 'user', select: 'fullName email phoneNumber avatarUrl' },
              { path: 'specialtyId', select: 'name' }
            ]
          },
          { path: 'serviceId', select: 'name price' }
        ]
      })
      .populate('billId', 'billNumber');
    
    // Transform to match old Payment format for backward compatibility
    const transformedPayments = payments.map(payment => ({
      _id: payment._id,
      appointmentId: payment.appointmentId,
      userId: payment.patientId,
      doctorId: payment.appointmentId?.doctorId,
      serviceId: payment.appointmentId?.serviceId,
      amount: payment.amount,
      originalAmount: payment.amount, // BillPayment doesn't have originalAmount, use amount
      discount: 0, // Will be in Bill
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      transactionId: payment.transactionId,
      paymentDetails: payment.paymentDetails,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));
    
    res.status(200).json({
      success: true,
      count: transformedPayments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      payments: transformedPayments
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payments',
      error: error.message
    });
  }
};

// Get payment details by ID (Admin only)
// Now using BillPayment
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment ID format'
      });
    }
    
    const payment = await BillPayment.findById(id)
      .populate({
        path: 'patientId',
        select: 'fullName email phoneNumber'
      })
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate status notes bookingCode doctorId serviceId',
        populate: [
          {
            path: 'doctorId',
            select: 'user title specialtyId',
            populate: [
              { path: 'user', select: 'fullName email phoneNumber' },
              { path: 'specialtyId', select: 'name' }
            ]
          },
          { path: 'serviceId', select: 'name price description' }
        ]
      })
      .populate('billId');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Get bill for coupon info if consultation payment
    let couponId = null;
    if (payment.billType === 'consultation' && payment.billId) {
      const bill = await Bill.findById(payment.billId);
      if (bill?.consultationBill?.couponId) {
        couponId = bill.consultationBill.couponId;
      }
    }
    
    // Transform to match old Payment format
    const transformedPayment = {
      _id: payment._id,
      appointmentId: payment.appointmentId,
      userId: payment.patientId,
      doctorId: payment.appointmentId?.doctorId,
      serviceId: payment.appointmentId?.serviceId,
      amount: payment.amount,
      originalAmount: payment.amount,
      discount: 0,
      couponId: couponId,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      transactionId: payment.transactionId,
      paymentDetails: payment.paymentDetails,
      notes: payment.notes,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };
    
    res.status(200).json({
      success: true,
      payment: transformedPayment
    });
  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment details',
      error: error.message
    });
  }
};

/**
 * @desc    Cập nhật trạng thái thanh toán (Admin only)
 * @route   PUT /api/payments/:id
 * @access  Private (Admin)
 */
exports.updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate if the payment ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid payment ID format' });
    }

    // If no request body or empty body, automatically set status to "CONFIRM"
    const isEmptyBody = !req.body || Object.keys(req.body).length === 0;
    const { paymentStatus = isEmptyBody ? 'completed' : undefined, notes, receiptNumber } = req.body || {};

    // Find the payment (BillPayment)
    const payment = await BillPayment.findById(id).populate('billId');
    
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Only cash payments can be updated (unless the user is admin)
    if (payment.paymentMethod !== 'cash' && req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Only cash payments can be updated manually' 
      });
    }

    // Update payment fields
    if (paymentStatus) {
      payment.paymentStatus = paymentStatus === 'confirm' ? 'completed' : paymentStatus;
    }
    if (notes) payment.notes = notes;
    if (receiptNumber) payment.transactionId = receiptNumber;

    // Save the updated payment
    await payment.save();

    // Update bill status if payment is completed
    if (payment.billId && (paymentStatus === 'completed' || paymentStatus === 'confirm')) {
      const bill = await Bill.findById(payment.billId);
      if (bill) {
        // Update the corresponding bill section
        if (payment.billType === 'consultation') {
          bill.consultationBill.status = 'paid';
          bill.consultationBill.paymentDate = new Date();
        } else if (payment.billType === 'medication') {
          // Update prescription payment if exists
          if (payment.prescriptionId && bill.medicationBill.prescriptionPayments) {
            const prescriptionPayment = bill.medicationBill.prescriptionPayments.find(
              p => p.prescriptionId.toString() === payment.prescriptionId.toString()
            );
            if (prescriptionPayment) {
              prescriptionPayment.status = 'paid';
              prescriptionPayment.paymentDate = new Date();
            }
          }
          // Update medication bill status if all prescriptions paid
          const allPaid = bill.medicationBill.prescriptionPayments.every(p => p.status === 'paid');
          if (allPaid) {
            bill.medicationBill.status = 'paid';
          }
        } else if (payment.billType === 'hospitalization') {
          bill.hospitalizationBill.status = 'paid';
          bill.hospitalizationBill.paymentDate = new Date();
        }
        await bill.save();
      }
    }

    // Update the corresponding appointment's payment status
    if (payment.appointmentId) {
      try {
        const appointment = await Appointment.findById(payment.appointmentId);
        if (appointment) {
          // Get bill to check overall status
          const bill = await Bill.findOne({ appointmentId: payment.appointmentId });
          if (bill && bill.overallStatus === 'paid') {
            appointment.paymentStatus = 'completed';
            if (appointment.status === 'pending') {
              appointment.status = 'confirmed';
            }
          } else if (paymentStatus === 'completed' || paymentStatus === 'confirm') {
            appointment.paymentStatus = 'completed';
            if (payment.paymentMethod === 'cash' && appointment.status === 'pending') {
              appointment.status = 'completed';
            } else if (appointment.status === 'pending') {
              appointment.status = 'confirmed';
            }
          }
          await appointment.save();
        }
      } catch (appointmentError) {
        console.error('Error updating appointment:', appointmentError);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment updated successfully',
      data: payment
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update payment', 
      error: error.message 
    });
  }
};

// Create new payment record (typically called by appointment system)
// Now creates Bill instead of Payment
exports.createPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const {
      appointmentId,
      userId,
      doctorId,
      serviceId,
      amount,
      originalAmount,
      couponId,
      discount,
      paymentMethod,
      transactionId
    } = req.body;

    // Validate required fields
    if (!appointmentId || !userId || !doctorId || !serviceId || !amount || !originalAmount || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment information'
      });
    }

    // Check if appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: 'Appointment not found'
      });
    }

    // Check if bill already exists for this appointment
    let bill = await Bill.findOne({ appointmentId });
    
    // Set initial payment status based on payment method
    let initialPaymentStatus = 'pending';
    if (paymentMethod === 'cash') {
      initialPaymentStatus = 'paid';
    }

    if (bill) {
      // Update existing bill's consultationBill
      bill.consultationBill = {
        amount: amount,
        originalAmount: originalAmount,
        discount: discount || 0,
        couponId: couponId || null,
        status: initialPaymentStatus,
        paymentMethod: paymentMethod,
        paymentDate: initialPaymentStatus === 'paid' ? new Date() : null,
        transactionId: transactionId || null
      };
      
      if (!bill.doctorId) bill.doctorId = doctorId;
      if (!bill.serviceId) bill.serviceId = serviceId;
      
      await bill.save();
    } else {
      // Create new bill
      bill = await Bill.create({
        appointmentId,
        patientId: userId,
        doctorId,
        serviceId,
        consultationBill: {
          amount: amount,
          originalAmount: originalAmount,
          discount: discount || 0,
          couponId: couponId || null,
          status: initialPaymentStatus,
          paymentMethod: paymentMethod,
          paymentDate: initialPaymentStatus === 'paid' ? new Date() : null,
          transactionId: transactionId || null
        }
      });
    }

    // Create BillPayment record for history
    if (initialPaymentStatus === 'paid') {
      await BillPayment.create({
        billId: bill._id,
        appointmentId,
        patientId: userId,
        billType: 'consultation',
        amount: amount,
        paymentMethod: paymentMethod,
        paymentStatus: 'completed',
        transactionId: transactionId || null
      });
    }

    // Map payment status to appointment payment status
    let appointmentPaymentStatus = 'pending';
    if (initialPaymentStatus === 'paid') {
      appointmentPaymentStatus = 'completed';
    }

    // Ensure appointment has a booking code
    if (!appointment.bookingCode) {
      const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      const timestamp = Date.now().toString().slice(-6);
      appointment.bookingCode = `BK-${randomCode}-${timestamp}`;
    }

    // Update appointment with payment information
    appointment.paymentStatus = appointmentPaymentStatus;
    
    // If payment is complete, update appointment status accordingly
    if (initialPaymentStatus === 'paid' && appointment.status === 'pending') {
      appointment.status = paymentMethod === 'cash' ? 'completed' : 'confirmed';
    }
    
    await appointment.save();

    res.status(201).json({
      success: true,
      message: 'Payment created successfully',
      payment: {
        _id: bill._id,
        appointmentId: bill.appointmentId,
        userId: bill.patientId,
        doctorId: bill.doctorId,
        serviceId: bill.serviceId,
        amount: bill.consultationBill.amount,
        originalAmount: bill.consultationBill.originalAmount,
        discount: bill.consultationBill.discount,
        couponId: bill.consultationBill.couponId,
        paymentMethod: bill.consultationBill.paymentMethod,
        paymentStatus: bill.consultationBill.status === 'paid' ? 'completed' : 'pending',
        transactionId: bill.consultationBill.transactionId
      },
      bookingCode: appointment.bookingCode
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating payment',
      error: error.message
    });
  }
};

/**
 * @desc    Get payment statistics for admin dashboard
 * @route   GET /api/admin/payments/stats
 * @access  Private (Admin)
 */
exports.getPaymentStats = async (req, res) => {
  try {
    // Get counts for different payment statuses from BillPayment
    const [totalCount, completedCount, pendingCount, failedCount] = await Promise.all([
      BillPayment.countDocuments({}),
      BillPayment.countDocuments({ paymentStatus: 'completed' }),
      BillPayment.countDocuments({ paymentStatus: 'pending' }),
      BillPayment.countDocuments({ paymentStatus: 'failed' })
    ]);

    // Get total revenue from completed payments
    const totalRevenue = await BillPayment.aggregate([
      { $match: { paymentStatus: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const revenue = totalRevenue.length > 0 ? totalRevenue[0].total : 0;

    // Return the statistics
    res.status(200).json({
      success: true,
      stats: {
        total: totalCount,
        completed: completedCount,
        pending: pendingCount,
        failed: failedCount,
        revenue: revenue
      }
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching payment statistics',
      error: error.message
    });
  }
};

/**
 * @desc    Lấy thông tin thanh toán cho người dùng
 * @route   GET /api/payments/user
 * @access  Private (User)
 */
exports.getUserPayments = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;
    
    const query = { patientId: userId };
    if (status) {
      if (status === 'completed') query.paymentStatus = 'completed';
      else if (status === 'pending') query.paymentStatus = 'pending';
      else if (status === 'failed') query.paymentStatus = 'failed';
      else query.paymentStatus = status;
    }
    
    // Đếm tổng số thanh toán
    const total = await BillPayment.countDocuments(query);
    
    // Lấy danh sách thanh toán
    const payments = await BillPayment.find(query)
      .populate('appointmentId', 'appointmentDate status doctorId serviceId')
      .populate({
        path: 'appointmentId',
        populate: [
          { path: 'doctorId', select: 'user title specialtyId', populate: { path: 'user', select: 'fullName' } },
          { path: 'serviceId', select: 'name price' }
        ]
      })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    // Transform to match old format
    const transformedPayments = payments.map(payment => ({
      _id: payment._id,
      appointmentId: payment.appointmentId?._id || payment.appointmentId,
      userId: payment.patientId,
      doctorId: payment.appointmentId?.doctorId,
      serviceId: payment.appointmentId?.serviceId,
      amount: payment.amount,
      originalAmount: payment.amount,
      discount: 0,
      paymentMethod: payment.paymentMethod,
      paymentStatus: payment.paymentStatus,
      transactionId: payment.transactionId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    }));
    
    res.status(200).json({
      success: true,
      count: transformedPayments.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: transformedPayments
    });
  } catch (error) {
    console.error('Get user payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách thanh toán',
      error: error.message
    });
  }
};

// PayPal API - Tạo thanh toán PayPal
exports.createPayPalPayment = async (payment, origin) => {
  try {
    // Kết nối với PayPal API (giả định, cần thêm thư viện và cấu hình PayPal SDK)
    // Trong môi trường thực, bạn sẽ sử dụng PayPal SDK
    // Ví dụ: const paypal = require('@paypal/checkout-server-sdk');
    
    // Đây là phiên bản mô phỏng - trong triển khai thực tế, bạn sẽ tích hợp PayPal SDK
    console.log('Creating PayPal payment for:', payment);
    
    // Trả về URL redirect mô phỏng - trong triển khai thực tế, URL này sẽ từ PayPal
    return `${origin}/checkout/paypal?paymentId=${payment._id}`;
  } catch (error) {
    console.error('PayPal payment creation error:', error);
    throw error;
  }
};

/**
 * @desc    Xác nhận thanh toán PayPal
 * @route   POST /api/payments/paypal/confirmed
 * @access  Private
 */
exports.confirmPayPalPayment = async (req, res) => {
  try {
    console.log('PayPal confirmation request received:', {
      body: req.body
    });
    
    const { appointmentId, paymentId, paymentDetails } = req.body;
    
    // Validate required fields
    if (!appointmentId || !paymentId) {
      console.error('Missing required fields:', { appointmentId, paymentId });
      return res.status(400).json({
        success: false,
        message: 'Thiếu ID cuộc hẹn hoặc ID thanh toán'
      });
    }
    
    // Validate appointment ID format
    if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
      console.error(`Invalid appointment ID format: ${appointmentId}`);
      return res.status(400).json({
        success: false,
        message: 'ID cuộc hẹn không hợp lệ'
      });
    }
    
    // Tìm bản ghi cuộc hẹn
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      console.error(`Appointment not found with ID: ${appointmentId}`);
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin cuộc hẹn'
      });
    }
    
    console.log(`Found appointment: ${appointment._id}, status: ${appointment.status}, paymentStatus: ${appointment.paymentStatus}`);
    
    // Kiểm tra nếu đã thanh toán
    if (appointment.paymentStatus === 'completed') {
      console.log(`Appointment ${appointmentId} is already paid`);
      return res.status(400).json({
        success: false,
        message: 'Cuộc hẹn này đã được thanh toán'
      });
    }
    
    // Get or create bill
    let bill = await Bill.findOne({ appointmentId });
    
    if (!bill) {
      // Create new bill
      bill = await Bill.create({
        appointmentId,
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        serviceId: appointment.serviceId,
        consultationBill: {
          amount: appointment.fee?.totalAmount || 0,
          originalAmount: (appointment.fee?.consultationFee || 0) + (appointment.fee?.additionalFees || 0),
          discount: appointment.fee?.discount || 0,
          status: 'paid',
          paymentMethod: 'paypal',
          paymentDate: new Date(),
          transactionId: paymentId,
          paymentDetails: paymentDetails
        }
      });
    } else {
      // Update existing bill
      bill.consultationBill.status = 'paid';
      bill.consultationBill.paymentMethod = 'paypal';
      bill.consultationBill.paymentDate = new Date();
      bill.consultationBill.transactionId = paymentId;
      bill.consultationBill.paymentDetails = paymentDetails;
      if (!bill.doctorId) bill.doctorId = appointment.doctorId;
      if (!bill.serviceId) bill.serviceId = appointment.serviceId;
      await bill.save();
    }
    
    // Create BillPayment record
    const billPayment = await BillPayment.create({
      billId: bill._id,
      appointmentId,
      patientId: appointment.patientId,
      billType: 'consultation',
      amount: appointment.fee?.totalAmount || 0,
      paymentMethod: 'paypal',
      paymentStatus: 'completed',
      transactionId: paymentId,
      paymentDetails: paymentDetails
    });
    
    console.log(`BillPayment created successfully: ${billPayment._id}`);
    
    // Cập nhật trạng thái thanh toán trong Appointment
    try {
      appointment.paymentStatus = 'completed';
      appointment.paymentMethod = 'paypal';
      
      // Nếu cuộc hẹn đang ở trạng thái pending, tự động chuyển sang confirmed
      if (appointment.status === 'pending') {
        console.log(`Auto-confirming appointment ${appointmentId} due to payment completion`);
        appointment.status = 'confirmed';
      }
      
      // Lưu cập nhật cho cuộc hẹn
      await appointment.save();
      console.log(`Appointment updated successfully: ${appointment._id}, status: ${appointment.status}, paymentStatus: ${appointment.paymentStatus}`);
    } catch (appointmentError) {
      console.error(`Error updating appointment:`, appointmentError);
      // Note: We still return success since the payment was completed
      // but include a warning about the appointment update
      return res.status(200).json({
        success: true,
        message: 'Thanh toán thành công nhưng không thể cập nhật trạng thái cuộc hẹn',
        paymentProcessed: true,
        warning: 'Appointment update failed: ' + appointmentError.message,
        data: {
          payment: billPayment,
          bill,
          appointment,
          redirectUrl: '/user/appointments'
        }
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Thanh toán PayPal đã được xác nhận thành công',
      data: {
        payment: {
          _id: billPayment._id,
          appointmentId: billPayment.appointmentId,
          userId: billPayment.patientId,
          amount: billPayment.amount,
          paymentMethod: billPayment.paymentMethod,
          paymentStatus: billPayment.paymentStatus,
          transactionId: billPayment.transactionId
        },
        bill,
        appointment,
        redirectUrl: '/user/appointments' // Chuyển hướng về trang lịch hẹn
      }
    });
  } catch (error) {
    console.error('PayPal confirmation error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi xác nhận thanh toán PayPal',
      error: error.message
    });
  }
};

/**
 * @desc    Hủy thanh toán PayPal
 * @route   POST /api/payments/paypal/cancel
 * @access  Public
 */
exports.cancelPayPalPayment = async (req, res) => {
  try {
    const { paymentId } = req.body;
    
    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu ID thanh toán'
      });
    }
    
    // Tìm bản ghi thanh toán (BillPayment)
    const payment = await BillPayment.findById(paymentId).populate('billId');
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin thanh toán'
      });
    }
    
    // Kiểm tra phương thức thanh toán
    if (payment.paymentMethod !== 'paypal') {
      return res.status(400).json({
        success: false,
        message: 'Phương thức thanh toán không hợp lệ'
      });
    }
    
    // Cập nhật trạng thái thanh toán
    payment.paymentStatus = 'cancelled';
    payment.notes = 'Thanh toán PayPal đã bị hủy bởi người dùng';
    await payment.save();
    
    // Update bill if exists
    if (payment.billId && payment.billType === 'consultation') {
      const bill = await Bill.findById(payment.billId);
      if (bill) {
        bill.consultationBill.status = 'cancelled';
        await bill.save();
      }
    }
    
    // Cập nhật trạng thái thanh toán cho cuộc hẹn hoặc hủy cuộc hẹn
    const appointmentId = payment.appointmentId?._id || payment.appointmentId;
    const appointment = await Appointment.findById(appointmentId);
    if (appointment) {
      // Tùy theo yêu cầu nghiệp vụ, bạn có thể hủy cuộc hẹn hoặc chỉ đặt lại trạng thái thanh toán
      appointment.paymentStatus = 'failed';
      appointment.status = 'cancelled';
      appointment.cancellationReason = 'Thanh toán PayPal bị hủy';
      appointment.cancelledBy = 'patient';
      
      await appointment.save();
      
      // Trả lại slot thời gian
      if (appointment.scheduleId) {
        const Schedule = mongoose.model('Schedule');
        const schedule = await Schedule.findById(appointment.scheduleId);
        if (schedule) {
          const timeSlot = appointment.timeSlot;
          const slotIndex = schedule.timeSlots.findIndex(
            slot => slot.startTime === timeSlot.startTime && slot.endTime === timeSlot.endTime
          );
          
          if (slotIndex !== -1) {
            schedule.timeSlots[slotIndex].isBooked = false;
            schedule.timeSlots[slotIndex].appointmentId = null;
            await schedule.save();
          }
        }
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Thanh toán PayPal đã bị hủy',
      data: {
        redirectUrl: '/user/appointment/new' // Chuyển hướng về trang đặt lịch
      }
    });
  } catch (error) {
    console.error('PayPal cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy thanh toán PayPal',
      error: error.message
    });
  }
};

// Add notification to PayPal Success route 
exports.paypalSuccess = async (req, res) => {
  try {
    // ... existing code ...
    
    // ... existing response code ...
  } catch (error) {
    // ... existing error handling ...
  }
};

// Get payment history for logged-in user
exports.getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Get total count for pagination (using BillPayment)
    const total = await BillPayment.countDocuments({ patientId: req.user.id });
    
    // Fetch paginated payments (using BillPayment)
    const payments = await BillPayment.find({ patientId: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate({
        path: 'appointmentId',
        select: 'appointmentDate appointmentTime serviceName _id',
      })
      .populate({
        path: 'doctorId',
        select: 'user',
        populate: {
          path: 'user',
          select: 'fullName'
        }
      })
      .populate({
        path: 'serviceId',
        select: 'name price',
      });

    // Transform data to include service name and standardize status
    const formattedPayments = payments.map(payment => {
      const paymentObj = payment.toObject();
      
      // Add service name from appointment or service
      if (payment.appointmentId && payment.appointmentId.serviceName) {
        paymentObj.serviceName = payment.appointmentId.serviceName;
      } else if (payment.serviceId && payment.serviceId.name) {
        paymentObj.serviceName = payment.serviceId.name;
      }
      
      // Ensure appointmentId is available for navigation
      if (payment.appointmentId && payment.appointmentId._id) {
        paymentObj.appointmentId = payment.appointmentId._id;
      }
      
      // Standardize doctor name format
      if (payment.doctorId && payment.doctorId.user) {
        paymentObj.doctorName = payment.doctorId.user.fullName;
      }
      
      // Ensure status exists and is standardized for filtering
      if (!paymentObj.status && paymentObj.paymentStatus) {
        paymentObj.status = paymentObj.paymentStatus;
      }
      
      return paymentObj;
    });

    res.status(200).json({
      payments: formattedPayments,
      pagination: {
        total,
        totalPages: Math.ceil(total / limitNum),
        currentPage: pageNum,
        pageSize: limitNum
      }
    });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy lịch sử thanh toán',
      error: error.message
    });
  }
};