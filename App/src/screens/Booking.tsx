import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList, Image, Modal, Alert, useWindowDimensions, TextInput, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@react-native-vector-icons/ionicons';
import { AppIcons, IconColors } from '../config/icons';
import { apiService, Hospital, ServiceItem, Doctor } from '../services/api';
import { ToastService } from '../services/ToastService';
import { useSocket } from '../contexts/SocketContext';

type Step = 1 | 2 | 3 | 4 | 5;

function buildNextDays(total: number): string[] {
  const days: string[] = [];
  const now = new Date();
  for (let i = 0; i < total; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${dd}`);
  }
  return days;
}



export default function BookingAllInOne() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const navigation = useNavigation();
  const route = useRoute();
  
  // Get params from current route or parent route (since Booking is inside BookingNavigator)
  // Use useMemo to recalculate when route.params changes
  const routeParams = useMemo(() => {
    // Try current route params first
    const currentParams = route.params as any;
    if (currentParams && Object.keys(currentParams).length > 0) {
      console.log('Using current route params:', currentParams);
      return currentParams;
    }
    
    // Try to get params from parent navigator (RootNavigator)
    try {
      const parent = navigation.getParent();
      if (parent) {
        const parentState = parent.getState();
        const parentRoute = parentState?.routes?.find((r: any) => r.name === 'Booking');
        if (parentRoute?.params) {
          console.log('Using parent route params:', parentRoute.params);
          return parentRoute.params as any;
        }
      }
    } catch (e) {
      console.log('Error getting parent params:', e);
    }
    
    // Try navigation state
    try {
      const navState = navigation.getState();
      if (navState) {
        // Check all routes in the navigation state
        for (const r of navState.routes) {
          if (r.name === 'Booking' && r.params) {
            console.log('Using navigation state params:', r.params);
            return r.params as any;
          }
        }
      }
    } catch (e) {
      console.log('Error getting navigation state params:', e);
    }
    
    console.log('No params found, returning empty object');
    return {};
  }, [route.params, navigation]);

  const [step, setStep] = useState<Step>(1);
  const [isPreFilling, setIsPreFilling] = useState(false);
  const [routeParamsState, setRouteParamsState] = useState<any>({});
  
  // Update route params when screen is focused (to catch params from parent navigator)
  useFocusEffect(
    React.useCallback(() => {
      const getParams = () => {
        // Try current route params first
        const currentParams = route.params as any;
        if (currentParams && Object.keys(currentParams).length > 0) {
          console.log('useFocusEffect: Using current route params:', currentParams);
          return currentParams;
        }
        
        // Try to get params from parent navigator (RootNavigator)
        try {
          const parent = navigation.getParent();
          if (parent) {
            const parentState = parent.getState();
            const parentRoute = parentState?.routes?.find((r: any) => r.name === 'Booking');
            if (parentRoute?.params) {
              console.log('useFocusEffect: Using parent route params:', parentRoute.params);
              return parentRoute.params as any;
            }
          }
        } catch (e) {
          console.log('useFocusEffect: Error getting parent params:', e);
        }
        
        return {};
      };
      
      const params = getParams();
      if (Object.keys(params).length > 0) {
        console.log('useFocusEffect: Setting route params state:', params);
        setRouteParamsState(params);
      }
    }, [route.params, navigation])
  );
  
  // Use routeParamsState if available, otherwise use computed routeParams
  const finalRouteParams = Object.keys(routeParamsState).length > 0 ? routeParamsState : routeParams;

  // Step 1
  const [branches, setBranches] = useState<Hospital[]>([]);
  const [specialties, setSpecialties] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const [specialtyOpen, setSpecialtyOpen] = useState(false);

  // Step 2
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);

  // Step 3
  const days = useMemo(() => buildNextDays(14), []);
  const [date, setDate] = useState<string | null>(null);
  const [timeSlot, setTimeSlot] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [dayTimeSlots, setDayTimeSlots] = useState<any[]>([]);
  const [timeLoading, setTimeLoading] = useState<boolean>(false);
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const sel = new Date(days[0]);
    return new Date(sel.getFullYear(), sel.getMonth(), 1);
  });
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [doctorSchedules, setDoctorSchedules] = useState<any[]>([]);
  const [dailyLimitInfo, setDailyLimitInfo] = useState({
    status: 'idle',
    count: 0,
    limit: 3,
    date: '',
  });
  
  // Realtime time slot updates
  const { socket, isConnected, emit, on, off } = useSocket();
  const [lockedSlots, setLockedSlots] = useState<Map<string, string>>(new Map()); // Map<`${scheduleId}_${timeSlotId}`, userId>
  const lockedSlotsRef = useRef<Map<string, string>>(new Map());

  // Step 4
  const [appointmentType, setAppointmentType] = useState<string>('first-visit');
  const [symptoms, setSymptoms] = useState<string>('');
  const [medicalHistory, setMedicalHistory] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [discountCode, setDiscountCode] = useState<string>('');
  const [priceDetails, setPriceDetails] = useState({ consultationFee: 0, serviceFee: 0, totalBeforeDiscount: 0, discountAmount: 0, finalTotal: 0 });
  const [appointmentTypeModalOpen, setAppointmentTypeModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load Step 1 data
  useEffect(() => {
    const load = async () => {
      try {
        const [h, s] = await Promise.all([
          apiService.getHospitals({ isActive: true, limit: 50 }),
          apiService.getSpecialties({ isActive: true, limit: 50 }),
        ]);
        setBranches((h as any)?.data?.hospitals || []);
        setSpecialties((s as any)?.data?.specialties || []);
        console.log('Initial data loaded:', { 
          branches: (h as any)?.data?.hospitals?.length || 0, 
          specialties: (s as any)?.data?.specialties?.length || 0 
        });
      } catch (e) {
        console.error('Load step1 failed', e);
      }
    };
    load();
  }, []);

  // Pre-fill functions (similar to client Appointment.jsx)
  const preFillFromDoctor = async (doctorIdParam: string) => {
    try {
      setIsPreFilling(true);
      const res = await apiService.getDoctorById(doctorIdParam);
      if (!res.success || !res.data) {
        ToastService.show('error', 'Không tìm thấy bác sĩ');
        return;
      }
      const doctor = res.data;
      
      // Extract IDs
      const specialtyId = typeof doctor.specialtyId === 'object' 
        ? doctor.specialtyId._id 
        : doctor.specialtyId;
      const hospitalId = typeof doctor.hospitalId === 'object' 
        ? doctor.hospitalId._id 
        : doctor.hospitalId;
      
      // Set form data
      console.log('Setting form data:', { doctorIdParam, specialtyId, hospitalId });
      setDoctorId(doctorIdParam);
      if (specialtyId) {
        setSelectedSpecialty(specialtyId);
        console.log('Set specialty:', specialtyId);
      }
      if (hospitalId) {
        setSelectedBranch(hospitalId);
        console.log('Set hospital:', hospitalId);
      }
      
      // Fetch related data
      if (hospitalId) {
        try {
          const specialtiesRes = await apiService.getSpecialties({ isActive: true, limit: 50 });
          const specialtiesData = (specialtiesRes as any)?.data?.specialties || [];
          setSpecialties(specialtiesData);
        } catch (err) {
          console.error('Error fetching specialties:', err);
        }
      }
      
      if (specialtyId) {
        try {
          // Fetch doctors for this specialty
          const doctorsRes = await apiService.getDoctors({ specialtyId });
          const doctorsData = (doctorsRes as any)?.data?.doctors || 
                             (Array.isArray((doctorsRes as any)?.data) ? (doctorsRes as any).data : []);
          setDoctors(doctorsData);
          
          // Fetch services for this specialty
          const servicesRes = await apiService.getServices({ specialtyId });
          const servicesData = (servicesRes as any)?.data?.services || 
                              (Array.isArray((servicesRes as any)?.data) ? (servicesRes as any).data : []);
          setServices(servicesData);
        } catch (err) {
          console.error('Error fetching services:', err);
        }
      }
      
      // Auto-advance to Step 2
      setStep(2);
    } catch (error) {
      console.error('Error pre-filling from doctor:', error);
      ToastService.show('error', 'Lỗi khi tải thông tin bác sĩ');
    } finally {
      setIsPreFilling(false);
    }
  };

  const preFillFromService = async (serviceIdParam: string) => {
    try {
      setIsPreFilling(true);
      // Get all services to find the one we need
      const servicesRes = await apiService.getServices({ limit: 1000, isActive: true });
      let servicesData: ServiceItem[] = [];
      if ('services' in (servicesRes as any)?.data) {
        servicesData = ((servicesRes as any).data as any).services || [];
      } else if ('data' in (servicesRes as any)?.data) {
        servicesData = ((servicesRes as any).data as any).data || [];
      } else if (Array.isArray((servicesRes as any)?.data)) {
        servicesData = (servicesRes as any).data as ServiceItem[];
      }
      
      const service = servicesData.find((s: ServiceItem) => s._id === serviceIdParam);
      if (!service) {
        ToastService.show('error', 'Không tìm thấy dịch vụ');
        return;
      }
      
      // Extract specialty ID
      const specialtyId = typeof service.specialtyId === 'object' 
        ? service.specialtyId._id 
        : service.specialtyId;
      
      // Set service
      setServiceId(serviceIdParam);
      setServices(servicesData.filter((s: ServiceItem) => s._id === serviceIdParam));
      
      if (specialtyId) {
        setSelectedSpecialty(specialtyId);
        
        // Fetch doctors for this specialty
        try {
          const doctorsRes = await apiService.getDoctors({ specialtyId });
          const doctorsData = (doctorsRes as any)?.data?.doctors || 
                             (Array.isArray((doctorsRes as any)?.data) ? (doctorsRes as any).data : []);
          setDoctors(doctorsData);
          
          // Auto-select first doctor and their hospital
          if (doctorsData.length > 0) {
            const firstDoctor = doctorsData[0];
            setDoctorId(firstDoctor._id);
            const selectedHospitalId = typeof firstDoctor.hospitalId === 'object'
              ? firstDoctor.hospitalId._id
              : firstDoctor.hospitalId;
            if (selectedHospitalId) {
              setSelectedBranch(selectedHospitalId);
            }
          }
        } catch (err) {
          console.error('Error fetching doctors:', err);
        }
      }
      
      // Auto-advance to Step 3
      setStep(3);
    } catch (error) {
      console.error('Error pre-filling from service:', error);
      ToastService.show('error', 'Lỗi khi tải thông tin dịch vụ');
    } finally {
      setIsPreFilling(false);
    }
  };

  const preFillFromSpecialty = async (specialtyIdParam: string) => {
    try {
      setIsPreFilling(true);
      setSelectedSpecialty(specialtyIdParam);
      
      // Fetch doctors for this specialty to find a hospital
      try {
        const doctorsRes = await apiService.getDoctors({ specialtyId: specialtyIdParam });
        const doctorsData = (doctorsRes as any)?.data?.doctors || 
                           (Array.isArray((doctorsRes as any)?.data) ? (doctorsRes as any).data : []);
        setDoctors(doctorsData);
        
        // Auto-select first hospital that has this specialty (from first doctor)
        if (doctorsData.length > 0) {
          const firstDoctor = doctorsData[0];
          const selectedHospitalId = typeof firstDoctor.hospitalId === 'object'
            ? firstDoctor.hospitalId._id
            : firstDoctor.hospitalId;
          if (selectedHospitalId) {
            setSelectedBranch(selectedHospitalId);
          }
        }
      } catch (err) {
        console.error('Error fetching doctors:', err);
      }
      
      // Fetch services for this specialty
      try {
        const servicesRes = await apiService.getServices({ specialtyId: specialtyIdParam });
        const servicesData = (servicesRes as any)?.data?.services || 
                            (Array.isArray((servicesRes as any)?.data) ? (servicesRes as any).data : []);
        setServices(servicesData);
      } catch (err) {
        console.error('Error fetching services:', err);
      }
      
      // Auto-advance to Step 2
      setStep(2);
    } catch (error) {
      console.error('Error pre-filling from specialty:', error);
      ToastService.show('error', 'Lỗi khi tải thông tin chuyên khoa');
    } finally {
      setIsPreFilling(false);
    }
  };

  const preFillFromHospital = async (hospitalIdParam: string) => {
    try {
      setIsPreFilling(true);
      setSelectedBranch(hospitalIdParam);
      
      // Fetch specialties for this hospital
      try {
        const specialtiesRes = await apiService.getSpecialties({ isActive: true, limit: 50 });
        const specialtiesData = (specialtiesRes as any)?.data?.specialties || [];
        setSpecialties(specialtiesData);
      } catch (err) {
        console.error('Error fetching specialties:', err);
      }
      
      // Stay on Step 1
    } catch (error) {
      console.error('Error pre-filling from hospital:', error);
      ToastService.show('error', 'Lỗi khi tải thông tin bệnh viện');
    } finally {
      setIsPreFilling(false);
    }
  };

  // Handle pre-fill from route params
  const [hasPreFilled, setHasPreFilled] = useState(false);
  const [preFillKey, setPreFillKey] = useState<string>('');
  
  // Reset hasPreFilled when route params change
  useEffect(() => {
    const { doctorId, specialtyId, hospitalId, serviceId } = finalRouteParams;
    const newKey = `${doctorId || ''}_${specialtyId || ''}_${hospitalId || ''}_${serviceId || ''}`;
    console.log('Route params changed:', { newKey, preFillKey, routeParams });
    if (newKey !== preFillKey && newKey !== '___') {
      console.log('Resetting hasPreFilled for new params');
      setHasPreFilled(false);
      setPreFillKey(newKey);
    }
  }, [routeParams, preFillKey]);
  
  useEffect(() => {
    const handlePreFill = async () => {
      if (isPreFilling || hasPreFilled) {
        console.log('Pre-fill skipped:', { isPreFilling, hasPreFilled });
        return;
      }
      
      const { doctorId: doctorIdParam, specialtyId: specialtyIdParam, 
              hospitalId: hospitalIdParam, serviceId: serviceIdParam } = finalRouteParams;
      
      
      if (!doctorIdParam && !serviceIdParam && !specialtyIdParam && !hospitalIdParam) {
        console.log('No pre-fill params found');
        return; // No pre-fill params
      }
      
      // Wait for initial data to load before pre-filling (at least one should be loaded)
      if (branches.length === 0 && specialties.length === 0) {
        console.log('Waiting for initial data to load...');
        return;
      }
      
      console.log('Starting pre-fill...');
      setHasPreFilled(true);
      
      // Priority order: doctor > service > specialty > hospital
      try {
        if (doctorIdParam) {
          console.log('Pre-filling from doctor:', doctorIdParam);
          await preFillFromDoctor(doctorIdParam);
        } else if (serviceIdParam) {
          console.log('Pre-filling from service:', serviceIdParam);
          await preFillFromService(serviceIdParam);
        } else if (specialtyIdParam) {
          console.log('Pre-filling from specialty:', specialtyIdParam);
          await preFillFromSpecialty(specialtyIdParam);
        } else if (hospitalIdParam) {
          console.log('Pre-filling from hospital:', hospitalIdParam);
          await preFillFromHospital(hospitalIdParam);
        }
        console.log('Pre-fill completed successfully');
      } catch (error) {
        console.error('Error in pre-fill:', error);
        setHasPreFilled(false); // Reset on error so it can retry
        ToastService.show('error', 'Lỗi khi tự động điền thông tin');
      }
    };
    
    // Add a small delay to ensure component is fully mounted
    const timer = setTimeout(() => {
      handlePreFill();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [finalRouteParams, branches.length, specialties.length, isPreFilling, hasPreFilled]);

  // Load Step 2 data when specialty selected
  useEffect(() => {
    const load = async () => {
      if (!selectedSpecialty) return;
      try {
        const [d, s] = await Promise.all([
          apiService.getDoctors({ specialtyId: selectedSpecialty }),
          apiService.getServices({ specialtyId: selectedSpecialty }),
        ]);
        setDoctors((d as any)?.data?.doctors || (Array.isArray((d as any)?.data) ? (d as any).data : []));
        const sd = (s as any)?.data;
        setServices(Array.isArray(sd?.services) ? sd.services : Array.isArray(sd) ? sd : (sd?.data || []));
      } catch (e) {
        console.error('Load step2 failed', e);
      }
    };
    load();
  }, [selectedSpecialty]);

  const limitThreshold = dailyLimitInfo.limit || 3;
  const dailyLimitReached = dailyLimitInfo.status === 'loaded' &&
    dailyLimitInfo.date === date &&
    dailyLimitInfo.count >= limitThreshold;
  const isCheckingDailyLimit = dailyLimitInfo.status === 'loading';

  const canNextStep1 = !!(selectedBranch && selectedSpecialty);
  const canNextStep2 = !!(doctorId && serviceId);
  const canNextStep3 = !!(date && timeSlot) && !dailyLimitReached;

  const formatVnd = (amount?: number) => {
    if (typeof amount !== 'number') return '';
    try {
      return amount.toLocaleString('vi-VN') + ' đ';
    } catch {
      return `${amount} đ`;
    }
  };

  // Load all schedules for doctor (align with web client)
  useEffect(() => {
    const loadAllSchedules = async () => {
      try {
        if (!doctorId) return;
        const res: any = await apiService.getDoctorSchedules(doctorId);
        const data = Array.isArray(res?.data?.data) ? res.data.data : (Array.isArray(res?.data) ? res.data : []);
        // only active schedules
        const active = Array.isArray(data) ? data.filter((s: any) => s?.isActive !== false) : [];
        setDoctorSchedules(active);
      } catch (e) {
        setDoctorSchedules([]);
      }
    };
    loadAllSchedules();
  }, [doctorId]);

  // Compute available dates for the current month based on existing schedules (not filtering out full slots)
  useEffect(() => {
    try {
      const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
      const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
      const ok = new Set<string>();
      doctorSchedules.forEach((s: any) => {
        if (!s?.date) return;
        const d = new Date(s.date);
        if (d >= start && d <= end && Array.isArray(s.timeSlots) && s.timeSlots.length > 0) {
          const iso = formatLocalYMD(d);
          if (!isPastLocal(iso)) ok.add(iso);
        }
      });
      setAvailableDates(ok);
    } catch {}
  }, [doctorSchedules, monthCursor]);

  // Calendar helpers (Monday-first grid)
  const formatLocalYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };
  const toUtcYMD = (d: Date) => {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const normalizeTime = (t?: string) => {
    if (!t) return '';
    // Accept formats: "8", "8:0", "08", "08:00"
    const parts = String(t).split(':');
    const h = Math.max(0, parseInt(parts[0] || '0', 10));
    const m = Math.max(0, parseInt(parts[1] || '0', 10));
    const hh = String(isNaN(h) ? 0 : h).padStart(2, '0');
    const mm = String(isNaN(m) ? 0 : m).padStart(2, '0');
    return `${hh}:${mm}`;
  };
  const formatDateDDMMYYYY = (iso?: string | null) => {
    if (!iso) return '';
    const [yy, mm, dd] = iso.split('-').map((n) => parseInt(n, 10));
    if (!yy || !mm || !dd) return iso;
    return `${String(dd).padStart(2,'0')}/${String(mm).padStart(2,'0')}/${String(yy).padStart(4,'0')}`;
  };
  const formatDateFull = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const [yy, mm, dd] = iso.split('-').map((n) => parseInt(n, 10));
      const d = new Date(Date.UTC(yy, mm - 1, dd, 12, 0, 0));
      const opts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return d.toLocaleDateString('vi-VN', opts);
    } catch {
      return iso;
    }
  };
  const formatHourRange = (start?: string | null, end?: string | null) => {
    const ns = normalizeTime(start || '');
    const ne = normalizeTime(end || '');
    return ns && ne ? `${ns} - ${ne}` : (ns || ne || '');
  };
  
  // Helper functions to get names
  const getHospitalName = (id?: string | null) => {
    const h = branches.find((b: any) => b?._id === id);
    return h?.name || '';
  };
  const getSpecialtyName = (id?: string | null) => {
    const s = specialties.find((sp: any) => sp?._id === id);
    return s?.name || '';
  };
  const getDoctorName = (id?: string | null) => {
    const d = doctors.find((doc: any) => doc?._id === id);
    return d?.user?.fullName || '';
  };
  const getServiceName = (id?: string | null) => {
    const s = services.find((sv: any) => sv?._id === id);
    return s?.name || '';
  };
  
  // Calculate prices
  useEffect(() => {
    const calcPrices = async () => {
      if (!doctorId) return;
      try {
        const doc = doctors.find((d: any) => d?._id === doctorId);
        const consultationFee = doc?.consultationFee || 0;
        const svc = services.find((s: any) => s?._id === serviceId);
        const serviceFee = svc?.price || 0;
        const totalBeforeDiscount = consultationFee + serviceFee;
        // TODO: coupon discount calculation
        const discountAmount = 0;
        const finalTotal = totalBeforeDiscount - discountAmount;
        setPriceDetails({ consultationFee, serviceFee, totalBeforeDiscount, discountAmount, finalTotal });
      } catch (e) {
        console.error('Calc prices failed', e);
      }
    };
    calcPrices();
  }, [doctorId, serviceId, doctors, services]);
  const isPastLocal = (iso: string) => {
    const [yy, mm, dd] = iso.split('-').map(Number);
    if (!yy || !mm || !dd) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(yy, mm - 1, dd);
    target.setHours(0, 0, 0, 0);
    return target < today;
  };

  // Load time slots for selected date (align with web: include all slots, mark full ones)
  useEffect(() => {
    const loadDaySlots = async () => {
      try {
        if (!doctorId || !date) {
          setDayTimeSlots([]);
          return;
        }
        setTimeLoading(true);
        const [yy, mm, dd] = date.split('-').map((n) => parseInt(n, 10));
        const utcIso = toUtcYMD(new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1)));
        const schedulesForDate = doctorSchedules.filter((s: any) => {
          const sd = new Date(s.date);
          const scheduleUtc = new Date(Date.UTC(sd.getFullYear(), sd.getMonth(), sd.getDate(), 12, 0, 0));
          return scheduleUtc.toISOString().split('T')[0] === utcIso;
        });
        const collected: any[] = [];
        schedulesForDate.forEach((s: any) => {
          const slots = Array.isArray(s?.timeSlots) ? s.timeSlots : [];
          slots.forEach((slot: any) => {
            const maxB = slot?.maxBookings ?? 3;
            const booked = slot?.bookedCount ?? 0;
            collected.push({
              scheduleId: s?._id,
              startTime: slot?.startTime,
              endTime: slot?.endTime,
              roomId: slot?.roomId,
              bookedCount: booked,
              maxBookings: maxB,
              isBooked: booked >= maxB,
            });
          });
        });
        // Normalize, deduplicate by start-end, and sort by start time
        const map = new Map<string, any>();
        collected.forEach((c) => {
          const k = `${normalizeTime(String(c?.startTime || ''))}-${normalizeTime(String(c?.endTime || ''))}`;
          if (!map.has(k)) map.set(k, c);
        });
        const normalized = Array.from(map.values()).sort((a, b) => {
          const [ah, am] = String(a?.startTime || '00:00').split(':').map((n: any) => parseInt(n, 10));
          const [bh, bm] = String(b?.startTime || '00:00').split(':').map((n: any) => parseInt(n, 10));
          return (ah * 60 + (isNaN(am) ? 0 : am)) - (bh * 60 + (isNaN(bm) ? 0 : bm));
        });
        setDayTimeSlots(normalized);
      } catch (e) {
        setDayTimeSlots([]);
      } finally {
        setTimeLoading(false);
      }
    };
    loadDaySlots();
  }, [doctorId, date, doctorSchedules]);

  // Join appointment room for realtime updates
  useEffect(() => {
    if (!socket || !isConnected || !doctorId || !date) return;

    const formattedDate = date.split('T')[0]; // Ensure YYYY-MM-DD format
    console.log('[Booking] Joining appointment room:', { doctorId, date: formattedDate });
    
    emit('join_appointment_room', {
      doctorId,
      date: formattedDate
    });

    return () => {
      // Leave room when component unmounts or dependencies change
      console.log('[Booking] Leaving appointment room');
    };
  }, [socket, isConnected, doctorId, date, emit]);

  // Track previously selected slot for cleanup
  const previousSelectedSlotRef = useRef<{ scheduleId: string; timeSlotId: string } | null>(null);

  // Lock/unlock slot when user selects/deselects
  useEffect(() => {
    if (!socket || !isConnected || !doctorId || !date) return;

    const currentSlot = selectedSlot && selectedSlot.scheduleId && selectedSlot.startTime
      ? { scheduleId: selectedSlot.scheduleId, timeSlotId: normalizeTime(selectedSlot.startTime) }
      : null;

    // Unlock previous slot if changed
    if (previousSelectedSlotRef.current && 
        previousSelectedSlotRef.current.scheduleId !== currentSlot?.scheduleId &&
        previousSelectedSlotRef.current.timeSlotId !== currentSlot?.timeSlotId) {
      emit('unlock_time_slot', {
        scheduleId: previousSelectedSlotRef.current.scheduleId,
        timeSlotId: previousSelectedSlotRef.current.timeSlotId,
        doctorId,
        date: date.split('T')[0]
      });
    }

    // Lock new slot
    if (currentSlot) {
      emit('lock_time_slot', {
        scheduleId: currentSlot.scheduleId,
        timeSlotId: currentSlot.timeSlotId,
        doctorId,
        date: date.split('T')[0]
      });
      previousSelectedSlotRef.current = currentSlot;
    } else {
      previousSelectedSlotRef.current = null;
    }

    // Cleanup on unmount
    return () => {
      if (previousSelectedSlotRef.current && socket && isConnected) {
        emit('unlock_time_slot', {
          scheduleId: previousSelectedSlotRef.current.scheduleId,
          timeSlotId: previousSelectedSlotRef.current.timeSlotId,
          doctorId,
          date: date.split('T')[0]
        });
      }
    };
  }, [socket, isConnected, doctorId, date, selectedSlot, emit]);

  // Listen to realtime time slot updates
  useEffect(() => {
    if (!socket) return;

    const handleTimeSlotUpdate = (data: { scheduleId: string; timeSlotInfo: any }) => {
      const { scheduleId, timeSlotInfo } = data;
      console.log('[Booking] Time slot updated:', { scheduleId, timeSlotInfo });

      // Update dayTimeSlots with new booking information
      setDayTimeSlots(prev => {
        return prev.map(slot => {
          // Match by scheduleId and startTime
          if (slot.scheduleId === scheduleId && 
              normalizeTime(slot.startTime) === normalizeTime(timeSlotInfo.startTime)) {
            return {
              ...slot,
              isBooked: timeSlotInfo.isBooked,
              bookedCount: timeSlotInfo.bookedCount,
              maxBookings: timeSlotInfo.maxBookings || slot.maxBookings
            };
          }
          return slot;
        });
      });

      // Show notification if slot becomes fully booked (only if user is viewing this date)
      if (date && timeSlotInfo.isBooked) {
        ToastService.show(
          'info',
          'Cập nhật khung giờ',
          `Khung giờ ${timeSlotInfo.startTime}-${timeSlotInfo.endTime} đã được đặt kín`
        );
      } else if (date && timeSlotInfo.bookedCount > 0) {
        const remaining = (timeSlotInfo.maxBookings || 3) - timeSlotInfo.bookedCount;
        if (remaining > 0) {
          ToastService.show(
            'info',
            'Cập nhật khung giờ',
            `Khung giờ ${timeSlotInfo.startTime}-${timeSlotInfo.endTime} còn ${remaining}/${timeSlotInfo.maxBookings || 3} chỗ trống`
          );
        }
      }
    };

    const handleTimeSlotLocked = (data: { scheduleId: string; timeSlotId: string; userId: string }) => {
      const { scheduleId, timeSlotId, userId } = data;
      console.log('[Booking] Time slot locked:', { scheduleId, timeSlotId, userId });
      
      const slotKey = `${scheduleId}_${timeSlotId}`;
      setLockedSlots(prev => {
        const newMap = new Map(prev);
        newMap.set(slotKey, userId);
        lockedSlotsRef.current = newMap;
        return newMap;
      });
    };

    const handleTimeSlotUnlocked = (data: { scheduleId: string; timeSlotId: string }) => {
      const { scheduleId, timeSlotId } = data;
      console.log('[Booking] Time slot unlocked:', { scheduleId, timeSlotId });
      
      const slotKey = `${scheduleId}_${timeSlotId}`;
      setLockedSlots(prev => {
        const newMap = new Map(prev);
        newMap.delete(slotKey);
        lockedSlotsRef.current = newMap;
        return newMap;
      });
    };

    const handleCurrentLockedSlots = (data: { lockedSlots: Array<{ scheduleId: string; timeSlotId: string; userId: string }> }) => {
      console.log('[Booking] Current locked slots:', data.lockedSlots);
      const locksMap = new Map<string, string>();
      data.lockedSlots.forEach(({ scheduleId, timeSlotId, userId }) => {
        locksMap.set(`${scheduleId}_${timeSlotId}`, userId);
      });
      setLockedSlots(locksMap);
      lockedSlotsRef.current = locksMap;
    };

    const handleTimeSlotLockRejected = (data: { message?: string; scheduleId?: string; timeSlotId?: string }) => {
      console.warn('[Booking] Lock rejected:', data);
      ToastService.show(
        'error',
        'Khung giờ không khả dụng',
        'Khung giờ này đang được người khác xử lý. Vui lòng chọn khung giờ khác.'
      );
      
      // Reset selection if our selection was rejected
      if (selectedSlot && data.scheduleId === selectedSlot.scheduleId && 
          data.timeSlotId === normalizeTime(selectedSlot.startTime)) {
        setTimeSlot(null);
        setSelectedSlot(null);
        previousSelectedSlotRef.current = null;
      }
    };

    const handleTimeSlotLockConfirmed = (data: { scheduleId: string; timeSlotId: string }) => {
      console.log('[Booking] Lock confirmed:', data);
    };

    // Register event listeners
    on('time_slot_updated', handleTimeSlotUpdate);
    on('time_slot_locked', handleTimeSlotLocked);
    on('time_slot_unlocked', handleTimeSlotUnlocked);
    on('current_locked_slots', handleCurrentLockedSlots);
    on('time_slot_lock_rejected', handleTimeSlotLockRejected);
    on('time_slot_lock_confirmed', handleTimeSlotLockConfirmed);

    // Cleanup listeners
    return () => {
      off('time_slot_updated', handleTimeSlotUpdate);
      off('time_slot_locked', handleTimeSlotLocked);
      off('time_slot_unlocked', handleTimeSlotUnlocked);
      off('current_locked_slots', handleCurrentLockedSlots);
      off('time_slot_lock_rejected', handleTimeSlotLockRejected);
      off('time_slot_lock_confirmed', handleTimeSlotLockConfirmed);
    };
  }, [socket, on, off, date, selectedSlot]);

  useEffect(() => {
    if (!date) {
      setDailyLimitInfo({
        status: 'idle',
        count: 0,
        limit: 3,
        date: '',
      });
    }
  }, [date]);
  const buildMonthMatrix = (cursor: Date) => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    // 0=Sun..6=Sat -> convert to Mon-first index (Mon=0..Sun=6)
    const firstWeekdayMonFirst = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    // days from previous month to fill start
    for (let i = 0; i < firstWeekdayMonFirst; i++) {
      const d = new Date(year, month, i - firstWeekdayMonFirst + 1);
      cells.push({ date: d, inMonth: false });
    }
    // current month days
    for (let d = 1; d <= totalDays; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
    // fill to multiple of 7
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date: next, inMonth: false });
    }
    // ensure 6 rows like common calendars
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date: next, inMonth: false });
    }
    const weeks: { date: Date; inMonth: boolean }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const checkDailyAppointmentLimit = useCallback(async (isoDate: string) => {
    if (!isoDate) return { blocked: false, limit: 3, count: 0 };
    setDailyLimitInfo((prev) => ({
      ...prev,
      status: 'loading',
      date: isoDate,
    }));
    try {
      const response = await apiService.getDailyAppointmentCount(isoDate);
      const payload = (response as any)?.data;
      const count = typeof payload?.count === 'number' ? payload.count : payload?.data?.count || 0;
      const limitFromApi = typeof payload?.limit === 'number' ? payload.limit : payload?.data?.limit || 3;
      const limitValue = limitFromApi || 3;
      const isBlocked = count >= limitValue;
      setDailyLimitInfo({
        status: 'loaded',
        count,
        limit: limitValue,
        date: isoDate,
      });
      return { blocked: isBlocked, limit: limitValue, count };
    } catch (error) {
      console.error('Error checking daily appointment limit:', error);
      setDailyLimitInfo((prev) => ({
        ...prev,
        status: 'error',
      }));
      return { blocked: false, limit: 3, count: 0 };
    }
  }, []);

  const handleDateSelect = useCallback(async (isoDate: string) => {
    if (!isoDate) return;
    const currentLimit = dailyLimitInfo.limit || 3;

    if (dailyLimitInfo.status === 'loaded' && dailyLimitInfo.date === isoDate) {
      if (dailyLimitInfo.count >= currentLimit) {
        setDateOpen(false);
        ToastService.show(
          'error',
          'Giới hạn lịch hẹn',
          `Bạn đã có ${dailyLimitInfo.count}/${currentLimit} lịch hẹn trong ngày này. Vui lòng chọn ngày khác.`
        );
        return;
      }
      setDate(isoDate);
      setTimeSlot(null);
      setSelectedSlot(null);
      setDateOpen(false);
      setTimeout(() => setTimeOpen(true), 150);
      return;
    }

    const { blocked, limit, count } = await checkDailyAppointmentLimit(isoDate);
    if (blocked) {
      setDateOpen(false);
      ToastService.show(
        'error',
        'Giới hạn lịch hẹn',
        `Bạn đã có ${count}/${limit} lịch hẹn trong ngày này. Vui lòng chọn ngày khác.`
      );
      return;
    }

    setDate(isoDate);
    setTimeSlot(null);
    setSelectedSlot(null);
    setDateOpen(false);
    setTimeout(() => setTimeOpen(true), 150);
  }, [checkDailyAppointmentLimit, dailyLimitInfo, setDateOpen]);

  const submit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const payload: any = {
        doctorId: doctorId!,
        hospitalId: selectedBranch!,
        specialtyId: selectedSpecialty!,
        serviceId: serviceId!,
        scheduleId: selectedSlot?.scheduleId,
        appointmentDate: date,
        timeSlot: selectedSlot ? { startTime: selectedSlot.startTime, endTime: selectedSlot.endTime } : undefined,
        appointmentType,
        symptoms: symptoms || '',
        medicalHistory: medicalHistory || '',
        notes: notes || '',
        couponCode: discountCode || undefined,
        // Set default payment method to 'momo' (online payment)
        // This prevents auto-paid status, user can pay later in AppointmentDetail
        paymentMethod: 'momo',
      };
      try {
        const response = await apiService.createAppointment(payload);
        // Check if response indicates failure
        if (response && response.success === false) {
          // API returned an error response (e.g., slot full, validation error)
          const errorMessage = response.message || 'Không thể đặt lịch. Vui lòng thử lại.';
          ToastService.show('error', 'Lỗi', errorMessage);
          setIsSubmitting(false);
          return;
        }
        // Success case
        ToastService.show('success', 'Thành công', 'Đặt lịch thành công!');
        // Navigate after a short delay to allow toast to show
        setTimeout(() => {
          (navigation as any)?.navigate('AppointmentSchedule');
        }, 1500);
      } catch (e: any) {
        console.log('createAppointment failed:', e);
        // Check if it's an API error response with success: false
        if (e && typeof e === 'object' && e.success === false) {
          // API returned error response
          const errorMessage = e.message || 'Không thể đặt lịch. Vui lòng thử lại.';
          ToastService.show('error', 'Lỗi', errorMessage);
        } else if (e?.response?.data && e.response.data.success === false) {
          // Axios error with API error response
          const errorMessage = e.response.data.message || 'Không thể đặt lịch. Vui lòng thử lại.';
          ToastService.show('error', 'Lỗi', errorMessage);
        } else {
          // Network error or other unexpected error - show generic error
          const errorMessage = e?.message || 'Không thể đặt lịch. Vui lòng kiểm tra kết nối và thử lại.';
          ToastService.show('error', 'Lỗi', errorMessage);
        }
      }
    } catch (e: any) {
      // Outer catch for unexpected errors
      ToastService.show('error', 'Lỗi', e?.message || 'Không thể đặt lịch. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const BottomNext = ({ disabled, onPress, label = 'Tiếp tục' }: { disabled?: boolean; onPress: () => void; label?: string }) => (
    <TouchableOpacity
      style={[styles.nextBtn, { bottom: Math.max(16, insets.bottom + 12) }, disabled && styles.nextBtnDisabled]}
      disabled={!!disabled}
      onPress={onPress}
    >
      <Text style={styles.nextText}>{label}</Text>
    </TouchableOpacity>
  );

  const BottomActions = ({ 
    disabled, 
    onNext, 
    onBack, 
    nextLabel = 'Tiếp tục',
    showBack = true,
    isLoading = false
  }: { 
    disabled?: boolean; 
    onNext: () => void; 
    onBack: () => void;
    nextLabel?: string;
    showBack?: boolean;
    isLoading?: boolean;
  }) => (
    <View style={[styles.bottomActions, { bottom: Math.max(16, insets.bottom + 12) }]}>
      {showBack && (
        <TouchableOpacity style={styles.backBtnBottom} onPress={onBack} disabled={isLoading}>
          <Text style={styles.backBtnBottomText}>Quay lại</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={[styles.nextBtnBottom, disabled && styles.nextBtnDisabled]}
        disabled={!!disabled || isLoading}
        onPress={onNext}
      >
        {isLoading && (
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
        )}
        <Text style={styles.nextText}>{nextLabel}</Text>
      </TouchableOpacity>
    </View>
  );

  const STEPS = [
    { key: 1, label: 'Bệnh viện', icon: AppIcons.hospital },
    { key: 2, label: 'Bác sĩ', icon: AppIcons.doctor },
    { key: 3, label: 'Lịch khám', icon: AppIcons.calendar },
    { key: 4, label: 'Thanh toán', icon: AppIcons.card },
    { key: 5, label: 'Xác nhận', icon: AppIcons.checkmarkCircle },
  ];


  const progress = step === STEPS.length 
    ? ((step - 1) / (STEPS.length - 0.5))  
    : (step - 1) / (STEPS.length - 1);

  const handleBackPress = () => {
    // Navigate to Home instead of just going back
    // This ensures user always returns to Home from booking screen
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(24, insets.bottom + 100) }]}> 
      {/* Header with back button */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBackPress}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đặt lịch khám</Text>
        <View style={styles.headerRight} />
      </View>

      <View style={styles.progressWrap}>
        <View style={styles.progressTrack} />
        <View style={[styles.progressFill, { width: `${Math.max(0, Math.min(1, progress)) * 100}%` }]} />
        <View style={styles.stepsRow}>
          {STEPS.map((s) => {
            const isActive = step === s.key;
            const isDone = step > s.key;
            return (
              <View key={s.key} style={styles.stepItem}>
                <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isDone && styles.stepCircleDone]}>
                  <Ionicons name={s.icon as any} size={18} color={isActive ? '#fff' : isDone ? IconColors.primary : '#6b7280'} />
                </View>
                <Text style={[styles.stepLabel, (isActive || isDone) && styles.stepLabelActive]}>{s.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {step === 1 && (
        <>
          <Text style={styles.title}>Chọn chi nhánh</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity style={styles.dropdownHeader} onPress={() => setBranchOpen(true)}>
              <Text style={styles.dropdownHeaderText}>
                {branches.find(b => b._id === selectedBranch)?.name || 'Chọn chi nhánh'}
              </Text>
            </TouchableOpacity>
            <Modal visible={branchOpen} transparent animationType="fade" onRequestClose={() => setBranchOpen(false)}>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Chọn chi nhánh</Text>
                  <ScrollView style={{ maxHeight: 320 }}>
                    {branches.map(item => (
                      <TouchableOpacity
                        key={item._id}
                        style={[styles.modalItem, selectedBranch === item._id && styles.modalItemActive]}
                        onPress={() => { setSelectedBranch(item._id); setBranchOpen(false); }}
                      >
                        <Text style={[styles.modalItemText, selectedBranch === item._id && styles.modalItemTextActive]}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={styles.modalClose} onPress={() => setBranchOpen(false)}>
                    <Text style={styles.modalCloseText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>

          <Text style={[styles.title, { marginTop: 16 }]}>Chọn chuyên khoa</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity style={styles.dropdownHeader} onPress={() => setSpecialtyOpen(true)}>
              <Text style={styles.dropdownHeaderText}>
                {specialties.find(s => s._id === selectedSpecialty)?.name || 'Chọn chuyên khoa'}
              </Text>
            </TouchableOpacity>
            <Modal visible={specialtyOpen} transparent animationType="fade" onRequestClose={() => setSpecialtyOpen(false)}>
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Chọn chuyên khoa</Text>
                  <ScrollView style={{ maxHeight: 320 }}>
                    {specialties.map(item => (
                      <TouchableOpacity
                        key={item._id}
                        style={[styles.modalItem, selectedSpecialty === item._id && styles.modalItemActive]}
                        onPress={() => { setSelectedSpecialty(item._id); setSpecialtyOpen(false); }}
                      >
                        <Text style={[styles.modalItemText, selectedSpecialty === item._id && styles.modalItemTextActive]}>{item.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  <TouchableOpacity style={styles.modalClose} onPress={() => setSpecialtyOpen(false)}>
                    <Text style={styles.modalCloseText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>

          <BottomNext disabled={!canNextStep1} onPress={() => setStep(2)} />
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.title}>Chọn bác sĩ</Text>
          <View style={styles.dropdown}>
            <TouchableOpacity style={styles.dropdownHeader} onPress={() => setDoctorOpen(true)}>
              <Text style={styles.dropdownHeaderText}>
                {doctors.find(d => d._id === doctorId)?.user?.fullName || 'Chọn bác sĩ'}
              </Text>
            </TouchableOpacity>
          </View>
          <Modal visible={doctorOpen} transparent animationType="fade" onRequestClose={() => setDoctorOpen(false)}>
            <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
              <View style={[
                styles.modalCard,
                {
                  paddingBottom: insets.bottom + 12,
                  width: '100%',
                  maxWidth: '100%',
                  height: Math.round(screenHeight * 0.74),
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                },
              ]}>
                <Text style={styles.modalTitle}>Chọn bác sĩ</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: 8 }}>
                  {doctors.map((item: any) => (
                    <TouchableOpacity
                      key={item._id}
                      style={[styles.doctorCard, doctorId === item._id && styles.doctorCardActive]}
                      onPress={() => { setDoctorId(item._id); setDoctorOpen(false); }}
                    >
                      {item.user?.avatarUrl ? (
                        <Image source={{ uri: item.user.avatarUrl }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: '#e5e7eb' }]} />
                      )}
                      <View style={{ width: 140 }}>
                        <Text numberOfLines={1} style={styles.doctorName}>{item.user?.fullName || 'Bác sĩ'}</Text>
                        <Text numberOfLines={1} style={styles.doctorSub}>{item.specialtyId?.name || ''}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.modalClose} onPress={() => setDoctorOpen(false)}>
                  <Text style={styles.modalCloseText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {doctorId ? (
            <>
              <Text style={[styles.title, { marginTop: 16 }]}>Chọn dịch vụ</Text>
              <View style={styles.dropdown}>
                <TouchableOpacity style={styles.dropdownHeader} onPress={() => setServiceOpen(true)}>
                  <Text style={styles.dropdownHeaderText}>
                    {services.find(s => s._id === serviceId)?.name || 'Chọn dịch vụ'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Modal visible={serviceOpen} transparent animationType="fade" onRequestClose={() => setServiceOpen(false)}>
                <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
                  <View
                    style={[
                      styles.modalCard,
                      {
                        paddingBottom: insets.bottom + 12,
                        width: '100%',
                        maxWidth: '100%',
                        height: Math.round(screenHeight * 0.74),
                        borderTopLeftRadius: 16,
                        borderTopRightRadius: 16,
                        borderBottomLeftRadius: 0,
                        borderBottomRightRadius: 0,
                      },
                    ]}
                  >
                    <Text style={styles.modalTitle}>Chọn dịch vụ</Text>
                    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8, paddingHorizontal: 8 }}>
                      {services.map((item: any) => (
                        <TouchableOpacity
                          key={item._id}
                          style={[styles.serviceCard, serviceId === item._id && styles.serviceCardActive]}
                          onPress={() => { setServiceId(item._id); setServiceOpen(false); }}
                          activeOpacity={0.9}
                        >
                          <Text numberOfLines={2} style={styles.serviceName}>{item.name}</Text>
                          <Text style={styles.servicePrice}>{formatVnd(item.price)}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <TouchableOpacity style={styles.modalClose} onPress={() => setServiceOpen(false)}>
                      <Text style={styles.modalCloseText}>Đóng</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            </>
          ) : null}

          <BottomActions 
            disabled={!canNextStep2} 
            onNext={() => setStep(3)} 
            onBack={() => setStep(1)} 
          />
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.title}>Chọn ngày</Text>
          <TouchableOpacity
            style={styles.calendarTrigger}
            onPress={() => {
              const base = date ? new Date(date) : new Date();
              setMonthCursor(new Date(base.getFullYear(), base.getMonth(), 1));
              setDateOpen(true);
            }}
          >
            <Ionicons name={AppIcons.calendar as any} size={16} color={IconColors.primary} />
            <Text style={styles.calendarText}>{date ? formatDateDDMMYYYY(date) : 'Chọn ngày'}</Text>
          </TouchableOpacity>
          <Modal visible={dateOpen} transparent animationType="fade" onRequestClose={() => setDateOpen(false)}>
            <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
              <View style={[styles.modalCard, { width: '100%', maxWidth: '100%', height: Math.round(screenHeight * 0.72), borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: Math.max(6, insets.bottom + 2) }]}>
                <View style={styles.calHeader}>
                  <TouchableOpacity style={styles.calNavBtn} onPress={() => setMonthCursor((prev: Date) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                    <Ionicons name={AppIcons.chevronBack as any} size={18} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.calHeaderTitle}>{`Tháng ${(monthCursor.getMonth() + 1).toString().padStart(2,'0')} / ${monthCursor.getFullYear()}`}</Text>
                  <TouchableOpacity style={styles.calNavBtn} onPress={() => setMonthCursor((prev: Date) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                    <Ionicons name={AppIcons.chevronForward as any} size={18} color="#111827" />
                  </TouchableOpacity>
                </View>
                <View style={styles.calLegendRow}>
                  <View style={styles.calLegendDot} />
                  <Text style={styles.calLegendText}>Ngày bác sĩ có lịch khám</Text>
                </View>
                <View style={styles.calWeekRow}>
                  {['T2','T3','T4','T5','T6','T7','CN'].map((w) => (
                    <Text key={w} style={styles.calWeekday}>{w}</Text>
                  ))}
                </View>
                <ScrollView style={{ flex: 1 }}>
                  {buildMonthMatrix(monthCursor).map((week, wi) => (
                    <View key={`w-${wi}`} style={styles.calWeekRow}>
                      {week.map((cell) => {
                        const iso = formatLocalYMD(cell.date);
                        const isCurrentMonth = cell.inMonth;
                        const isSelected = date ? (iso === date) : false;
                        const isPast = isPastLocal(iso);
                        const isAvailable = availableDates.has(iso);
                        return (
                          <TouchableOpacity
                            key={iso}
                            style={styles.calDay}
                            onPress={() => {
                              if (isCurrentMonth && isAvailable && !isPast) {
                                handleDateSelect(iso);
                              }
                            }}
                            activeOpacity={0.8}
                          >
                            <View style={[styles.calDayCircle, isSelected && styles.calDayCircleSelected, !isCurrentMonth && styles.calDayCircleMuted, ((isCurrentMonth && !isAvailable) || isPast) && { opacity: 0.35 }]}>
                              <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected, !isCurrentMonth && styles.calDayTextMuted]}>{cell.date.getDate()}</Text>
                              {isCurrentMonth && isAvailable && !isSelected && !isPast ? <View style={styles.calDot} /> : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
                <TouchableOpacity style={styles.modalClose} onPress={() => setDateOpen(false)}>
                  <Text style={styles.modalCloseText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {isCheckingDailyLimit && (
            <View style={styles.limitInfo}>
              <ActivityIndicator size="small" color="#2563eb" style={{ marginRight: 8 }} />
              <Text style={styles.limitInfoText}>
                Đang kiểm tra số lịch hẹn của bạn cho ngày {dailyLimitInfo.date ? formatDateDDMMYYYY(dailyLimitInfo.date) : ''}...
              </Text>
            </View>
          )}

          {dailyLimitInfo.status === 'error' && (
            <View style={styles.limitInfoWarning}>
              <Ionicons name="information-circle" size={18} color="#92400e" style={{ marginRight: 8 }} />
              <Text style={styles.limitInfoWarningText}>
                Không thể kiểm tra giới hạn lịch hẹn. Bạn vẫn có thể thử lại hoặc chọn ngày khác.
              </Text>
            </View>
          )}

          <Text style={[styles.title, { marginTop: 16 }]}>Chọn giờ</Text>
          <TouchableOpacity
            style={styles.calendarTrigger}
            onPress={() => {
              if (dailyLimitReached) {
                ToastService.show(
                  'error',
                  'Giới hạn lịch hẹn',
                  'Bạn đã đạt giới hạn 3 lịch hẹn trong ngày này. Vui lòng chọn ngày khác.'
                );
                return;
              }
              setTimeOpen(true);
            }}
          >
            <Ionicons name={AppIcons.time as any} size={16} color={IconColors.primary} />
            <Text style={styles.calendarText}>{selectedSlot ? formatHourRange(selectedSlot.startTime, selectedSlot.endTime) : (timeSlot ? `${normalizeTime(timeSlot)} - ` : 'Chọn giờ')}</Text>
          </TouchableOpacity>

          <Modal visible={timeOpen} transparent animationType="fade" onRequestClose={() => setTimeOpen(false)}>
            <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
              <View style={[
                styles.modalCard,
                {
                  width: '100%',
                  maxWidth: '100%',
                  height: Math.round(screenHeight * 0.6),
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                  borderBottomLeftRadius: 0,
                  borderBottomRightRadius: 0,
                  paddingBottom: Math.max(6, insets.bottom + 2),
                },
              ]}> 
                <Text style={styles.modalTitle}>Chọn khung giờ</Text>
                {dailyLimitReached ? (
                  <View style={styles.limitAlertModal}>
                    <Ionicons name="warning" size={18} color="#b91c1c" style={{ marginRight: 8 }} />
                    <View>
                      <Text style={styles.limitAlertTitle}>Bạn đã đạt giới hạn 3 lịch hẹn trong ngày này.</Text>
                      <Text style={styles.limitAlertText}>Vui lòng chọn ngày khác để tiếp tục đặt lịch.</Text>
                    </View>
                  </View>
                ) : dayTimeSlots.length === 0 && !timeLoading ? (
                  <View style={{ width: '100%', alignItems: 'center', paddingVertical: 16 }}>
                    <Text style={{ color: '#6b7280', fontWeight: '600' }}>Không có khung giờ</Text>
                  </View>
                ) : (
                  <FlatList
                    data={dayTimeSlots}
                    numColumns={3}
                    keyExtractor={(slot: any, idx: number) => `${slot?.startTime || ''}-${slot?.endTime || ''}-${idx}`}
                    contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 8 }}
                    columnWrapperStyle={{ justifyContent: 'flex-start' }}
                    renderItem={({ item: slot, index }) => {
                      const start = String(slot?.startTime || '');
                      const end = String(slot?.endTime || '');
                      const label = start && end ? `${normalizeTime(start)} - ${normalizeTime(end)}` : (normalizeTime(start) || normalizeTime(end) || '—');
                      const cap = typeof slot?.maxBookings === 'number' ? slot.maxBookings : 0;
                      const used = typeof slot?.bookedCount === 'number' ? slot.bookedCount : 0;
                      const remaining = Math.max(0, cap - used);
                      const fullyBooked = cap > 0 && used >= cap;
                      const isBookedFlag = !!slot?.isBooked;
                      const isToday = date === formatLocalYMD(new Date());
                      let isPastTime = false;
                      if (isToday && end) {
                        const [eh, em] = end.split(':').map((n: any) => parseInt(n, 10));
                        const now = new Date();
                        const nowMin = now.getHours() * 60 + now.getMinutes();
                        const endMin = (isNaN(eh) ? 0 : eh) * 60 + (isNaN(em) ? 0 : em);
                        isPastTime = endMin <= nowMin;
                      }
                      // Check if slot is locked by someone else
                      const slotKey = `${slot?.scheduleId}_${normalizeTime(start)}`;
                      const isLocked = lockedSlots.has(slotKey);
                      const disabled = fullyBooked || isBookedFlag || isPastTime || dailyLimitReached || isLocked;
                      const active = !disabled && timeSlot && normalizeTime(timeSlot) === normalizeTime(start);
                      const marginStyle = { marginRight: (index % 3 === 2) ? 0 : 8 } as any;
                      return (
                        <TouchableOpacity
                          style={[styles.timeCell, marginStyle, active && styles.timeCellActive, disabled && { opacity: 0.45 }, isLocked && styles.timeCellLocked]}
                          onPress={() => { if (!disabled) { setTimeSlot(normalizeTime(start)); setSelectedSlot({ startTime: normalizeTime(start), endTime: normalizeTime(end), scheduleId: slot?.scheduleId }); setTimeOpen(false); } }}
                          activeOpacity={0.9}
                          disabled={disabled}
                        >
                          <Text style={[styles.timeCellText, active && styles.timeCellTextActive]}>{label}</Text>
                          {isLocked ? (
                            <Text style={[styles.timeCellSub, { color: '#f59e0b' }]}>Đang chọn</Text>
                          ) : disabled ? (
                            <Text style={[styles.timeCellSub, { color: '#ef4444' }]}>Hết chỗ</Text>
                          ) : cap > 0 ? (
                            <Text style={styles.timeCellSub}>{`Còn ${remaining}/${cap}`}</Text>
                          ) : (
                            <Text style={styles.timeCellSub}>Còn trống</Text>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                  />
                )}
                <TouchableOpacity style={styles.modalClose} onPress={() => setTimeOpen(false)}>
                  <Text style={styles.modalCloseText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <BottomActions 
            disabled={!canNextStep3} 
            onNext={() => setStep(4)} 
            onBack={() => setStep(2)} 
          />
        </>
      )}

      {step === 4 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <Text style={styles.title}>Thông tin thanh toán</Text>
          
          {/* Thông tin lịch hẹn */}
          <View style={styles.appointmentInfoBox}>
            <Text style={styles.appointmentInfoTitle}>Thông tin lịch hẹn</Text>
            {/* Bệnh viện + Chuyên khoa cùng 1 hàng */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmCol}>
                <Text style={styles.appointmentInfoLabel}>Bệnh viện</Text>
                <Text style={styles.appointmentInfoValue}>{getHospitalName(selectedBranch)}</Text>
              </View>
              <View style={[styles.confirmCol, styles.confirmColRight]}>
                <Text style={styles.appointmentInfoLabel}>Chuyên khoa</Text>
                <Text style={styles.appointmentInfoValue}>{getSpecialtyName(selectedSpecialty)}</Text>
              </View>
            </View>
            {/* Bác sĩ */}
            <View style={styles.appointmentInfoItem}>
              <Text style={styles.appointmentInfoLabel}>Bác sĩ</Text>
              <Text style={styles.appointmentInfoValue}>{getDoctorName(doctorId)}</Text>
            </View>
            {/* Dịch vụ (nếu có) */}
            {serviceId ? (
              <View style={styles.appointmentInfoItem}>
                <Text style={styles.appointmentInfoLabel}>Dịch vụ</Text>
                <Text style={styles.appointmentInfoValue}>{getServiceName(serviceId)}</Text>
              </View>
            ) : null}
            {/* Ngày + Giờ cùng 1 hàng */}
            <View style={styles.confirmRow}>
              <View style={styles.confirmCol}>
                <Text style={styles.appointmentInfoLabel}>Ngày khám</Text>
                <Text style={styles.appointmentInfoValue}>{date ? formatDateFull(date) : ''}</Text>
              </View>
              <View style={[styles.confirmCol, styles.confirmColRight]}>
                <Text style={styles.appointmentInfoLabel}>Giờ khám</Text>
                <Text style={styles.appointmentInfoValue}>{selectedSlot ? formatHourRange(selectedSlot.startTime, selectedSlot.endTime) : ''}</Text>
              </View>
            </View>
          </View>
          
          {/* Chi phí dự kiến */}
          <View style={styles.costBox}>
            <Text style={styles.costTitle}>Chi phí dự kiến</Text>
            <View style={styles.costRow}>
              <Text style={styles.costLabel}>Phí khám tư vấn:</Text>
              <Text style={styles.costValue}>{priceDetails.consultationFee.toLocaleString('vi-VN')} VNĐ</Text>
            </View>
            {serviceId ? (
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Phí dịch vụ:</Text>
                <Text style={styles.costValue}>{priceDetails.serviceFee.toLocaleString('vi-VN')} VNĐ</Text>
              </View>
            ) : null}
            <View style={[styles.costRow, styles.costTotal]}>
              <Text style={styles.costLabel}>Tổng chi phí:</Text>
              <Text style={styles.costValue}>{priceDetails.totalBeforeDiscount.toLocaleString('vi-VN')} VNĐ</Text>
            </View>
            {priceDetails.discountAmount > 0 ? (
              <View style={styles.costRow}>
                <Text style={[styles.costLabel, { color: '#10b981' }]}>Giảm giá:</Text>
                <Text style={[styles.costValue, { color: '#10b981' }]}>-{priceDetails.discountAmount.toLocaleString('vi-VN')} VNĐ</Text>
              </View>
            ) : null}
            <View style={[styles.costRow, styles.costPayment]}>
              <Text style={styles.costPaymentLabel}>Thanh toán:</Text>
              <Text style={styles.costPaymentValue}>{priceDetails.finalTotal.toLocaleString('vi-VN')} VNĐ</Text>
            </View>
            <View style={styles.paymentInfo}>
              <Ionicons name="information-circle" size={16} color="#2563eb" />
              <Text style={styles.paymentInfoText}>Bạn có thể thanh toán trực tuyến bằng PayPal hoặc MoMo trong phần chi tiết lịch hẹn sau khi đặt lịch thành công.</Text>
            </View>
          </View>
          
          {/* Mã giảm giá */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mã giảm giá (nếu có)</Text>
            <View style={styles.discountRow}>
              <TextInput
                style={styles.discountInput}
                value={discountCode}
                onChangeText={setDiscountCode}
                placeholder="Nhập mã giảm giá"
                placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity style={styles.discountButton}>
                <Text style={styles.discountButtonText}>Sử dụng</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Loại khám */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Loại khám</Text>
            <TouchableOpacity style={styles.selectWrapper} onPress={() => setAppointmentTypeModalOpen(true)}>
              <Text style={styles.selectText}>
                {appointmentType === 'first-visit' ? 'Khám lần đầu' : appointmentType === 'follow-up' ? 'Tái khám' : 'Tư vấn'}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6b7280" />
            </TouchableOpacity>
            <Modal visible={appointmentTypeModalOpen} transparent animationType="fade" onRequestClose={() => setAppointmentTypeModalOpen(false)}>
              <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setAppointmentTypeModalOpen(false)}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Chọn loại khám</Text>
                  {['first-visit', 'follow-up', 'consultation'].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.modalItem, appointmentType === type && styles.modalItemActive]}
                      onPress={() => {
                        setAppointmentType(type);
                        setAppointmentTypeModalOpen(false);
                      }}
                    >
                      <Text style={[styles.modalItemText, appointmentType === type && styles.modalItemTextActive]}>
                        {type === 'first-visit' ? 'Khám lần đầu' : type === 'follow-up' ? 'Tái khám' : 'Tư vấn'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity style={styles.modalClose} onPress={() => setAppointmentTypeModalOpen(false)}>
                    <Text style={styles.modalCloseText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
          
          {/* Triệu chứng */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Triệu chứng</Text>
            <TextInput
              style={styles.textArea}
              value={symptoms}
              onChangeText={setSymptoms}
              placeholder="Mô tả triệu chứng của bạn"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>
          
          {/* Tiền sử bệnh */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Tiền sử bệnh (nếu có)</Text>
            <TextInput
              style={styles.textArea}
              value={medicalHistory}
              onChangeText={setMedicalHistory}
              placeholder="Các bệnh đã mắc, dị ứng, thuốc đang sử dụng..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>
          
          {/* Ghi chú thêm */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ghi chú thêm</Text>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Các yêu cầu đặc biệt hoặc thông tin khác..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
            />
          </View>
          
          <BottomActions 
            onNext={() => setStep(5)} 
            onBack={() => setStep(3)} 
          />
        </ScrollView>
      )}

      {step === 5 && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          <Text style={styles.title}>Xác nhận đặt lịch</Text>
          <Text style={styles.confirmNote}>Vui lòng kiểm tra lại thông tin lịch hẹn trước khi hoàn tất. Bạn có thể thanh toán trực tuyến bằng PayPal trong lịch sử đặt lịch.</Text>

          {/* Thông tin bệnh viện */}
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Thông tin bệnh viện</Text>
            <View style={styles.confirmRow}> 
              <View style={styles.confirmCol}> 
                <Text style={styles.confirmLabel}>Bệnh viện</Text>
                <Text style={styles.confirmValue}>{getHospitalName(selectedBranch)}</Text>
              </View>
              <View style={[styles.confirmCol, styles.confirmColRight]}> 
                <Text style={styles.confirmLabel}>Chuyên khoa</Text>
                <Text style={styles.confirmValue}>{getSpecialtyName(selectedSpecialty)}</Text>
              </View>
            </View>
          </View>

          {/* Thông tin bác sĩ */}
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Thông tin bác sĩ</Text>
            <View style={styles.confirmRow}>
              <View style={styles.confirmCol}>
                <Text style={styles.confirmLabel}>Bác sĩ</Text>
                <Text style={styles.confirmValue}>{getDoctorName(doctorId)}</Text>
              </View>
            </View>
          </View>

          {/* Thông tin lịch hẹn */}
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Thông tin lịch hẹn</Text>
            <View style={styles.confirmRow}>
              <View style={styles.confirmCol}>
                <Text style={styles.confirmLabel}>Ngày khám</Text>
                <Text style={styles.confirmValue}>{date ? formatDateFull(date) : ''}</Text>
              </View>
              <View style={[styles.confirmCol, styles.confirmColRight]}>
                <Text style={styles.confirmLabel}>Giờ khám</Text>
                <Text style={styles.confirmValue}>{selectedSlot ? formatHourRange(selectedSlot.startTime, selectedSlot.endTime) : ''}</Text>
              </View>
            </View>
            <View style={styles.confirmRow}>
              <View style={styles.confirmCol}>
                <Text style={styles.confirmLabel}>Loại khám</Text>
                <Text style={styles.confirmValue}>{appointmentType === 'first-visit' ? 'Khám lần đầu' : appointmentType === 'follow-up' ? 'Tái khám' : 'Tư vấn'}</Text>
              </View>
            </View>
          </View>

          {/* Thông tin y tế */}
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Thông tin y tế</Text>
            <View style={styles.confirmItem}> 
              <Text style={styles.confirmLabel}>Dịch vụ</Text>
              <Text style={styles.confirmValue}>{getServiceName(serviceId) || 'Khám tổng quát'}</Text>
            </View>
            <View style={styles.confirmItem}> 
              <Text style={styles.confirmLabel}>Triệu chứng</Text>
              <Text style={styles.confirmValue}>{symptoms || 'Không có'}</Text>
            </View>
            <View style={styles.confirmItem}> 
              <Text style={styles.confirmLabel}>Tiền sử bệnh</Text>
              <Text style={styles.confirmValue}>{medicalHistory || 'Không có'}</Text>
            </View>
            <View style={styles.confirmItem}> 
              <Text style={styles.confirmLabel}>Ghi chú</Text>
              <Text style={styles.confirmValue}>{notes || 'Không có'}</Text>
            </View>
          </View>

          {/* Thông tin thanh toán */}
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Thông tin thanh toán</Text>
            <View style={styles.confirmRow}>
              <View style={[styles.confirmCol, { alignItems: 'flex-end' }]}> 
                <Text style={styles.confirmLabel}>Tổng chi phí</Text>
                <Text style={[styles.confirmValue, { color: '#2563eb', fontWeight: '700' }]}>{priceDetails.finalTotal.toLocaleString('vi-VN')} VNĐ</Text>
              </View>
            </View>
            <View style={styles.paymentInfo}>
              <Ionicons name="information-circle" size={16} color="#2563eb" />
              <Text style={styles.paymentInfoText}>Bạn có thể thanh toán trực tuyến bằng PayPal hoặc MoMo trong phần chi tiết lịch hẹn sau khi đặt lịch thành công.</Text>
            </View>
          </View>

          <BottomActions 
            nextLabel="Hoàn thành đặt lịch"
            onNext={submit} 
            onBack={() => setStep(4)} 
            disabled={isSubmitting}
            isLoading={isSubmitting}
          />
        </ScrollView>
      )}

      {/* Top back button removed; bottom actions provide navigation */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7', padding: 16 },
  // Header styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    backgroundColor: '#f7f7f7',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  headerRight: {
    width: 40,
  },
  stepHeader: { color: '#6b7280', fontWeight: '700', marginBottom: 8 },
  title: { fontWeight: '700', fontSize: 16, marginBottom: 8 },

  // progress bar + steps
  progressWrap: { paddingTop: 8, paddingBottom: 16,  },
  progressTrack: { position: 'absolute', left: 32, right: 32, top:58, height: 6,backgroundColor: '#e5e7eb', borderRadius: 999 },
  progressFill: { position: 'absolute', left: 32, top:58, height: 6, backgroundColor: '#2563eb', borderRadius: 999 },
  stepsRow: { flexDirection: 'row', marginTop:26, justifyContent: 'space-between', alignItems: 'center' },
  stepItem: { alignItems: 'center', width: 72 },
  stepCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', 
                justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', elevation: 1 },
  stepCircleActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  stepCircleDone: { borderColor: '#2563eb' },
  stepLabel: { marginTop: 6, fontSize: 12, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: '#2563eb' },

  // dropdown styles (reused)
  dropdown: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  dropdownHeader: { paddingVertical: 12, paddingHorizontal: 14 },
  dropdownHeaderText: { color: '#374151', fontWeight: '600' },
  dropdownList: { borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 14 },
  dropdownItemActive: { backgroundColor: '#eff6ff' },
  dropdownItemText: { color: '#374151', fontWeight: '600' },
  dropdownItemTextActive: { color: '#0a84ff' },

  // doctor card compact horizontal
  doctorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', 
                borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 20, 
                marginRight: 10, width: 320, minWidth: 220, alignSelf: 'flex-start' },
  doctorCardActive: { borderColor: '#0a84ff', backgroundColor: '#eff6ff' },
  avatar: { width: 58, height: 58, borderRadius: 24, marginRight: 10 },
  doctorName: { fontWeight: '700', color: '#111827', fontSize: 14 },
  doctorSub: { color: '#6b7280', fontSize: 12 },

  // date/time
  calendarTrigger: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, 
                     borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  calendarText: { color: '#111827', fontWeight: '700', marginLeft: 8 },
  limitInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 8, padding: 10,
               borderWidth: 1, borderColor: '#bfdbfe', marginTop: 8 },
  limitInfoText: { color: '#1e40af', fontSize: 12, flex: 1 },
  limitAlertModal: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fee2e2', borderRadius: 8, 
                     padding: 12, borderWidth: 1, borderColor: '#fecaca', marginBottom: 12 },
  limitAlertTitle: { color: '#b91c1c', fontWeight: '700', marginBottom: 4 },
  limitAlertText: { color: '#b91c1c', fontSize: 12 },
  limitInfoWarning: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fffbeb', borderRadius: 8, 
                      padding: 12, borderWidth: 1, borderColor: '#fcd34d', marginTop: 8 },
  limitInfoWarningText: { color: '#92400e', fontSize: 12, flex: 1 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999,
          marginRight: 8, backgroundColor: '#fff' },
  pillActive: { borderColor: '#0a84ff', backgroundColor: '#eff6ff' },
  pillText: { color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#0a84ff' },

  // time grid modal
  timeGridRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  timeCell: { width: '32%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, 
              paddingVertical: 14, paddingHorizontal: 10, marginBottom: 10, alignItems: 'center' },
  timeCellActive: { borderColor: '#0a84ff', backgroundColor: '#eff6ff' },
  timeCellLocked: { borderColor: '#f59e0b', backgroundColor: '#fffbeb' },
  timeCellText: { fontWeight: '700', color: '#111827', fontSize: 13 },
  timeCellTextActive: { color: '#0a84ff' },
  timeCellSub: { marginTop: 4, color: '#10b981', fontWeight: '600', fontSize: 11 },

  // modal styles (date picker)
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '86%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  modalItem: { paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8 },
  modalItemActive: { backgroundColor: '#eff6ff' },
  modalItemText: { color: '#374151', fontWeight: '600' },
  modalItemTextActive: { color: '#0a84ff' },
  modalClose: { marginTop: 12, backgroundColor: '#0a84ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontWeight: '700' },

  // calendar styles
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calNavBtn: { padding: 6 },
  calHeaderTitle: { fontWeight: '700', color: '#111827' },
  calLegendRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', paddingVertical: 8,
                  paddingHorizontal: 12, borderRadius: 8, marginBottom: 6 },
  calLegendDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb', marginRight: 6 },
  calLegendText: { color: '#6b7280', fontWeight: '600' },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  calWeekday: { width: `${100 / 7}%`, textAlign: 'center', color: '#6b7280', fontWeight: '700' },
  calDay: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6 },
  calDayCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef2ff', alignItems: 'center', 
                  justifyContent: 'center' },
  calDayCircleSelected: { backgroundColor: '#2563eb' },
  calDayCircleMuted: { backgroundColor: '#f3f4f6' },
  calDayText: { color: '#111827', fontWeight: '700' },
  calDayTextSelected: { color: '#fff' },
  calDayTextMuted: { color: '#9ca3af' },
  calDot: { position: 'absolute', bottom: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb' },

  // payment
  row: { padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10 },
  rowActive: { borderColor: '#0a84ff' },
  rowText: { color: '#374151', fontWeight: '600' },
  rowTextActive: { color: '#0a84ff' },

  // confirm
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  rowInfo: { marginBottom: 8, color: '#374151', fontWeight: '600' },

  // bottom buttons
  nextBtn: { position: 'absolute', left: 16, right: 16, backgroundColor: '#0a84ff', padding: 14, 
             borderRadius: 12, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#93c5fd' },
  nextText: { color: '#fff', fontWeight: '700' },
  backBtn: { position: 'absolute', left: 16, top: 8, paddingVertical: 6, paddingHorizontal: 8 },
  backText: { color: '#0a84ff', fontWeight: '700' },
  bottomActions: { position: 'absolute', left: 16, right: 16, flexDirection: 'row' },
  backBtnBottom: { flex: 1, backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center',
                   borderWidth: 1, borderColor: '#e5e7eb', marginRight: 12 },
  backBtnBottomText: { color: '#374151', fontWeight: '700' },
  nextBtnBottom: { flex: 2, backgroundColor: '#0a84ff', padding: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },

  // service card in modal
  serviceCard: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 10 },
  serviceCardActive: { borderColor: '#0a84ff', backgroundColor: '#eff6ff' },
  serviceName: { fontWeight: '700', color: '#111827', marginBottom: 6 },
  servicePrice: { color: '#0a84ff', fontWeight: '700' },
  
  // step 4 payment styles
  appointmentInfoBox: { backgroundColor: '#e0f2fe', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#bae6fd' },
  appointmentInfoTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  appointmentInfoGrid: { },
  appointmentInfoItem: { marginBottom: 12 },
  appointmentInfoLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 4 },
  appointmentInfoValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
  costBox: { backgroundColor: '#f9fafb', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  costTitle: { fontSize: 18, fontWeight: '600', color: '#111827', marginBottom: 12 },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  costTotal: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8, marginTop: 4 },
  costLabel: { fontSize: 14, color: '#6b7280' },
  costValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  costPayment: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 8 },
  costPaymentLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  costPaymentValue: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  paymentMethodBox: { marginTop: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 16 },
  paymentMethodTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  paymentMethodCaption: { marginTop: 4, fontSize: 12, color: '#6b7280' },
  paymentMethodOption: { marginTop: 12, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, padding: 14, backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  paymentMethodOptionActive: { borderColor: '#2563eb', backgroundColor: '#eef2ff' },
  paymentMethodOptionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  paymentMethodRadio: { marginRight: 12 },
  paymentMethodOptionText: { flex: 1 },
  paymentMethodLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  paymentMethodOptionTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  paymentMethodOptionTitleActive: { color: '#1d4ed8' },
  paymentMethodOptionDesc: { fontSize: 12, color: '#6b7280', lineHeight: 16 },
  paymentMethodBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#dbeafe' },
  paymentMethodBadgeText: { fontSize: 11, fontWeight: '700', color: '#1d4ed8' },
  paymentInfo: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, padding: 12, backgroundColor: '#eff6ff', 
                 borderRadius: 8, borderWidth: 1, borderColor: '#bfdbfe' },
  paymentInfoText: { flex: 1, fontSize: 12, color: '#1e40af', marginLeft: 8, lineHeight: 18 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  discountRow: { flexDirection: 'row' },
  discountInput: { flex: 1, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', 
                   paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, marginRight: 8 },
  discountButton: { backgroundColor: '#dbeafe', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center' },
  discountButtonText: { color: '#1e40af', fontWeight: '600' },
  selectWrapper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 12,
                   borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 12, paddingHorizontal: 14 },
  selectText: { fontSize: 14, color: '#111827', fontWeight: '600' },
  textArea: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 12, 
              paddingHorizontal: 14, fontSize: 14, minHeight: 80, textAlignVertical: 'top' },

  // step 5 confirm styles
  confirmNote: { color: '#6b7280', fontSize: 12, marginBottom: 12 },
  confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  confirmCol: { flex: 1 },
  confirmColRight: { paddingLeft: 16 },
  confirmItem: { marginBottom: 10 },
  confirmLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 4 },
  confirmValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
});


