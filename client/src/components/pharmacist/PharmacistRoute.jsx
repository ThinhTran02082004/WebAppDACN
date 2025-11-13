import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PharmacistLayout from './PharmacistLayout';

const PharmacistRoute = () => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Debug user info for pharmacist route
  useEffect(() => {
    if (user) {
      console.log('Pharmacist Route - User info:', { 
        id: user.id,
        role: user.role, 
        roleType: user.roleType,
        isPharmacist: (user.role === 'pharmacist' || user.roleType === 'pharmacist')
      });
    } else {
      console.log('Pharmacist Route - No user logged in');
    }
  }, [user]);

  if (loading) {
    return <div className="loading-app">Đang tải...</div>;
  }

  // Kiểm tra nếu người dùng đã xác thực
  if (!user) {
    console.log('Pharmacist Route - Redirecting to login due to no user');
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Kiểm tra cả hai trường roleType và role
  const isPharmacist = user.roleType === 'pharmacist' || user.role === 'pharmacist';
  
  if (!isPharmacist) {
    console.log('Pharmacist Route - User does not have pharmacist role:', user.role, user.roleType);
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  console.log('Pharmacist Route - Rendering pharmacist layout');
  // Hiển thị giao diện dược sĩ với các thành phần con
  return (
    <PharmacistLayout>
      <Outlet />
    </PharmacistLayout>
  );
};

export default PharmacistRoute;

