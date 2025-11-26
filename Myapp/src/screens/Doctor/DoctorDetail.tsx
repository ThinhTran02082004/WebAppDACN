import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Alert,
} from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { apiService, Doctor } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

interface DoctorDetailProps {
  route: {
    params: {
      id: string;
    };
  };
  navigation: any;
}

interface Review {
  _id: string;
  userId: {
    _id: string;
    fullName: string;
    avatarUrl?: string;
  };
  rating: number;
  comment: string;
  createdAt: string;
  doctorReply?: {
    content: string;
    createdAt: string;
  };
  replies?: Array<{
    _id: string;
    userId: {
      _id: string;
      fullName: string;
      avatarUrl?: string;
      roleType?: string;
    };
    comment: string;
    createdAt: string;
  }>;
}

export default function DoctorDetail({ route, navigation }: DoctorDetailProps) {
  const { id } = route.params;
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewStats, setReviewStats] = useState({ total: 0, averageRating: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [hasMoreReviews, setHasMoreReviews] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'reviews'>('info');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isLoadingFavorite, setIsLoadingFavorite] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await apiService.getDoctorById(id);
        if (res.success) setDoctor(res.data);
      } catch (error) {
        console.error('Error loading doctor:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Check if doctor is in favorites
  useEffect(() => {
    const checkFavorite = async () => {
      if (!user || !id) {
        setIsFavorite(false);
        return;
      }
      try {
        const res = await apiService.getFavoriteDoctors();
        if (res && res.success) {
          const data = (res?.data as any);
          const favoriteDoctors: Doctor[] = Array.isArray(data) ? data : (data?.doctors || []);
          const isFav = favoriteDoctors.some((doc: Doctor) => doc._id === id);
          setIsFavorite(isFav);
        } else {
          // If response is not successful, assume not favorite
          setIsFavorite(false);
        }
      } catch (error: any) {
        console.error('Error checking favorite:', error);
        // If there's an auth error, assume not favorite
        const errorMessage = error?.message || error?.response?.data?.message || '';
        if (error?.response?.status === 401 || errorMessage.includes('đăng nhập') || errorMessage.includes('quyền')) {
          setIsFavorite(false);
        }
      }
    };
    checkFavorite();
  }, [id, user]);

  useEffect(() => {
    const loadReviews = async () => {
      setLoadingReviews(true);
      try {
        const res = await apiService.getDoctorReviews(id, { page: 1, limit: 5 });
        console.log('Reviews response:', res);
        if (res.success && res.data) {
          // API trả về: { data: [...reviews], count/total, averageRating }
          const dataObj = res.data as any;
          const reviewsArray = Array.isArray(dataObj) ? dataObj : (dataObj.reviews || dataObj.data || []);
          const total = dataObj.count || dataObj.total || reviewsArray.length || 0;
          setReviews(reviewsArray);
          setReviewStats({
            total,
            averageRating: dataObj.averageRating || 0,
          });
          setReviewsPage(1);
          setHasMoreReviews(reviewsArray.length < total);
        }
      } catch (error) {
        console.error('Error loading reviews:', error);
      } finally {
        setLoadingReviews(false);
      }
    };
    loadReviews();
  }, [id]);

  const loadMoreReviews = async () => {
    if (loadingReviews || !hasMoreReviews) return;
    const nextPage = reviewsPage + 1;
    setLoadingReviews(true);
    try {
      const res = await apiService.getDoctorReviews(id, { page: nextPage, limit: 5 });
      if (res.success && res.data) {
        const dataObj = res.data as any;
        const newReviews: Review[] = Array.isArray(dataObj) ? dataObj : (dataObj.reviews || dataObj.data || []);
        const total = dataObj.count || dataObj.total || reviewStats.total || 0;
        setReviews((prev) => [...prev, ...newReviews]);
        setReviewsPage(nextPage);
        setHasMoreReviews((prevHasMore) => prevHasMore && (reviews.length + newReviews.length < total));
        // Keep stats consistent
        setReviewStats((prev) => ({ ...prev, total }));
      }
    } catch (error) {
      console.error('Error loading more reviews:', error);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleBookAppointment = () => {
    if (!user) {
      // Yêu cầu đăng nhập
      navigation.navigate('Login');
      return;
    }
    // Navigate to booking screen with pre-filled data
    if (doctor) {
      const specialtyId = typeof doctor.specialtyId === 'object' 
        ? doctor.specialtyId._id 
        : doctor.specialtyId;
      const hospitalId = typeof doctor.hospitalId === 'object' 
        ? doctor.hospitalId._id 
        : doctor.hospitalId;
      
      navigation.navigate('Booking', {
        doctorId: doctor._id,
        specialtyId: specialtyId || undefined,
        hospitalId: hospitalId || undefined,
      });
    } else {
      navigation.navigate('Booking');
    }
  };

  const handleVideoCall = () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    // TODO: Navigate to video call
    console.log('Video call with doctor:', doctor?._id);
  };

  const handleToggleFavorite = async () => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    if (!doctor?._id || isLoadingFavorite) return;

    setIsLoadingFavorite(true);
    try {
      if (isFavorite) {
        const res = await apiService.removeFavoriteDoctor(doctor._id);
        if (res && res.success) {
          setIsFavorite(false);
        } else {
          const errorMessage = (res as any)?.message || 'Không thể xóa khỏi yêu thích';
          if (errorMessage.includes('đăng nhập') || errorMessage.includes('quyền')) {
            Alert.alert('Lỗi', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            navigation.navigate('Login');
          } else {
            Alert.alert('Lỗi', errorMessage);
          }
        }
      } else {
        const res = await apiService.addFavoriteDoctor(doctor._id);
        if (res && res.success) {
          setIsFavorite(true);
        } else {
          const errorMessage = (res as any)?.message || 'Không thể thêm vào yêu thích';
          if (errorMessage.includes('đăng nhập') || errorMessage.includes('quyền')) {
            Alert.alert('Lỗi', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            navigation.navigate('Login');
          } else {
            Alert.alert('Lỗi', errorMessage);
          }
        }
      }
    } catch (error: any) {
      console.error('Error toggling favorite:', error);
      const errorMessage = error?.response?.data?.message || error?.message || 'Không thể cập nhật yêu thích';
      if (error?.response?.status === 401 || errorMessage.includes('đăng nhập') || errorMessage.includes('quyền')) {
        Alert.alert('Lỗi', 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        navigation.navigate('Login');
      } else {
        Alert.alert('Lỗi', errorMessage);
      }
    } finally {
      setIsLoadingFavorite(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0a84ff" />
        <Text style={styles.loadingText}>Đang tải thông tin...</Text>
      </View>
    );
  }

  if (!doctor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity> 
          <View style={styles.placeholder} />
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#ccc" />
          <Text style={styles.errorText}>Không tìm thấy thông tin bác sĩ</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.retryButtonText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={handleToggleFavorite}
          disabled={isLoadingFavorite}
        >
          {isLoadingFavorite ? (
            <ActivityIndicator size="small" color="#0a84ff" />
          ) : (
            <Ionicons 
              name={isFavorite ? "heart" : "heart-outline"} 
              size={24} 
              color={isFavorite ? "#ff3b30" : "#333"} 
            />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Doctor Info Card */}
        <View style={styles.doctorCard}>
          <View style={styles.avatarContainer}>
            {imageError || !doctor.user?.avatarUrl ? (
              <View style={styles.defaultAvatar}>
                <Ionicons name="person" size={60} color="#0a84ff" />
              </View>
            ) : (
              <Image
                source={{ uri: doctor.user.avatarUrl }}
                style={styles.avatar}
                onError={() => setImageError(true)}
                resizeMode="cover"
              />
            )}
          </View>

          <Text style={styles.doctorName}>
            {(doctor.title || 'BS.').replace(/CK[0-9]+/g, '').trim()} {doctor.user?.fullName || 'Chưa cập nhật'}
          </Text>

          <Text style={styles.specialty}>{doctor.specialtyId?.name || 'Chưa cập nhật chuyên khoa'}</Text>

          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#ff9500" />
            <Text style={styles.rating}>
              {reviewStats.averageRating > 0 ? reviewStats.averageRating.toFixed(1) : (doctor.averageRating ? Number(doctor.averageRating).toFixed(1) : 'N/A')}
            </Text>
            <Text style={styles.ratingCount}>({reviewStats.total} đánh giá)</Text>
          </View>

          {/* Quick Info */}
          <View style={styles.quickInfoContainer}>
            <View style={styles.quickInfoItem}>
              <Ionicons name="briefcase-outline" size={20} color="#0a84ff" />
              <Text style={styles.quickInfoText}>
                {typeof doctor.experience === 'number' ? `${doctor.experience} năm` : 'N/A'}
              </Text>
              <Text style={styles.quickInfoLabel}>Kinh nghiệm</Text>
            </View>
            <View style={styles.quickInfoDivider} />
            <View style={styles.quickInfoItem}>
              <Ionicons name="medical-outline" size={20} color="#0a84ff" />
              <Text style={styles.quickInfoText}>{doctor.services?.length || 0}</Text>
              <Text style={styles.quickInfoLabel}>Dịch vụ</Text>
            </View>
          </View>
        </View>

        {/* Fee Info */}
        <View style={styles.feeSection}>
          <View style={styles.feeSectionHeader}>
            <Ionicons name="card-outline" size={18} color="#333" />
            <Text style={styles.feeSectionTitle}>Chi phí khám </Text>
          </View>
          <View style={styles.feeCardCompact}>
            <Text style={styles.feeAmountCompact}>
              {typeof doctor.consultationFee === 'number'
                ? `${doctor.consultationFee.toLocaleString('vi-VN')}đ`
                : 'Liên hệ'}
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'info' && styles.tabActive]}
            onPress={() => setActiveTab('info')}
          >
            <Ionicons 
              name="information-circle-outline" 
              size={20} 
              color={activeTab === 'info' ? '#0a84ff' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'info' && styles.tabTextActive]}>
              Thông tin chung
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'reviews' && styles.tabActive]}
            onPress={() => setActiveTab('reviews')}
          >
            <Ionicons 
              name="star-outline" 
              size={20} 
              color={activeTab === 'reviews' ? '#0a84ff' : '#666'} 
            />
            <Text style={[styles.tabText, activeTab === 'reviews' && styles.tabTextActive]}>
              Đánh giá {reviewStats.total > 0 && `(${reviewStats.total})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'info' ? (
          <View style={styles.tabContent}>
            {/* About */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="document-text-outline" size={20} color="#333" />
                <Text style={styles.sectionTitle}>Giới thiệu</Text>
              </View>
              <Text style={styles.description}>
                {doctor.description || 'Bác sĩ chuyên khoa với nhiều năm kinh nghiệm trong lĩnh vực y tế. Tận tâm chăm sóc sức khỏe bệnh nhân.'}
              </Text>
            </View>

            {/* Hospital Info */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="business-outline" size={20} color="#333" />
                <Text style={styles.sectionTitle}>Bệnh viện</Text>
              </View>
              <View style={styles.hospitalCard}>
                <Ionicons name="location" size={20} color="#0a84ff" />
                <View style={styles.hospitalInfo}>
                  <Text style={styles.hospitalName}>{doctor.hospitalId?.name || 'Chưa cập nhật'}</Text>
                  <Text style={styles.hospitalAddress}>{doctor.hospitalId?.address || 'Chưa có địa chỉ'}</Text>
                </View>
              </View>
            </View>

            {/* Education */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="school-outline" size={20} color="#333" />
                <Text style={styles.sectionTitle}>Học vấn</Text>
              </View>
              <View style={styles.educationCard}>
                <Text style={styles.educationText}>
                  {doctor.education || 'Tốt nghiệp Đại học Y khoa'}
                </Text>
              </View>
            </View>

            {/* Certifications */}
            {doctor.certifications && doctor.certifications.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="ribbon-outline" size={20} color="#333" />
                  <Text style={styles.sectionTitle}>Chứng chỉ</Text>
                </View>
                {doctor.certifications.map((cert, index) => (
                  <View key={index} style={styles.certificationItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#34c759" />
                    <Text style={styles.certificationText}>{cert}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.tabContent}>

            {/* Reviews Tab Content */}
            {loadingReviews ? (
              <View style={styles.reviewsLoading}>
                <ActivityIndicator size="large" color="#0a84ff" />
                <Text style={styles.loadingText}>Đang tải đánh giá...</Text>
              </View>
            ) : reviews.length > 0 ? (
            <>
            
              {/* Review List */}
              {reviews.map((review) => (
                <View key={review._id} style={styles.reviewItem}>
                  {/* Patient Review */}
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewUserInfo}>
                      {review.userId?.avatarUrl ? (
                        <Image
                          source={{ uri: review.userId.avatarUrl }}
                          style={styles.reviewAvatar}
                        />
                      ) : (
                        <View style={styles.reviewDefaultAvatar}>
                          <Ionicons name="person" size={20} color="#0a84ff" />
                        </View>
                      )}
                      <View style={styles.reviewUserDetails}>
                        <Text style={styles.reviewUserName}>
                          {review.userId?.fullName || 'Bệnh nhân'}
                        </Text>
                        <View style={styles.reviewRatingRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= review.rating ? 'star' : 'star-outline'}
                              size={12}
                              color="#ff9500"
                            />
                          ))}
                        </View>
                      </View>
                    </View>
                    <Text style={styles.reviewDate}>
                      {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                    </Text>
                  </View>
                  
                  {/* Patient Comment */}
                  {review.comment ? (
                    <View style={styles.reviewCommentContainer}>
                      <Text style={styles.reviewComment}>{review.comment}</Text>
                    </View>
                  ) : (
                    <View style={styles.reviewCommentContainer}>
                      <Text style={styles.reviewCommentEmpty}>Bệnh nhân đã đánh giá nhưng không để lại nhận xét</Text>
                    </View>
                  )}

                  {/* Doctor Reply */}
                  {(review.doctorReply || (review.replies && review.replies.length > 0)) && (
                    <View style={styles.doctorReplyContainer}>
                      <View style={styles.doctorReplyHeader}>
                        <View style={styles.doctorReplyDoctorInfo}>
                          {doctor?.user?.avatarUrl ? (
                            <Image
                              source={{ uri: doctor.user.avatarUrl }}
                              style={styles.doctorReplyAvatar}
                            />
                          ) : (
                            <View style={[styles.doctorReplyAvatar, styles.doctorReplyAvatarFallback]}>
                              <Ionicons name="person" size={16} color="#6b7280" />
                            </View>
                          )}
                          <View>
                            <Text style={styles.doctorReplyDoctorName}>{doctor?.user?.fullName || 'Bác sĩ'}</Text>
                            {doctor?.title ? (
                              <Text style={styles.doctorReplyDoctorTitle}>
                                {(doctor.title || 'BS.').replace(/CK[0-9]+/g, '').trim()}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <Text style={styles.doctorReplyDate}>
                          {new Date(
                            review.doctorReply?.createdAt || review.replies?.[0]?.createdAt || ''
                          ).toLocaleDateString('vi-VN')}
                        </Text>
                      </View>
                      <Text style={styles.doctorReplyText}>
                        {review.doctorReply?.content || review.replies?.[0]?.comment}
                      </Text>
                    </View>
                  )}
                </View>
              ))}

              {hasMoreReviews && (
                <TouchableOpacity style={styles.viewAllReviewsButton} onPress={loadMoreReviews} activeOpacity={0.7}>
                  <Text style={styles.viewAllReviewsText}>
                    Xem thêm
                  </Text>
                  {loadingReviews ? (
                    <ActivityIndicator size="small" color="#0a84ff" />
                  ) : (
                    <Ionicons name="chevron-down" size={16} color="#0a84ff" />
                  )}
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.noReviews}>
              <Ionicons name="chatbox-outline" size={64} color="#ccc" />
              <Text style={styles.noReviewsText}>Chưa có đánh giá nào</Text>
              <Text style={styles.noReviewsSubtext}>
                Hãy là người đầu tiên đánh giá bác sĩ này
              </Text>
            </View>
          )}
          </View>
        )}

        <View style={{ height: 100 }} />
    </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.bookButton}
          onPress={handleBookAppointment}
          activeOpacity={0.8}
        >
          <Text style={styles.bookButtonText}>Đặt lịch khám</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#0a84ff',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    marginTop:24,
  },
  backButton: {
    padding: 8,
  },
  favoriteButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  doctorCard: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#0a84ff',
    marginBottom: 16,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  defaultAvatar: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  specialty: {
    fontSize: 16,
    color: '#0a84ff',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  rating: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ff9500',
    marginLeft: 6,
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: '#666',
  },
  quickInfoContainer: {
    flexDirection: 'row',
    width: '100%',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  quickInfoItem: {
    alignItems: 'center',
    flex: 1,
  },
  quickInfoDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },
  quickInfoText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  quickInfoLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 8,
  },
  hospitalCard: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
  },
  hospitalInfo: {
    flex: 1,
    marginLeft: 12,
  },
  hospitalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  hospitalAddress: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  description: {
    fontSize: 15,
    color: '#444',
    lineHeight: 24,
  },
  educationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  educationText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  certificationText: {
    fontSize: 15,
    color: '#333',
    marginLeft: 12,
    flex: 1,
  },
  feeSection: {
    backgroundColor: '#fff',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  feeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  feeSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 6,
  },
  feeCardCompact: {
    flexDirection: 'row',
    backgroundColor: '#f0f8ff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#0a84ff',
  },
  feeAmountCompact: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0a84ff',
    marginRight: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginTop: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#0a84ff',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666',
  },
  tabTextActive: {
    color: '#0a84ff',
    fontWeight: '600',
  },
  tabContent: {
    backgroundColor: '#f8f9fa',
  },
  reviewsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    marginLeft: 16,
    marginRight: 16,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  reviewDefaultAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#0a84ff',
  },
  reviewUserDetails: {
    flex: 1,
  },
  reviewUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewRatingRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewCommentContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  reviewComment: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginLeft: 12,
    marginRight: 12,
  },
  reviewCommentEmpty: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  doctorReplyContainer: {
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    marginLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#0a84ff',
  },
  doctorReplyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  doctorReplyDoctorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  doctorReplyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  doctorReplyAvatarFallback: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  doctorReplyDoctorName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0a84ff',
  },
  doctorReplyDoctorTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  doctorReplyText: {
    fontSize: 14,
    color: '#1565c0',
    lineHeight: 20,
    marginBottom: 4,
  },
  doctorReplyDate: {
    fontSize: 11,
    color: '#64b5f6',
    marginTop: 2,
    marginLeft: 12,
  },
  viewAllReviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  viewAllReviewsText: {
    fontSize: 15,
    color: '#0a84ff',
    fontWeight: '600',
    marginRight: 4,
  },
  noReviews: {
    alignItems: 'center',
    paddingVertical: 60,
    backgroundColor: '#fff',
  },
  noReviewsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: '#999',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginBottom: 48,
    gap: 12,
  },
  bookButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#0a84ff',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0a84ff',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
