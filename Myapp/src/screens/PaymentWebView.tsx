import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Alert, Modal, Text, TouchableOpacity, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { StackScreenProps } from '@react-navigation/stack';
import Ionicons from '@react-native-vector-icons/ionicons';
import { AppIcons, IconColors } from '../config/icons';
import { apiService } from '../services/api';

type Props = StackScreenProps<any, 'PaymentWebView'>;

// We will intercept these path fragments to detect completion/cancel
const PAYPAL_SUCCESS_PATH = '/payment/paypal/success';
const PAYPAL_CANCEL_PATH = '/payment/paypal/cancel';
const MOMO_RESULT_PATH = '/payment/result';

export default function PaymentWebView({ route, navigation }: Props) {
  const { url, mode, appointmentId, appointment } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState('');
  const webviewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();

  const onNavChange = useCallback(async (navState: any) => {
    try {
      const currentUrl: string = navState?.url || '';
      if (!currentUrl) return;

      // Handle PayPal redirect URLs
      if (mode === 'paypal') {
        if (currentUrl.includes(PAYPAL_SUCCESS_PATH)) {
          // Extract paymentId and PayerID
          const urlParts = currentUrl.split('?');
          const queryString = urlParts.length > 1 ? urlParts[1] : '';
          const params = new URLSearchParams(queryString);
          const paymentId = (params as any).get?.('paymentId') || '';
          const PayerID = (params as any).get?.('PayerID') || '';
          if (paymentId && PayerID) {
            // Navigate to PaymentResult screen to handle verification
            navigation.replace('PaymentResult', {
              paymentId,
              PayerID,
              mode: 'paypal',
              appointmentId: appointmentId,
            });
            return;
          }
        }
        if (currentUrl.includes(PAYPAL_CANCEL_PATH)) {
          // Navigate to PaymentResult with cancelled status
          navigation.replace('PaymentResult', {
            mode: 'paypal',
            appointmentId: appointmentId,
            resultCode: 'cancelled',
          });
          return;
        }
      }

      // Handle MoMo redirect URL - redirect to PaymentResult screen
      if (mode === 'momo' && currentUrl.includes(MOMO_RESULT_PATH)) {
        const urlParts = currentUrl.split('?');
        const queryString = urlParts.length > 1 ? urlParts[1] : '';
        const params = new URLSearchParams(queryString);
        const resultCode = (params as any).get?.('resultCode');
        const orderId = (params as any).get?.('orderId');
        
        // Navigate to PaymentResult screen to handle verification
        navigation.replace('PaymentResult', {
          orderId: orderId || '',
          resultCode: resultCode || '',
          mode: 'momo',
          appointmentId: appointmentId,
        });
        return;
      }
    } catch {
      // ignore parse errors
    }
  }, [mode, navigation]);

  const source = useMemo(() => ({ uri: url as string }), [url]);

  const handleGoToSchedule = () => {
    setShowSuccessModal(false);
    // Navigate to Schedule screen (Appointments tab)
    // First go back to close PaymentWebView, then navigate to Appointments tab
    navigation.goBack(); // Close PaymentWebView
    // Navigate to Home tab with Appointments screen
    setTimeout(() => {
      navigation.navigate('Home', { screen: 'Appointments' });
    }, 100);
  };

  const handleGoToAppointmentDetail = () => {
    setShowSuccessModal(false);
    // Navigate back to AppointmentDetail
    // Don't pass stale appointment data - let it fetch fresh data
    // Add a small delay to ensure server has processed the payment
    setTimeout(() => {
      if (appointmentId) {
        // Fetch fresh appointment data first
        apiService.getAppointmentById(appointmentId).then((response) => {
          if (response?.success && response?.data) {
            navigation.navigate('AppointmentDetail', { 
              appointment: response.data,
              fromPayment: true // Flag to indicate coming from payment
            });
          } else {
            // If fetch fails, navigate with appointmentId only and let screen fetch
            navigation.navigate('AppointmentDetail', { 
              appointmentId: appointmentId,
              fromPayment: true
            });
          }
        }).catch(() => {
          // On error, navigate with appointmentId and let screen fetch
          navigation.navigate('AppointmentDetail', { 
            appointmentId: appointmentId,
            fromPayment: true
          });
        });
      } else {
        // If appointmentId not available, just go back
        navigation.goBack();
      }
    }, 1000); // Increased delay to ensure server has processed payment
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name={AppIcons.chevronBack as any} size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {mode === 'paypal' ? 'Thanh toán PayPal' : 'Thanh toán MoMo'}
        </Text>
        <View style={styles.placeholder} />
      </View>
      
      <WebView
        ref={webviewRef}
        source={source}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={onNavChange}
        startInLoadingState
        style={styles.webView}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      )}
      
      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.successIconContainer}>
                <Ionicons name="checkmark-circle" size={64} color="#10b981" />
              </View>
              <Text style={styles.modalTitle}>Thành công</Text>
              <Text style={styles.modalMessage}>{paymentMessage}</Text>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.scheduleButton]}
                onPress={handleGoToSchedule}
              >
                <Ionicons name="calendar-outline" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Quay lại trang lịch hẹn</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.detailButton]}
                onPress={handleGoToAppointmentDetail}
              >
                <Ionicons name="document-text-outline" size={20} color="#fff" />
                <Text style={styles.modalButtonText}>Quay lại chi tiết lịch hẹn</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  placeholder: {
    width: 32,
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.3)'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  successIconContainer: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  modalButtons: {
    width: '100%',
    gap: 12,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  scheduleButton: {
    backgroundColor: '#2563eb',
  },
  detailButton: {
    backgroundColor: '#10b981',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});


