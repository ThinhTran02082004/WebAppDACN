import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { FaCheckCircle, FaExclamationCircle, FaSpinner } from 'react-icons/fa';

const VerifyEmail = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { updateUserData, login } = useAuth();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const hasVerifiedRef = useRef(false); // ✅ Prevent double verification
  
  useEffect(() => {
    const verifyEmailToken = async () => {
      // ✅ Prevent multiple verifications
      if (hasVerifiedRef.current) {
        return;
      }
      
      const searchParams = new URLSearchParams(location.search);
      const token = searchParams.get('token');
      
      console.log('Token from URL:', token);
      
      if (!token) {
        setStatus('error');
        setMessage('Token xác thực không hợp lệ hoặc đã hết hạn. Vui lòng thử lại.');
        return;
      }
      
      try {
        hasVerifiedRef.current = true; // ✅ Set flag before making request
        console.log('Sending verification request...');
        const response = await api.post('/auth/verify-email', { token });
        console.log('Verification response:', response.data);
        
        if (response.data.success) {
          setStatus('success');
          setMessage(response.data.message || 'Email của bạn đã được xác thực thành công!');
          
          // ✅ Fix: Use login() with token instead of updateUserData()
          if (response.data.token && response.data.user) {
            console.log('Saving user data with token:', response.data.user);
            // Use login() to properly save token and user data
            login({
              ...response.data.user,
              token: response.data.token
            }, false, false); // rememberMe=false, showNotification=false
          } else if (response.data.user) {
            console.log('Updating user data without token:', response.data.user);
            updateUserData(response.data.user);
          }
          
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Không thể xác thực email. Vui lòng thử lại.');
          hasVerifiedRef.current = false; // ✅ Reset on error
        }
      } catch (error) {
        hasVerifiedRef.current = false; // ✅ Reset on error
        console.error('Email verification error:', error);
        
        setStatus('error');
        if (error.response) {
          console.log('Error response:', error.response.data);
          setMessage(error.response.data.message || 'Không thể xác thực email. Vui lòng thử lại.');
        } else if (error.request) {
          console.log('Error request:', error.request);
          setMessage('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng.');
        } else {
          console.log('Error:', error.message);
          setMessage('Đã xảy ra lỗi. Vui lòng thử lại sau.');
        }
      }
    };
    
    verifyEmailToken();
  }, [location.search, navigate, login, updateUserData]); // ✅ Keep dependencies but use useRef to prevent duplicate calls
  
  // ... rest of the component remains the same
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-6">Xác thực email</h1>
        
        {status === 'loading' && (
          <div className="flex flex-col items-center justify-center py-6">
            <FaSpinner className="text-4xl text-primary animate-spin mb-4" />
            <p className="text-gray-600">Đang xác thực email của bạn...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <FaCheckCircle className="text-4xl text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-green-600 mb-2">Xác thực thành công!</h2>
            <p className="text-gray-600 mb-2">{message}</p>
            <p className="text-gray-500">Bạn sẽ được chuyển hướng về trang chủ sau vài giây...</p>
          </div>
        )}
        
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <FaExclamationCircle className="text-4xl text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-red-600 mb-3">Xác thực không thành công</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors"
                onClick={() => navigate('/need-verification')}
              >
                Yêu cầu xác thực lại
              </button>
              <button
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                onClick={() => navigate('/')}
              >
                Về trang chủ
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail; 
