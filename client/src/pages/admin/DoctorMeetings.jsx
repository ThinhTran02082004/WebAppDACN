import React, { useState, useEffect } from 'react';
import { FaVideo, FaUsers, FaClock, FaTimes, FaSearch, FaFilter, FaUserTimes, FaSignInAlt, FaSync } from 'react-icons/fa';
import { toast } from 'react-toastify';
import api from '../../utils/api';
import { useSocket } from '../../context/SocketContext';
import VideoRoom from '../../components/VideoRoom/VideoRoom';
import moment from 'moment';
import 'moment/locale/vi';

moment.locale('vi');

const DoctorMeetings = () => {
  const { socket } = useSocket();
  const [meetings, setMeetings] = useState([]);
  const [activeMeetings, setActiveMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // all, live
  const [filter, setFilter] = useState('all'); // all, active, ended
  const [searchTerm, setSearchTerm] = useState('');
  const [hospitalFilter, setHospitalFilter] = useState('all');
  const [hospitals, setHospitals] = useState([]);
  
  // Video room state
  const [showVideoRoom, setShowVideoRoom] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [joinToken, setJoinToken] = useState(null);
  const [joinRoomInfo, setJoinRoomInfo] = useState(null);

  useEffect(() => {
    fetchHospitals();
    if (activeTab === 'all') {
      fetchMeetings();
    } else if (activeTab === 'live') {
      fetchActiveMeetings();
    }
  }, [filter, activeTab]);

  // Socket.io real-time updates
  useEffect(() => {
    if (!socket) return;

    const handleMeetingCreated = (data) => {
      if (data.meeting) {
        setMeetings(prev => [data.meeting, ...prev]);
        toast.info(`Cuộc họp mới: ${data.meeting.title}`);
      }
    };

    const handleMeetingUpdated = (data) => {
      if (data.meeting) {
        setMeetings(prev => 
          prev.map(m => m._id === data.meeting._id ? { ...m, ...data.meeting } : m)
        );
      }
    };

    const handleMeetingEnded = (data) => {
      if (data.meeting) {
        setMeetings(prev => 
          prev.map(m => m._id === data.meeting._id ? { ...m, status: 'ended', endTime: data.endTime, duration: data.duration } : m)
        );
        toast.info('Một cuộc họp đã kết thúc');
      }
    };

    socket.on('meeting_created', handleMeetingCreated);
    socket.on('meeting_updated', handleMeetingUpdated);
    socket.on('meeting_ended', handleMeetingEnded);

    return () => {
      socket.off('meeting_created', handleMeetingCreated);
      socket.off('meeting_updated', handleMeetingUpdated);
      socket.off('meeting_ended', handleMeetingEnded);
    };
  }, [socket]);

  const fetchHospitals = async () => {
    try {
      const response = await api.get('/hospitals?limit=1000&isActive=true');
      if (response.data.success) {
        const hospitalData = response.data.data?.hospitals || [];
        setHospitals(Array.isArray(hospitalData) ? hospitalData : []);
      }
    } catch (error) {
      console.error('Error fetching hospitals:', error);
    }
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      let url = '/doctor-meetings/all';
      
      if (filter === 'active') {
        url += '?status=active,waiting';
      } else if (filter === 'ended') {
        url += '?status=ended';
      }

      const response = await api.get(url);
      if (response.data.success) {
        const data = Array.isArray(response.data.data) ? response.data.data : [];
        setMeetings(data);
      }
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast.error('Không thể tải danh sách cuộc họp');
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveMeetings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/doctor-meetings/active-rooms');
      if (response.data.success) {
        const data = Array.isArray(response.data.data) ? response.data.data : [];
        setActiveMeetings(data);
      }
    } catch (error) {
      console.error('Error fetching active meetings:', error);
      toast.error('Không thể tải danh sách phòng hoạt động');
    } finally {
      setLoading(false);
    }
  };

  const handleEndMeeting = async (meetingId) => {
    if (!window.confirm('Bạn có chắc muốn kết thúc cuộc họp này không?')) {
      return;
    }

    try {
      const response = await api.post(`/doctor-meetings/${meetingId}/end`);
      if (response.data.success) {
        toast.success('Đã kết thúc cuộc họp');
        if (activeTab === 'all') {
          fetchMeetings();
        } else {
          fetchActiveMeetings();
        }
      }
    } catch (error) {
      console.error('Error ending meeting:', error);
      toast.error(error.response?.data?.message || 'Không thể kết thúc cuộc họp');
    }
  };

  const handleJoinMeeting = async (meetingId, roomCode) => {
    try {
      const response = await api.post(`/doctor-meetings/join/${roomCode}`);
      if (response.data.success) {
        setJoinToken(response.data.data.token);
        setJoinRoomInfo(response.data.data);
        setSelectedMeeting(meetingId);
        setShowVideoRoom(true);
      }
    } catch (error) {
      console.error('Error joining meeting:', error);
      toast.error(error.response?.data?.message || 'Không thể tham gia cuộc họp');
    }
  };

  const handleRemoveParticipant = async (roomName, participantIdentity) => {
    if (!window.confirm('Bạn có chắc muốn kick người tham gia này?')) {
      return;
    }

    try {
      const response = await api.post('/doctor-meetings/admin/remove-participant', {
        roomName,
        participantIdentity
      });

      if (response.data.success) {
        toast.success('Đã kick người tham gia');
        fetchActiveMeetings();
      }
    } catch (error) {
      console.error('Error removing participant:', error);
      toast.error('Không thể kick người tham gia');
    }
  };

  const handleCloseVideoRoom = () => {
    setShowVideoRoom(false);
    setSelectedMeeting(null);
    setJoinToken(null);
    setJoinRoomInfo(null);
    if (activeTab === 'all') {
      fetchMeetings();
    } else {
      fetchActiveMeetings();
    }
  };

  const filteredMeetings = meetings.filter(meeting => {
    const matchSearch = 
      !searchTerm || 
      meeting.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      meeting.roomCode?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchHospital = 
      hospitalFilter === 'all' ||
      meeting.hospitals?.some(h => h._id === hospitalFilter);

    return matchSearch && matchHospital;
  });

  // Show video room if active
  if (showVideoRoom && joinToken && joinRoomInfo) {
    return (
      <VideoRoom
        roomId={selectedMeeting}
        onClose={handleCloseVideoRoom}
        userRole="admin"
        meetingMode={true}
        initialToken={joinToken}
        initialRoomInfo={joinRoomInfo}
      />
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-2">
              <FaVideo className="text-blue-600" />
              Quản Lý Cuộc Họp Bác Sĩ
            </h1>
            <p className="text-gray-600">Theo dõi và quản lý các cuộc họp nội bộ của bác sĩ</p>
          </div>
          <button
            onClick={() => activeTab === 'all' ? fetchMeetings() : fetchActiveMeetings()}
            className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-2"
          >
            <FaSync />
            Làm mới
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'all' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Tất cả phòng
          </button>
          <button
            onClick={() => setActiveTab('live')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'live' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Phòng đang hoạt động
          </button>
        </div>

        {/* Filters - Only for "all" tab */}
        {activeTab === 'all' && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FaSearch className="inline mr-1" />
                  Tìm kiếm
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tiêu đề hoặc mã phòng..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <FaFilter className="inline mr-1" />
                  Trạng thái
                </label>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Tất cả</option>
                  <option value="active">Đang diễn ra</option>
                  <option value="ended">Đã kết thúc</option>
                </select>
              </div>

              {/* Hospital Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chi nhánh
                </label>
                <select
                  value={hospitalFilter}
                  onChange={(e) => setHospitalFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">Tất cả chi nhánh</option>
                  {hospitals.map(hospital => (
                    <option key={hospital._id} value={hospital._id}>
                      {hospital.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Content based on active tab */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : activeTab === 'all' ? (
          // All meetings list
          filteredMeetings.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FaVideo className="mx-auto text-gray-400 text-5xl mb-4" />
              <p className="text-gray-600">
                {filter === 'active' ? 'Không có cuộc họp đang diễn ra' : 
                 filter === 'ended' ? 'Không có cuộc họp đã kết thúc' : 
                 'Không có cuộc họp nào'}
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
            {filteredMeetings.map((meeting) => (
              <div key={meeting._id} className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-800">
                        {meeting.title}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        meeting.status === 'active' ? 'bg-green-100 text-green-800' :
                        meeting.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {meeting.status === 'active' ? 'Đang diễn ra' :
                         meeting.status === 'waiting' ? 'Chờ bắt đầu' : 'Đã kết thúc'}
                      </span>
                    </div>

                    {meeting.description && (
                      <p className="text-gray-600 text-sm mb-3">{meeting.description}</p>
                    )}

                    {/* Hospital Tags */}
                    {meeting.hospitals && meeting.hospitals.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {meeting.hospitals.map((hospital, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-md text-xs">
                            {hospital.name || 'Bệnh viện'}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <span className="flex items-center gap-1">
                        <FaUsers />
                        Tổ chức: {meeting.organizer?.user?.fullName || meeting.createdBy?.user?.fullName || 'N/A'}
                      </span>
                      <span className="flex items-center gap-1">
                        <FaUsers className="text-green-600" />
                        {meeting.activeParticipantCount || meeting.participants?.filter(p => !p.leftAt).length || 0} người tham gia
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
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Mã cuộc họp:</span>
                    <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm font-semibold text-blue-600">
                      {meeting.roomCode}
                    </code>
                  </div>

                  {meeting.status !== 'ended' && (
                    <button
                      onClick={() => handleEndMeeting(meeting._id)}
                      className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md font-semibold transition-colors flex items-center gap-2"
                    >
                      <FaTimes />
                      Kết thúc cuộc họp
                    </button>
                  )}
                </div>

                {/* Participants List */}
                {meeting.participants && meeting.participants.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">
                      Danh sách người tham gia ({meeting.participants.length}):
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {meeting.participants.map((participant, idx) => (
                        <div key={idx} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded text-sm">
                          <span className="text-gray-700">
                            {participant.doctorId?.user?.fullName || 'Bác sĩ'}
                          </span>
                          {participant.leftAt ? (
                            <span className="text-xs text-red-600">Đã rời</span>
                          ) : (
                            <span className="text-xs text-green-600">Đang tham gia</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          )
        ) : (
          // Live meetings list
          activeMeetings.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <FaVideo className="mx-auto text-gray-400 text-5xl mb-4" />
              <p className="text-gray-600">Không có phòng nào đang hoạt động</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeMeetings.map((room) => (
                <div key={room.sid || room._id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-md">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900 text-lg">{room.name || room.title}</h4>
                      {room.roomCode && (
                        <p className="text-sm text-gray-500 mt-1">
                          Mã phòng: <code className="px-2 py-1 bg-gray-100 rounded font-mono text-sm font-semibold text-blue-600">{room.roomCode}</code>
                        </p>
                      )}
                      <p className="text-sm text-gray-500">
                        Tạo lúc: {moment((room.creationTime || room.startTime) * 1000).format('HH:mm:ss DD/MM/YYYY')}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        <FaUsers className="mr-1" />
                        {room.numParticipants || room.participants?.length || 0} người
                      </span>
                      <button
                        onClick={() => handleJoinMeeting(room._id || room.meetingId, room.roomCode)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm gap-2"
                        title="Tham gia phòng với quyền Admin"
                      >
                        <FaSignInAlt />
                        Tham gia
                      </button>
                      <button
                        onClick={() => handleEndMeeting(room._id || room.meetingId)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center text-sm gap-2"
                        title="Kết thúc cuộc họp"
                      >
                        <FaTimes />
                        Kết thúc
                      </button>
                    </div>
                  </div>

                  {/* Participants */}
                  {room.participants && room.participants.length > 0 && (
                    <div className="border-t border-gray-200 pt-3 mt-3">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Người tham gia:</h5>
                      <div className="space-y-2">
                        {room.participants.map((participant, idx) => (
                          <div key={participant.sid || idx} className="flex justify-between items-center bg-gray-50 rounded p-2">
                            <div>
                              <span className="font-medium text-sm">{participant.name || participant.doctorId?.user?.fullName || 'Unknown'}</span>
                              {participant.identity && (
                                <span className="ml-2 text-xs text-gray-500">
                                  (ID: {participant.identity})
                                </span>
                              )}
                              {participant.joinedAt && (
                                <div className="text-xs text-gray-400">
                                  Tham gia: {moment((participant.joinedAt * 1000) || participant.joinedAt).format('HH:mm:ss')}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveParticipant(room.name || room.roomName, participant.identity)}
                              className="text-red-600 hover:text-red-900 px-3 py-1 hover:bg-red-50 rounded transition-colors"
                              title="Kick khỏi phòng"
                            >
                              <FaUserTimes className="inline mr-1" />
                              Kick
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
    </div>
  );
};

export default DoctorMeetings;

