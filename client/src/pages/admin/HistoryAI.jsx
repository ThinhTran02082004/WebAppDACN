import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { 
  FaComments, FaUser, FaRobot, FaBrain, FaTag, 
  FaPlus, FaSpinner, FaCheckCircle, FaExclamationTriangle 
} from 'react-icons/fa';

const HistoryAI = () => {
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // State cho các nút "Thêm vào bộ lọc"
  const [addingIds, setAddingIds] = useState(new Set()); // Đang xử lý
  const [addedIds, setAddedIds] = useState(new Set());   // Đã thêm thành công
  const [addError, setAddError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      setAddError(null); // Xóa lỗi cũ khi tải trang mới
      try {
        const res = await api.get(`/admin/chat-history?page=${currentPage}&limit=20`);
        if (res.data.success) {
          // Backend trả về: data.items (mảng), data.total, data.page, data.limit, data.pages
          const responseData = res.data.data || {};
          setHistory(Array.isArray(responseData.items) ? responseData.items : []);
          // Map pagination để khớp với frontend (pages -> totalPages)
          setPagination({
            totalPages: responseData.pages || 1,
            currentPage: responseData.page || 1,
            total: responseData.total || 0,
            limit: responseData.limit || 20
          });
        } else {
          setError('Không thể tải lịch sử chat.');
          setHistory([]); // Đảm bảo history luôn là mảng
        }
      } catch (err) {
        setError('Lỗi kết nối máy chủ.');
        setHistory([]); // Đảm bảo history luôn là mảng khi có lỗi
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, [currentPage]);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && pagination && newPage <= pagination.totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  /**
   * Xử lý khi admin bấm nút "Thêm vào bộ lọc"
   */
  const handleAddIrrelevant = async (item) => {
    if (addingIds.has(item._id) || addedIds.has(item._id)) return;

    setAddingIds(prev => new Set(prev).add(item._id)); // Đặt trạng thái "Đang thêm"
    setAddError(null);

    try {
      // Gọi API backend (chúng ta sẽ tạo ở Bước 2)
      const res = await api.post('/admin/filter/add', { text: item.userPrompt });
      
      if (!res.data.success) {
        throw new Error(res.data.message || 'Lỗi không xác định từ server');
      }
      
      // Thêm thành công -> chuyển sang trạng thái "Đã thêm"
      setAddedIds(prev => new Set(prev).add(item._id));
      
    } catch (err) {
      console.error("Lỗi khi thêm vào bộ lọc:", err);
      setAddError(`Lỗi khi thêm câu hỏi (ID: ${item._id}): ${err.message}`);
    } finally {
      // Xóa khỏi trạng thái "Đang thêm" dù thành công hay thất bại
      setAddingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(item._id);
        return newSet;
      });
    }
  };
  
  // Hàm render nội dung cho nút
  const renderButtonContent = (item) => {
    if (addingIds.has(item._id)) {
      return <><FaSpinner className="animate-spin mr-1.5" /> Đang thêm...</>;
    }
    if (addedIds.has(item._id)) {
      return <><FaCheckCircle className="mr-1.5" /> Đã thêm</>;
    }
    return <><FaPlus className="mr-1.5" /> Thêm vào bộ lọc</>;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center">
          <FaComments className="mr-3 text-blue-600" />
          Lịch sử & Phân tích Trợ lý AI
        </h1>
        <p className="text-gray-600 mt-1">
          Xem lại các cuộc hội thoại và phân tích hành vi của người dùng.
        </p>
      </div>

      {loading && (
        <div className="text-center py-10">
          <div className="inline-block w-8 h-8 border-4 border-blue-600/30 border-l-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 mt-2">Đang tải lịch sử...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center p-4 bg-red-50 text-red-700 rounded-lg">
          <FaExclamationTriangle className="mr-3 text-red-500" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* Hiển thị lỗi khi thêm vào bộ lọc (nếu có) */}
      {addError && (
        <div className="flex items-center justify-center p-4 bg-yellow-50 text-yellow-700 rounded-lg">
          <FaExclamationTriangle className="mr-3 text-yellow-500" />
          <p className="font-medium">{addError}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Người dùng
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nội dung
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loại truy vấn
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Thời gian
                  </th>
                  {/* ⭐ CỘT MỚI */}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {!Array.isArray(history) || history.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      Không có lịch sử chat nào.
                    </td>
                  </tr>
                ) : (
                  history.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.userId?.fullName || 'Không rõ'}</div>
                        <div className="text-sm text-gray-500">{item.userId?.email || 'N/A'}</div>
                      </td>
                      {/* ⭐ SỬA: Thêm 'break-words' và 'max-w-lg' */}
                      <td className="px-6 py-4 max-w-lg" style={{ minWidth: '400px' }}>
                        <div className="flex items-start space-x-2 mb-2">
                          <FaUser className="flex-shrink-0 text-blue-600 mt-1" />
                          <p className="text-sm text-gray-800 bg-blue-50 p-2 rounded-md break-words">{item.userPrompt}</p>
                        </div>
                        <div className="flex items-start space-x-2">
                          <FaRobot className="flex-shrink-0 text-green-600 mt-1" />
                          <p className="text-sm text-gray-800 bg-green-50 p-2 rounded-md break-words">{item.aiResponse}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.usedTool ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <FaBrain className="mr-1.5" />
                            Nghiệp vụ (Đúng mục đích)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <FaTag className="mr-1.5" />
                            Tổng quát (Không liên quan)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleString('vi-VN')}
                      </td>
                      {/* ⭐ NÚT MỚI */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Chỉ hiển thị nút nếu câu hỏi là "Tổng quát" */}
                        {!item.usedTool && (
                          <button
                            onClick={() => handleAddIrrelevant(item)}
                            disabled={addingIds.has(item._id) || addedIds.has(item._id)}
                            className={`flex items-center px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                              (addingIds.has(item._id) || addedIds.has(item._id))
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {renderButtonContent(item)}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination (Giữ nguyên) */}
          {pagination && pagination.totalPages > 1 && (
             <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              {/* ... (Toàn bộ code phân trang của bạn) ... */}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryAI;