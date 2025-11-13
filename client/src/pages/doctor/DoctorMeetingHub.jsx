import React, { useState, useEffect, useCallback } from 'react';
import { FaVideo, FaPlus, FaCopy, FaUsers, FaClock, FaCheck, FaTimes, FaHospital } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import VideoRoom from '../../components/VideoRoom/VideoRoom';
import { useSocket } from '../../context/SocketContext';

const extractHospitalId = (hospital) => {
  if (!hospital) return null;
  if (typeof hospital === 'string') return hospital.toString();
  if (typeof hospital === 'object' && hospital._id) return hospital._id.toString();
  return null;
};

const normalizeMeeting = (meeting) => {
  if (!meeting || typeof meeting !== 'object') {
    return meeting;
  }

  const normalized = { ...meeting };

  if (meeting._id) {
    normalized._id = meeting._id.toString ? meeting._id.toString() : meeting._id;
  }
  const hospitalSet = new Set(
    Array.isArray(meeting.hospitalIds)
      ? meeting.hospitalIds.map((id) => (id ? id.toString() : null)).filter(Boolean)
      : []
  );

  if (Array.isArray(meeting.hospitals)) {
    normalized.hospitals = meeting.hospitals.map((hospital) => {
      if (!hospital) return hospital;
      if (typeof hospital === 'string') {
        const id = hospital.toString();
        hospitalSet.add(id);
        return hospital;
      }

      const mappedHospital = { ...hospital };
      if (hospital._id) {
        mappedHospital._id = hospital._id.toString();
        hospitalSet.add(mappedHospital._id);
      }
      return mappedHospital;
    });
  }

  normalized.hospitalIds = Array.from(hospitalSet);

  const participants = Array.isArray(meeting.participants) ? meeting.participants : [];
  normalized.participants = participants;
  normalized.activeParticipantCount =
    typeof meeting.activeParticipantCount === 'number'
      ? meeting.activeParticipantCount
      : participants.filter((participant) => !participant.leftAt).length;

  return normalized;
};

const sortMeetings = (list) =>
  list.slice().sort((a, b) => {
    const aTime = new Date(a.updatedAt || a.startTime || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.startTime || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

const DoctorMeetingHub = () => {
  const { socket } = useSocket();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState('active'); // active, ended
  const [activeVideoRoom, setActiveVideoRoom] = useState(null);
  const [copied, setCopied] = useState(null);
  const [currentDoctorId, setCurrentDoctorId] = useState(null);

  // Hospitals
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitals, setSelectedHospitals] = useState([]);
  const [currentDoctorHospital, setCurrentDoctorHospital] = useState(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Join by code
  const [joinCode, setJoinCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [validMeeting, setValidMeeting] = useState(null);

  const doctorHospitalId = currentDoctorHospital?._id
    ? currentDoctorHospital._id.toString()
    : null;

  const includeMeetingForDoctor = useCallback(
    (meeting) => {
      if (!meeting) return false;
      if (!doctorHospitalId) return true;
      const hospitalIds = Array.isArray(meeting.hospitalIds) ? meeting.hospitalIds : [];
      return hospitalIds.includes(doctorHospitalId);
    },
    [doctorHospitalId]
  );

  const upsertMeeting = useCallback(
    (incomingMeeting, options = {}) => {
      if (!incomingMeeting) return;
      const meetingData = options.normalized ? incomingMeeting : normalizeMeeting(incomingMeeting);
      if (!meetingData || !meetingData._id) return;

      if (!includeMeetingForDoctor(meetingData)) {
        setMeetings((prev) => prev.filter((meeting) => meeting._id !== meetingData._id));
        return;
      }

      setMeetings((prev) => {
        const existingIndex = prev.findIndex((meeting) => meeting._id === meetingData._id);
        if (existingIndex === -1) {
          return sortMeetings([meetingData, ...prev]);
        }
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], ...meetingData };
        return sortMeetings(updated);
      });
    },
    [includeMeetingForDoctor]
  );

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const statusParam = activeTab === 'active' ? 'active,waiting' : 'ended';
      const response = await api.get(`/doctor-meetings/my-meetings?status=${statusParam}`);
      if (response.data.success) {
        const rawMeetings = Array.isArray(response.data.data) ? response.data.data : [];
        const normalizedMeetings = rawMeetings.map(normalizeMeeting);
        // Backend đã filter theo hospital, không cần filter lại ở đây
        setMeetings(sortMeetings(normalizedMeetings));
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Không thể tải danh sách cuộc họp');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Load doctor hospital và meetings khi mount
  useEffect(() => {
    let mounted = true;

    const initializeData = async () => {
      try {
        // 1. Load doctor hospital info
        const profileResponse = await api.get('/doctors/profile');
        if (!mounted) return;

        if (profileResponse.data.success) {
          const doctorData = profileResponse.data.data;
          
          // Lưu doctor ID
          if (doctorData?._id) {
            const doctorId = doctorData._id.toString ? doctorData._id.toString() : doctorData._id;
            setCurrentDoctorId(doctorId);
          }
          
          const hospital = doctorData?.hospital;
          if (hospital) {
            const hospitalId = hospital._id ? hospital._id.toString() : null;
            const formattedHospital =
              hospitalId && typeof hospital === 'object'
                ? { ...hospital, _id: hospitalId }
                : hospital;

            setCurrentDoctorHospital(formattedHospital);

            if (hospitalId) {
              setSelectedHospitals([hospitalId]);
            }
          }
        }

        // 2. Load hospitals list
        await fetchHospitals();

        // 3. Load meetings - backend sẽ filter theo hospital
        await fetchMeetings();
      } catch (error) {
        console.error('Error initializing data:', error);
      }
    };

    initializeData();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch meetings khi đổi tab hoặc có currentDoctorHospital
  useEffect(() => {
    if (currentDoctorHospital) {
      fetchMeetings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (!socket) return;

    const handleMeetingCreated = (payload = {}) => {
      if (payload.meeting) {
        const normalized = normalizeMeeting(payload.meeting);
        if (includeMeetingForDoctor(normalized)) {
          upsertMeeting(normalized, { normalized: true });
          if (activeTab === 'active') {
            const message = payload.message || `Cuộc họp nội bộ mới: "${normalized.title}"`;
            toast.info(message, { autoClose: 6000 });
          }
          return;
        }
      }
      fetchMeetings();
    };

    const handleMeetingUpdated = (payload = {}) => {
      if (payload.meeting) {
        upsertMeeting(payload.meeting);
      } else {
        fetchMeetings();
      }
    };

    const handleMeetingEnded = (payload = {}) => {
      if (payload.meeting) {
        upsertMeeting(payload.meeting);
      } else {
        fetchMeetings();
      }
      if (activeTab === 'active') {
        toast.info('Một cuộc họp đã kết thúc');
      }
    };

    const handleParticipantEvent = (payload = {}) => {
      if (payload.meeting) {
        upsertMeeting(payload.meeting);
      } else {
        fetchMeetings();
      }
    };

    socket.on('meeting_created', handleMeetingCreated);
    socket.on('meeting_updated', handleMeetingUpdated);
    socket.on('meeting_ended', handleMeetingEnded);
    socket.on('participant_joined', handleParticipantEvent);
    socket.on('participant_left', handleParticipantEvent);

    return () => {
      socket.off('meeting_created', handleMeetingCreated);
      socket.off('meeting_updated', handleMeetingUpdated);
      socket.off('meeting_ended', handleMeetingEnded);
      socket.off('participant_joined', handleParticipantEvent);
      socket.off('participant_left', handleParticipantEvent);
    };
  }, [socket, upsertMeeting, fetchMeetings, includeMeetingForDoctor, activeTab]);


  const fetchHospitals = async () => {
    try {
      const response = await api.get('/hospitals?limit=1000&isActive=true');
      if (response.data.success) {
        const hospitalData = Array.isArray(response.data.data?.hospitals)
          ? response.data.data.hospitals
          : [];

        const formattedHospitals = hospitalData.map((hospital) => {
          if (hospital && typeof hospital === 'object' && hospital._id) {
            return { ...hospital, _id: hospital._id.toString() };
          }
          return hospital;
        });

        if (doctorHospitalId) {
          formattedHospitals.sort((a, b) => {
            const aId = extractHospitalId(a);
            const bId = extractHospitalId(b);
            if (aId === doctorHospitalId) return -1;
            if (bId === doctorHospitalId) return 1;
            const aName = a?.name || '';
            const bName = b?.name || '';
            return aName.localeCompare(bName);
          });
        }

        setHospitals(formattedHospitals);
      }
    } catch (error) {
      console.error('Error fetching hospitals:', error);
      setHospitals([]);
    }
  };


  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Vui lòng nhập tiêu đề cuộc họp');
      return;
    }

    if (selectedHospitals.length === 0) {
      toast.error('Vui lòng chọn ít nhất một chi nhánh bệnh viện');
      return;
    }

    try {
      setCreating(true);
      const response = await api.post('/doctor-meetings/create', {
        title: title.trim(),
        description: description.trim(),
        hospitals: selectedHospitals
      });

      if (response.data.success) {
        const roomCode = response.data.data.roomCode;
        const meetingTitle = response.data.data.title || 'Cuộc họp nội bộ';
        
        // Show success message with room code
        toast.success(
          <div>
            <div className="font-semibold">Tạo cuộc họp nội bộ thành công!</div>
            <div className="text-sm mt-1">Mã cuộc họp: <strong>{roomCode}</strong></div>
          </div>,
          { autoClose: 8000 }
        );
        
        setTitle('');
        setDescription('');
        setSelectedHospitals([]);
        setShowCreateForm(false);
        fetchMeetings();
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast.error(error.response?.data?.message || 'Không thể tạo cuộc họp');
    } finally {
      setCreating(false);
    }
  };

  const handleValidateCode = async (code) => {
    if (!code || code.length < 6) {
      setValidMeeting(null);
      return;
    }

    try {
      setValidating(true);
      const response = await api.get(`/doctor-meetings/validate/${code}`);
      if (response.data.success) {
        setValidMeeting(response.data.data);
      }
    } catch (error) {
      setValidMeeting(null);
    } finally {
      setValidating(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode || joinCode.length < 6) {
      toast.error('Vui lòng nhập mã cuộc họp hợp lệ');
      return;
    }

    try {
      const response = await api.post(`/doctor-meetings/join/${joinCode}`);
      if (response.data.success) {
        toast.success('Đang tham gia cuộc họp...');
        // Open video room with meeting data
        setActiveVideoRoom({ 
          ...response.data.data,
          isMeeting: true 
        });
      }
    } catch (error) {
      console.error('Error joining meeting:', error);
      toast.error(error.response?.data?.message || 'Không thể tham gia cuộc họp');
    }
  };

  const handleToggleHospital = (hospitalId) => {
    setSelectedHospitals(prev => {
      if (prev.includes(hospitalId)) {
        return prev.filter(id => id !== hospitalId);
      } else {
        return [...prev, hospitalId];
      }
    });
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      toast.success('Đã sao chép mã cuộc họp!');
      setTimeout(() => setCopied(null), 2000);
    }).catch(err => {
      console.error('Failed to copy:', err);
      toast.error('Không thể sao chép mã');
    });
  };

  const handleEndMeeting = async (meetingId) => {
    if (!window.confirm('Bạn có chắc muốn kết thúc cuộc họp này?')) {
      return;
    }

    try {
      const response = await api.post(`/doctor-meetings/${meetingId}/end`);
      if (response.data.success) {
        toast.success('Đã kết thúc cuộc họp');
        fetchMeetings();
      }
    } catch (error) {
      console.error('Error ending meeting:', error);
      toast.error(error.response?.data?.message || 'Không thể kết thúc cuộc họp');
    }
  };

  const handleJoinMeeting = async (meeting) => {
    try {
      const response = await api.post(`/doctor-meetings/join/${meeting.roomCode}`);
      if (response.data.success) {
        setActiveVideoRoom({ 
          ...response.data.data,
          isMeeting: true 
        });
      }
    } catch (error) {
      console.error('Error joining meeting:', error);
      toast.error(error.response?.data?.message || 'Không thể tham gia cuộc họp');
    }
  };

  if (activeVideoRoom) {
    return (
      <VideoRoom 
        roomId={activeVideoRoom.meetingId || activeVideoRoom.roomName} 
        onClose={() => {
          setActiveVideoRoom(null);
          fetchMeetings();
        }} 
        userRole="doctor"
        meetingMode={true}
        initialToken={activeVideoRoom.token}
        initialRoomInfo={activeVideoRoom}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
            <FaVideo className="text-blue-600" />
            Cuộc Họp Nội Bộ
          </h1>
          <p className="text-gray-600">Tạo và tham gia các cuộc họp với các bác sĩ khác</p>
        </div>

        {/* Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Create Meeting Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaPlus className="text-green-500" />
              Tạo Cuộc Họp Mới
            </h3>
            
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <FaPlus />
                Tạo Cuộc Họp
              </button>
            ) : (
              <form onSubmit={handleCreateMeeting} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tiêu đề cuộc họp *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="VD: Họp bàn ca bệnh"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mô tả (tùy chọn)
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Thông tin thêm về cuộc họp..."
                  />
                </div>
                
                {/* Hospital Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <FaHospital className="inline mr-1" />
                    Chọn chi nhánh bệnh viện *
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-3 space-y-2">
                    {!Array.isArray(hospitals) || hospitals.length === 0 ? (
                      <p className="text-sm text-gray-500">Đang tải danh sách bệnh viện...</p>
                    ) : (
                      hospitals.map(hospital => (
                        <label key={hospital._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedHospitals.includes(hospital._id)}
                            onChange={() => handleToggleHospital(hospital._id)}
                            className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-700">{hospital.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedHospitals.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Đã chọn {selectedHospitals.length} chi nhánh
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md font-semibold transition-colors disabled:bg-gray-300"
                  >
                    {creating ? 'Đang tạo...' : 'Tạo'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setTitle('');
                      setDescription('');
                      setSelectedHospitals([]);
                    }}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-md transition-colors"
                  >
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Join by Code Card */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaVideo className="text-blue-500" />
              Tham Gia Cuộc Họp
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nhập mã cuộc họp
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
                      setJoinCode(value);
                      if (value.length >= 6) {
                        handleValidateCode(value);
                      } else {
                        setValidMeeting(null);
                      }
                    }}
                    placeholder="VD: M-ABC123"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase font-mono"
                  />
                  {validating && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                  {validMeeting && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <FaCheck className="text-green-500" />
                    </div>
                  )}
                </div>
              </div>

              {validMeeting && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="text-sm font-medium text-green-800 mb-1">Cuộc họp hợp lệ</p>
                  <div className="text-xs text-green-600 space-y-1">
                    <p><strong>Tiêu đề:</strong> {validMeeting.title}</p>
                    <p><strong>Người tổ chức:</strong> {validMeeting.organizer}</p>
                    <p><strong>Người tham gia:</strong> {validMeeting.participantCount}/{validMeeting.maxParticipants}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleJoinByCode}
                disabled={!validMeeting || joinCode.length < 6}
                className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-semibold transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FaVideo />
                Tham Gia Ngay
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 border-b-2 font-medium transition-colors ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Đang diễn ra
            </button>
            <button
              onClick={() => setActiveTab('ended')}
              className={`px-4 py-2 border-b-2 font-medium transition-colors ${
                activeTab === 'ended'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
            >
              Đã kết thúc
            </button>
          </nav>
        </div>

        {/* Meetings List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : (() => {
          const filteredMeetings = meetings.filter(meeting => {
            if (activeTab === 'active') {
              return meeting.status === 'waiting' || meeting.status === 'active';
            } else {
              return meeting.status === 'ended';
            }
          });

          if (filteredMeetings.length === 0) {
            return (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <FaVideo className="mx-auto text-gray-400 text-5xl mb-4" />
                <p className="text-gray-600">
                  {activeTab === 'active' ? 'Không có cuộc họp đang diễn ra' : 'Không có cuộc họp đã kết thúc'}
                </p>
              </div>
            );
          }

          return (
            <div className="grid gap-4">
              {filteredMeetings.map((meeting) => (
              <div key={meeting._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 mb-1">
                      {meeting.title}
                    </h3>
                    {meeting.description && (
                      <p className="text-gray-600 text-sm mb-2">{meeting.description}</p>
                    )}
                    
                    {/* Hospital Info */}
                    {meeting.hospitals && meeting.hospitals.length > 0 && (
                      <div className="mb-2 flex flex-wrap gap-2">
                        {meeting.hospitals.map((hospital, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
                            <FaHospital className="text-xs" />
                            {hospital.name || 'Bệnh viện'}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <div className="flex flex-wrap gap-3 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <FaUsers />
                        {meeting.organizer?.user?.fullName || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FaUsers className="text-green-600" />
                        {meeting.participants?.filter(p => !p.leftAt).length || 0} người tham gia
                      </span>
                      {meeting.startTime && (
                        <span className="flex items-center gap-1">
                          <FaClock />
                          {new Date(meeting.startTime).toLocaleString('vi-VN')}
                        </span>
                      )}
                      {meeting.duration > 0 && (
                        <span className="flex items-center gap-1">
                          <FaClock />
                          {meeting.duration} phút
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      meeting.status === 'active' ? 'bg-green-100 text-green-800' :
                      meeting.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {meeting.status === 'active' ? 'Đang diễn ra' :
                       meeting.status === 'waiting' ? 'Chờ bắt đầu' : 'Đã kết thúc'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Mã cuộc họp:</span>
                    <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm font-semibold text-blue-600">
                      {meeting.roomCode}
                    </code>
                    <button
                      onClick={() => handleCopyCode(meeting.roomCode)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                      title="Sao chép mã"
                    >
                      {copied === meeting.roomCode ? <FaCheck className="text-green-500" /> : <FaCopy />}
                    </button>
                  </div>

                  <div className="flex gap-2">
                    {meeting.status !== 'ended' && (
                      <>
                        <button
                          onClick={() => handleJoinMeeting(meeting)}
                          className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-semibold transition-colors flex items-center gap-2"
                        >
                          <FaVideo />
                          Tham gia
                        </button>
                        {/* Chỉ hiển thị nút kết thúc cho người tạo cuộc họp */}
                        {(() => {
                          const createdById = meeting.createdBy?._id 
                            ? (typeof meeting.createdBy._id === 'string' ? meeting.createdBy._id : meeting.createdBy._id.toString())
                            : (typeof meeting.createdBy === 'string' ? meeting.createdBy : null);
                          const organizerId = meeting.organizer?._id
                            ? (typeof meeting.organizer._id === 'string' ? meeting.organizer._id : meeting.organizer._id.toString())
                            : (typeof meeting.organizer === 'string' ? meeting.organizer : null);
                          
                          const isCreator = currentDoctorId && (
                            (createdById && createdById === currentDoctorId) ||
                            (organizerId && organizerId === currentDoctorId)
                          );
                          
                          return isCreator ? (
                            <button
                              onClick={() => handleEndMeeting(meeting._id)}
                              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold transition-colors flex items-center gap-2"
                            >
                              <FaTimes />
                              Kết thúc
                            </button>
                          ) : null;
                        })()}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </div>
    </div>
  );
};

export default DoctorMeetingHub;

