import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaPlus, FaEdit, FaTrash, FaBed, FaCheck, FaTimes } from 'react-icons/fa';
import { useSocket } from '../context/SocketContext';

const InpatientRoomManager = () => {
  const { socket } = useSocket();
  const [rooms, setRooms] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [filter, setFilter] = useState({
    type: '',
    floor: '',
    available: ''
  });

  const [formData, setFormData] = useState({
    roomNumber: '',
    roomName: '',
    floor: '',
    type: 'standard',
    hourlyRate: 0,
    capacity: 1,
    amenities: [],
    equipment: [],
    description: ''
  });

  const [newAmenity, setNewAmenity] = useState('');
  const [newEquipment, setNewEquipment] = useState('');

  useEffect(() => {
    fetchRooms();
    fetchStatistics();

    // Listen for real-time room updates
    if (socket) {
      socket.on('room_occupied', handleRoomUpdate);
      socket.on('room_available', handleRoomUpdate);
      socket.on('room_updated', handleRoomUpdate);

      return () => {
        socket.off('room_occupied', handleRoomUpdate);
        socket.off('room_available', handleRoomUpdate);
        socket.off('room_updated', handleRoomUpdate);
      };
    }
  }, [socket, filter]);

  const handleRoomUpdate = (data) => {
    console.log('Room updated:', data);
    
    // Update local state
    setRooms(prev => prev.map(room =>
      room._id === data.roomId
        ? { ...room, status: data.status, currentOccupancy: data.currentOccupancy }
        : room
    ));

    fetchStatistics();
  };

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = {};
      if (filter.type) params.type = filter.type;
      if (filter.floor) params.floor = filter.floor;
      if (filter.available) params.available = filter.available;

      const response = await axios.get(`${import.meta.env.VITE_API_URL}/inpatient-rooms`, {
        headers: { Authorization: `Bearer ${token}` },
        params
      });
      setRooms(response.data.data);
    } catch (error) {
      toast.error('Không thể tải danh sách phòng');
    } finally {
      setLoading(false);
    }
  };

  const fetchStatistics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/inpatient-rooms/statistics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatistics(response.data.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      
      if (editingRoom) {
        // Update room
        await axios.put(
          `${import.meta.env.VITE_API_URL}/inpatient-rooms/${editingRoom._id}`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Cập nhật phòng thành công');
      } else {
        // Create room
        await axios.post(
          `${import.meta.env.VITE_API_URL}/inpatient-rooms`,
          formData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Tạo phòng thành công');
      }

      setShowForm(false);
      setEditingRoom(null);
      resetForm();
      fetchRooms();
      fetchStatistics();

    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể lưu phòng');
    }
  };

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      roomNumber: room.roomNumber,
      roomName: room.roomName || '',
      floor: room.floor || '',
      type: room.type,
      hourlyRate: room.hourlyRate,
      capacity: room.capacity,
      amenities: room.amenities || [],
      equipment: room.equipment || [],
      description: room.description || ''
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa phòng này?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${import.meta.env.VITE_API_URL}/inpatient-rooms/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Xóa phòng thành công');
      fetchRooms();
      fetchStatistics();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Không thể xóa phòng');
    }
  };

  const resetForm = () => {
    setFormData({
      roomNumber: '',
      roomName: '',
      floor: '',
      type: 'standard',
      hourlyRate: 0,
      capacity: 1,
      amenities: [],
      equipment: [],
      description: ''
    });
  };

  const addAmenity = () => {
    if (newAmenity.trim() && !formData.amenities.includes(newAmenity.trim())) {
      setFormData({ ...formData, amenities: [...formData.amenities, newAmenity.trim()] });
      setNewAmenity('');
    }
  };

  const removeAmenity = (amenity) => {
    setFormData({ ...formData, amenities: formData.amenities.filter(a => a !== amenity) });
  };

  const addEquipment = () => {
    if (newEquipment.trim() && !formData.equipment.includes(newEquipment.trim())) {
      setFormData({ ...formData, equipment: [...formData.equipment, newEquipment.trim()] });
      setNewEquipment('');
    }
  };

  const removeEquipment = (equipment) => {
    setFormData({ ...formData, equipment: formData.equipment.filter(e => e !== equipment) });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount);
  };

  const getTypeLabel = (type) => {
    const labels = {
      standard: 'Tiêu chuẩn',
      vip: 'VIP',
      icu: 'ICU'
    };
    return labels[type] || type;
  };

  const getStatusBadge = (room) => {
    if (!room.isAvailable) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Đầy</span>;
    }
    if (room.currentOccupancy > 0) {
      return <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">Đang sử dụng</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Trống</span>;
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-gray-800">Quản Lý Phòng Nội Trú</h2>
            <button
              onClick={() => { setShowForm(!showForm); setEditingRoom(null); resetForm(); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              {showForm ? <FaTimes /> : <FaPlus />}
              {showForm ? 'Đóng' : 'Thêm Phòng'}
            </button>
          </div>

          {/* Statistics */}
          {statistics?.overall && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Tổng phòng</p>
                <p className="text-2xl font-bold text-blue-600">{statistics.overall.totalRooms}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Phòng trống</p>
                <p className="text-2xl font-bold text-green-600">{statistics.overall.availableRooms}</p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Đang sử dụng</p>
                <p className="text-2xl font-bold text-yellow-600">{statistics.overall.currentOccupancy}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600">Tổng sức chứa</p>
                <p className="text-2xl font-bold text-purple-600">{statistics.overall.totalCapacity}</p>
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <select
              value={filter.type}
              onChange={(e) => setFilter({ ...filter, type: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Tất cả loại phòng</option>
              <option value="standard">Tiêu chuẩn</option>
              <option value="vip">VIP</option>
              <option value="icu">ICU</option>
            </select>

            <input
              type="text"
              placeholder="Tầng..."
              value={filter.floor}
              onChange={(e) => setFilter({ ...filter, floor: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            />

            <select
              value={filter.available}
              onChange={(e) => setFilter({ ...filter, available: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="true">Còn trống</option>
              <option value="false">Đã đầy</option>
            </select>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="p-6 bg-gray-50 border-b">
            <h3 className="text-lg font-semibold mb-4">
              {editingRoom ? 'Cập Nhật Phòng' : 'Thêm Phòng Mới'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Số phòng *</label>
                  <input
                    type="text"
                    value={formData.roomNumber}
                    onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên phòng</label>
                  <input
                    type="text"
                    value={formData.roomName}
                    onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tầng</label>
                  <input
                    type="text"
                    value={formData.floor}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    placeholder="VD: Tầng 2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loại phòng *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg"
                    required
                  >
                    <option value="standard">Tiêu chuẩn</option>
                    <option value="vip">VIP</option>
                    <option value="icu">ICU</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phí theo giờ (VNĐ) *</label>
                  <input
                    type="number"
                    value={formData.hourlyRate}
                    onChange={(e) => setFormData({ ...formData, hourlyRate: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border rounded-lg"
                    min="0"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sức chứa *</label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 border rounded-lg"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows="2"
                />
              </div>

              {/* Amenities */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiện nghi</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newAmenity}
                    onChange={(e) => setNewAmenity(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addAmenity())}
                    className="flex-1 px-4 py-2 border rounded-lg"
                    placeholder="VD: TV, Tủ lạnh, Điều hòa..."
                  />
                  <button
                    type="button"
                    onClick={addAmenity}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <FaPlus />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.amenities.map((amenity, index) => (
                    <span key={index} className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full flex items-center gap-2">
                      {amenity}
                      <button type="button" onClick={() => removeAmenity(amenity)} className="text-blue-600 hover:text-blue-800">
                        <FaTimes size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Equipment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Thiết bị y tế</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newEquipment}
                    onChange={(e) => setNewEquipment(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEquipment())}
                    className="flex-1 px-4 py-2 border rounded-lg"
                    placeholder="VD: Máy thở, Monitor..."
                  />
                  <button
                    type="button"
                    onClick={addEquipment}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <FaPlus />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.equipment.map((equip, index) => (
                    <span key={index} className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full flex items-center gap-2">
                      {equip}
                      <button type="button" onClick={() => removeEquipment(equip)} className="text-purple-600 hover:text-purple-800">
                        <FaTimes size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingRoom(null); resetForm(); }}
                  className="px-6 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingRoom ? 'Cập Nhật' : 'Tạo Phòng'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Rooms List */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">Đang tải...</div>
          ) : rooms.length === 0 ? (
            <div className="text-center py-8 text-gray-500">Chưa có phòng nào</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rooms.map((room) => (
                <div key={room._id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <FaBed />
                        Phòng {room.roomNumber}
                      </h3>
                      {room.roomName && <p className="text-sm text-gray-600">{room.roomName}</p>}
                    </div>
                    {getStatusBadge(room)}
                  </div>

                  <div className="space-y-2 mb-4">
                    <p className="text-sm">
                      <span className="font-medium">Loại:</span> {getTypeLabel(room.type)}
                    </p>
                    {room.floor && (
                      <p className="text-sm">
                        <span className="font-medium">Tầng:</span> {room.floor}
                      </p>
                    )}
                    <p className="text-sm">
                      <span className="font-medium">Sức chứa:</span> {room.currentOccupancy}/{room.capacity} người
                    </p>
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(room.hourlyRate)}/giờ
                    </p>
                  </div>

                  {(room.amenities?.length > 0 || room.equipment?.length > 0) && (
                    <div className="mb-4 text-sm">
                      {room.amenities?.length > 0 && (
                        <p className="text-gray-600">
                          <strong>Tiện nghi:</strong> {room.amenities.slice(0, 2).join(', ')}
                          {room.amenities.length > 2 && '...'}
                        </p>
                      )}
                      {room.equipment?.length > 0 && (
                        <p className="text-gray-600">
                          <strong>Thiết bị:</strong> {room.equipment.slice(0, 2).join(', ')}
                          {room.equipment.length > 2 && '...'}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(room)}
                      className="flex-1 px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded flex items-center justify-center gap-2"
                    >
                      <FaEdit /> Sửa
                    </button>
                    <button
                      onClick={() => handleDelete(room._id)}
                      className="flex-1 px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded flex items-center justify-center gap-2"
                      disabled={room.currentOccupancy > 0}
                    >
                      <FaTrash /> Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InpatientRoomManager;

