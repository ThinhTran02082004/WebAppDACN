import React from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import { FaStar, FaHospital } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const DoctorCard = ({ doctor }) => {
  const { theme, isEnabled } = useTheme();
  const isChristmas = theme === 'christmas' && isEnabled;
  
  // Helper function to safely get nested properties
  const safeGet = (obj, path, defaultValue = '') => {
    try {
      const keys = path.split('.');
      let result = obj;
      for (const key of keys) {
        if (result === undefined || result === null) return defaultValue;
        result = result[key];
      }
      return result === undefined || result === null ? defaultValue : result;
    } catch (e) {
      return defaultValue;
    }
  };

  // Calculate average rating safely
  const rating = (() => {
    if (typeof doctor.avgRating === 'number') {
      return doctor.avgRating;
    } else if (doctor.avgRating && typeof doctor.avgRating.value === 'number') {
      return doctor.avgRating.value;
    } else if (doctor.rating && typeof doctor.rating === 'number') {
      return doctor.rating;
    } else if (doctor.ratings && typeof doctor.ratings.average === 'number') {
      return doctor.ratings.average;
    }
    return 0;
  })();

  // Get review count
  const reviewCount = doctor.numReviews || doctor.reviewCount || (doctor.ratings && doctor.ratings.count) || 0;
  
  // Render stars
  const renderStars = (rating) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <FaStar 
            key={star}
            className={`${star <= Math.floor(rating) 
              ? 'text-yellow-500' 
              : star <= Math.ceil(rating) && rating % 1 !== 0 
                ? 'text-yellow-300' 
                : 'text-gray-300'
            } w-3 h-3`}
          />
        ))}
      </div>
    );
  };

  const renderImage = () => {
    const avatarUrl = safeGet(doctor, 'user.avatarUrl');
    
    if (!avatarUrl) {
      return (
        <div className="w-full h-48 bg-gradient-to-r from-primary/60 to-blue-500/60 flex items-center justify-center">
          <span className="text-3xl font-bold text-white">
            {safeGet(doctor, 'user.fullName', 'BS').split(' ').map(n => n[0]).join('').toUpperCase()}
          </span>
        </div>
      );
    }

    return (
      <div className="w-full h-48 bg-white flex items-center justify-center">
        <img 
          src={avatarUrl} 
          alt={safeGet(doctor, 'user.fullName', 'Doctor')} 
          className="h-full object-contain" 
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/avatars/default-avatar.png';
          }}
        />
      </div>
    );
  };
            
            return (
    <div className={`bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 h-full flex flex-col border hover:-translate-y-1 group relative overflow-hidden ${
      isChristmas 
        ? 'border-red-300 hover:border-red-400 shadow-red-100 hover:shadow-red-200' 
        : 'border-gray-100'
    }`}>
      {/* Hiệu ứng giáng sinh - tuyết rơi nhỏ trên card */}
      {isChristmas && (
        <>
          <div className="absolute top-2 left-2 text-red-400 text-xs animate-pulse">❄</div>
          <div className="absolute top-4 right-4 text-green-400 text-xs animate-pulse" style={{ animationDelay: '0.5s' }}>❄</div>
          <div className="absolute bottom-20 left-4 text-red-400 text-xs animate-pulse" style={{ animationDelay: '1s' }}>❄</div>
          <div className="absolute top-1/2 right-2 text-green-400 text-xs animate-pulse" style={{ animationDelay: '1.5s' }}>❄</div>
          
          {/* Viền gradient giáng sinh */}
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-50/30 via-transparent to-green-50/30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          
          {/* Sao trang trí */}
          <div className="absolute top-1 right-1 text-yellow-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-pulse">⭐</div>
        </>
      )}
      
      <Link to={`/doctors/${doctor._id}`} className="relative block">
        <div className="relative">
          {renderImage()}
          
          {/* Hiệu ứng giáng sinh cho ảnh */}
          {isChristmas && (
            <div className="absolute inset-0 bg-gradient-to-t from-red-500/10 to-transparent pointer-events-none rounded-t-xl"></div>
          )}
          
          {safeGet(doctor, 'specialtyId.name') && (
            <div className={`absolute top-2 right-2 text-xs font-medium py-1 px-2 rounded-full shadow-sm ${
              isChristmas 
                ? 'bg-gradient-to-r from-red-500 to-green-500 text-white border-2 border-white' 
                : 'bg-white/90 text-primary'
            }`}>
              {safeGet(doctor, 'specialtyId.name')}
            </div>
          )}
          
          {/* Rating badge với hiệu ứng giáng sinh */}
          {rating > 0 && (
            <div className={`absolute bottom-2 left-2 text-white text-xs font-bold py-1 px-2 rounded flex items-center ${
              isChristmas 
                ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 shadow-lg shadow-yellow-500/50 border-2 border-white' 
                : 'bg-yellow-500'
            }`}>
              <FaStar className="mr-1" />
              {rating.toFixed(1)}
            </div>
          )}
        </div>
      </Link>
      
      <div className="p-4 flex-grow flex flex-col relative">
        <Link to={`/doctors/${doctor._id}`}>
          <h3 className={`font-semibold text-lg transition-colors ${
            isChristmas 
              ? 'text-gray-800 group-hover:text-red-600' 
              : 'text-gray-800 group-hover:text-primary'
          }`}>
            {safeGet(doctor, 'user.fullName', 'Bác sĩ')}
            {isChristmas && (
              <span className="ml-2 text-red-500 text-sm animate-pulse">🎄</span>
            )}
          </h3>
        </Link>
        
        {safeGet(doctor, 'hospitalId.name') && (
          <p className="text-gray-600 text-sm mt-1 flex items-center">
            <FaHospital className="text-primary mr-1" /> {safeGet(doctor, 'hospitalId.name')}
          </p>
        )}
        
        <div className="mt-3 flex items-center">
          <div className="flex items-center">
            {renderStars(rating)}
            <span className="ml-2 font-medium text-yellow-500">
              {rating ? rating.toFixed(1) : '0.0'}
                  </span>
          </div>
          <span className="mx-2 text-gray-300">•</span>
          <span className="text-gray-500 text-sm">{reviewCount} đánh giá</span>
        </div>
        
        <p className="text-gray-600 text-sm leading-relaxed mb-5 overflow-hidden text-ellipsis whitespace-nowrap">
          {doctor.description || 'Bác sĩ có nhiều năm kinh nghiệm trong lĩnh vực chuyên môn.'}
        </p>
        
        <div className="mt-auto pt-3">
          <div className="flex justify-between items-center">
            <span className={`font-medium text-sm ${
              isChristmas ? 'text-red-600' : 'text-primary'
            }`}>
              {doctor.experience || ''} {doctor.experience ? 'năm kinh nghiệm' : ''}
            </span>
            <Link 
              to={`/doctors/${doctor._id}`} 
              className={`text-xs py-1 px-3 rounded-full transition-all duration-300 ${
                isChristmas 
                  ? 'bg-gradient-to-r from-red-500 to-green-500 text-white hover:from-red-600 hover:to-green-600 shadow-md hover:shadow-lg transform hover:scale-105' 
                  : 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary'
              }`}
            >
              Xem chi tiết {isChristmas && '🎁'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

DoctorCard.propTypes = {
  doctor: PropTypes.object.isRequired
};

export default DoctorCard; 
