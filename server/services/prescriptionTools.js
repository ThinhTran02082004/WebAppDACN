const mongoose = require('mongoose');
const Prescription = require('../models/Prescription');
const PrescriptionDraft = require('../models/PrescriptionDraft');
const cache = require('./cacheService');

const formatOfficialPrescription = (prescription) => ({
  type: 'official',
  isDraft: false,
  prescriptionId: prescription._id,
  diagnosis: prescription.diagnosis,
  status: prescription.status,
  totalAmount: prescription.totalAmount,
  medicationsCount: prescription.medications?.length || 0,
  doctor: prescription.doctorId?.user?.fullName || 'Không xác định',
  specialty:
    prescription.appointmentId?.specialtyId?.name ||
    prescription.doctorId?.specialtyId?.name ||
    'Chưa xác định',
  appointmentDate: prescription.appointmentId?.appointmentDate,
  bookingCode: prescription.appointmentId?.bookingCode,
  createdAt: prescription.createdAt,
  updatedAt: prescription.updatedAt
});

const formatDraftPrescription = (draft) => ({
  type: 'draft',
  isDraft: true,
  prescriptionCode: draft.prescriptionCode,
  diagnosis: draft.diagnosis,
  symptom: draft.symptom,
  status: draft.status,
  hospital: draft.hospitalId ? { id: draft.hospitalId, name: draft.hospitalName } : null,
  specialty: draft.specialtyId ? { id: draft.specialtyId, name: draft.specialtyName } : null,
  doctor: draft.doctorId ? { id: draft.doctorId, name: draft.doctorName } : null,
  hospitalAvailability: draft.hospitalAvailability || [],
  medicationsCount: draft.medications?.length || 0,
  medications: (draft.medications || []).map((med) => ({
    name: med.name,
    quantity: med.quantity,
    price: med.price
  })),
  approval: draft.approvedBy ? {
    approvedBy: draft.approvedBy,
    approvedByRole: draft.approvedByRole,
    approvedAt: draft.approvedAt
  } : null,
  createdAt: draft.createdAt,
  updatedAt: draft.updatedAt
});

const getMyPrescriptions = async ({ sessionId, status, includeDrafts = true, limit = 10 }) => {
  const userId = cache.getUserId(sessionId);
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return {
      error:
        'AUTHENTICATION_REQUIRED: Người dùng chưa đăng nhập. Vui lòng yêu cầu họ đăng nhập trước khi xem đơn thuốc.'
    };
  }

  const limitNumber = Math.max(1, Math.min(parseInt(limit, 10) || 10, 50));

  const officialQuery = { patientId: userId };
  if (status && status !== 'draft_only') {
    officialQuery.status = status;
  }

  const draftQuery = { patientId: userId };
  if (status && status !== 'official_only') {
    draftQuery.status = status;
  }

  const [officialDocs, officialTotal] = await Promise.all([
    Prescription.find(officialQuery)
      .populate('medications.medicationId', 'name unitTypeDisplay')
      .populate('appointmentId', 'appointmentDate bookingCode specialtyId')
      .populate({
        path: 'appointmentId',
        populate: { path: 'specialtyId', select: 'name' }
      })
      .populate('doctorId', 'title specialtyId')
      .populate({
        path: 'doctorId',
        populate: { path: 'user', select: 'fullName' }
      })
      .populate({
        path: 'doctorId',
        populate: { path: 'specialtyId', select: 'name' }
      })
      .sort({ createdAt: -1 })
      .limit(limitNumber)
      .lean(),
    Prescription.countDocuments(officialQuery)
  ]);

  let draftDocs = [];
  let draftTotal = 0;
  if (includeDrafts && status !== 'official_only') {
    [draftDocs, draftTotal] = await Promise.all([
      PrescriptionDraft.find(draftQuery)
        .sort({ createdAt: -1 })
        .limit(limitNumber)
        .lean(),
      PrescriptionDraft.countDocuments(draftQuery)
    ]);
  }

  const formattedOfficial = officialDocs.map(formatOfficialPrescription);
  const formattedDrafts = draftDocs.map(formatDraftPrescription);

  const combined = [...formattedOfficial, ...formattedDrafts].sort((a, b) => {
    const dateA = new Date(a.createdAt || 0);
    const dateB = new Date(b.createdAt || 0);
    return dateB - dateA;
  });

  return {
    success: true,
    totalOfficial: officialTotal,
    totalDraft: draftTotal,
    records: combined.slice(0, limitNumber)
  };
};

const cancelPrescription = async ({ sessionId, prescriptionCode, prescriptionId, reason }) => {
  const userId = cache.getUserId(sessionId);
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return {
      error:
        'AUTHENTICATION_REQUIRED: Người dùng chưa đăng nhập. Vui lòng yêu cầu họ đăng nhập trước khi hủy đơn thuốc.'
    };
  }

  if (!prescriptionCode && !prescriptionId) {
    return {
      error: 'Vui lòng cung cấp mã đơn thuốc (prescriptionCode) hoặc ID đơn thuốc.'
    };
  }

  const cancelReason =
    reason?.trim() || 'Người dùng yêu cầu hủy đơn thuốc thông qua trợ lý AI.';

  if (prescriptionCode) {
    const draft = await PrescriptionDraft.findOne({
      prescriptionCode: prescriptionCode.trim().toUpperCase(),
      patientId: userId
    });

    if (!draft) {
      return {
        error: `Không tìm thấy đơn thuốc với mã ${prescriptionCode}.`,
        suggestion: 'Bạn hãy kiểm tra lại mã đơn thuốc (PRS-XXXXXX).'
      };
    }

    if (draft.status !== 'pending_approval') {
      return {
        error: `Đơn thuốc ${prescriptionCode} hiện ở trạng thái "${draft.status}" nên không thể hủy.`,
        suggestion: 'Bạn chỉ có thể hủy các đơn đang chờ duyệt.'
      };
    }

    draft.status = 'cancelled';
    draft.note = draft.note
      ? `${draft.note}\n\n[AI Cancelled]: ${cancelReason}`
      : `[AI Cancelled]: ${cancelReason}`;
    await draft.save();

    return {
      success: true,
      message: `Đã hủy đơn thuốc nháp ${prescriptionCode}.`,
      status: draft.status
    };
  }

  if (prescriptionId) {
    const prescription = await Prescription.findOne({
      _id: prescriptionId,
      patientId: userId
    });

    if (!prescription) {
      return {
        error: 'Không tìm thấy đơn thuốc phù hợp với ID bạn cung cấp.'
      };
    }

    if (prescription.status === 'cancelled') {
      return {
        error: 'Đơn thuốc này đã bị hủy trước đó.'
      };
    }

    await prescription.cancel(userId, cancelReason);

    return {
      success: true,
      message: 'Đã hủy đơn thuốc thành công.',
      status: prescription.status
    };
  }

  return {
    error: 'Không thể hủy đơn thuốc vì thiếu thông tin mã hoặc ID.'
  };
};

module.exports = {
  getMyPrescriptions,
  cancelPrescription
};

