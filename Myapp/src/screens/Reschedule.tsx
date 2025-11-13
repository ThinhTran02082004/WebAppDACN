import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, ScrollView, FlatList } from 'react-native';
import Ionicons from '@react-native-vector-icons/ionicons';
import type { StackScreenProps } from '@react-navigation/stack';
import { apiService } from '../services/api';
import { IconColors, AppIcons } from '../config/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = StackScreenProps<any, 'RescheduleAppointment'> & {
  route: { params: { appointmentId: string; doctorId: string; currentDate: string } };
};

export default function RescheduleAppointmentScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { appointmentId, doctorId, currentDate } = route.params || ({} as any);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [doctorSchedules, setDoctorSchedules] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [monthCursor, setMonthCursor] = useState<Date>(() => {
    const base = currentDate ? new Date(currentDate) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [dayTimeSlots, setDayTimeSlots] = useState<any[]>([]);
  const [timeLoading, setTimeLoading] = useState<boolean>(false);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiService.getDoctorSchedules(doctorId);
        const list = Array.isArray((res as any)?.data?.data) ? (res as any).data.data : (Array.isArray((res as any)?.data) ? (res as any).data : []);
        const active = Array.isArray(list) ? list.filter((s: any) => s?.isActive !== false) : [];
        setDoctorSchedules(active);
      } catch (e: any) {
        setDoctorSchedules([]);
        Alert.alert('Lỗi', e?.message || 'Không thể tải lịch của bác sĩ');
      } finally {
        setLoading(false);
      }
    })();
  }, [doctorId]);

  // Helpers (reuse logic from Booking)
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
    const parts = String(t).split(':');
    const h = Math.max(0, parseInt(parts[0] || '0', 10));
    const m = Math.max(0, parseInt(parts[1] || '0', 10));
    const hh = String(isNaN(h) ? 0 : h).padStart(2, '0');
    const mm = String(isNaN(m) ? 0 : m).padStart(2, '0');
    return `${hh}:${mm}`;
  };
  const formatDateFull = (iso?: string | null) => {
    if (!iso) return '';
    try {
      const [yy, mm, dd] = iso.split('-').map((n) => parseInt(n, 10));
      const d = new Date(Date.UTC(yy, (mm || 1) - 1, dd || 1, 12, 0, 0));
      const opts: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      return d.toLocaleDateString('vi-VN', opts);
    } catch { return iso as any; }
  };
  const formatHourRange = (start?: string | null, end?: string | null) => {
    const ns = normalizeTime(start || '');
    const ne = normalizeTime(end || '');
    return ns && ne ? `${ns} - ${ne}` : (ns || ne || '');
  };

  // Available dates for month
  useEffect(() => {
    try {
      const start = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
      const end = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
      const ok = new Set<string>();
      doctorSchedules.forEach((s: any) => {
        if (!s?.date) return;
        const d = new Date(s.date);
        if (d >= start && d <= end && Array.isArray(s.timeSlots) && s.timeSlots.length > 0) {
          ok.add(formatLocalYMD(d));
        }
      });
      setAvailableDates(ok);
    } catch {}
  }, [doctorSchedules, monthCursor]);

  // Load time slots of selected date
  useEffect(() => {
    const loadDaySlots = async () => {
      try {
        if (!date) { setDayTimeSlots([]); return; }
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
              bookedCount: booked,
              maxBookings: maxB,
              isBooked: booked >= maxB,
            });
          });
        });
        // Deduplicate by time and prefer the variant that still has capacity
        const map = new Map<string, any>();
        collected.forEach((c) => {
          const k = `${normalizeTime(String(c?.startTime || ''))}-${normalizeTime(String(c?.endTime || ''))}`;
          const existing = map.get(k);
          if (!existing) {
            map.set(k, c);
            return;
          }
          const existingRemaining = (existing?.maxBookings ?? 0) - (existing?.bookedCount ?? 0);
          const candidateRemaining = (c?.maxBookings ?? 0) - (c?.bookedCount ?? 0);
          // Prefer slot that is not fully booked; if both available, pick the one with more remaining capacity
          if (existing?.isBooked && !c?.isBooked) {
            map.set(k, c);
          } else if (!existing?.isBooked && c?.isBooked) {
            // keep existing
          } else if (candidateRemaining > existingRemaining) {
            map.set(k, c);
          }
        });
        const normalized = Array.from(map.values()).sort((a, b) => {
          const [ah, am] = String(a?.startTime || '00:00').split(':').map((n: any) => parseInt(n, 10));
          const [bh, bm] = String(b?.startTime || '00:00').split(':').map((n: any) => parseInt(n, 10));
          return (ah * 60 + (isNaN(am) ? 0 : am)) - (bh * 60 + (isNaN(bm) ? 0 : bm));
        });
        setDayTimeSlots(normalized);
      } catch { setDayTimeSlots([]); }
      finally { setTimeLoading(false); }
    };
    loadDaySlots();
  }, [date, doctorSchedules]);

  const buildMonthMatrix = (cursor: Date) => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstWeekdayMonFirst = (firstDay.getDay() + 6) % 7;
    const totalDays = lastDay.getDate();
    const cells: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < firstWeekdayMonFirst; i++) {
      const d = new Date(year, month, i - firstWeekdayMonFirst + 1);
      cells.push({ date: d, inMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) cells.push({ date: new Date(year, month, d), inMonth: true });
    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date: next, inMonth: false });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
      cells.push({ date: next, inMonth: false });
    }
    const weeks: { date: Date; inMonth: boolean }[][] = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    return weeks;
  };

  const canNextStep1 = !!date;
  const canNextStep2 = !!selectedSlot;

  const onConfirm = async () => {
    if (!date || !selectedSlot) return;
    try {
      setSubmitting(true);
      await apiService.rescheduleAppointment(appointmentId, {
        scheduleId: selectedSlot.scheduleId,
        timeSlot: { startTime: selectedSlot.startTime, endTime: selectedSlot.endTime },
        appointmentDate: date,
      });
      Alert.alert('Thành công', 'Đổi lịch hẹn thành công.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } catch (e: any) {
      Alert.alert('Lỗi', e?.message || 'Không thể đổi lịch. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8 }}>
          <Ionicons name={AppIcons.chevronBack as any} size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Đổi lịch hẹn</Text>
        <View style={{ width: 70 }} />
      </View>

      {/* Progress like Booking: 3 steps */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack} />
        <View style={[styles.progressFill, { width: `${((step - 1) / 2) * 100}%` }]} />
        <View style={styles.stepsRow}>
          {[{k:1,l:'Ngày'},{k:2,l:'Giờ'},{k:3,l:'Xác nhận'}].map((s) => (
            <View key={s.k} style={styles.stepItem}>
              <View style={[styles.stepCircle, step === s.k && styles.stepCircleActive, step > s.k && styles.stepCircleDone]}>
                <Ionicons name={(s.k===1?AppIcons.calendar:s.k===2?AppIcons.time:AppIcons.checkmarkCircle) as any} size={18} color={step===s.k?'#fff': step > s.k? IconColors.primary : '#6b7280'} />
              </View>
              <Text style={[styles.stepLabel, (step===s.k || step>s.k) && styles.stepLabelActive]}>{s.l}</Text>
            </View>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingCenter}><ActivityIndicator size="large" color="#2563eb" /></View>
      ) : step === 1 ? (
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
            <Text style={styles.calendarText}>{date ? formatDateFull(date) : 'Chọn ngày'}</Text>
          </TouchableOpacity>
          <Modal visible={dateOpen} transparent animationType="fade" onRequestClose={() => setDateOpen(false)}>
            <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
              <View style={[styles.modalCard, { width: '100%', maxWidth: '100%', height: 480, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 12 }]}> 
                <View style={styles.calHeader}>
                  <TouchableOpacity style={styles.calNavBtn} onPress={() => setMonthCursor((prev: Date) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>
                    <Ionicons name={AppIcons.chevronBack as any} size={18} color="#111827" />
                  </TouchableOpacity>
                  <Text style={styles.calHeaderTitle}>{`Tháng ${(monthCursor.getMonth() + 1).toString().padStart(2,'0')} / ${monthCursor.getFullYear()}`}</Text>
                  <TouchableOpacity style={styles.calNavBtn} onPress={() => setMonthCursor((prev: Date) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>
                    <Ionicons name={AppIcons.chevronForward as any} size={18} color="#111827" />
                  </TouchableOpacity>
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
                        const isAvailable = availableDates.has(iso);
                        return (
                          <TouchableOpacity key={iso} style={styles.calDay} onPress={() => { if (isCurrentMonth && isAvailable) { setDate(iso); setDateOpen(false); } }} activeOpacity={0.8}>
                            <View style={[styles.calDayCircle, isSelected && styles.calDayCircleSelected, !isCurrentMonth && styles.calDayCircleMuted, (!isAvailable) && { opacity: 0.35 }]}>
                              <Text style={[styles.calDayText, isSelected && styles.calDayTextSelected, !isCurrentMonth && styles.calDayTextMuted]}>{cell.date.getDate()}</Text>
                              {isCurrentMonth && isAvailable && !isSelected ? <View style={styles.calDot} /> : null}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          </Modal>

          <View style={[styles.bottomActions, { bottom: Math.max(16, insets.bottom + 12) }]}>
            <TouchableOpacity style={[styles.nextBtnBottom, !canNextStep1 && styles.nextBtnDisabled]} disabled={!canNextStep1} onPress={() => setStep(2)}>
              <Text style={styles.nextText}>Tiếp tục</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : step === 2 ? (
        <>
          <Text style={styles.title}>Chọn giờ</Text>
          <TouchableOpacity style={styles.calendarTrigger} onPress={() => setTimeOpen(true)}>
            <Ionicons name={AppIcons.time as any} size={16} color={IconColors.primary} />
            <Text style={styles.calendarText}>{selectedSlot ? formatHourRange(selectedSlot.startTime, selectedSlot.endTime) : 'Chọn giờ'}</Text>
          </TouchableOpacity>
          <Modal visible={timeOpen} transparent animationType="fade" onRequestClose={() => setTimeOpen(false)}>
            <View style={[styles.modalBackdrop, { justifyContent: 'flex-end' }]}>
              <View style={[styles.modalCard, { width: '100%', maxWidth: '100%', height: 420, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: 12 }]}> 
                <Text style={styles.modalTitle}>Chọn khung giờ</Text>
                {dayTimeSlots.length === 0 && !timeLoading ? (
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
                      const disabled = fullyBooked || !date;
                      const active = !disabled && selectedSlot && normalizeTime(selectedSlot.startTime) === normalizeTime(start);
                      const marginStyle = { marginRight: (index % 3 === 2) ? 0 : 8 } as any;
                      return (
                        <TouchableOpacity
                          style={[styles.timeCell, marginStyle, active && styles.timeCellActive, disabled && { opacity: 0.45 } ]}
                          onPress={() => { if (!disabled) { setSelectedSlot({ startTime: normalizeTime(start), endTime: normalizeTime(end), scheduleId: slot?.scheduleId }); setTimeOpen(false); } }}
                          activeOpacity={0.9}
                          disabled={disabled}
                        >
                          <Text style={[styles.timeCellText, active && styles.timeCellTextActive]}>{label}</Text>
                          {disabled ? (
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

          <View style={[styles.bottomActions, { bottom: Math.max(16, insets.bottom + 12) }]}>
            <TouchableOpacity style={styles.backBtnBottom} onPress={() => setStep(1)}>
              <Text style={styles.backBtnBottomText}>Quay lại</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nextBtnBottom, !canNextStep2 && styles.nextBtnDisabled]} disabled={!canNextStep2} onPress={() => setStep(3)}>
              <Text style={styles.nextText}>Tiếp tục</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: Math.max(100, insets.bottom + 120) }}>
          <Text style={styles.title}>Xác nhận đổi lịch</Text>
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Thông tin lịch hẹn mới</Text>
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
          </View>

          <View style={[styles.bottomActions, { bottom: Math.max(16, insets.bottom + 12) }]}>
            <TouchableOpacity style={styles.backBtnBottom} onPress={() => setStep(2)} disabled={submitting}>
              <Text style={styles.backBtnBottomText}>Quay lại</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nextBtnBottom, submitting && styles.nextBtnDisabled]} onPress={onConfirm} disabled={submitting}>
              {submitting && <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />}
              <Text style={styles.nextText}>Xác nhận đổi lịch</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22,padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  progressWrap: { paddingTop: 8, paddingBottom: 16, paddingHorizontal: 16 },
  progressTrack: { position: 'absolute', left: 32, right: 32, top:58, height: 6,backgroundColor: '#e5e7eb', borderRadius: 999 },
  progressFill: { position: 'absolute', left: 32, top:58, height: 6, backgroundColor: '#2563eb', borderRadius: 999 },
  stepsRow: { flexDirection: 'row', marginTop:26, justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  stepItem: { alignItems: 'center', width: 72 },
  stepCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb', elevation: 1 },
  stepCircleActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  stepCircleDone: { borderColor: '#2563eb' },
  stepLabel: { marginTop: 6, fontSize: 12, color: '#9ca3af', fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: '#2563eb' },
  title: { fontWeight: '700', fontSize: 16, marginBottom: 8, paddingHorizontal: 16 },
  calendarTrigger: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', paddingVertical: 12, paddingHorizontal: 14, marginHorizontal: 16 },
  calendarText: { color: '#111827', fontWeight: '700', marginLeft: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '86%', backgroundColor: '#fff', borderRadius: 12, padding: 16 },
  modalTitle: { fontWeight: '700', fontSize: 16, marginBottom: 12 },
  modalClose: { marginTop: 12, backgroundColor: '#0a84ff', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  modalCloseText: { color: '#fff', fontWeight: '700' },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calNavBtn: { padding: 6 },
  calHeaderTitle: { fontWeight: '700', color: '#111827' },
  calWeekRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  calWeekday: { width: `${100 / 7}%`, textAlign: 'center', color: '#6b7280', fontWeight: '700' },
  calDay: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6 },
  calDayCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#eef2ff', alignItems: 'center', justifyContent: 'center' },
  calDayCircleSelected: { backgroundColor: '#2563eb' },
  calDayCircleMuted: { backgroundColor: '#f3f4f6' },
  calDayText: { color: '#111827', fontWeight: '700' },
  calDayTextSelected: { color: '#fff' },
  calDayTextMuted: { color: '#9ca3af' },
  calDot: { position: 'absolute', bottom: 4, width: 6, height: 6, borderRadius: 3, backgroundColor: '#2563eb' },
  timeCell: { width: '32%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 10, marginBottom: 10, alignItems: 'center' },
  timeCellActive: { borderColor: '#0a84ff', backgroundColor: '#eff6ff' },
  timeCellText: { fontWeight: '700', color: '#111827', fontSize: 13 },
  timeCellTextActive: { color: '#0a84ff' },
  timeCellSub: { marginTop: 4, color: '#10b981', fontWeight: '600', fontSize: 11 },
  bottomActions: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', bottom: 16 },
  backBtnBottom: { flex: 1, backgroundColor: '#fff', padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb', marginRight: 12 },
  backBtnBottomText: { color: '#374151', fontWeight: '700' },
  nextBtnBottom: { flex: 2, backgroundColor: '#0a84ff', padding: 14, borderRadius: 12, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#93c5fd' },
  nextText: { color: '#fff', fontWeight: '700' },
  confirmBox: { backgroundColor: '#fff', borderRadius: 12, padding: 16, margin: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  confirmTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
  confirmRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  confirmCol: { flex: 1 },
  confirmColRight: { paddingLeft: 16 },
  confirmLabel: { fontSize: 12, color: '#6b7280', fontWeight: '600', marginBottom: 4 },
  confirmValue: { fontSize: 14, color: '#111827', fontWeight: '600' },
});


