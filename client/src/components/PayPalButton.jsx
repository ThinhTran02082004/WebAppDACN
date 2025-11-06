import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../utils/api';

const PayPalButton = ({ 
  amount, 
  appointmentId, 
  billType,
  prescriptionId,
  onSuccess, 
  onError,
  onCancel 
}) => {
  const [sdkReady, setSdkReady] = useState(false);
  const paypalRef = useRef(null);
  const buttonsContainerRef = useRef(null);
  const paymentIdRef = useRef(null); // Store payment ID for execute

  useEffect(() => {
    // Load PayPal SDK script
    const loadPayPalSDK = async () => {
      try {
        // Get PayPal client ID from server
        const response = await api.get('/payments/paypal/client-id');
        const clientId = response.data.clientId || process.env.REACT_APP_PAYPAL_CLIENT_ID || 'Aetwa0pQjsQVVGxb_NqE5wue5IKBePqpHlGsLwSQ1mmr6uGMGPqs6MtrK-La4SCaRkS0Q0j1Ep-dwkkd';
        const currency = 'USD'; // PayPal uses USD

        // Check if script already loaded
        if (window.paypal) {
          setSdkReady(true);
          return;
        }

        // Create script element
        const script = document.createElement('script');
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=${currency}`;
        script.async = true;
        script.onload = () => {
          setSdkReady(true);
        };
        script.onerror = () => {
          console.error('Failed to load PayPal SDK');
          toast.error('Không thể tải PayPal SDK. Vui lòng thử lại.');
          if (onError) onError();
        };
        document.body.appendChild(script);

        return () => {
          // Cleanup on unmount
          const existingScript = document.querySelector(`script[src*="paypal.com/sdk"]`);
          if (existingScript) {
            document.body.removeChild(existingScript);
          }
        };
      } catch (error) {
        console.error('Error loading PayPal SDK:', error);
        toast.error('Không thể tải PayPal SDK');
        if (onError) onError();
      }
    };

    loadPayPalSDK();
  }, []);

  useEffect(() => {
    if (!sdkReady || !window.paypal || !amount || !appointmentId) return;

    // Clear existing buttons
    if (buttonsContainerRef.current) {
      buttonsContainerRef.current.innerHTML = '';
    }

    // Render PayPal Button
    if (window.paypal.Buttons) {
      window.paypal.Buttons({
        createOrder: async (data, actions) => {
          try {
            // Call your server to create PayPal order
            const payload = {
              appointmentId,
              amount,
              billType
            };
            if (prescriptionId) {
              payload.prescriptionId = prescriptionId;
            }
            const response = await api.post('/payments/paypal/create', payload);

            if (!response.data.success) {
              throw new Error(response.data.message || 'Không thể tạo thanh toán PayPal');
            }

            // Store payment ID for execute (needed for PayPal REST SDK)
            paymentIdRef.current = response.data.data?.paymentId;
            
            // Return order ID (EC-XXX token) from PayPal for SDK
            // Priority: approvalToken > orderId > paymentId
            return response.data.data?.approvalToken || response.data.data?.orderId || response.data.data?.paymentId;
          } catch (error) {
            console.error('Error creating PayPal order:', error);
            toast.error(error.response?.data?.message || error.message || 'Không thể tạo thanh toán PayPal');
            if (onError) onError(error);
            throw error;
          }
        },
        onApprove: async (data, actions) => {
          try {
            // SDK trả về orderID (EC-XXX), nhưng server cần payment ID (PAY-XXX)
            // Gửi cả orderID và paymentId (đã lưu từ createOrder)
            const response = await api.post('/payments/paypal/execute', {
              orderId: data.orderID || data.paymentID, // EC-XXX từ SDK
              paymentId: paymentIdRef.current, // PAY-XXX đã lưu khi create
              PayerID: data.payerID,
              billType // Pass billType to server
            });

            if (!response.data.success) {
              throw new Error(response.data.message || 'Thanh toán PayPal thất bại');
            }

            toast.success('Thanh toán PayPal thành công!');
            if (onSuccess) onSuccess(response.data.data);
          } catch (error) {
            console.error('Error executing PayPal payment:', error);
            toast.error(error.response?.data?.message || error.message || 'Thanh toán PayPal thất bại');
            if (onError) onError(error);
          }
        },
        onCancel: (data) => {
          console.log('PayPal payment cancelled:', data);
          toast.info('Bạn đã hủy thanh toán PayPal');
          if (onCancel) onCancel(data);
        },
        onError: (err) => {
          console.error('PayPal button error:', err);
          toast.error('Đã xảy ra lỗi trong quá trình thanh toán PayPal');
          if (onError) onError(err);
        },
        style: {
          layout: 'vertical',
          color: 'blue',
          shape: 'rect',
          label: 'paypal'
        }
      }).render(buttonsContainerRef.current);
    }
  }, [sdkReady, amount, appointmentId, billType, onSuccess, onError, onCancel]);

  if (!sdkReady) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Đang tải PayPal...</span>
      </div>
    );
  }

  return (
    <div ref={buttonsContainerRef} className="w-full"></div>
  );
};

export default PayPalButton;

