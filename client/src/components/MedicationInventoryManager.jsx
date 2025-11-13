import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FaPlus, FaHistory, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const MedicationInventoryManager = () => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [medications, setMedications] = useState([]);
  const [history, setHistory] = useState([]);
  const [lowStockAlerts, setLowStockAlerts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('all'); // 'all' or specific hospitalId
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('inventory'); // 'inventory', 'import', 'history', 'alerts'
  const [filter, setFilter] = useState({
    search: '',
    category: ''
  });

  const [importForm, setImportForm] = useState({
    medicationId: '',
    quantity: 0,
    unitPrice: 0,
    supplier: '',
    batchNumber: '',
    expiryDate: '',
    notes: ''
  });

  useEffect(() => {
    // Fetch hospitals if admin
    if (user && (user.role === 'admin' || user.roleType === 'admin')) {
      fetchHospitals();
    }
    fetchMedications();
    fetchLowStockAlerts();

    // Listen for real-time stock updates
    if (socket) {
      socket.on('stock_updated', handleStockUpdate);
      
      return () => {
        socket.off('stock_updated', handleStockUpdate);
      };
    }
  }, [socket, selectedHospitalId]);

  const fetchHospitals = async () => {
    try {
      const res = await api.get('/admin/hospitals', { params: { limit: 100 } });
      if (res.data.success) {
        let hospitalsData = [];
        if (res.data.data && res.data.data.hospitals && Array.isArray(res.data.data.hospitals)) {
          hospitalsData = res.data.data.hospitals;
        } else if (Array.isArray(res.data.data)) {
          hospitalsData = res.data.data;
        }
        setHospitals(hospitalsData);
      }
    } catch (error) {
      console.error('Error fetching hospitals:', error);
    }
  };

  const handleStockUpdate = (data) => {
    console.log('Stock updated:', data);
    toast.info(`Thuốc "${data.medicationName}" đã được cập nhật. Tồn kho: ${data.newStock}`, {
      autoClose: 3000
    });
    
    // Update local state
    setMedications(prev => prev.map(med => 
      med._id === data.medicationId 
        ? { ...med, stockQuantity: data.newStock }
        : med
    ));

    // Refresh alerts if stock is low
    if (data.newStock < data.lowStockThreshold) {
      fetchLowStockAlerts();
    }
  };

  const fetchMedications = async () => {
    try {
      setLoading(true);
      const params = { limit: 1000 };
      // For admin, add hospitalId filter if selected
      if (user && (user.role === 'admin' || user.roleType === 'admin') && selectedHospitalId !== 'all') {
        params.hospitalId = selectedHospitalId;
      }
      const response = await api.get('/medications', { params });
      // API returns { data: { docs: [...] } }
      const medicationsList = response.data.data?.docs || response.data.docs || response.data.data || [];
      setMedications(Array.isArray(medicationsList) ? medicationsList : []);
    } catch (error) {
      toast.error('Không thể tải danh sách thuốc');
      console.error('Error fetching medications:', error);
      setMedications([]); // Set empty array on error
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const params = { limit: 50 };
      // For admin, add hospitalId filter if selected
      if (user && (user.role === 'admin' || user.roleType === 'admin') && selectedHospitalId !== 'all') {
        params.hospitalId = selectedHospitalId;
      }
      const response = await api.get('/medication-inventory/history', { params });
      setHistory(response.data.data);
    } catch (error) {
      toast.error('Không thể tải lịch sử xuất nhập');
      console.error('Error fetching history:', error);
    }
  };

  const fetchLowStockAlerts = async () => {
    try {
      const params = {};
      // For admin, add hospitalId filter if selected
      if (user && (user.role === 'admin' || user.roleType === 'admin') && selectedHospitalId !== 'all') {
        params.hospitalId = selectedHospitalId;
      }
      const response = await api.get('/medication-inventory/alerts', { params });
      setLowStockAlerts(response.data.data);
    } catch (error) {
      console.error('Error fetching alerts:', error);
    }
  };

  const handleImportStock = async (e) => {
    e.preventDefault();

    if (!importForm.medicationId || importForm.quantity <= 0) {
      toast.warning('Vui lòng chọn thuốc và nhập số lượng hợp lệ');
      return;
    }

    try {
      setLoading(true);
      await api.post('/medication-inventory/import', importForm);
      toast.success('Nhập hàng thành công');
      
      // Reset form
      setImportForm({
        medicationId: '',
        quantity: 0,
        unitPrice: 0,
        supplier: '',
        batchNumber: '',
        expiryDate: '',
        notes: ''
      });

      // Refresh data
      fetchMedications();
      fetchLowStockAlerts();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể nhập hàng');
    } finally {
      setLoading(false);
    }
  };

  const handleMedicationSelect = (medicationId) => {
    const med = medications.find(m => m._id === medicationId);
    if (med) {
      setImportForm({
        ...importForm,
        medicationId,
        unitPrice: med.unitPrice || 0
      });
    }
  };

  const filteredMedications = (Array.isArray(medications) ? medications : []).filter(med => {
    const matchSearch = !filter.search || 
      med.name.toLowerCase().includes(filter.search.toLowerCase()) ||
      med.genericName?.toLowerCase().includes(filter.search.toLowerCase());
    
    const matchCategory = !filter.category || med.category === filter.category;
    
    // Additional hospital filter for client-side (if admin selected 'all' but medications still come filtered)
    // This is a backup filter, primary filtering happens in fetchMedications
    const matchHospital = selectedHospitalId === 'all' || 
      !selectedHospitalId || 
      (med.hospitalId && (
        (typeof med.hospitalId === 'string' && med.hospitalId === selectedHospitalId) ||
        (typeof med.hospitalId === 'object' && med.hospitalId._id === selectedHospitalId)
      ));
    
    return matchSearch && matchCategory && matchHospital;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('vi-VN');
  };

  const getStockStatus = (med) => {
    if (med.stockQuantity === 0) return { text: 'Hết hàng', color: 'bg-red-100 text-red-800' };
    if (med.stockQuantity < med.lowStockThreshold) return { text: 'Sắp hết', color: 'bg-yellow-100 text-yellow-800' };
    return { text: 'Còn hàng', color: 'bg-green-100 text-green-800' };
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">Quản Lý Kho Thuốc</h2>
            <div className="flex items-center gap-4">
              {/* Hospital selection for admin */}
              {user && (user.role === 'admin' || user.roleType === 'admin') && (
                <select
                  value={selectedHospitalId}
                  onChange={(e) => {
                    setSelectedHospitalId(e.target.value);
                  }}
                  className="px-4 py-2 border rounded-lg bg-white"
                >
                  <option value="all">Tất cả chi nhánh</option>
                  {hospitals.map((hospital) => (
                    <option key={hospital._id} value={hospital._id}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => {
                  fetchMedications();
                  fetchLowStockAlerts();
                }}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center gap-2"
              >
                <FaSync className={loading ? 'animate-spin' : ''} />
                Làm mới
              </button>
            </div>
          </div>
        </div>

        {/* Alerts Banner */}
        {lowStockAlerts.length > 0 && (
          <div className="p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <div className="flex items-center">
              <FaExclamationTriangle className="text-yellow-600 mr-3" />
              <div>
                <p className="font-semibold text-yellow-800">
                  Cảnh báo: {lowStockAlerts.length} thuốc sắp hết hàng
                </p>
                <button
                  onClick={() => setActiveTab('alerts')}
                  className="text-sm text-yellow-700 underline"
                >
                  Xem chi tiết
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'inventory'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            Tồn Kho
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-6 py-3 font-medium ${
              activeTab === 'import'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <FaPlus className="inline mr-2" />
            Nhập Hàng
          </button>
          <button
            onClick={() => { setActiveTab('history'); fetchHistory(); }}
            className={`px-6 py-3 font-medium ${
              activeTab === 'history'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <FaHistory className="inline mr-2" />
            Lịch Sử
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-6 py-3 font-medium relative ${
              activeTab === 'alerts'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600'
            }`}
          >
            <FaExclamationTriangle className="inline mr-2" />
            Cảnh Báo
            {lowStockAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {lowStockAlerts.length}
              </span>
            )}
          </button>
        </div>

        <div className="p-6">
          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <div>
              {/* Filters */}
              <div className="mb-4 flex gap-4">
                <input
                  type="text"
                  placeholder="Tìm kiếm thuốc..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="flex-1 px-4 py-2 border rounded-lg"
                />
                <select
                  value={filter.category}
                  onChange={(e) => setFilter({ ...filter, category: e.target.value })}
                  className="px-4 py-2 border rounded-lg"
                >
                  <option value="">Tất cả danh mục</option>
                  <option value="kháng sinh">Kháng sinh</option>
                  <option value="giảm đau">Giảm đau</option>
                  <option value="vitamin">Vitamin</option>
                  <option value="khác">Khác</option>
                </select>
              </div>

              {/* Medications Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tên thuốc</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Danh mục</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chi nhánh</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Đơn giá</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tồn kho</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredMedications.map((med) => {
                      const status = getStockStatus(med);
                      const hospitalName = med.hospitalId 
                        ? (typeof med.hospitalId === 'object' ? med.hospitalId.name : 'N/A')
                        : 'N/A';
                      return (
                        <tr key={med._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div>
                              <div className="font-medium text-gray-900">{med.name}</div>
                              {med.genericName && (
                                <div className="text-sm text-gray-500">{med.genericName}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{med.category}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="font-medium">{hospitalName}</div>
                            {med.hospitalId && typeof med.hospitalId === 'object' && med.hospitalId.address && (
                              <div className="text-xs text-gray-500">{med.hospitalId.address}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                            {formatCurrency(med.unitPrice)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-semibold ${
                              med.stockQuantity === 0 ? 'text-red-600' :
                              med.stockQuantity < med.lowStockThreshold ? 'text-yellow-600' :
                              'text-green-600'
                            }`}>
                              {med.stockQuantity} {med.unitTypeDisplay}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                              {status.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Tab */}
          {activeTab === 'import' && (
            <div className="max-w-2xl">
              <h3 className="text-lg font-semibold mb-4">Nhập Hàng Thuốc</h3>
              <form onSubmit={handleImportStock} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Chọn thuốc *</label>
                  <select
                    value={importForm.medicationId}
                    onChange={(e) => handleMedicationSelect(e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Chọn thuốc cần nhập</option>
                    {filteredMedications.map((med) => {
                      const hospitalName = med.hospitalId 
                        ? (typeof med.hospitalId === 'object' ? med.hospitalId.name : 'N/A')
                        : 'N/A';
                      return (
                        <option key={med._id} value={med._id}>
                          {med.name} (Tồn: {med.stockQuantity} {med.unitTypeDisplay}) - {hospitalName}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số lượng nhập *</label>
                    <input
                      type="number"
                      value={importForm.quantity}
                      onChange={(e) => setImportForm({ ...importForm, quantity: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border rounded-lg"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Đơn giá</label>
                    <input
                      type="number"
                      value={importForm.unitPrice}
                      onChange={(e) => setImportForm({ ...importForm, unitPrice: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border rounded-lg"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp</label>
                  <input
                    type="text"
                    value={importForm.supplier}
                    onChange={(e) => setImportForm({ ...importForm, supplier: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="Tên nhà cung cấp"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số lô</label>
                    <input
                      type="text"
                      value={importForm.batchNumber}
                      onChange={(e) => setImportForm({ ...importForm, batchNumber: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hạn sử dụng</label>
                    <input
                      type="date"
                      value={importForm.expiryDate}
                      onChange={(e) => setImportForm({ ...importForm, expiryDate: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
                  <textarea
                    value={importForm.notes}
                    onChange={(e) => setImportForm({ ...importForm, notes: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    rows="3"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {loading ? 'Đang xử lý...' : 'Nhập Hàng'}
                </button>
              </form>
            </div>
          )}

          {/* History Tab */}
          {activeTab === 'history' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Lịch Sử Xuất Nhập Kho</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thời gian</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Thuốc</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chi nhánh</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loại</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Số lượng</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tồn kho</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Người thực hiện</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.map((item) => {
                      const hospitalName = item.hospitalId 
                        ? (typeof item.hospitalId === 'object' ? item.hospitalId.name : 'N/A')
                        : 'N/A';
                      return (
                        <tr key={item._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {formatDateTime(item.createdAt)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium">{item.medicationId?.name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            <div className="font-medium">{hospitalName}</div>
                            {item.hospitalId && typeof item.hospitalId === 'object' && item.hospitalId.address && (
                              <div className="text-xs text-gray-500">{item.hospitalId.address}</div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.transactionType === 'import' ? 'bg-green-100 text-green-800' :
                              item.transactionType === 'export' ? 'bg-red-100 text-red-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {item.transactionType === 'import' ? 'Nhập' :
                               item.transactionType === 'export' ? 'Xuất' :
                               item.transactionType === 'prescription' ? 'Kê đơn' : 'Điều chỉnh'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <span className={item.transactionType === 'import' ? 'text-green-600' : 'text-red-600'}>
                              {item.transactionType === 'import' ? '+' : '-'}{item.quantity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {item.previousStock} → {item.newStock}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {item.performedBy?.fullName || 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Alerts Tab */}
          {activeTab === 'alerts' && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Cảnh Báo Tồn Kho Thấp</h3>
              {lowStockAlerts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">Không có cảnh báo nào</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lowStockAlerts.map((alert) => {
                    const hospitalName = alert.hospitalId 
                      ? (typeof alert.hospitalId === 'object' ? alert.hospitalId.name : 'N/A')
                      : 'N/A';
                    return (
                      <div key={alert._id} className="border border-yellow-300 rounded-lg p-4 bg-yellow-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{alert.name}</h4>
                            <p className="text-xs text-gray-600 mt-1">Chi nhánh: {hospitalName}</p>
                          </div>
                          <FaExclamationTriangle className="text-yellow-600" />
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Tồn kho: <strong className="text-red-600">{alert.stockQuantity}</strong> {alert.unitTypeDisplay}
                        </p>
                        <p className="text-sm text-gray-600">
                          Ngưỡng cảnh báo: {alert.lowStockThreshold} {alert.unitTypeDisplay}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedicationInventoryManager;

