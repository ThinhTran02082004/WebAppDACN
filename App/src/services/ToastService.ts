import Toast from 'react-native-toast-message';

const show = (type: 'success' | 'error' | 'info', text1: string, text2?: string) => {
  Toast.show({
    type,
    text1,
    text2,
    position: 'top',
    visibilityTime: 4000,
  });
};

export const ToastService = { show };

export default ToastService;
