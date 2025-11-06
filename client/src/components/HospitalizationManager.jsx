import React, { useState, useEffect, useMemo } from 'react';
import api from '../utils/api';
import { toast } from 'react-toastify';
import { FaBed, FaExchangeAlt, FaSignOutAlt, FaClock, FaMoneyBillWave, FaCheck } from 'react-icons/fa';

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
  const [appointmentDetails, setAppointmentDetails] = useState(null);
  const [roomSearch, setRoomSearch] = useState('');
  const [showDischargeConfirm, setShowDischargeConfirm] = useState(false);

  const appointmentHospitalId = useMemo(() => {
    if (!appointmentDetails) return null;
    return appointmentDetails.hospitalId?._id || appointmentDetails.hospitalId || null;
  }, [appointmentDetails]);

  useEffect(() => {
    if (appointmentId) {
      fetchHospitalization();
      fetchAppointmentDetails();
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
      let hospitalIdToUse = appointmentHospitalId;

      if (!hospitalIdToUse) {
        const latestAppointment = await fetchAppointmentDetails();
        hospitalIdToUse = latestAppointment?.hospitalId?._id || latestAppointment?.hospitalId || null;
      }

      if (!hospitalIdToUse) {
        toast.error('Khong xac dinh duoc chi nhanh benh vien cua lich hen');
        return;
      }

      const params = { hospitalId: hospitalIdToUse };
      if (type) params.type = type;
      const response = await api.get('/hospitalizations/available-rooms', { params });
      const rooms = response?.data?.data ?? [];
      setAvailableRooms(Array.isArray(rooms) ? rooms : []);
    } catch (error) {
      console.error('Error fetching available rooms:', error);
      toast.error('Khong the tai danh sach phong trong');
    }
  };

  const fetchAppointmentDetails = async () => {
    try {
      const response = await api.get(`/appointments/${appointmentId}`);
      if (response.data?.success) {
        setAppointmentDetails(response.data.data);
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching appointment for hospitalization manager:', error);
      toast.error('Khong the tai thong tin lich hen');
    }
    return null;
  };
  const filteredTransferRooms = useMemo(() => {
    const currentRoomId = hospitalization?.inpatientRoomId?._id || hospitalization?.inpatientRoomId;

    return availableRooms
      .filter((room) => {
        if (!room || !currentRoomId) return !!room;
        return room._id !== currentRoomId;
      })
      .filter((room) => {
        if (!roomSearch.trim()) return true;
        const term = roomSearch.trim().toLowerCase();
        const candidates = [
          room.roomNumber,
          room.roomName,
          getRoomTypeLabel(room.type),
          room.hospitalId?.name
        ];
        return candidates.some((value) => value && value.toLowerCase().includes(term));
      });
  }, [availableRooms, hospitalization, roomSearch]);



  const updateCurrentCost = () => {
    if (hospitalization && hospitalization.status !== 'discharged') {
      const calc = computeCurrentRoomAndTotals(hospitalization);
      setCurrentInfo((prev) => ({
        ...prev,
        currentHours: calc.currentRoomHours,
        currentCost: calc.currentRoomCost,
        currentRoomStart: calc.currentRoomStart,
        currentRoomHours: calc.currentRoomHours,
        currentRoomCost: calc.currentRoomCost,
        totalSoFarHours: calc.totalSoFarHours,
        totalSoFarAmount: calc.totalSoFarAmount
      }));
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
      setRoomSearch('');

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

  const costSummary = useMemo(() => {
    if (!hospitalization) {
      return { currentRoomCost: 0, totalSoFarAmount: 0 };
    }
    const computed = computeCurrentRoomAndTotals(hospitalization);
    return {
      currentRoomCost: currentInfo?.currentRoomCost ?? currentInfo?.currentCost ?? computed.currentRoomCost,
      totalSoFarAmount: currentInfo?.totalSoFarAmount ?? computed.totalSoFarAmount
    };
  }, [hospitalization, currentInfo]);

  function getRoomTypeLabel(type) {
    const labels = { standard: 'Tiêu chuẩn', vip: 'VIP', icu: 'ICU' };
    return labels[type] || type;
  }

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
                {availableRooms.map((room) => {
                  const remaining = Math.max(0, (room.capacity || 0) - (room.currentOccupancy || 0));
                  return (
                    <option
                      key={room._id}
                      value={room._id}
                      disabled={remaining <= 0}
                    >
                      Phong {room.roomNumber} - {getRoomTypeLabel(room.type)} ({formatCurrency(room.hourlyRate)}/gio) - Con {remaining}
                    </option>
                  );
                })}
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
                  {formatCurrency(costSummary.currentRoomCost)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tổng nội trú (tạm tính)</p>
                <p className="text-xl font-bold text-purple-600">
                  {formatCurrency(costSummary.totalSoFarAmount)}
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
            onClick={() => { setRoomSearch(''); setTransferForm({ newRoomId: '', reason: '' }); fetchAvailableRooms(); setShowTransferForm(true); }}
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
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full p-6 space-y-5">
            <h3 className="text-2xl font-bold text-gray-800">Chuyển Phòng</h3>
            <form onSubmit={handleTransferRoom} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phòng mới *
                </label>
                <input
                  type="text"
                  value={roomSearch}
                  onChange={(e) => setRoomSearch(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Tìm theo số phòng, tên phòng, loại phòng..."
                />
                <p className="text-xs text-gray-500 mt-1">Không hiển thị phòng hiện tại. Chọn một phòng còn trống để chuyển.</p>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {filteredTransferRooms.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-6 bg-gray-50 border border-dashed rounded-lg">
                    Không tìm thấy phòng phù hợp.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredTransferRooms.map((room) => {
                      const remaining = Math.max(0, (room.capacity || 0) - (room.currentOccupancy || 0));
                      const isSelected = transferForm.newRoomId === room._id;
                      const disabled = remaining <= 0;
                      return (
                        <button
                          type="button"
                          key={room._id}
                          onClick={() => !disabled && setTransferForm({ ...transferForm, newRoomId: room._id })}
                          disabled={disabled}
                          className={[
                            'relative text-left border rounded-xl p-4 transition-all',
                            disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'hover:border-blue-400 hover:shadow-md bg-white',
                            isSelected ? 'border-blue-500 ring-2 ring-blue-200 bg-blue-50' : 'border-gray-200'
                          ].join(' ')}
                        >
                          {isSelected && (
                            <span className="absolute top-4 right-4 text-blue-600">
                              <FaCheck />
                            </span>
                          )}
                          <div className="font-semibold text-gray-800 text-lg">Phòng {room.roomNumber}</div>
                          {room.roomName && (
                            <div className="text-sm text-gray-500">{room.roomName}</div>
                          )}
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div>
                              <span className="font-medium">Loại:</span> {getRoomTypeLabel(room.type)}
                            </div>
                            {room.floor && (
                              <div>
                                <span className="font-medium">Tầng:</span> {room.floor}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Sức chứa:</span> {room.currentOccupancy || 0}/{room.capacity || 0}
                            </div>
                            <div>
                              <span className="font-medium">Còn trống:</span> {remaining}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Giá/giờ:</span> {formatCurrency(room.hourlyRate)}
                            </div>
                            {room.hospitalId?.name && (
                              <div className="col-span-2">
                                <span className="font-medium">Bệnh viện:</span> {room.hospitalId.name}
                              </div>
                            )}
                          </div>
                          <div className="mt-3">
                            <span
                              className={[
                                'inline-flex px-2 py-1 text-xs rounded-full',
                                room.status === 'available'
                                  ? 'bg-green-100 text-green-700'
                                  : room.status === 'occupied'
                                  ? 'bg-red-100 text-red-600'
                                  : room.status === 'maintenance'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : room.status === 'cleaning'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-600'
                              ].join(' ')}
                            >
                              {room.status === 'available'
                                ? 'Khả dụng'
                                : room.status === 'occupied'
                                ? 'Đã đầy'
                                : room.status === 'maintenance'
                                ? 'Bảo trì'
                                : room.status === 'cleaning'
                                ? 'Vệ sinh'
                                : room.status}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
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
                  placeholder="Ví dụ: Yêu cầu phòng riêng, cần thiết bị đặc biệt..."
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowTransferForm(false); setRoomSearch(''); }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={loading || !transferForm.newRoomId}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-60"
                >
                  Chuyển Phòng
                </button>
              </div>
            </form>
          </div>
        </div>      )}

      {/* Discharge Form Modal */}
      {showDischargeForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Xuất Viện</h3>
            <form onSubmit={handleDischarge} className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <p className="text-sm font-medium">Chi phí nội trú dự tính:</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(costSummary.totalSoFarAmount)}
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



