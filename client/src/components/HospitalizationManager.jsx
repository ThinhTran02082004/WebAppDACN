import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FaBed, FaExchangeAlt, FaSignOutAlt, FaClock, FaMoneyBillWave } from 'react-icons/fa';

const HospitalizationManager = ({ appointmentId, patientId, onUpdate }) => {
  const [hospitalization, setHospitalization] = useState(null);
  const [availableRooms, setAvailableRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showDischargeForm, setShowDischargeForm] = useState(false);

  const [assignForm, setAssignForm] = useState({
    inpatientRoomId: '',
    admissionReason: '',
    notes: ''
  });

  const [transferForm, setTransferForm] = useState({
    newRoomId: '',
    reason: ''
  });

  const [dischargeForm, setDischargeForm] = useState({
    reason: ''
  });

  const [currentInfo, setCurrentInfo] = useState(null);
  const [autoUpdateInterval, setAutoUpdateInterval] = useState(null);

  useEffect(() => {
    if (appointmentId) {
      fetchHospitalization();
    }
  }, [appointmentId]);

  useEffect(() => {
    // Auto-update current cost every minute if patient is admitted
    if (hospitalization && hospitalization.status !== 'discharged') {
      const interval = setInterval(() => {
        updateCurrentCost();
      }, 60000); // Every minute

      setAutoUpdateInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [hospitalization]);

  const fetchHospitalization = async () => {
    try {
      const response = await api.get(`/hospitalizations/appointment/${appointmentId}`);

      if (response.data.data) {
        setHospitalization(response.data.data);
        const srv = response.data.data.currentInfo || {};
        const calc = computeCurrentRoomAndTotals(response.data.data);
        setCurrentInfo({
          currentHours: srv.currentHours ?? calc.currentRoomHours,
          currentCost: srv.currentCost ?? calc.currentRoomCost,
          currentRoomStart: srv.currentRoomStart ?? calc.currentRoomStart,
          currentRoomHours: srv.currentRoomHours ?? calc.currentRoomHours,
          currentRoomCost: srv.currentRoomCost ?? calc.currentRoomCost,
          totalSoFarHours: srv.totalSoFarHours ?? calc.totalSoFarHours,
          totalSoFarAmount: srv.totalSoFarAmount ?? calc.totalSoFarAmount
        });
      }
    } catch (error) {
      console.error('Error fetching hospitalization:', error);
      // Không hiển thị toast nếu không có hospitalization (404) vì đó là trường hợp bình thường
      if (error.response?.status !== 404) {
        toast.error('Không thể tải thông tin nằm viện');
      }
    }
  };

  const fetchAvailableRooms = async (type = '') => {
    try {
      const params = {};
      if (type) params.type = type;
      const response = await api.get('/hospitalizations/available-rooms', { params });
      setAvailableRooms(response.data.data);
    } catch (error) {
      toast.error('Không thể tải danh sách phòng trống');
    }
  };

  const updateCurrentCost = () => {
    if (hospitalization && hospitalization.status !== 'discharged') {
      const admissionDate = new Date(hospitalization.admissionDate);
      const now = new Date();
      const hours = Math.ceil((now - admissionDate) / (1000 * 60 * 60));
      const cost = hours * hospitalization.hourlyRate;

      setCurrentInfo({
        currentHours: hours,
        currentCost: cost
      });
    }
  };

  const handleAssignRoom = async (e) => {
    e.preventDefault();

    if (!assignForm.inpatientRoomId) {
      toast.warning('Vui lòng chọn phòng');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post('/hospitalizations/assign', {
        appointmentId,
        ...assignForm
      });

      toast.success('Phân phòng nội trú thành công');
      setHospitalization(response.data.data);
      setShowAssignForm(false);
      setAssignForm({ inpatientRoomId: '', admissionReason: '', notes: '' });

      if (onUpdate) onUpdate();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể phân phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferRoom = async (e) => {
    e.preventDefault();

    if (!transferForm.newRoomId) {
      toast.warning('Vui lòng chọn phòng mới');
      return;
    }

    try {
      setLoading(true);
      const response = await api.post(`/hospitalizations/${hospitalization._id}/transfer`, transferForm);

      toast.success('Chuyển phòng thành công');
      setHospitalization(response.data.data);
      const calc = computeCurrentRoomAndTotals(response.data.data);
      setCurrentInfo({
        currentHours: calc.currentRoomHours,
        currentCost: calc.currentRoomCost,
        currentRoomStart: calc.currentRoomStart,
        currentRoomHours: calc.currentRoomHours,
        currentRoomCost: calc.currentRoomCost,
        totalSoFarHours: calc.totalSoFarHours,
        totalSoFarAmount: calc.totalSoFarAmount
      });
      setShowTransferForm(false);
      setTransferForm({ newRoomId: '', reason: '' });

      if (onUpdate) onUpdate();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể chuyển phòng');
    } finally {
      setLoading(false);
    }
  };

  const handleDischarge = async (e) => {
    e.preventDefault();

    if (!window.confirm('Bạn có chắc chắn muốn xuất viện cho bệnh nhân này?')) return;

    try {
      setLoading(true);
      const response = await api.post(`/hospitalizations/${hospitalization._id}/discharge`, dischargeForm);

      toast.success('Xuất viện thành công');
      setHospitalization(response.data.data);
      setShowDischargeForm(false);
      setDischargeForm({ reason: '' });
      
      if (autoUpdateInterval) {
        clearInterval(autoUpdateInterval);
      }

      if (onUpdate) onUpdate();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xuất viện');
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

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('vi-VN');
  };

  // Compute current room timing/cost and cumulative totals from roomHistory
  const computeCurrentRoomAndTotals = (hosp) => {
    const history = hosp?.roomHistory || [];
    const latest = history.length > 0 ? history[history.length - 1] : null;
    const now = new Date();
    const start = latest?.checkInTime ? new Date(latest.checkInTime) : new Date(hosp.admissionDate);
    const rate = latest?.hourlyRate || hosp.hourlyRate || 0;
    const currentHours = Math.max(0, Math.ceil((now - start) / (1000 * 60 * 60)));
    const currentCost = currentHours * rate;
    const finalized = history.filter(e => !!e.checkOutTime);
    const finalizedHours = finalized.reduce((s, e) => s + (e.hours || 0), 0);
    const finalizedAmount = finalized.reduce((s, e) => s + (e.amount || 0), 0);
    return {
      currentRoomStart: start,
      currentRoomHours: currentHours,
      currentRoomCost: currentCost,
      totalSoFarHours: finalizedHours + currentHours,
      totalSoFarAmount: finalizedAmount + currentCost
    };
  };

  const getRoomTypeLabel = (type) => {
    const labels = { standard: 'Tiêu chuẩn', vip: 'VIP', icu: 'ICU' };
    return labels[type] || type;
  };

  // If not hospitalized yet
  if (!hospitalization) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
          <FaBed />
          Nằm Viện
        </h3>

        {!showAssignForm ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">Bệnh nhân chưa được phân phòng nội trú</p>
            <button
              onClick={() => { setShowAssignForm(true); fetchAvailableRooms(); }}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 mx-auto"
            >
              <FaBed />
              Phân Phòng Nội Trú
            </button>
          </div>
        ) : (
          <form onSubmit={handleAssignRoom} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chọn phòng *
              </label>
              <select
                value={assignForm.inpatientRoomId}
                onChange={(e) => setAssignForm({ ...assignForm, inpatientRoomId: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              >
                <option value="">Chọn phòng trống</option>
                {availableRooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    Phòng {room.roomNumber} - {getRoomTypeLabel(room.type)} 
                    ({formatCurrency(room.hourlyRate)}/giờ) - Còn trống: {room.capacity - room.currentOccupancy}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lý do nhập viện *
              </label>
              <input
                type="text"
                value={assignForm.admissionReason}
                onChange={(e) => setAssignForm({ ...assignForm, admissionReason: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ghi chú
              </label>
              <textarea
                value={assignForm.notes}
                onChange={(e) => setAssignForm({ ...assignForm, notes: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                rows="3"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAssignForm(false)}
                className="px-6 py-2 border rounded-lg hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Đang xử lý...' : 'Phân Phòng'}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  }

  // If hospitalized
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <FaBed />
        Thông Tin Nằm Viện
      </h3>

      {/* Current Status */}
      <div className="bg-blue-50 p-4 rounded-lg mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Phòng hiện tại</p>
            <p className="text-lg font-semibold">
              Phòng {hospitalization.inpatientRoomId?.roomNumber} - {getRoomTypeLabel(hospitalization.inpatientRoomId?.type)}
            </p>
            {hospitalization.inpatientRoomId?.floor && (
              <p className="text-sm text-gray-600">{hospitalization.inpatientRoomId.floor}</p>
            )}
          </div>

          <div>
            <p className="text-sm text-gray-600">Phí phòng</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(hospitalization.hourlyRate)}/giờ
            </p>
          </div>
        </div>
      </div>

      {/* Time and Cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
            <FaClock />
            Thời gian nằm viện
          </p>
          {hospitalization.status === 'discharged' ? (
            <>
              <p className="text-sm">
                <strong>Nhập viện:</strong> {formatDateTime(hospitalization.admissionDate)}
              </p>
              <p className="text-sm">
                <strong>Xuất viện:</strong> {formatDateTime(hospitalization.dischargeDate)}
              </p>
              <p className="text-lg font-bold text-blue-600 mt-2">
                Tổng: {hospitalization.totalHours} giờ
              </p>
            </>
          ) : (
            <>
              <p className="text-sm">
                <strong>Vào phòng hiện tại:</strong> {formatDateTime(currentInfo?.currentRoomStart || hospitalization.admissionDate)}
              </p>
              <p className="text-lg font-bold text-blue-600 mt-2">
                {currentInfo?.currentRoomHours ?? currentInfo?.currentHours ?? 0} giờ (đang cập nhật...)
              </p>
            </>
          )}
        </div>

        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
            <FaMoneyBillWave />
            Chi phí nội trú
          </p>
          {hospitalization.status === 'discharged' ? (
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(hospitalization.totalAmount)}
            </p>
          ) : (
            <>
              <div className="mb-1">
                <p className="text-xs text-gray-500">Chi phí phòng hiện tại</p>
                <p className="text-xl font-bold text-yellow-600">
                  {formatCurrency(currentInfo?.currentRoomCost ?? currentInfo?.currentCost ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tổng nội trú (tạm tính)</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatCurrency(currentInfo?.totalSoFarAmount ?? (currentInfo?.currentCost || 0))}
                </p>
              </div>
              <p className="text-xs text-gray-500 mt-1">(Dự tính, cập nhật tự động)</p>
            </>
          )}
        </div>
      </div>

      {/* Admission Reason */}
      {hospitalization.admissionReason && (
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700">Lý do nhập viện:</p>
          <p className="text-gray-900">{hospitalization.admissionReason}</p>
        </div>
      )}

      {/* Room History */}
      {hospitalization.roomHistory && hospitalization.roomHistory.length > 0 && (
        <div className="mb-4 border rounded-lg p-4 bg-gray-50">
          <p className="text-sm font-medium text-gray-700 mb-3">Lịch sử chuyển phòng:</p>
          <div className="space-y-3">
            {hospitalization.roomHistory.map((roomEntry, index) => (
              <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium text-gray-800">
                    Phòng {roomEntry.roomNumber || roomEntry.inpatientRoomId?.roomNumber || 'N/A'}
                    {roomEntry.roomType && (
                      <span className="ml-2 text-xs text-gray-500">({getRoomTypeLabel(roomEntry.roomType)})</span>
                    )}
                  </div>
                  {roomEntry.amount > 0 && (
                    <div className="text-sm font-semibold text-gray-700">
                      {formatCurrency(roomEntry.amount)}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <div>
                    <span className="font-medium">Vào:</span> {roomEntry.checkInTime ? formatDateTime(roomEntry.checkInTime) : 'N/A'}
                  </div>
                  <div>
                    <span className="font-medium">Ra:</span> {roomEntry.checkOutTime ? formatDateTime(roomEntry.checkOutTime) : 'Đang ở'}
                  </div>
                  {roomEntry.hours > 0 && (
                    <div>
                      <span className="font-medium">Thời gian:</span> {roomEntry.hours} giờ
                    </div>
                  )}
                  {roomEntry.hourlyRate > 0 && (
                    <div>
                      <span className="font-medium">Giá/giờ:</span> {formatCurrency(roomEntry.hourlyRate)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {hospitalization.status !== 'discharged' && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { setShowTransferForm(true); fetchAvailableRooms(); }}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 flex items-center gap-2"
          >
            <FaExchangeAlt />
            Chuyển Phòng
          </button>
          <button
            onClick={() => setShowDischargeForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <FaSignOutAlt />
            Xuất Viện
          </button>
        </div>
      )}

      {/* Discharge Info */}
      {hospitalization.status === 'discharged' && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <p className="font-semibold text-green-800 mb-2">Đã xuất viện</p>
          {hospitalization.dischargeReason && (
            <p className="text-sm text-gray-700">
              <strong>Lý do:</strong> {hospitalization.dischargeReason}
            </p>
          )}
          {hospitalization.dischargedBy && (
            <p className="text-sm text-gray-600">
              Xuất viện bởi: {hospitalization.dischargedBy.user?.fullName}
            </p>
          )}
        </div>
      )}

      {/* Transfer Form Modal */}
      {showTransferForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Chuyển Phòng</h3>
            <form onSubmit={handleTransferRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phòng mới *
                </label>
                <select
                  value={transferForm.newRoomId}
                  onChange={(e) => setTransferForm({ ...transferForm, newRoomId: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  required
                >
                  <option value="">Chọn phòng trống</option>
                  {availableRooms.map((room) => (
                    <option key={room._id} value={room._id}>
                      Phòng {room.roomNumber} - {getRoomTypeLabel(room.type)} ({formatCurrency(room.hourlyRate)}/giờ)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lý do chuyển phòng
                </label>
                <textarea
                  value={transferForm.reason}
                  onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTransferForm(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Chuyển Phòng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discharge Form Modal */}
      {showDischargeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Xuất Viện</h3>
            <form onSubmit={handleDischarge} className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <p className="text-sm font-medium">Chi phí nội trú dự tính:</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(currentInfo?.currentCost || hospitalization.totalAmount)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Lý do xuất viện
                </label>
                <textarea
                  value={dischargeForm.reason}
                  onChange={(e) => setDischargeForm({ ...dischargeForm, reason: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="3"
                  placeholder="VD: Đã hồi phục, chuyển viện, ..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDischargeForm(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Xác Nhận Xuất Viện
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HospitalizationManager;

