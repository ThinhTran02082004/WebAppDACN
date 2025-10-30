import React, { useState, useEffect } from 'react';
import axios from 'axios';
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

  const [medicationForm, setMedicationForm] = useState({
    medicationId: '',
    quantity: 1,
    dosage: '',
    usage: '',
    duration: '',
    notes: ''
  });

  useEffect(() => {
    fetchMedications();
    fetchTemplates();
  }, []);

  const fetchMedications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/medications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedications(response.data.data.filter(m => m.stockQuantity > 0));
    } catch (error) {
      console.error('Error fetching medications:', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/prescription-templates`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(response.data.data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleAddMedication = () => {
    if (!medicationForm.medicationId) {
      toast.warning('Vui lòng chọn thuốc');
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
      dosage: medicationForm.dosage,
      usage: medicationForm.usage,
      duration: medicationForm.duration,
      notes: medicationForm.notes,
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
  };

  const handleRemoveMedication = (medicationId) => {
    setSelectedMedications(selectedMedications.filter(m => m.medicationId !== medicationId));
  };

  const handleUseTemplate = (template) => {
    const templateMedications = template.medications.map(med => ({
      medicationId: med.medicationId._id,
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

    // Check stock for all medications
    const insufficientStock = templateMedications.filter(tmed => {
      const med = medications.find(m => m._id === tmed.medicationId);
      return !med || med.stockQuantity < tmed.quantity;
    });

    if (insufficientStock.length > 0) {
      toast.error('Một số thuốc trong đơn mẫu không đủ tồn kho');
      return;
    }

    setSelectedMedications(templateMedications);
    setDiagnosis(template.diseaseType || '');
    setActiveTab('manual');
    toast.success('Đã áp dụng đơn thuốc mẫu');
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

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      // Create prescription
      const prescriptionData = {
        appointmentId,
        medications: selectedMedications.map(med => ({
          medicationId: med.medicationId,
          quantity: med.quantity,
          dosage: med.dosage,
          usage: med.usage,
          duration: med.duration,
          notes: med.notes
        })),
        diagnosis,
        notes
      };

      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/prescriptions`,
        prescriptionData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Kê đơn thuốc thành công');

      // Save as template if requested
      if (saveAsTemplate && templateName.trim()) {
        try {
          await axios.post(
            `${import.meta.env.VITE_API_URL}/prescription-templates`,
            {
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
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
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

                <input
                  type="text"
                  placeholder="Liều dùng (VD: 1 viên)"
                  value={medicationForm.dosage}
                  onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                  className="px-3 py-2 border rounded"
                />

                <input
                  type="text"
                  placeholder="Cách dùng (VD: Sau ăn)"
                  value={medicationForm.usage}
                  onChange={(e) => setMedicationForm({ ...medicationForm, usage: e.target.value })}
                  className="px-3 py-2 border rounded"
                />

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => (
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

