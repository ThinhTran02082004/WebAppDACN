export const safeGet = (obj: any, path: string, defaultValue: any = undefined) => {
  try {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) ?? defaultValue;
  } catch {
    return defaultValue;
  }
};

export const getRating = (doctor: any): number => {
  // If ratings object exists, use it
  if (doctor.ratings?.average !== undefined) {
    return doctor.ratings.average;
  }
  
  // If averageRating exists, use it
  if (doctor.averageRating !== undefined) {
    return doctor.averageRating;
  }
  
  // If reviews array exists, calculate average
  if (Array.isArray(doctor.reviews) && doctor.reviews.length > 0) {
    const totalRating = doctor.reviews.reduce((sum: number, review: any) => sum + (review.rating || 0), 0);
    return totalRating / doctor.reviews.length;
  }
  
  // Default value
  return 0;
};

export const getReviewsCount = (doctor: any): number => {
  // If ratings object exists, use it
  if (doctor.ratings?.count !== undefined) {
    return doctor.ratings.count;
  }
  
  // If reviews array exists, use its length
  if (Array.isArray(doctor.reviews)) {
    return doctor.reviews.length;
  }
  
  // Default value
  return 0;
};

export const getExperience = (doctor: any): number => {
  // If experience is directly specified
  if (typeof doctor.experience === 'number') {
    return doctor.experience;
  }
  
  // Calculate from startPracticeDate if available
  if (doctor.startPracticeDate) {
    const startYear = new Date(doctor.startPracticeDate).getFullYear();
    const currentYear = new Date().getFullYear();
    return Math.max(0, currentYear - startYear);
  }
  
  // Default value
  return 0;
};

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
};

export const formatPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return '';
  const cleaned = phoneNumber.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{4})(\d{3})(\d{3})$/);
  if (match) {
    return `${match[1]} ${match[2]} ${match[3]}`;
  }
  return phoneNumber;
};

export const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

export const formatTime = (time: string): string => {
  return time.replace(/^([0-9]{1,2}):([0-9]{1,2})$/, '$1:$2');
};

/**
 * Normalize image source to ensure it's always a valid URI string
 * Handles cases where image might be an object, string, or undefined
 */
export const normalizeImageSource = (image: any, fallback: string = 'https://placehold.co/200x200'): { uri: string } => {
  // If image is already a string (URL), use it
  if (typeof image === 'string' && image.trim() !== '') {
    return { uri: image };
  }
  
  // If image is an object with secureUrl property
  if (image && typeof image === 'object' && image.secureUrl) {
    return { uri: image.secureUrl };
  }
  
  // If image is an object with url property
  if (image && typeof image === 'object' && image.url) {
    return { uri: image.url };
  }
  
  // If image is an object with imageUrl property
  if (image && typeof image === 'object' && image.imageUrl) {
    return { uri: image.imageUrl };
  }
  
  // If image is an object but we can't find a URL property, try to stringify and check
  if (image && typeof image === 'object') {
    // Try common property names
    const possibleUrls = ['secureUrl', 'url', 'imageUrl', 'src', 'source', 'uri'];
    for (const prop of possibleUrls) {
      if (image[prop] && typeof image[prop] === 'string') {
        return { uri: image[prop] };
      }
    }
  }
  
  // Fallback to default
  return { uri: fallback };
};