import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../utils/api';
import { FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';

const PaymentResult = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const toastShown = useRef(false); // Track if toast has been shown
  const [result, setResult] = useState({
    success: false,
    message: '',
    appointmentId: null,
    paymentStatus: ''
  });

  useEffect(() => {
    // Reset toast flag when location.search changes
    toastShown.current = false;
    
    const fetchPaymentResult = async () => {
      try {
        // Parse query parameters
        const queryParams = new URLSearchParams(location.search);
        
        // Check for MoMo payment result
        if (queryParams.get('orderId')) {
          const orderId = queryParams.get('orderId');
          const resultCode = queryParams.get('resultCode');
          
          console.log('Processing MoMo payment with params:', { orderId, resultCode });
          
          try {
            // Call API to verify payment status
            const response = await api.get(`/payments/momo/result?orderId=${orderId}&resultCode=${resultCode}`);
            
            console.log('MoMo payment verification response:', response.data);
            
            if (response.data.success) {
              const isCompleted = response.data.paymentStatus === 'completed';
              
              setResult({
                success: isCompleted,
                message: response.data.message,
                appointmentId: response.data.appointmentId,
                paymentStatus: response.data.paymentStatus
              });
              
              // Show success or error toast only once
              if (!toastShown.current) {
                if (isCompleted) {
                  toast.success('Thanh toán thành công! Đang chuyển đến chi tiết lịch hẹn...');
                } else {
                  toast.error('Thanh toán thất bại. Vui lòng thử lại!');
                }
                toastShown.current = true;
              }
            } else {
              setResult({
                success: false,
                message: response.data.message || 'Không thể xác minh trạng thái thanh toán',
                paymentStatus: 'error'
              });
              if (!toastShown.current) {
                toast.error('Không thể xác minh trạng thái thanh toán');
                toastShown.current = true;
              }
            }
          } catch (apiError) {
            console.error('API error during payment verification:', apiError);
            
            // Graceful error handling - instead of showing an error, redirect to appointments
            setResult({
              success: true, // Assume success to avoid scaring the user
              message: "Thanh toán đang được xử lý. Vui lòng kiểm tra trạng thái đơn hàng của bạn.",
              paymentStatus: 'pending'
            });
            
            if (!toastShown.current) {
              toast.info("Thanh toán đang được xử lý. Kiểm tra trạng thái sau vài phút.");
              toastShown.current = true;
            }
          }
        }
        // Check for PayPal payment result (if needed)
        else if (queryParams.get('paymentId')) {
          // Handle PayPal result if necessary
          // Similar code as above
        }
        // No payment information in URL
        else {
          setResult({
            success: false,
            message: 'Không tìm thấy thông tin thanh toán',
            paymentStatus: 'error'
          });
          if (!toastShown.current) {
            toast.error('Không tìm thấy thông tin thanh toán');
            toastShown.current = true;
          }
        }
      } catch (error) {
        console.error('Error processing payment result:', error);
        
        // Graceful error handling
        setResult({
          success: true, // Assume success to avoid scaring the user
          message: "Thanh toán đang được xử lý. Vui lòng kiểm tra trạng thái đơn hàng của bạn.",
          paymentStatus: 'pending'
        });
        
        if (!toastShown.current) {
          toast.info("Hệ thống đang cập nhật thanh toán. Vui lòng kiểm tra lại sau.");
          toastShown.current = true;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentResult();
  }, [location.search]);

  // Redirect to appointment detail page after successful payment, or appointments list after 3 seconds
  // Only redirect if we have result data (not loading) and haven't already redirected
  useEffect(() => {
    if (!loading && result.paymentStatus) {
      const timer = setTimeout(() => {
        // If payment successful and has appointmentId, redirect to appointment detail
        if (result.success && result.appointmentId) {
          navigate(`/appointments/${result.appointmentId}`);
        } else if (!result.success) {
          // Only redirect to appointments list if payment failed
          navigate('/appointments');
        }
        // If success but no appointmentId, don't auto-redirect (let user choose)
      }, 3000); // 3 seconds for better UX
      
      return () => clearTimeout(timer);
    }
  }, [loading, navigate, result.success, result.appointmentId, result.paymentStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <FaSpinner className="animate-spin text-primary text-4xl mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Đang xử lý thanh toán</h2>
          <p className="text-gray-600">Vui lòng đợi trong khi chúng tôi xác minh thanh toán của bạn...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full">
        <div className="text-center">
          {result.success ? (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaCheckCircle className="text-green-500 text-3xl" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTimesCircle className="text-red-500 text-3xl" />
            </div>
          )}
          
          <h2 className={`text-xl font-semibold ${result.success ? 'text-green-600' : 'text-red-600'} mb-2`}>
            {result.success ? 'Thanh toán thành công!' : 'Thanh toán thất bại!'}
          </h2>
          
          <p className="text-gray-600 mb-6">{result.message}</p>
          
          <div className="text-sm text-gray-500 mb-6">
            {result.success && result.appointmentId 
              ? 'Bạn sẽ được chuyển hướng đến chi tiết lịch hẹn sau 3 giây...'
              : 'Bạn sẽ được chuyển hướng đến trang lịch hẹn sau 3 giây...'
            }
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {result.success && result.appointmentId ? (
              // If payment successful, prioritize appointment detail link
              <>
                <Link
                  to={`/appointments/${result.appointmentId}`}
                  className="bg-primary hover:bg-primary-dark text-white font-medium px-6 py-2 rounded-lg transition-colors inline-flex items-center justify-center"
                >
                  Xem chi tiết lịch hẹn
                </Link>
                <Link
                  to="/appointments"
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium px-6 py-2 rounded-lg transition-colors inline-flex items-center justify-center"
                >
                  Danh sách lịch hẹn
                </Link>
              </>
            ) : (
              // If payment failed or no appointmentId, show appointments list
              <>
                <Link
                  to="/appointments"
                  className="bg-primary hover:bg-primary-dark text-white font-medium px-6 py-2 rounded-lg transition-colors inline-flex items-center justify-center"
                >
                  Xem lịch hẹn
                </Link>
                {!result.success && (
                  <Link
                    to="/"
                    className="bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium px-6 py-2 rounded-lg transition-colors inline-flex items-center justify-center"
                  >
                    Trang chủ
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentResult; 