import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  FaSearch, FaUserInjured, FaCalendarPlus, FaFileAlt, FaSort, 
  FaFilter, FaUsers, FaAngleRight, FaAngleLeft, FaEye,
  FaCalendarAlt, FaClock, FaPhone, FaEnvelope, FaExclamationTriangle,
  FaTimes, FaStethoscope, FaCheckCircle, FaTimesCircle
} from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../../utils/api';

const Patients = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('fullName');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const [itemsPerPage] = useState(10);
  const [error, setError] = useState(null);
  
  // State for appointment popup
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientAppointments, setPatientAppointments] = useState([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);

  useEffect(() => {
    fetchPatients();
  }, [currentPage, sortBy, sortOrder, searchTerm]);

  const fetchPatients = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: itemsPerPage,
        sort: sortBy,
        order: sortOrder,
        search: searchTerm || undefined
      };
      
      const response = await api.get('/doctors/patients', { params });
      
      if (response.data.success) {
        const patientsData = response.data.data || [];
        setPatients(patientsData);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setTotalPatients(response.data.pagination?.total || response.data.total || patientsData.length);
      } else {
        setError(response.data.message || 'Không thể tải danh sách bệnh nhân');
        toast.error(response.data.message || 'Không thể tải danh sách bệnh nhân');
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      const errorMsg = error.response?.data?.message || 'Không thể tải dữ liệu bệnh nhân. Vui lòng thử lại sau.';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Fetch appointments for a specific patient
  const fetchPatientAppointments = async (patientId) => {
    setLoadingAppointments(true);
    try {
      // Use the chat appointments endpoint which filters by otherUserId (patient's user ID)
      const response = await api.get('/appointments/chat/shared', {
        params: {
          otherUserId: patientId
        }
      });
      
      if (response.data.success) {
        setPatientAppointments(response.data.data || []);
      } else {
        toast.error(response.data.message || 'Không thể tải lịch hẹn của bệnh nhân');
        setPatientAppointments([]);
      }
    } catch (error) {
      console.error('Error fetching patient appointments:', error);
      toast.error('Không thể tải lịch hẹn của bệnh nhân');
      setPatientAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };

  // Handle patient row click
  const handlePatientClick = async (patient) => {
    setSelectedPatient(patient);
    setShowAppointmentModal(true);
    await fetchPatientAppointments(patient._id);
  };

  // Handle appointment selection
  const handleAppointmentSelect = (appointmentId) => {
    setShowAppointmentModal(false);
    navigate(`/doctor/appointments/${appointmentId}`);
  };

  // Xem hồ sơ y tế của bệnh nhân
  const viewMedicalRecords = async (patientId, e) => {
    e.stopPropagation(); // Prevent row click
    // Navigate directly - the MedicalRecords component will fetch the data
    navigate(`/doctor/medical-records/${patientId}`);
  };

  // Xem lịch hẹn của bệnh nhân (filter by patientId)
  const viewPatientAppointments = (patientId, e) => {
    e.stopPropagation(); // Prevent row click
    navigate(`/doctor/appointments?patientId=${patientId}`);
  };

  // Sắp xếp bệnh nhân
  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Format cho ngày sinh
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    }).format(date);
  };

  // Format cho ngày tháng đầy đủ
  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Tính tuổi từ ngày sinh
  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return 'N/A';
    
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Chờ xác nhận', className: 'bg-yellow-100 text-yellow-800', icon: <FaClock className="text-xs" /> },
      confirmed: { label: 'Đã xác nhận', className: 'bg-blue-100 text-blue-800', icon: <FaCheckCircle className="text-xs" /> },
      completed: { label: 'Hoàn thành', className: 'bg-green-100 text-green-800', icon: <FaCheckCircle className="text-xs" /> },
      cancelled: { label: 'Đã hủy', className: 'bg-red-100 text-red-800', icon: <FaTimesCircle className="text-xs" /> },
      rejected: { label: 'Đã từ chối', className: 'bg-red-100 text-red-800', icon: <FaTimesCircle className="text-xs" /> },
      rescheduled: { label: 'Đã đổi lịch', className: 'bg-purple-100 text-purple-800', icon: <FaCalendarAlt className="text-xs" /> },
      'no-show': { label: 'Không đến', className: 'bg-gray-100 text-gray-800', icon: <FaExclamationTriangle className="text-xs" /> }
    };

    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800', icon: null };
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  // Render biểu tượng sắp xếp
  const renderSortIcon = (field) => {
    if (sortBy !== field) {
      return <FaSort className="text-gray-400 ml-1" />;
    }
    return (
      <FaSort className={`ml-1 ${sortOrder === 'asc' ? 'text-blue-600' : 'text-red-600'}`} />
    );
  };

  // Render appointment modal
  const renderAppointmentModal = () => {
    if (!showAppointmentModal || !selectedPatient) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 flex items-center justify-center backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <div>
              <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <FaCalendarAlt className="mr-2 text-primary" />
                Lịch hẹn của {selectedPatient.fullName}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Chọn một lịch hẹn để xem chi tiết
              </p>
            </div>
            <button 
              className="text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
              onClick={() => {
                setShowAppointmentModal(false);
                setSelectedPatient(null);
                setPatientAppointments([]);
              }}
            >
              <FaTimes className="h-6 w-6" />
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loadingAppointments ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-gray-600">Đang tải lịch hẹn...</p>
                </div>
              </div>
            ) : patientAppointments.length === 0 ? (
              <div className="text-center py-12">
                <FaCalendarAlt className="mx-auto text-5xl text-gray-300 mb-4" />
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Không có lịch hẹn</h4>
                <p className="text-gray-600">
                  Bệnh nhân này chưa có lịch hẹn nào với bạn.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {patientAppointments.map((appointment) => (
                  <div
                    key={appointment._id}
                    onClick={() => handleAppointmentSelect(appointment._id)}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-blue-50 hover:border-blue-300 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusBadge(appointment.status)}
                          {appointment.bookingCode && (
                            <span className="text-xs text-gray-500">
                              Mã: {appointment.bookingCode}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-2 text-gray-700">
                            <FaCalendarAlt className="text-gray-400" />
                            <span>
                              {(() => {
                                const date = new Date(appointment.appointmentDate);
                                const utcDate = new Date(Date.UTC(
                                  date.getFullYear(),
                                  date.getMonth(),
                                  date.getDate(),
                                  12, 0, 0
                                ));
                                return utcDate.toLocaleDateString('vi-VN', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                });
                              })()}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-700">
                            <FaClock className="text-gray-400" />
                            <span>
                              {appointment.timeSlot?.startTime || ''} - {appointment.timeSlot?.endTime || ''}
                            </span>
                          </div>
                          {appointment.serviceId?.name && (
                            <div className="flex items-center gap-2 text-gray-700">
                              <FaStethoscope className="text-gray-400" />
                              <span>{appointment.serviceId.name}</span>
                            </div>
                          )}
                          {appointment.hospitalId?.name && (
                            <div className="flex items-center gap-2 text-gray-600 text-xs">
                              <span>{appointment.hospitalId.name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="ml-4">
                        <button className="text-primary hover:text-primary-dark transition-colors">
                          <FaEye className="text-lg" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => {
                setShowAppointmentModal(false);
                setSelectedPatient(null);
                setPatientAppointments([]);
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="bg-gray-50 min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center min-h-[70vh]">
            <div className="text-center">
              <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Đang tải danh sách bệnh nhân...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && patients.length === 0) {
    return (
      <div className="bg-gray-50 min-h-screen py-8">
        <div className="container mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center shadow-sm">
            <FaExclamationTriangle className="text-red-500 text-4xl mx-auto mb-4" />
            <div className="text-red-600 text-lg font-semibold mb-2">Lỗi</div>
            <p className="text-red-700 mb-4">{error}</p>
            <button 
              onClick={fetchPatients}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <div className="container mx-auto px-4">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-2 flex items-center">
            <FaUsers className="mr-3 text-primary" /> Quản lý bệnh nhân
          </h1>
          <p className="text-gray-600">Xem và quản lý danh sách bệnh nhân của bạn</p>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="p-4 md:p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Search Input */}
              <div className="relative flex-1 max-w-md">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên, email, số điện thoại..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                />
              </div>
              
              {/* Sort Controls */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <FaFilter className="text-gray-500" />
                  <select
                    className="bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setSortOrder('asc');
                      setCurrentPage(1);
                    }}
                    value={sortBy}
                  >
                    <option value="fullName">Sắp xếp theo tên</option>
                    <option value="dateOfBirth">Sắp xếp theo tuổi</option>
                    <option value="lastVisit">Sắp xếp theo lần khám gần đây</option>
                    <option value="visitCount">Sắp xếp theo số lần khám</option>
                  </select>
                </div>
                <button
                  className="bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-2 hover:bg-gray-50 text-sm flex items-center gap-2"
                  onClick={() => {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                    setCurrentPage(1);
                  }}
                >
                  <FaSort className={sortOrder === 'asc' ? 'text-green-600' : 'text-red-600'} />
                  {sortOrder === 'asc' ? 'Tăng dần' : 'Giảm dần'}
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center text-gray-700">
                <span className="bg-primary/10 p-2 rounded-full mr-2">
                  <FaUserInjured className="text-primary" />
                </span>
                <span className="font-medium">
                  Tổng số: <span className="text-primary font-bold">{totalPatients}</span> bệnh nhân
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Patients Table */}
        {patients.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaUsers className="text-2xl text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Không có bệnh nhân</h3>
            <p className="text-gray-600">
              {searchTerm 
                ? 'Không tìm thấy bệnh nhân phù hợp với từ khóa tìm kiếm.' 
                : 'Bạn chưa có bệnh nhân nào trong hệ thống.'}
            </p>
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                }}
                className="mt-4 text-primary hover:underline"
              >
                Xóa bộ lọc tìm kiếm
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th 
                      scope="col" 
                      className="px-4 md:px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => handleSort('fullName')}
                    >
                      <div className="flex items-center">
                        Họ tên {renderSortIcon('fullName')}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-4 md:px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors hidden md:table-cell"
                      onClick={() => handleSort('email')}
                    >
                      <div className="flex items-center">
                        Email {renderSortIcon('email')}
                      </div>
                    </th>
                    <th scope="col" className="px-4 md:px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Số điện thoại
                    </th>
                    <th scope="col" className="px-4 md:px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Giới tính
                    </th>
                    <th 
                      scope="col" 
                      className="px-4 md:px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors hidden md:table-cell"
                      onClick={() => handleSort('dateOfBirth')}
                    >
                      <div className="flex items-center">
                        Ngày sinh / Tuổi {renderSortIcon('dateOfBirth')}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-4 md:px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors hidden lg:table-cell"
                      onClick={() => handleSort('lastVisit')}
                    >
                      <div className="flex items-center">
                        Lần khám gần nhất {renderSortIcon('lastVisit')}
                      </div>
                    </th>
                    <th 
                      scope="col" 
                      className="px-4 md:px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors hidden sm:table-cell"
                      onClick={() => handleSort('visitCount')}
                    >
                      <div className="flex items-center">
                        Số lần khám {renderSortIcon('visitCount')}
                      </div>
                    </th>
                    <th scope="col" className="px-4 md:px-6 py-3.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {patients.map((patient) => (
                    <tr 
                      key={patient._id} 
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                      onClick={() => handlePatientClick(patient)}
                    >
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 flex-shrink-0">
                            <img
                              src={patient.avatarUrl || `/avatars/default-avatar.png`}
                              alt={patient.fullName}
                              className="h-10 w-10 rounded-full object-cover border-2 border-gray-200"
                              onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(patient.fullName || 'User')}&background=1AC0FF&color=fff`;
                              }}
                            />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{patient.fullName || 'N/A'}</div>
                            <div className="text-xs text-gray-500 md:hidden mt-1">
                              <div className="flex items-center gap-1">
                                <FaEnvelope className="text-gray-400" />
                                {patient.email}
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <FaPhone className="text-gray-400" />
                                {patient.phoneNumber || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="flex items-center text-sm text-gray-600">
                          <FaEnvelope className="mr-2 text-gray-400" />
                          {patient.email || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <div className="flex items-center text-sm text-gray-600">
                          <FaPhone className="mr-2 text-gray-400" />
                          {patient.phoneNumber || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${patient.gender === 'male' ? 'bg-blue-100 text-blue-800' : 
                            patient.gender === 'female' ? 'bg-pink-100 text-pink-800' : 
                            'bg-gray-100 text-gray-800'}`}>
                          {patient.gender === 'male' ? 'Nam' : 
                           patient.gender === 'female' ? 'Nữ' : 
                           'Khác'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <div className="text-sm text-gray-600">
                          <div>{formatDate(patient.dateOfBirth)}</div>
                          {patient.dateOfBirth && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              ({calculateAge(patient.dateOfBirth)} tuổi)
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <div className="flex items-center text-sm text-gray-600">
                          <FaClock className="mr-2 text-gray-400" />
                          {patient.lastVisit ? formatDateTime(patient.lastVisit) : 'Chưa có'}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <div className="flex items-center text-sm text-gray-600">
                          <FaCalendarAlt className="mr-2 text-gray-400" />
                          <span className="font-semibold">{patient.visitCount || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={(e) => viewMedicalRecords(patient._id, e)}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-xs font-medium"
                            title="Xem hồ sơ y tế"
                          >
                            <FaFileAlt className="mr-1.5" />
                            <span className="hidden sm:inline">Hồ sơ</span>
                          </button>
                          <button
                            onClick={(e) => viewPatientAppointments(patient._id, e)}
                            className="inline-flex items-center px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors text-xs font-medium"
                            title="Xem lịch hẹn"
                          >
                            <FaEye className="mr-1.5" />
                            <span className="hidden sm:inline">Lịch hẹn</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 md:px-6 py-4 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-gray-700">
                  Hiển thị <span className="font-medium">{patients.length}</span> trên tổng số <span className="font-medium">{totalPatients}</span> bệnh nhân
                </div>
                <div className="flex items-center justify-center sm:justify-end gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <FaAngleLeft className="mr-1.5" /> Trước
                  </button>
                  
                  <div className="flex items-center px-3 py-2 text-sm text-gray-700">
                    <span className="font-medium">Trang {currentPage} / {totalPages}</span>
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage >= totalPages}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Sau <FaAngleRight className="ml-1.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Appointment Modal */}
        {renderAppointmentModal()}
      </div>
    </div>
  );
};

export default Patients;
