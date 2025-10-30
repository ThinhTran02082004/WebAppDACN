/**
 * Role-based access control middleware
 * Restricts access to routes based on user roles
 */

/**
 * Middleware to restrict access to specific roles
 * @param {...string} roles - Allowed roles (e.g., 'admin', 'doctor', 'user')
 * @returns {Function} Express middleware
 */
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Bạn chưa đăng nhập. Vui lòng đăng nhập để tiếp tục.'
      });
    }

    // Check if user's role is in the allowed roles
    const userRole = req.user.role || req.user.roleType;
    
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập tài nguyên này'
      });
    }

    next();
  };
};

/**
 * Middleware to check if user is an admin
 */
exports.adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Bạn chưa đăng nhập'
    });
  }

  const userRole = req.user.role || req.user.roleType;
  
  if (userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin mới có quyền truy cập'
    });
  }

  next();
};

/**
 * Middleware to check if user is a doctor
 */
exports.doctorOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Bạn chưa đăng nhập'
    });
  }

  const userRole = req.user.role || req.user.roleType;
  
  if (userRole !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ bác sĩ mới có quyền truy cập'
    });
  }

  next();
};

/**
 * Middleware to check if user is either admin or doctor
 */
exports.adminOrDoctor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Bạn chưa đăng nhập'
    });
  }

  const userRole = req.user.role || req.user.roleType;
  
  if (userRole !== 'admin' && userRole !== 'doctor') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ admin hoặc bác sĩ mới có quyền truy cập'
    });
  }

  next();
};


