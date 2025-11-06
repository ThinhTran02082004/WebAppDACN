import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Spin, Alert } from 'antd';
import { toastSuccess, toastError, toastInfo, toastGoogleSuccess, toastFacebookSuccess } from '../../utils/toast';
import { navigateByRole } from '../../utils/roleUtils';
import api from '../../utils/api';

const SocialCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  const [error, setError] = useState(null);
  const processedRef = useRef(false);
  const toastShownRef = useRef(false);
  const redirectingRef = useRef(false); // ✅ Thêm flag để theo dõi quá trình redirect

  // Hiển thị thông báo đang xử lý ngay khi component mount
  useEffect(() => {
    if (!toastShownRef.current && (searchParams.get('data') || searchParams.get('code'))) {
      toastInfo('Đang xử lý đăng nhập...');
      toastShownRef.current = true;
    }
  }, [searchParams]);

  useEffect(() => {
    // Tránh xử lý nhiều lần
    if (processedRef.current || redirectingRef.current) {
      return;
    }

    const processCallback = async () => {
      try {
        // Đánh dấu đã bắt đầu xử lý
        processedRef.current = true;

        // Check for Facebook OAuth code
        const code = searchParams.get('code');
        if (code) {
          // Xử lý Facebook OAuth code
          console.log('Đang xử lý Facebook OAuth callback với code:', code);
          
          // Lấy redirectUri giống với redirectUri đã sử dụng khi gọi FB login
          const redirectUri = `${window.location.origin}/api/auth/facebook/callback`;
          
          // Gọi API để đổi code lấy token và thông tin người dùng
          const response = await api.post('/auth/facebook-code', {
            code: code,
            redirectUri: redirectUri
          });
          
          if (response.data.success) {
            // Đăng nhập thành công với dữ liệu từ Facebook
            const userData = response.data.data;
            
            // Set authentication in context (không hiển thị thông báo từ hàm login)
            await login(userData, true, false);
            
            // Hiển thị thông báo đăng nhập Facebook thành công
            toastFacebookSuccess(`Đăng nhập Facebook thành công! Xin chào, ${userData.fullName}`);
            
            // Chuyển hướng sau một chút để đảm bảo toast hiển thị
            setTimeout(() => {
              // Nếu người dùng cần đặt mật khẩu, chuyển hướng đến trang đặt mật khẩu
              if (userData.needPassword) {
                console.log('Chuyển hướng đến trang đặt mật khẩu cho tài khoản mạng xã hội');
                navigate('/set-social-password');
                return;
              }
              
              // Lấy đường dẫn redirect từ session storage hoặc redirect theo role
              const redirectTo = sessionStorage.getItem('auth_redirect');
              sessionStorage.removeItem('auth_redirect');
              if (redirectTo) {
                window.location.href = redirectTo;
              } else {
                navigateByRole(userData, navigate);
              }
            }, 3000);
            
            return;
          } else {
            setError(response.data.message || 'Đăng nhập Facebook không thành công.');
            toastError('Đăng nhập Facebook không thành công.');
            return;
          }
        }

        // Get the data parameter from URL (for existing social callback)
        const dataParam = searchParams.get('data');
        if (!dataParam) {
          setError('Không nhận được dữ liệu người dùng từ máy chủ.');
          return;
        }

        // Parse the user data
        const userData = JSON.parse(decodeURIComponent(dataParam));
        
        if (!userData.token) {
          setError('Token xác thực không hợp lệ.');
          return;
        }

        // Log the user in (store token, set logged in state)
        console.log('Đăng nhập thành công với dữ liệu:', userData);
        console.log('needPassword:', userData.needPassword); // ✅ Debug log
        
        // Set authentication in context (không hiển thị thông báo từ hàm login)
        await login(userData, true, false);
        
        // ✅ Đánh dấu đang trong quá trình redirect
        redirectingRef.current = true;
        
        // Xác định loại đăng nhập từ authProvider hoặc từ dữ liệu
        const isGoogleLogin = userData.authProvider === 'google' || userData.googleId;
        const isFacebookLogin = userData.authProvider === 'facebook' || userData.facebookId;
        
        // Hiển thị thông báo dựa vào loại đăng nhập
        if (isGoogleLogin) {
          console.log('Hiển thị thông báo đăng nhập Google thành công');
          toastGoogleSuccess(`Đăng nhập Google thành công! Xin chào, ${userData.fullName}`);
        } else if (isFacebookLogin) {
          toastFacebookSuccess(`Đăng nhập Facebook thành công! Xin chào, ${userData.fullName}`);
        } else {
          toastSuccess(`Đăng nhập thành công! Xin chào, ${userData.fullName}`);
        }
        
        // ✅ Kiểm tra needPassword NGAY LẬP TỨC (không cần setTimeout)
        if (userData.needPassword) {
          console.log('User cần đặt mật khẩu, chuyển hướng đến /set-social-password');
          navigate('/set-social-password', { replace: true });
          return;
        }
        
        // Chuyển hướng sau một chút để đảm bảo toast hiển thị (chỉ cho trường hợp không cần password)
        setTimeout(() => {
          // Lấy đường dẫn redirect từ session storage hoặc redirect theo role
          const redirectTo = sessionStorage.getItem('auth_redirect');
          sessionStorage.removeItem('auth_redirect');
          if (redirectTo) {
            window.location.href = redirectTo;
          } else {
            navigateByRole(userData, navigate);
          }
          redirectingRef.current = false; // ✅ Reset flag sau khi redirect
        }, 1500);
      } catch (error) {
        console.error('Lỗi xử lý callback mạng xã hội:', error);
        setError('Đã xảy ra lỗi khi xử lý đăng nhập. Vui lòng thử lại.');
        toastError('Đăng nhập không thành công. Vui lòng thử lại.');
        redirectingRef.current = false; // ✅ Reset flag nếu có lỗi
      }
    };

    // ✅ Chỉ xử lý nếu có query param, chưa xử lý, và chưa redirect
    if ((searchParams.get('data') || searchParams.get('code')) && !processedRef.current && !redirectingRef.current) {
      processCallback();
    } 
    // ✅ CHỈ redirect về trang chủ nếu đã đăng nhập VÀ không đang trong quá trình xử lý callback
    else if (isAuthenticated && !searchParams.get('data') && !searchParams.get('code') && !redirectingRef.current) {
      navigate('/', { replace: true });
    }

    // Cleanup
    return () => {
      // Không reset processedRef ở đây để tránh xử lý lại
    };
  }, [searchParams, navigate, login, isAuthenticated]); // ✅ Giữ isAuthenticated nhưng thêm logic kiểm tra

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center',
      height: '100vh'
    }}>
      {error ? (
        <Alert
          message="Lỗi Đăng nhập"
          description={error}
          type="error"
          showIcon
          action={
            <button 
              onClick={() => navigate('/login')}
              style={{ 
                marginTop: '10px', 
                padding: '5px 15px', 
                backgroundColor: '#1890ff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Quay lại đăng nhập
            </button>
          }
        />
      ) : (
        <Spin size="large" />
      )}
    </div>
  );
};

export default SocialCallback; 
