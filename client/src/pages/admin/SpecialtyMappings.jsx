import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaSearch, FaFilter, FaSync, FaTimes, FaCheck, FaSeedling, FaInfoCircle, FaArrowLeft, FaArrowRight } from 'react-icons/fa';
import api from '../../utils/api';
import { toast } from 'react-toastify';

const SpecialtyMappings = () => {
  const [mappings, setMappings] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingAction, setLoadingAction] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState({
    specialtyId: 'all',
    status: 'all'
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    pageSize: 50,
    total: 0
  });
  const [selectedMapping, setSelectedMapping] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState('');
  const [formData, setFormData] = useState({
    text: '',
    specialtyId: '',
    priority: 0,
    note: '',
    isActive: true
  });
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchData();
    fetchSpecialties();
  }, [pagination.currentPage, filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.currentPage,
        limit: pagination.pageSize,
        search: searchTerm
      });

      if (filter.specialtyId !== 'all') {
        queryParams.append('specialtyId', filter.specialtyId);
      }

      const res = await api.get(`/admin/specialty-mappings?${queryParams}`);
      if (res.data.success) {
        setMappings(res.data.data.mappings || []);
        setPagination({
          ...pagination,
          totalPages: res.data.data.pagination?.pages || 1,
          total: res.data.data.pagination?.total || 0
        });
      }
    } catch (error) {
      console.error('Error fetching mappings:', error);
      toast.error('Không thể tải danh sách mappings');
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialties = async () => {
    try {
      const res = await api.get('/admin/specialties?limit=100');
      if (res.data.success) {
        setSpecialties(res.data.data?.specialties || []);
      }
    } catch (error) {
      console.error('Error fetching specialties:', error);
    }
  };

  const handleSearch = () => {
    setPagination({ ...pagination, currentPage: 1 });
    fetchData();
  };

  const handleOpenModal = (type, mapping = null) => {
    setModalType(type);
    setSelectedMapping(mapping);
    if (mapping) {
      setFormData({
        text: mapping.text,
        specialtyId: mapping.specialtyId?._id || mapping.specialtyId || '',
        priority: mapping.priority || 0,
        note: mapping.note || '',
        isActive: mapping.isActive !== false
      });
    } else {
      setFormData({
        text: '',
        specialtyId: '',
        priority: 0,
        note: '',
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedMapping(null);
    setFormData({
      text: '',
      specialtyId: '',
      priority: 0,
      note: '',
      isActive: true
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoadingAction(true);

    try {
      if (modalType === 'create') {
        await api.post('/admin/specialty-mappings', formData);
        toast.success('Đã tạo mapping thành công');
      } else if (modalType === 'edit') {
        await api.put(`/admin/specialty-mappings/${selectedMapping._id}`, formData);
        toast.success('Đã cập nhật mapping thành công');
      }
      handleCloseModal();
      fetchData();
    } catch (error) {
      console.error('Error saving mapping:', error);
      toast.error(error.response?.data?.message || 'Không thể lưu mapping');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleDelete = async (mapping) => {
    if (!window.confirm(`Bạn có chắc muốn xóa mapping "${mapping.text}"?`)) {
      return;
    }

    setLoadingAction(true);
    try {
      await api.delete(`/admin/specialty-mappings/${mapping._id}`);
      toast.success('Đã xóa mapping thành công');
      fetchData();
    } catch (error) {
      console.error('Error deleting mapping:', error);
      toast.error('Không thể xóa mapping');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleSeedToQdrant = async () => {
    if (!window.confirm('Bạn có chắc muốn seed tất cả mappings vào Qdrant? Quá trình này có thể mất vài phút.')) {
      return;
    }

    setSeeding(true);
    try {
      const res = await api.post('/admin/specialty-mappings/seed-to-qdrant');
      if (res.data.success) {
        toast.success(`Đã seed ${res.data.data.successCount} mappings vào Qdrant`);
      }
    } catch (error) {
      console.error('Error seeding to Qdrant:', error);
      toast.error('Không thể seed vào Qdrant');
    } finally {
      setSeeding(false);
    }
  };

  const getSpecialtyName = (mapping) => {
    if (mapping.specialtyId?.name) return mapping.specialtyId.name;
    if (mapping.specialtyName) return mapping.specialtyName;
    return 'N/A';
  };

  const activeCount = mappings.filter(m => m.isActive !== false).length;
  const inactiveCount = mappings.filter(m => m.isActive === false).length;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <FaFilter className="mr-3 text-blue-600" />
                Quản Lý Specialty Mappings
              </h1>
              <p className="text-gray-600 mt-2">
                Quản lý các mapping từ khóa đến chuyên khoa cho AI chatbot
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSeedToQdrant}
                disabled={seeding}
              >
                <FaSeedling className="mr-2" />
                {seeding ? 'Đang seed...' : 'Seed vào Qdrant'}
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center shadow-md"
                onClick={() => handleOpenModal('create')}
              >
                <FaPlus className="mr-2" />
                Thêm Mapping
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Tổng số</p>
                  <p className="text-2xl font-bold text-gray-900">{pagination.total}</p>
                </div>
                <FaFilter className="text-3xl text-blue-500 opacity-20" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Đang hoạt động</p>
                  <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
                </div>
                <FaCheck className="text-3xl text-green-500 opacity-20" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Đã tắt</p>
                  <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
                </div>
                <FaTimes className="text-3xl text-gray-500 opacity-20" />
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Chuyên khoa</p>
                  <p className="text-2xl font-bold text-gray-900">{specialties.length}</p>
                </div>
                <FaInfoCircle className="text-3xl text-purple-500 opacity-20" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Tìm kiếm từ khóa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <div>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filter.specialtyId}
                onChange={(e) => {
                  setFilter({ ...filter, specialtyId: e.target.value });
                  setPagination({ ...pagination, currentPage: 1 });
                }}
              >
                <option value="all">Tất cả chuyên khoa</option>
                {specialties.map(spec => (
                  <option key={spec._id} value={spec._id}>
                    {spec.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={filter.status}
                onChange={(e) => {
                  setFilter({ ...filter, status: e.target.value });
                  setPagination({ ...pagination, currentPage: 1 });
                }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Đã tắt</option>
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              onClick={handleSearch}
            >
              <FaSearch className="mr-2 inline" />
              Tìm kiếm
            </button>
            <button
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              onClick={() => {
                setSearchTerm('');
                setFilter({ specialtyId: 'all', status: 'all' });
                setPagination({ ...pagination, currentPage: 1 });
                fetchData();
              }}
            >
              <FaTimes className="mr-2 inline" />
              Reset
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-20">
              <FaFilter className="mx-auto text-6xl text-gray-300 mb-4" />
              <p className="text-gray-600 text-lg">Không có mapping nào</p>
              <button
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                onClick={() => handleOpenModal('create')}
              >
                Thêm mapping đầu tiên
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Từ khóa
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Chuyên khoa
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Độ ưu tiên
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Ghi chú
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {mappings.map((mapping) => (
                      <tr key={mapping._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">{mapping.text}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                            {getSpecialtyName(mapping)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              {mapping.priority || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-500 max-w-xs truncate">
                            {mapping.note || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {mapping.isActive !== false ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                              <FaCheck className="mr-1" />
                              Hoạt động
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                              <FaTimes className="mr-1" />
                              Tắt
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded transition-colors"
                              onClick={() => handleOpenModal('edit', mapping)}
                              title="Sửa"
                            >
                              <FaEdit />
                            </button>
                            <button
                              className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded transition-colors"
                              onClick={() => handleDelete(mapping)}
                              title="Xóa"
                            >
                              <FaTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                      Hiển thị <span className="font-medium">{(pagination.currentPage - 1) * pagination.pageSize + 1}</span> đến{' '}
                      <span className="font-medium">
                        {Math.min(pagination.currentPage * pagination.pageSize, pagination.total)}
                      </span>{' '}
                      trong tổng số <span className="font-medium">{pagination.total}</span> mappings
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })}
                        disabled={pagination.currentPage === 1}
                      >
                        <FaArrowLeft />
                      </button>
                      <div className="flex items-center gap-1">
                        {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                          let pageNum;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (pagination.currentPage >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = pagination.currentPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              className={`px-3 py-2 border rounded-lg transition-colors ${
                                pagination.currentPage === pageNum
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'border-gray-300 hover:bg-gray-50'
                              }`}
                              onClick={() => setPagination({ ...pagination, currentPage: pageNum })}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })}
                        disabled={pagination.currentPage === pagination.totalPages}
                      >
                        <FaArrowRight />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseModal}></div>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="relative bg-white rounded-lg max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-6 border-b">
                <h3 className="text-xl font-semibold text-gray-900">
                  {modalType === 'create' ? 'Thêm Mapping Mới' : 'Sửa Mapping'}
                </h3>
                <button
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={handleCloseModal}
                >
                  <FaTimes className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Từ khóa <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={formData.text}
                      onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                      required
                      disabled={modalType === 'edit'}
                      placeholder="Ví dụ: khám tổng quát"
                    />
                    {modalType === 'edit' && (
                      <p className="mt-1 text-xs text-gray-500">Không thể thay đổi từ khóa khi sửa</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Chuyên khoa <span className="text-red-500">*</span>
                    </label>
                    <select
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={formData.specialtyId}
                      onChange={(e) => setFormData({ ...formData, specialtyId: e.target.value })}
                      required
                    >
                      <option value="">Chọn chuyên khoa</option>
                      {specialties.map(spec => (
                        <option key={spec._id} value={spec._id}>
                          {spec.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Độ ưu tiên
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      min="0"
                      placeholder="0"
                    />
                    <p className="mt-1 text-xs text-gray-500">Priority cao hơn sẽ được ưu tiên khi có nhiều mapping khớp</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ghi chú
                    </label>
                    <textarea
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      rows="3"
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      placeholder="Ghi chú về mapping này..."
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      id="isActive"
                    />
                    <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                      Đang hoạt động
                    </label>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                  <button
                    type="button"
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    onClick={handleCloseModal}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={loadingAction}
                  >
                    {loadingAction ? 'Đang lưu...' : 'Lưu'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpecialtyMappings;
