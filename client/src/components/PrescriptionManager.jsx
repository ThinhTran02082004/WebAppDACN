import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FaPlus, FaTrash, FaSave, FaTimes, FaList, FaFileAlt } from 'react-icons/fa';

const PrescriptionManager = ({ appointmentId, patientId, onPrescriptionCreated }) => {
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' or 'template'
  const [medications, setMedications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedMedications, setSelectedMedications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [existingPrescriptions, setExistingPrescriptions] = useState([]);

  const [medicationForm, setMedicationForm] = useState({
    medicationId: '',
    quantity: 1,
    dosage: '',
    usage: '',
    duration: '',
    notes: ''
  });
  const [customDosage, setCustomDosage] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);
  const [customUsage, setCustomUsage] = useState(false);

  useEffect(() => {
    fetchTemplates();
    if (appointmentId) {
      fetchAppointment();
      fetchExistingPrescriptions();
    }
  }, [appointmentId]);

  useEffect(() => {
    // Fetch medications after appointment data is available so we can filter by branch
    const hospitalId = appointment?.hospitalId?._id || appointment?.hospitalId;
    if (hospitalId || !appointmentId) {
      fetchMedications();
    }
  }, [appointment?.hospitalId?._id, appointment?.doctorId?.hospitalId?._id]);
  const fetchMedications = async () => {
    try {
      // Determine hospital/branch from appointment and ensure doctor belongs to that branch
      const appointmentHospitalId = appointment?.hospitalId?._id || appointment?.hospitalId;
      const doctorHospitalId = appointment?.doctorId?.hospitalId?._id || appointment?.doctorId?.hospitalId;

      if (appointmentHospitalId && doctorHospitalId && doctorHospitalId !== appointmentHospitalId) {
        toast.warning('Bac si khong thuoc chi nhanh nay. Vui long kiem tra lich hen.');
        setMedications([]);
        return;
      }

      const params = { limit: 1000 };
      if (appointmentHospitalId) {
        params.hospitalId = appointmentHospitalId;
      }
      
      const response = await api.get('/medications', { params });
      const list =
        response?.data?.data?.docs ??
        response?.data?.data ??
        response?.data ??
        [];

      const normalizeId = (value) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (typeof value === 'object') {
          if (value._id) return value._id;
          if (typeof value.toString === 'function') return value.toString();
        }
        return null;
      };

      const filteredMedications = Array.isArray(list)
        ? list.filter((med) => {
            if (!med) return false;
            if (med.stockQuantity <= 0) return false;
            if (!appointmentHospitalId) return true;
            const medHospitalId = normalizeId(med.hospitalId);
            return medHospitalId === appointmentHospitalId;
          })
        : [];

      setMedications(filteredMedications);
    } catch (error) {
      console.error('Error fetching medications:', error);
      toast.error('Khong the tai danh sach thuoc');
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await api.get('/prescription-templates');
      setTemplates(response?.data?.data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.warning('Không thể tải danh sách đơn thuốc mẫu');
    }
  };

  const fetchAppointment = async () => {
    try {
      const response = await api.get(`/appointments/${appointmentId}`);
      if (response.data.success) {
        setAppointment(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching appointment:', error);
      toast.error('Không thể tải thông tin lịch hẹn');
    }
  };

  const fetchExistingPrescriptions = async () => {
    try {
      const response = await api.get(`/prescriptions/appointment/${appointmentId}`);
      if (response.data.success) {
        setExistingPrescriptions(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching existing prescriptions:', error);
      toast.warning('Không thể tải danh sách đơn thuốc hiện có');
    }
  };

  const handleAddMedication = () => {
    if (!medicationForm.medicationId) {
      toast.warning('Vui lòng chọn thuốc');
      return;
    }

    // Validate duration (required field)
    if (!medicationForm.duration || !medicationForm.duration.trim()) {
      toast.warning('Vui lòng chọn hoặc nhập thời gian sử dụng thuốc');
      return;
    }
    
    // Validate dosage (optional but recommended)
    if (!medicationForm.dosage || !medicationForm.dosage.trim()) {
      toast.warning('Vui lòng chọn hoặc nhập liều dùng');
      return;
    }

    const medication = medications.find(m => m._id === medicationForm.medicationId);
    if (!medication) return;

    // Check stock
    if (medication.stockQuantity < medicationForm.quantity) {
      toast.error(`Không đủ tồn kho. Còn lại: ${medication.stockQuantity} ${medication.unitTypeDisplay}`);
      return;
    }

    // Check if already added
    if (selectedMedications.some(m => m.medicationId === medicationForm.medicationId)) {
      toast.warning('Thuốc đã được thêm vào đơn');
      return;
    }

    const newMedication = {
      medicationId: medication._id,
      medicationName: medication.name,
      quantity: medicationForm.quantity,
      dosage: medicationForm.dosage || '',
      usage: medicationForm.usage || '',
      duration: medicationForm.duration.trim(),
      notes: medicationForm.notes || '',
      unitPrice: medication.unitPrice,
      unitTypeDisplay: medication.unitTypeDisplay,
      totalPrice: medication.unitPrice * medicationForm.quantity
    };

    setSelectedMedications([...selectedMedications, newMedication]);

    // Reset form
    setMedicationForm({
      medicationId: '',
      quantity: 1,
      dosage: '',
      usage: '',
      duration: '',
      notes: ''
    });
    setCustomDosage(false);
    setCustomDuration(false);
    setCustomUsage(false);
  };

  const handleRemoveMedication = (medicationId) => {
    setSelectedMedications(selectedMedications.filter(m => m.medicationId !== medicationId));
  };

  const handleUseTemplate = async (template) => {
    try {
      // Get hospitalId from appointment
      const hospitalId = appointment?.hospitalId?._id || appointment?.hospitalId;
      if (!hospitalId) {
        toast.error('Không xác định được chi nhánh');
        return;
      }

      // Prepare template medications
      const templateMedications = template.medications.map(med => ({
        medicationId: med.medicationId._id || med.medicationId,
        medicationName: med.medicationId.name,
        quantity: med.quantity,
        dosage: med.dosage,
        usage: med.usage,
        duration: med.duration,
        notes: med.notes,
        unitPrice: med.medicationId.unitPrice,
        unitTypeDisplay: med.medicationId.unitTypeDisplay,
        totalPrice: med.medicationId.unitPrice * med.quantity
      }));

      // Validate stock and availability in current hospital
      const unavailableMedications = [];
      const availableMedications = [];

      for (const tmed of templateMedications) {
        const med = medications.find(m => m._id === tmed.medicationId);
        
        if (!med) {
          unavailableMedications.push({
            name: tmed.medicationName,
            reason: 'Không tìm thấy thuốc trong hệ thống'
          });
          continue;
        }

        // Check if medication belongs to current hospital
        const medHospitalId = med.hospitalId?._id || med.hospitalId;
        if (medHospitalId && medHospitalId.toString() !== hospitalId.toString()) {
          unavailableMedications.push({
            name: tmed.medicationName,
            reason: 'Thuốc không có trong chi nhánh này'
          });
          continue;
        }

        // Check stock
        if (med.stockQuantity < tmed.quantity) {
          unavailableMedications.push({
            name: tmed.medicationName,
            reason: `Không đủ tồn kho (còn: ${med.stockQuantity} ${med.unitTypeDisplay})`
          });
          continue;
        }

        // Medication is available
        availableMedications.push(tmed);
      }

      // Show warnings for unavailable medications
      if (unavailableMedications.length > 0) {
        const unavailableList = unavailableMedications.map(m => `- ${m.name}: ${m.reason}`).join('\n');
        const message = `Một số thuốc trong đơn mẫu không khả dụng:\n${unavailableList}\n\nChỉ các thuốc khả dụng sẽ được thêm vào đơn.`;
        
        if (availableMedications.length === 0) {
          toast.error('Không có thuốc nào trong đơn mẫu khả dụng cho chi nhánh này');
          return;
        }
        
        if (!window.confirm(message)) {
          return;
        }
      }

      // Set only available medications
      setSelectedMedications(availableMedications);
      setDiagnosis(template.diseaseType || '');
      setActiveTab('manual');
      
      if (unavailableMedications.length > 0) {
        toast.warning(`Đã áp dụng đơn mẫu với ${availableMedications.length}/${templateMedications.length} thuốc khả dụng`);
      } else {
        toast.success('Đã áp dụng đơn thuốc mẫu');
      }
    } catch (error) {
      console.error('Error using template:', error);
      toast.error('Không thể áp dụng đơn mẫu');
    }
  };

  const calculateTotal = () => {
    return selectedMedications.reduce((sum, med) => sum + med.totalPrice, 0);
  };

  const handleSubmit = async () => {
    if (selectedMedications.length === 0) {
      toast.warning('Vui lòng chọn ít nhất một loại thuốc');
      return;
    }

    if (!diagnosis.trim()) {
      toast.warning('Vui lòng nhập chẩn đoán');
      return;
    }

    // Validate all medications have duration
    const medicationsWithoutDuration = selectedMedications.filter(
      med => !med.duration || !med.duration.trim()
    );
    
    if (medicationsWithoutDuration.length > 0) {
      toast.warning('Vui lòng nhập thời gian sử dụng cho tất cả các thuốc');
      return;
    }

    try {
      setLoading(true);

      // Determine prescriptionOrder and isHospitalization
      const isHospitalized = appointment?.status === 'hospitalized';
      const nextOrder = existingPrescriptions.length > 0
        ? Math.max(...existingPrescriptions.map(p => p.prescriptionOrder || 1)) + 1
        : 1;

      // Create prescription
      const prescriptionData = {
        appointmentId,
        medications: selectedMedications.map(med => ({
          medicationId: med.medicationId,
          quantity: med.quantity,
          dosage: med.dosage || '',
          usage: med.usage || '',
          duration: med.duration.trim(),
          notes: med.notes || ''
        })),
        diagnosis,
        notes,
        prescriptionOrder: nextOrder,
        isHospitalization: isHospitalized
      };

      const response = await api.post('/prescriptions', prescriptionData);

      toast.success('Kê đơn thuốc thành công');

      // Save as template if requested
      if (saveAsTemplate && templateName.trim()) {
        try {
          await api.post('/prescription-templates', {
            name: templateName,
            description: `Đơn thuốc cho ${diagnosis}`,
            category: 'other',
            diseaseType: diagnosis,
            isPublic: true,
            medications: selectedMedications.map(med => ({
              medicationId: med.medicationId,
              quantity: med.quantity,
              dosage: med.dosage,
              usage: med.usage,
              duration: med.duration,
              notes: med.notes
            }))
          });
          toast.success('Đã lưu đơn thuốc mẫu');
        } catch (error) {
          console.error('Error saving template:', error);
        }
      }

      // Reset form
      setSelectedMedications([]);
      setDiagnosis('');
      setNotes('');
      setSaveAsTemplate(false);
      setTemplateName('');

      // Refresh existing prescriptions to update order for next time
      await fetchExistingPrescriptions();

      if (onPrescriptionCreated) {
        onPrescriptionCreated(response.data.data);
      }

    } catch (error) {
      console.error('Error creating prescription:', error);
      toast.error(error.response?.data?.message || 'Không thể kê đơn thuốc');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="p-6 border-b">
        <h2 className="text-2xl font-bold text-gray-800">Kê Đơn Thuốc</h2>
      </div>

      {/* Existing Prescriptions List */}
      {existingPrescriptions.length > 0 && (
        <div className="p-6 border-b bg-gray-50">
          <h3 className="font-semibold text-lg mb-4 text-gray-700">
            Các Đơn Thuốc Đã Tạo ({existingPrescriptions.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {existingPrescriptions
              .sort((a, b) => (a.prescriptionOrder || 1) - (b.prescriptionOrder || 1))
              .map((prescription) => (
                <div
                  key={prescription._id}
                  className="bg-white border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                        Đợt {prescription.prescriptionOrder || 'N/A'}
                      </span>
                      {prescription.isHospitalization && (
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-semibold">
                          Nội trú
                        </span>
                      )}
                    </div>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        prescription.status === 'dispensed' || prescription.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : prescription.status === 'verified'
                          ? 'bg-blue-100 text-blue-800'
                          : prescription.status === 'approved'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {prescription.status === 'dispensed' || prescription.status === 'completed'
                        ? 'Đã cấp'
                        : prescription.status === 'verified'
                        ? 'Đã duyệt'
                        : prescription.status === 'approved'
                        ? 'Đã kê'
                        : 'Chờ xử lý'}
                    </span>
                  </div>
                  {prescription.diagnosis && (
                    <p className="text-sm text-gray-600 mb-2">
                      <span className="font-medium">Chẩn đoán:</span> {prescription.diagnosis}
                    </p>
                  )}
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">
                      {prescription.medications?.length || 0} loại thuốc
                    </p>
                    <p className="text-sm font-semibold text-green-600">
                      {formatCurrency(prescription.totalAmount || 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(prescription.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('manual')}
          className={`flex-1 px-6 py-3 font-medium ${
            activeTab === 'manual'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <FaList className="inline mr-2" />
          Chọn Thuốc Riêng Lẻ
        </button>
        <button
          onClick={() => setActiveTab('template')}
          className={`flex-1 px-6 py-3 font-medium ${
            activeTab === 'template'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-blue-600'
          }`}
        >
          <FaFileAlt className="inline mr-2" />
          Đơn Thuốc Mẫu
        </button>
      </div>

      <div className="p-6">
        {/* Manual Tab */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            {/* Add Medication Form */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-3">Thêm Thuốc Vào Đơn</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                <div className="md:col-span-2">
                  <select
                    value={medicationForm.medicationId}
                    onChange={(e) => setMedicationForm({ ...medicationForm, medicationId: e.target.value })}
                    className="w-full px-3 py-2 border rounded"
                  >
                    <option value="">Chọn thuốc</option>
                    {medications.map((med) => (
                      <option key={med._id} value={med._id}>
                        {med.name} - Tồn: {med.stockQuantity} ({formatCurrency(med.unitPrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <input
                  type="number"
                  placeholder="Số lượng"
                  value={medicationForm.quantity}
                  onChange={(e) => setMedicationForm({ ...medicationForm, quantity: parseInt(e.target.value) || 1 })}
                  className="px-3 py-2 border rounded"
                  min="1"
                />

                {/* Liều dùng với dropdown */}
                {customDosage ? (
                  <input
                    type="text"
                    placeholder="Liều dùng tùy chỉnh"
                    value={medicationForm.dosage}
                    onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                    className="px-3 py-2 border rounded"
                    onBlur={() => {
                      if (!medicationForm.dosage.trim()) {
                        setCustomDosage(false);
                        setMedicationForm({ ...medicationForm, dosage: '' });
                      }
                    }}
                  />
                ) : (
                  <select
                    value={medicationForm.dosage}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setCustomDosage(true);
                        setMedicationForm({ ...medicationForm, dosage: '' });
                      } else {
                        setMedicationForm({ ...medicationForm, dosage: e.target.value });
                      }
                    }}
                    className="px-3 py-2 border rounded"
                  >
                    <option value="">Liều dùng</option>
                    <option value="1 viên/ngày">1 viên/ngày</option>
                    <option value="2 viên/ngày">2 viên/ngày</option>
                    <option value="3 viên/ngày">3 viên/ngày</option>
                    <option value="4 viên/ngày">4 viên/ngày</option>
                    <option value="1 viên/2 lần/ngày">1 viên/2 lần/ngày</option>
                    <option value="1 viên/3 lần/ngày">1 viên/3 lần/ngày</option>
                    <option value="2 viên/2 lần/ngày">2 viên/2 lần/ngày</option>
                    <option value="1/2 viên/ngày">1/2 viên/ngày</option>
                    <option value="1 ống/ngày">1 ống/ngày</option>
                    <option value="2 ống/ngày">2 ống/ngày</option>
                    <option value="1 gói/ngày">1 gói/ngày</option>
                    <option value="2 gói/ngày">2 gói/ngày</option>
                    <option value="1 lần khi cần">1 lần khi cần</option>
                    <option value="custom">Tùy chỉnh...</option>
                  </select>
                )}

                {/* Cách dùng với dropdown */}
                {customUsage ? (
                  <input
                    type="text"
                    placeholder="Cách dùng tùy chỉnh"
                    value={medicationForm.usage}
                    onChange={(e) => setMedicationForm({ ...medicationForm, usage: e.target.value })}
                    className="px-3 py-2 border rounded"
                    onBlur={() => {
                      if (!medicationForm.usage.trim()) {
                        setCustomUsage(false);
                        setMedicationForm({ ...medicationForm, usage: '' });
                      }
                    }}
                  />
                ) : (
                  <select
                    value={medicationForm.usage}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setCustomUsage(true);
                        setMedicationForm({ ...medicationForm, usage: '' });
                      } else {
                        setMedicationForm({ ...medicationForm, usage: e.target.value });
                      }
                    }}
                    className="px-3 py-2 border rounded"
                  >
                    <option value="">Cách dùng</option>
                    <option value="Trước ăn">Trước ăn</option>
                    <option value="Sau ăn">Sau ăn</option>
                    <option value="Trong bữa ăn">Trong bữa ăn</option>
                    <option value="Khi đói">Khi đói</option>
                    <option value="Uống với nhiều nước">Uống với nhiều nước</option>
                    <option value="Ngậm dưới lưỡi">Ngậm dưới lưỡi</option>
                    <option value="Pha với nước ấm">Pha với nước ấm</option>
                    <option value="Tiêm bắp">Tiêm bắp</option>
                    <option value="Tiêm tĩnh mạch">Tiêm tĩnh mạch</option>
                    <option value="Bôi ngoài da">Bôi ngoài da</option>
                    <option value="Nhỏ mắt">Nhỏ mắt</option>
                    <option value="Nhỏ mũi">Nhỏ mũi</option>
                    <option value="Nhỏ tai">Nhỏ tai</option>
                    <option value="Khi cần">Khi cần</option>
                    <option value="custom">Tùy chỉnh...</option>
                  </select>
                )}

                {/* Thời gian với dropdown */}
                {customDuration ? (
                  <input
                    type="text"
                    placeholder="Thời gian tùy chỉnh"
                    value={medicationForm.duration}
                    onChange={(e) => setMedicationForm({ ...medicationForm, duration: e.target.value })}
                    className="px-3 py-2 border rounded"
                    required
                    onBlur={() => {
                      if (!medicationForm.duration.trim()) {
                        setCustomDuration(false);
                        setMedicationForm({ ...medicationForm, duration: '' });
                      }
                    }}
                  />
                ) : (
                  <select
                    value={medicationForm.duration}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setCustomDuration(true);
                        setMedicationForm({ ...medicationForm, duration: '' });
                      } else {
                        setMedicationForm({ ...medicationForm, duration: e.target.value });
                      }
                    }}
                    className="px-3 py-2 border rounded"
                    required
                  >
                    <option value="">Thời gian</option>
                    <option value="3 ngày">3 ngày</option>
                    <option value="5 ngày">5 ngày</option>
                    <option value="7 ngày">7 ngày</option>
                    <option value="10 ngày">10 ngày</option>
                    <option value="14 ngày">14 ngày</option>
                    <option value="21 ngày">21 ngày</option>
                    <option value="28 ngày">28 ngày</option>
                    <option value="1 tuần">1 tuần</option>
                    <option value="2 tuần">2 tuần</option>
                    <option value="3 tuần">3 tuần</option>
                    <option value="4 tuần">4 tuần</option>
                    <option value="1 tháng">1 tháng</option>
                    <option value="2 tháng">2 tháng</option>
                    <option value="3 tháng">3 tháng</option>
                    <option value="Uống đến hết">Uống đến hết</option>
                    <option value="Khi cần">Khi cần</option>
                    <option value="custom">Tùy chỉnh...</option>
                  </select>
                )}

                <button
                  type="button"
                  onClick={handleAddMedication}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <FaPlus /> Thêm
                </button>
              </div>
            </div>

            {/* Selected Medications List */}
            {selectedMedications.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Danh Sách Thuốc Đã Chọn ({selectedMedications.length})</h3>
                <div className="space-y-2">
                  {selectedMedications.map((med) => (
                    <div key={med.medicationId} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex-1">
                        <p className="font-medium">{med.medicationName}</p>
                        <p className="text-sm text-gray-600">
                          SL: {med.quantity} {med.unitTypeDisplay} | Liều: {med.dosage} | Cách dùng: {med.usage}
                          {med.duration && ` | Thời gian: ${med.duration}`}
                        </p>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(med.totalPrice)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveMedication(med.medicationId)}
                        className="ml-4 text-red-600 hover:text-red-800"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-4 bg-gray-100 rounded">
                  <p className="text-xl font-bold text-green-600">
                    Tổng tiền thuốc: {formatCurrency(calculateTotal())}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Template Tab */}
        {activeTab === 'template' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-lg text-gray-800">Đơn thuốc mẫu</h3>
                <p className="text-sm text-gray-500">
                  Tìm kiếm theo tên để nhanh chóng chọn đơn phù hợp với bệnh nhân.
                </p>
              </div>
              <div className="relative md:w-64">
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg pr-10"
                  placeholder="Tìm đơn mẫu..."
                />
                <svg
                  className="w-5 h-5 text-gray-400 absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates
                .filter((template) =>
                  template.name.toLowerCase().includes(templateSearch.trim().toLowerCase())
                )
                .map((template) => (
                  <div key={template._id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                    <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">
                      {template.diseaseType && `Bệnh: ${template.diseaseType}`}
                    </p>
                    <p className="text-sm text-gray-500 mb-3">
                      {template.medications?.length} thuốc | {formatCurrency(template.totalPrice)}
                    </p>
                    <button
                      onClick={() => handleUseTemplate(template)}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                      Sử Dụng Đơn Này
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Diagnosis and Notes */}
        {selectedMedications.length > 0 && (
          <div className="mt-6 space-y-4 border-t pt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chẩn đoán *
              </label>
              <input
                type="text"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                placeholder="Nhập chẩn đoán bệnh"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg"
                rows="3"
                placeholder="Ghi chú thêm về đơn thuốc..."
              />
            </div>

            {/* Save as Template Option */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="saveAsTemplate"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="saveAsTemplate" className="text-sm font-medium text-gray-700">
                Lưu đơn thuốc này làm mẫu
              </label>
            </div>

            {saveAsTemplate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên đơn thuốc mẫu
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="VD: Đơn thuốc cảm cúm thường"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center gap-2"
              >
                <FaSave />
                {loading ? 'Đang lưu...' : 'Lưu Đơn Thuốc'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrescriptionManager;
