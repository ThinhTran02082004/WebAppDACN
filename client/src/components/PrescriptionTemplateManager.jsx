import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaCopy, FaEye, FaTimes } from 'react-icons/fa';

const PrescriptionTemplateManager = ({ onSelectTemplate }) => {
  const [templates, setTemplates] = useState([]);
  const [medications, setMedications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [filter, setFilter] = useState({
    category: '',
    createdByRole: ''
  });

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    diseaseType: '',
    isPublic: true,
    medications: []
  });

  const [medicationForm, setMedicationForm] = useState({
    medicationId: '',
    quantity: 1,
    dosage: '',
    usage: '',
    duration: '',
    notes: ''
  });

  useEffect(() => {
    fetchTemplates();
    fetchMedications();
  }, [filter]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = {};
      if (filter.category) params.category = filter.category;
      if (filter.createdByRole) params.createdByRole = filter.createdByRole;

      const response = await axios.get(`${import.meta.env.VITE_API_URL}/prescription-templates`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setTemplates(response.data.data);
    } catch (error) {
      toast.error('Không thể tải danh sách đơn thuốc mẫu');
    } finally {
      setLoading(false);
    }
  };

  const fetchMedications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/medications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMedications(response.data.data);
    } catch (error) {
      console.error('Error fetching medications:', error);
    }
  };

  const handleAddMedication = () => {
    if (!medicationForm.medicationId) {
      toast.warning('Vui lòng chọn thuốc');
      return;
    }

    const medication = medications.find(m => m._id === medicationForm.medicationId);
    if (!medication) return;

    const newMedication = {
      ...medicationForm,
      medicationName: medication.name,
      unitPrice: medication.unitPrice
    };

    setFormData({
      ...formData,
      medications: [...formData.medications, newMedication]
    });

    // Reset medication form
    setMedicationForm({
      medicationId: '',
      quantity: 1,
      dosage: '',
      usage: '',
      duration: '',
      notes: ''
    });
  };

  const handleRemoveMedication = (index) => {
    const newMedications = formData.medications.filter((_, i) => i !== index);
    setFormData({ ...formData, medications: newMedications });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.medications.length === 0) {
      toast.warning('Vui lòng thêm ít nhất một loại thuốc');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/prescription-templates`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Tạo đơn thuốc mẫu thành công');
      setShowForm(false);
      resetForm();
      fetchTemplates();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể tạo đơn thuốc mẫu');
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa đơn thuốc mẫu này?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/prescription-templates/${id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Xóa đơn thuốc mẫu thành công');
      fetchTemplates();
    } catch (error) {
      toast.error('Không thể xóa đơn thuốc mẫu');
    }
  };

  const handleCloneTemplate = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${import.meta.env.VITE_API_URL}/prescription-templates/${id}/clone`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success('Sao chép đơn thuốc mẫu thành công');
      fetchTemplates();
    } catch (error) {
      toast.error('Không thể sao chép đơn thuốc mẫu');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: '',
      diseaseType: '',
      isPublic: true,
      medications: []
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Quản Lý Đơn Thuốc Mẫu</h2>
            <button
              onClick={() => setShowForm(!showForm)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              {showForm ? <FaTimes /> : <FaPlus />}
              {showForm ? 'Đóng' : 'Tạo Đơn Mẫu'}
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filter.category}
              onChange={(e) => setFilter({ ...filter, category: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Tất cả danh mục</option>
              <option value="common">Bệnh thường gặp</option>
              <option value="chronic">Bệnh mãn tính</option>
              <option value="acute">Bệnh cấp tính</option>
              <option value="pediatric">Nhi khoa</option>
              <option value="other">Khác</option>
            </select>

            <select
              value={filter.createdByRole}
              onChange={(e) => setFilter({ ...filter, createdByRole: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Người tạo</option>
              <option value="admin">Admin</option>
              <option value="doctor">Bác sĩ</option>
            </select>
          </div>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="p-6 bg-gray-50 border-b">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên đơn thuốc mẫu *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Danh mục *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Chọn danh mục</option>
                    <option value="common">Bệnh thường gặp</option>
                    <option value="chronic">Bệnh mãn tính</option>
                    <option value="acute">Bệnh cấp tính</option>
                    <option value="pediatric">Nhi khoa</option>
                    <option value="other">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loại bệnh
                  </label>
                  <input
                    type="text"
                    value={formData.diseaseType}
                    onChange={(e) => setFormData({ ...formData, diseaseType: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="VD: Cảm cúm, Ho, ..."
                  />
                </div>

                <div className="flex items-center">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPublic}
                      onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Công khai (tất cả bác sĩ có thể sử dụng)
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="2"
                />
              </div>

              {/* Add Medication */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-3">Thêm Thuốc</h3>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <select
                    value={medicationForm.medicationId}
                    onChange={(e) => setMedicationForm({ ...medicationForm, medicationId: e.target.value })}
                    className="px-3 py-2 border rounded"
                  >
                    <option value="">Chọn thuốc</option>
                    {medications.map((med) => (
                      <option key={med._id} value={med._id}>
                        {med.name} ({formatCurrency(med.unitPrice)})
                      </option>
                    ))}
                  </select>

                  <input
                    type="number"
                    placeholder="Số lượng"
                    value={medicationForm.quantity}
                    onChange={(e) => setMedicationForm({ ...medicationForm, quantity: parseInt(e.target.value) })}
                    className="px-3 py-2 border rounded"
                    min="1"
                  />

                  <input
                    type="text"
                    placeholder="Liều dùng"
                    value={medicationForm.dosage}
                    onChange={(e) => setMedicationForm({ ...medicationForm, dosage: e.target.value })}
                    className="px-3 py-2 border rounded"
                  />

                  <input
                    type="text"
                    placeholder="Cách dùng"
                    value={medicationForm.usage}
                    onChange={(e) => setMedicationForm({ ...medicationForm, usage: e.target.value })}
                    className="px-3 py-2 border rounded"
                  />

                  <input
                    type="text"
                    placeholder="Thời gian"
                    value={medicationForm.duration}
                    onChange={(e) => setMedicationForm({ ...medicationForm, duration: e.target.value })}
                    className="px-3 py-2 border rounded"
                  />

                  <button
                    type="button"
                    onClick={handleAddMedication}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    <FaPlus />
                  </button>
                </div>
              </div>

              {/* Medications List */}
              {formData.medications.length > 0 && (
                <div className="border-t pt-4">
                  <h3 className="text-lg font-semibold mb-3">Danh sách thuốc ({formData.medications.length})</h3>
                  <div className="space-y-2">
                    {formData.medications.map((med, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-white border rounded">
                        <div className="flex-1">
                          <p className="font-medium">{medications.find(m => m._id === med.medicationId)?.name}</p>
                          <p className="text-sm text-gray-600">
                            SL: {med.quantity} | Liều: {med.dosage} | Cách dùng: {med.usage} | Thời gian: {med.duration}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMedication(index)}
                          className="ml-4 text-red-600 hover:text-red-800"
                        >
                          <FaTrash />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); resetForm(); }}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Tạo Đơn Mẫu
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Templates List */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">Đang tải...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Chưa có đơn thuốc mẫu nào</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div key={template._id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {template.category}
                    </span>
                  </div>

                  {template.diseaseType && (
                    <p className="text-sm text-gray-600 mb-2">Bệnh: {template.diseaseType}</p>
                  )}

                  <p className="text-sm text-gray-500 mb-3">
                    Người tạo: {template.creatorName} ({template.createdByRole})
                  </p>

                  <p className="text-sm mb-2">
                    Số thuốc: <strong>{template.medications?.length || 0}</strong>
                  </p>

                  <p className="text-lg font-bold text-green-600 mb-3">
                    {formatCurrency(template.totalPrice)}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowDetails(template)}
                      className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center gap-2"
                      title="Xem chi tiết"
                    >
                      <FaEye />
                    </button>
                    {onSelectTemplate && (
                      <button
                        onClick={() => onSelectTemplate(template)}
                        className="flex-1 px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded"
                      >
                        Sử dụng
                      </button>
                    )}
                    <button
                      onClick={() => handleCloneTemplate(template._id)}
                      className="px-3 py-2 bg-blue-100 hover:bg-blue-200 rounded"
                      title="Sao chép"
                    >
                      <FaCopy />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template._id)}
                      className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded"
                      title="Xóa"
                    >
                      <FaTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold">{showDetails.name}</h2>
                <button
                  onClick={() => setShowDetails(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <FaTimes size={24} />
                </button>
              </div>

              {showDetails.description && (
                <p className="text-gray-600 mb-4">{showDetails.description}</p>
              )}

              <div className="mb-4">
                <p><strong>Danh mục:</strong> {showDetails.category}</p>
                {showDetails.diseaseType && (
                  <p><strong>Loại bệnh:</strong> {showDetails.diseaseType}</p>
                )}
                <p><strong>Người tạo:</strong> {showDetails.creatorName} ({showDetails.createdByRole})</p>
                <p><strong>Công khai:</strong> {showDetails.isPublic ? 'Có' : 'Không'}</p>
                <p><strong>Số lần sử dụng:</strong> {showDetails.usageCount}</p>
              </div>

              <h3 className="text-lg font-semibold mb-3">Danh sách thuốc</h3>
              <div className="space-y-3">
                {showDetails.medications?.map((med, index) => (
                  <div key={index} className="border rounded p-3">
                    <p className="font-medium">{med.medicationId?.name}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                      <p><strong>Số lượng:</strong> {med.quantity} {med.medicationId?.unitTypeDisplay}</p>
                      <p><strong>Đơn giá:</strong> {formatCurrency(med.medicationId?.unitPrice)}</p>
                      <p><strong>Liều dùng:</strong> {med.dosage}</p>
                      <p><strong>Cách dùng:</strong> {med.usage}</p>
                      <p><strong>Thời gian:</strong> {med.duration}</p>
                      {med.notes && <p className="col-span-2"><strong>Ghi chú:</strong> {med.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t">
                <p className="text-xl font-bold text-green-600">
                  Tổng tiền: {formatCurrency(showDetails.totalPrice)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrescriptionTemplateManager;

