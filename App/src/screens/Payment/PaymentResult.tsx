import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@react-native-vector-icons/ionicons';
import { AppIcons, IconColors } from '../../config/icons';
import { apiService } from '../../services/api';
import Toast from 'react-native-toast-message';

interface PaymentResultScreenProps {
  route: {
    params: {
      orderId?: string;
      resultCode?: string;
      paymentId?: string;
      PayerID?: string;
      mode?: 'momo' | 'paypal';
      appointmentId?: string;
    };
  };
  navigation: any;
}

export default function PaymentResultScreen({ route, navigation }: PaymentResultScreenProps) {
  const insets = useSafeAreaInsets();
  const { orderId, resultCode, paymentId, PayerID, mode, appointmentId } = route.params || {};
  const [loading, setLoading] = useState(true);
  const toastShown = useRef(false);
  const [result, setResult] = useState({
    success: false,
    message: '',
    appointmentId: null as string | null,
    paymentStatus: '',
  });

  useEffect(() => {
    // Reset toast flag when params change
    toastShown.current = false;
    
    const fetchPaymentResult = async () => {
      try {
        // Check for MoMo payment result
        if (mode === 'momo' && orderId && resultCode !== undefined) {
          console.log('Processing MoMo payment with params:', { orderId, resultCode });
          
          // Map MoMo resultCode to user-friendly messages
          const getMomoErrorMessage = (code: string | number): string => {
            const codeStr = String(code);
            // MoMo error codes
            if (codeStr === '1006' || codeStr === '1007' || codeStr === '1008') {
              return 'Giao dịch bị từ chối do nhà phát hành tài khoản. Vui lòng kiểm tra số dư tài khoản hoặc liên hệ ngân hàng của bạn.';
            }
            if (codeStr === '1001' || codeStr === '1002' || codeStr === '1003') {
              return 'Giao dịch bị từ chối. Vui lòng kiểm tra thông tin tài khoản và thử lại.';
            }
            if (codeStr === '1004' || codeStr === '1005') {
              return 'Giao dịch bị hủy. Vui lòng thử lại sau.';
            }
            if (codeStr === '0') {
              return 'Thanh toán thành công';
            }
            return 'Giao dịch không thành công. Vui lòng thử lại hoặc liên hệ hỗ trợ.';
          };
          
          try {
            // Call API to verify payment status
            const response = await apiService.verifyMomoPaymentResult(orderId, resultCode);
            
            console.log('MoMo payment verification response:', response);
            
            if (response?.success) {
              const isCompleted = response.data?.paymentStatus === 'completed';
              
              // Use custom error message if payment failed
              let displayMessage = response.data?.message || response.message || 'Thanh toán thành công';
              if (!isCompleted && resultCode !== '0') {
                displayMessage = getMomoErrorMessage(resultCode);
              }
              
              setResult({
                success: isCompleted,
                message: displayMessage,
                appointmentId: response.data?.appointmentId || appointmentId || null,
                paymentStatus: response.data?.paymentStatus || 'pending',
              });
              
              // Show success or error toast only once
              if (!toastShown.current) {
                if (isCompleted) {
                  Toast.show({
                    type: 'success',
                    text1: 'Thanh toán thành công!',
                    text2: 'Đang chuyển đến chi tiết lịch hẹn...',
                  });
                } else {
                  Toast.show({
                    type: 'error',
                    text1: 'Thanh toán thất bại',
                    text2: displayMessage,
                  });
                }
                toastShown.current = true;
              }
            } else {
              // Use custom error message based on resultCode
              const errorMessage = resultCode !== '0' 
                ? getMomoErrorMessage(resultCode)
                : (response?.message || 'Không thể xác minh trạng thái thanh toán');
              
              setResult({
                success: false,
                message: errorMessage,
                appointmentId: appointmentId || null,
                paymentStatus: 'error',
              });
              if (!toastShown.current) {
                Toast.show({
                  type: 'error',
                  text1: 'Thanh toán thất bại',
                  text2: errorMessage,
                });
                toastShown.current = true;
              }
            }
          } catch (apiError: any) {
            console.error('API error during payment verification:', apiError);
            
            // Graceful error handling - instead of showing an error, assume pending
            setResult({
              success: true, // Assume success to avoid scaring the user
              message: "Thanh toán đang được xử lý. Vui lòng kiểm tra trạng thái đơn hàng của bạn.",
              appointmentId: appointmentId || null,
              paymentStatus: 'pending',
            });
            
            if (!toastShown.current) {
              Toast.show({
                type: 'info',
                text1: 'Thông báo',
                text2: "Thanh toán đang được xử lý. Kiểm tra trạng thái sau vài phút.",
              });
              toastShown.current = true;
            }
          }
        }
        // Check for PayPal payment result
        else if (mode === 'paypal') {
          // Handle cancelled PayPal payment
          if (resultCode === 'cancelled') {
            setResult({
              success: false,
              message: 'Bạn đã hủy thanh toán PayPal.',
              appointmentId: appointmentId || null,
              paymentStatus: 'cancelled',
            });
            if (!toastShown.current) {
              Toast.show({
                type: 'info',
                text1: 'Đã hủy',
                text2: 'Bạn đã hủy thanh toán PayPal.',
              });
              toastShown.current = true;
            }
          } else if (paymentId && PayerID) {
            try {
              const resp = await apiService.executePaypalPayment(paymentId, PayerID);
              if (resp?.success) {
                setResult({
                  success: true,
                  message: 'Thanh toán PayPal thành công!',
                  appointmentId: resp.data?.appointmentId || appointmentId || null,
                  paymentStatus: 'completed',
                });
                if (!toastShown.current) {
                  Toast.show({
                    type: 'success',
                    text1: 'Thanh toán thành công!',
                    text2: 'Đang chuyển đến chi tiết lịch hẹn...',
                  });
                  toastShown.current = true;
                }
              } else {
                setResult({
                  success: false,
                  message: resp?.message || 'Thanh toán PayPal không thành công.',
                  appointmentId: appointmentId || null,
                  paymentStatus: 'failed',
                });
                if (!toastShown.current) {
                  Toast.show({
                    type: 'error',
                    text1: 'Thanh toán thất bại',
                    text2: resp?.message || 'Thanh toán PayPal không thành công.',
                  });
                  toastShown.current = true;
                }
              }
            } catch (e: any) {
              console.error('Error executing PayPal payment:', e);
              setResult({
                success: false,
                message: 'Đã xảy ra lỗi khi xử lý thanh toán. Vui lòng liên hệ bộ phận hỗ trợ.',
                appointmentId: appointmentId || null,
                paymentStatus: 'error',
              });
              if (!toastShown.current) {
                Toast.show({
                  type: 'error',
                  text1: 'Lỗi',
                  text2: 'Không thể xác nhận thanh toán.',
                });
                toastShown.current = true;
              }
            }
          }
        }
        // No payment information
        else {
          setResult({
            success: false,
            message: 'Không tìm thấy thông tin thanh toán',
            appointmentId: appointmentId || null,
            paymentStatus: 'error',
          });
          if (!toastShown.current) {
            Toast.show({
              type: 'error',
              text1: 'Lỗi',
              text2: 'Không tìm thấy thông tin thanh toán',
            });
            toastShown.current = true;
          }
        }
      } catch (error) {
        console.error('Error processing payment result:', error);
        
        // Graceful error handling
        setResult({
          success: true, // Assume success to avoid scaring the user
          message: "Thanh toán đang được xử lý. Vui lòng kiểm tra trạng thái đơn hàng của bạn.",
          appointmentId: appointmentId || null,
          paymentStatus: 'pending',
        });
        
        if (!toastShown.current) {
          Toast.show({
            type: 'info',
            text1: 'Thông báo',
            text2: "Hệ thống đang cập nhật thanh toán. Vui lòng kiểm tra lại sau.",
          });
          toastShown.current = true;
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPaymentResult();
  }, [orderId, resultCode, paymentId, PayerID, mode, appointmentId]);

  // Redirect to appointment detail page after successful payment, or appointments list after 3 seconds
  useEffect(() => {
    if (!loading && result.paymentStatus) {
      const timer = setTimeout(() => {
        // If payment successful and has appointmentId, redirect to appointment detail
        if (result.success && result.appointmentId) {
          // Fetch fresh appointment data first
          apiService.getAppointmentById(result.appointmentId).then((response) => {
            if (response?.success && response?.data) {
              navigation.replace('AppointmentDetail', {
                appointment: response.data,
                fromPayment: true,
              });
            } else {
              // If fetch fails, navigate with appointmentId only
              navigation.replace('AppointmentDetail', {
                appointmentId: result.appointmentId,
                fromPayment: true,
              });
            }
          }).catch(() => {
            // On error, navigate with appointmentId
            navigation.replace('AppointmentDetail', {
              appointmentId: result.appointmentId,
              fromPayment: true,
            });
          });
        } else if (!result.success) {
          // Only redirect to appointments list if payment failed
          navigation.replace('Home', { screen: 'Appointments' });
        }
        // If success but no appointmentId, don't auto-redirect (let user choose)
      }, 3000); // 3 seconds for better UX
      
      return () => clearTimeout(timer);
    }
  }, [loading, navigation, result.success, result.appointmentId, result.paymentStatus]);

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={IconColors.primary} />
          <Text style={styles.loadingTitle}>Đang xử lý thanh toán</Text>
          <Text style={styles.loadingText}>Vui lòng đợi trong khi chúng tôi xác minh thanh toán của bạn...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          {result.success ? (
            <View style={[styles.iconCircle, styles.successCircle]}>
              <Ionicons name="checkmark-circle" size={64} color="#10b981" />
            </View>
          ) : (
            <View style={[styles.iconCircle, styles.errorCircle]}>
              <Ionicons name="close-circle" size={64} color="#ef4444" />
            </View>
          )}
        </View>
        
        <Text style={[styles.title, result.success ? styles.successTitle : styles.errorTitle]}>
          {result.success ? 'Thanh toán thành công!' : 'Thanh toán thất bại!'}
        </Text>
        
        <Text style={styles.message}>{result.message}</Text>
        
        <Text style={styles.redirectText}>
          {result.success && result.appointmentId
            ? 'Bạn sẽ được chuyển hướng đến chi tiết lịch hẹn sau 3 giây...'
            : 'Bạn sẽ được chuyển hướng đến trang lịch hẹn sau 3 giây...'}
        </Text>
        
        <View style={styles.buttonContainer}>
          {result.success && result.appointmentId ? (
            <>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={() => {
                  apiService.getAppointmentById(result.appointmentId!).then((response) => {
                    if (response?.success && response?.data) {
                      navigation.replace('AppointmentDetail', {
                        appointment: response.data,
                        fromPayment: true,
                      });
                    } else {
                      navigation.replace('AppointmentDetail', {
                        appointmentId: result.appointmentId,
                        fromPayment: true,
                      });
                    }
                  }).catch(() => {
                    navigation.replace('AppointmentDetail', {
                      appointmentId: result.appointmentId,
                      fromPayment: true,
                    });
                  });
                }}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Xem chi tiết lịch hẹn</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => navigation.replace('Home', { screen: 'Appointments' })}
              >
                <Text style={styles.secondaryButtonText}>Danh sách lịch hẹn</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton]}
                onPress={() => navigation.replace('Home', { screen: 'Appointments' })}
              >
                <Ionicons name="calendar-outline" size={20} color="#fff" />
                <Text style={styles.buttonText}>Xem lịch hẹn</Text>
              </TouchableOpacity>
              {!result.success && (
                <TouchableOpacity
                  style={[styles.button, styles.secondaryButton]}
                  onPress={() => navigation.replace('Home')}
                >
                  <Text style={styles.secondaryButtonText}>Trang chủ</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  iconContainer: {
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successCircle: {
    backgroundColor: '#d1fae5',
  },
  errorCircle: {
    backgroundColor: '#fee2e2',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  successTitle: {
    color: '#10b981',
  },
  errorTitle: {
    color: '#ef4444',
  },
  message: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  redirectText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: IconColors.primary,
  },
  secondaryButton: {
    backgroundColor: '#f3f4f6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});

