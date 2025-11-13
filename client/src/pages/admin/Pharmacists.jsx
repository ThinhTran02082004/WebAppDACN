import React, { useState, useEffect } from 'react';
import { 
  FaUserMd, FaSearch, FaPlus, FaEdit, FaTrash, FaFilter, 
  FaTimes, FaHospital, FaUserLock, FaUserCheck, FaSave 
} from 'react-icons/fa';
import api from '../../utils/api';
import { toast } from 'react-toastify';

const Pharmacists = () => {
  const [pharmacists, setPharmacists] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({
    status: 'all',
    hospitalId: 'all'
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    pageSize: 10,
    totalPages: 1
  });
  const [selectedPharmacist, setSelectedPharmacist] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [lockReason, setLockReason] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    phoneNumber: '',
    hospitalId: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
    fetchHospitals();
  }, [pagination.currentPage, filter]);

  const fetchHospitals = async () => {
    try {
      const response = await api.get('/hospitals');
      if (response.data && response.data.success) {
        const hospitalsData = Array.isArray(response.data.data) 
          ? response.data.data 
          : response.data.data?.hospitals || [];
        setHospitals(hospitalsData.filter(h => h.isActive !== false));
      }
    } catch (error) {
      console.error('Error fetching hospitals:', error);
      toast.error('Không thể tải danh sách chi nhánh');
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let isLockedParam = undefined;
      if (filter.status === 'locked') {
        isLockedParam = true;
      } else if (filter.status === 'active') {
        isLockedParam = false;
      }
      
      const params = {
        page: pagination.currentPage,
        limit: pagination.pageSize,
        roleType: 'pharmacist',
        isLocked: isLockedParam,
        search: searchTerm || undefined
      };

      // Add hospitalId filter if selected
      if (filter.hospitalId !== 'all') {
        // Note: This will need backend support or client-side filtering
        // For now, fetch all and filter client-side
      }

      const res = await api.get('/admin/users', { params });
      
      if (res.data && res.data.success) {
        let userData = Array.isArray(res.data.data) ? res.data.data : [];
        
        // Filter by hospitalId on client side if needed
        if (filter.hospitalId !== 'all') {
          userData = userData.filter(user => 
            user.hospitalId?._id?.toString() === filter.hospitalId ||
            user.hospitalId?.toString() === filter.hospitalId
          );
        }
        
        setPharmacists(userData);
        setTotalRecords(res.data.total || userData.length);
        setPagination(prev => ({
          ...prev,
          totalPages: Math.ceil((res.data.total || userData.length) / pagination.pageSize) || 1
        }));
      } else {
        setPharmacists([]);
        setTotalRecords(0);
      }
    } catch (error) {
      console.error('Error fetching pharmacists:', error);
      toast.error('Không thể tải dữ liệu dược sĩ');
      setPharmacists([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilter(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    fetchData();
  };

  const handleSearchReset = () => {
    setSearchTerm('');
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setTimeout(() => {
      fetchData();
    }, 0);
  };

  const handleFilterReset = () => {
    setFilter({
      status: 'all',
      hospitalId: 'all'
    });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const handlePageChange = (page) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const openModal = (type, pharmacist = null) => {
    setModalType(type);
    setSelectedPharmacist(pharmacist);
    setLockReason('');
    if (type === 'create') {
      setFormData({
        fullName: '',
        email: '',
        password: '',
        phoneNumber: '',
        hospitalId: ''
      });
      setFormErrors({});
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPharmacist(null);
    setModalType('');
    setLockReason('');
    setFormData({
      fullName: '',
      email: '',
      password: '',
      phoneNumber: '',
      hospitalId: ''
    });
    setFormErrors({});
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.fullName.trim()) {
      errors.fullName = 'Vui lòng nhập họ tên';
    }
    
    if (!formData.email.trim()) {
      errors.email = 'Vui lòng nhập email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email không hợp lệ';
    }
    
    if (!formData.password || formData.password.length < 6) {
      errors.password = 'Mật khẩu phải có ít nhất 6 ký tự';
    }
    
    if (!formData.hospitalId) {
      errors.hospitalId = 'Vui lòng chọn chi nhánh';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreatePharmacist = async () => {
    if (!validateForm()) return;

    setFormSubmitting(true);
    try {
      const response = await api.post('/admin/pharmacists', formData);
      if (response.data.success) {
        toast.success('Tạo tài khoản dược sĩ thành công');
        fetchData();
        closeModal();
      }
    } catch (error) {
      console.error('Error creating pharmacist:', error);
      const errorMessage = error.response?.data?.message || 'Không thể tạo tài khoản dược sĩ';
      if (error.response?.data?.field) {
        setFormErrors({
          [error.response.data.field]: errorMessage
        });
      } else if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors);
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleLockPharmacist = async (userId) => {
    try {
      if (!lockReason) {
        toast.error('Vui lòng nhập lý do khóa tài khoản');
        return;
      }
      
      const res = await api.put(`/admin/users/${userId}/lock`, { 
        lockReason: lockReason 
      });
      
      if (res.data.success) {
        toast.success('Đã khóa tài khoản dược sĩ');
        setPharmacists(pharmacists.map(user => {
          if (user._id === userId) {
            return {
              ...user,
              isLocked: true,
              lockReason: lockReason
            };
          }
          return user;
        }));
        closeModal();
      } else {
        toast.error(res.data?.message || 'Không thể khóa tài khoản');
      }
    } catch (error) {
      console.error('Error locking pharmacist:', error);
      toast.error(error.response?.data?.message || 'Không thể khóa tài khoản');
    }
  };

  const handleUnlockPharmacist = async (userId) => {
    try {
      const res = await api.put(`/admin/users/${userId}/unlock`);
      if (res.data.success) {
        toast.success('Đã mở khóa tài khoản dược sĩ');
        setPharmacists(pharmacists.map(user => {
          if (user._id === userId) {
            return {
              ...user,
              isLocked: false,
              lockReason: undefined
            };
          }
          return user;
        }));
      } else {
        toast.error(res.data?.message || 'Không thể mở khóa tài khoản');
      }
    } catch (error) {
      console.error('Error unlocking pharmacist:', error);
      toast.error(error.response?.data?.message || 'Không thể mở khóa tài khoản');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', { year: 'numeric', month: 'numeric', day: 'numeric' });
  };

  const renderModal = () => {
    if (!isModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
        <div className={`relative bg-white rounded-lg ${modalType === 'create' ? 'max-w-2xl' : 'max-w-md'} w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto`}>
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-semibold text-gray-800">
              {modalType === 'lock' && 'Khóa tài khoản dược sĩ'}
              {modalType === 'create' && 'Thêm dược sĩ mới'}
            </h2>
            <button 
              className="text-gray-500 hover:text-gray-700 focus:outline-none"
              onClick={closeModal}
            >
              <FaTimes className="h-5 w-5" />
            </button>
          </div>
          
          <div className="p-6">
            {modalType === 'lock' && (
              <div>
                <p className="mb-4 text-gray-600">
                  Bạn có chắc chắn muốn khóa tài khoản dược sĩ <span className="font-semibold">{selectedPharmacist?.fullName || 'này'}</span>?
                </p>
                
                <div className="mb-4">
                  <label htmlFor="lockReason" className="block text-sm font-medium text-gray-700 mb-1">
                    Lý do khóa tài khoản:
                  </label>
                  <textarea
                    id="lockReason"
                    name="lockReason"
                    value={lockReason}
                    onChange={(e) => setLockReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Vui lòng nhập lý do khóa tài khoản"
                    rows="3"
                  />
                </div>
              </div>
            )}

            {modalType === 'create' && (
              <form onSubmit={(e) => { e.preventDefault(); handleCreatePharmacist(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
                      Họ tên *
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      name="fullName"
                      value={formData.fullName}
                      onChange={handleFormChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.fullName 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      required
                    />
                    {formErrors.fullName && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.fullName}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.email 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      required
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Mật khẩu *
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleFormChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.password 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      required
                      minLength={6}
                    />
                    {formErrors.password && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.password}</p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">
                      Số điện thoại
                    </label>
                    <input
                      type="tel"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label htmlFor="hospitalId" className="block text-sm font-medium text-gray-700 mb-1">
                      Chi nhánh *
                    </label>
                    <select
                      id="hospitalId"
                      name="hospitalId"
                      value={formData.hospitalId}
                      onChange={handleFormChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        formErrors.hospitalId 
                          ? 'border-red-500 focus:ring-red-500' 
                          : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      required
                    >
                      <option value="">-- Chọn chi nhánh --</option>
                      {hospitals.map(hospital => (
                        <option key={hospital._id} value={hospital._id}>
                          {hospital.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.hospitalId && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.hospitalId}</p>
                    )}
                  </div>
                </div>
              </form>
            )}
          </div>
          
          <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
            <button 
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              onClick={closeModal}
            >
              Hủy
            </button>
            
            {modalType === 'lock' && (
              <button 
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                onClick={() => handleLockPharmacist(selectedPharmacist._id)}
              >
                Khóa tài khoản
              </button>
            )}

            {modalType === 'create' && (
              <button 
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleCreatePharmacist}
                disabled={formSubmitting}
              >
                <FaSave className="inline mr-2" />
                {formSubmitting ? 'Đang tạo...' : 'Tạo tài khoản'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý dược sĩ</h1>
      </div>

      <div className="p-6 border-b">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search Bar */}
          <div className="w-full lg:w-1/3">
            <form onSubmit={handleSearch} className="flex w-full">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder="Tìm kiếm dược sĩ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <FaSearch className="text-gray-400" />
                </div>
                {searchTerm && (
                  <button 
                    type="button" 
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                    onClick={handleSearchReset}
                  >
                    <FaTimes />
                  </button>
                )}
              </div>
              <button 
                type="submit" 
                className="ml-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center"
              >
                <FaSearch className="mr-2" />
                Tìm
              </button>
            </form>
          </div>

          {/* Filters */}
          <div className="w-full lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FaFilter className="text-gray-400" />
              </div>
              <select
                name="status"
                value={filter.status}
                onChange={handleFilterChange}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="locked">Đã khóa</option>
              </select>
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <FaHospital className="text-gray-400" />
              </div>
              <select
                name="hospitalId"
                value={filter.hospitalId}
                onChange={handleFilterChange}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white appearance-none"
              >
                <option value="all">Tất cả chi nhánh</option>
                {hospitals.map(hospital => (
                  <option key={hospital._id} value={hospital._id}>
                    {hospital.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center mt-4">
          <div className="flex space-x-2">
            {(filter.status !== 'all' || filter.hospitalId !== 'all') && (
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                onClick={handleFilterReset}
              >
                <FaTimes />
                <span>Xóa bộ lọc</span>
              </button>
            )}
          </div>
          <div className="flex space-x-2">
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              onClick={() => openModal('create')}
            >
              <FaPlus />
              <span>Thêm dược sĩ</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-8">
          <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Họ tên</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Số điện thoại</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chi nhánh</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trạng thái</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ngày tạo</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hành động</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {pharmacists.length > 0 ? (
                pharmacists.map((pharmacist) => (
                  <tr key={pharmacist._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{pharmacist.fullName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{pharmacist.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{pharmacist.phoneNumber || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {pharmacist.hospitalId?.name || 'Chưa gán chi nhánh'}
                      </div>
                      {pharmacist.hospitalId?.address && (
                        <div className="text-xs text-gray-500">{pharmacist.hospitalId.address}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        pharmacist.isLocked 
                          ? 'bg-red-100 text-red-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {pharmacist.isLocked ? 'Đã khóa' : 'Hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">{formatDate(pharmacist.createdAt)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {pharmacist.isLocked ? (
                        <button
                          className="p-2 text-green-600 hover:text-green-900 rounded-full hover:bg-green-50"
                          onClick={() => handleUnlockPharmacist(pharmacist._id)}
                          title="Mở khóa tài khoản"
                        >
                          <FaUserCheck className="h-5 w-5" />
                        </button>
                      ) : (
                        <button
                          className="p-2 text-red-600 hover:text-red-900 rounded-full hover:bg-red-50"
                          onClick={() => openModal('lock', pharmacist)}
                          title="Khóa tài khoản"
                        >
                          <FaUserLock className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-gray-500">
                    Không có dữ liệu dược sĩ
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="flex items-center justify-between px-6 py-4 bg-white border-t">
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handlePageChange(1)}
                disabled={pagination.currentPage === 1}
              >
                &laquo;
              </button>
              <button
                className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
              >
                &lsaquo;
              </button>
            </div>
            
            <div className="text-sm text-gray-700">
              Trang {pagination.currentPage} / {pagination.totalPages} ({totalRecords} bản ghi)
            </div>
            
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                &rsaquo;
              </button>
              <button
                className="p-2 rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={pagination.currentPage === pagination.totalPages}
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && renderModal()}
    </div>
  );
};

export default Pharmacists;

