import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { FaStethoscope, FaUserMd, FaCalendarAlt, FaInfoCircle, FaArrowRight, FaSearch, FaFilter, FaChevronDown, FaTimes, FaSortAmountDown, FaHeartbeat, FaLungs, FaBrain, FaAmbulance, FaBaby, FaTooth, FaEye, FaFileMedicalAlt, FaNotesMedical, FaXRay, FaBone, FaAllergies, FaWheelchair, FaPills, FaProcedures, FaHandHoldingMedical, FaVial, FaHospital, FaDna } from 'react-icons/fa';
import { GiMedicines, GiDna1, GiMedicalPack, GiHealthNormal, GiHumanEar, GiHeartOrgan, GiChemicalDrop } from 'react-icons/gi';
import { MdLocalHospital, MdMedicalServices, MdBloodtype, MdOutlineVaccines } from 'react-icons/md';
import { IoNutritionOutline } from 'react-icons/io5';
import { SpecialtyCard } from '../../components/user';
import AOS from 'aos';
import 'aos/dist/aos.css';

// Hàm giúp lấy đúng icon component dựa trên tên icon
export const getIconComponent = (iconName) => {
  const iconMap = {
    'stethoscope': FaStethoscope,
    'heartbeat': FaHeartbeat,
    'lungs': FaLungs,
    'brain': FaBrain,
    'ambulance': FaAmbulance,
    'baby': FaBaby,
    'tooth': FaTooth,
    'eye': FaEye,
    'file-medical-alt': FaFileMedicalAlt,
    'notes-medical': FaNotesMedical,
    'x-ray': FaXRay,
    'bone': FaBone,
    'allergies': FaAllergies,
    'wheelchair': FaWheelchair,
    'pills': FaPills,
    'procedures': FaProcedures,
    'hand-holding-medical': FaHandHoldingMedical,
    'vial': FaVial,
    'user-md': FaUserMd,
    'hospital': FaHospital,
    'dna': FaDna,
    'gi-medicines': GiMedicines,
    'gi-dna': GiDna1,
    'gi-medical-pack': GiMedicalPack,
    'gi-health': GiHealthNormal,
    'gi-ear': GiHumanEar,
    'gi-heart': GiHeartOrgan,
    'gi-chemical': GiChemicalDrop,
    'md-hospital': MdLocalHospital,
    'md-medical': MdMedicalServices,
    'md-blood': MdBloodtype,
    'md-vaccines': MdOutlineVaccines,
    'io-nutrition': IoNutritionOutline
  };
  
  // Return the component if it exists in the map, otherwise return a default
  return iconMap[iconName?.toLowerCase()] || FaStethoscope;
};

const Specialties = () => {
  // State for data
  const [specialties, setSpecialties] = useState([]);
  const [filteredSpecialties, setFilteredSpecialties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorCount, setSelectedDoctorCount] = useState('');
  const [selectedServiceCount, setSelectedServiceCount] = useState('');
  const [selectedSort, setSelectedSort] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState(0);
  
  const navigate = useNavigate();

  // Initialize AOS animation library
  useEffect(() => {
    AOS.init({
      duration: 800,
      once: true,
      easing: 'ease-out-cubic'
    });
  }, []);

  useEffect(() => {
    const fetchSpecialties = async () => {
      setLoading(true);
      try {
        const response = await api.get('/specialties');
        console.log('Specialties data:', response.data);
        
        // Xử lý cả hai định dạng dữ liệu
        let specialtiesData = [];
        if (response.data) {
          if (Array.isArray(response.data.data)) {
            specialtiesData = response.data.data;
          } else if (response.data.data && response.data.data.specialties) {
            // Trường hợp cấu trúc mới: { data: { specialties: [...] } }
            specialtiesData = response.data.data.specialties;
          }
        }
        
        // Lọc chỉ hiển thị các chuyên khoa đang hoạt động (isActive=true)
        specialtiesData = specialtiesData.filter(specialty => specialty.isActive === true);
        
        // Fetch additional data for each specialty
        const enhancedSpecialties = await Promise.all(specialtiesData.map(async specialty => {
          try {
            // Fetch doctor count for this specialty
            const doctorsResponse = await api.get(`/appointments/specialties/${specialty._id}/doctors`);
            const doctorCount = Array.isArray(doctorsResponse.data.data) ? doctorsResponse.data.data.length : 0;
            
            // Fetch service count for this specialty
            const servicesResponse = await api.get(`/appointments/specialties/${specialty._id}/services`);
            const serviceCount = Array.isArray(servicesResponse.data.data) ? servicesResponse.data.data.length : 0;
            
            // Return enhanced specialty with real counts
            return {
              ...specialty,
              doctorCount,
              serviceCount,
              doctors: doctorsResponse.data.data || [],
              services: servicesResponse.data.data || [],
              commonServices: specialty.commonServices || []
            };
          } catch (error) {
            console.error(`Error fetching counts for specialty ${specialty._id}:`, error);
            // Return with fallback counts if API calls fail
          return {
            ...specialty,
            doctorCount: specialty.doctorCount || specialty.doctors?.length || 0,
              serviceCount: specialty.serviceCount || specialty.services?.length || 0,
            commonServices: specialty.commonServices || specialty.services?.slice(0, 5)?.map(s => s.name) || []
          };
          }
        }));
        
        setSpecialties(enhancedSpecialties);
        setFilteredSpecialties(enhancedSpecialties);
        setError(null);
      } catch (err) {
        console.error('Error fetching specialties:', err);
        setError('Không thể tải danh sách chuyên khoa. Vui lòng thử lại sau.');
      } finally {
        setLoading(false);
      }
    };

    fetchSpecialties();
  }, []);

  // Apply filters when filter values change
  useEffect(() => {
    if (!specialties.length) return;
    
    let filtered = [...specialties];
    
    // Apply search filter
    if (searchQuery.trim() !== '') {
      filtered = filtered.filter(specialty => 
        specialty.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (specialty.description && specialty.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Filter by doctor count
    if (selectedDoctorCount) {
      filtered = filtered.filter(specialty => {
        const doctorCount = specialty.doctorCount || 0;
        
        switch(selectedDoctorCount) {
          case 'high':
            return doctorCount >= 10;
          case 'medium':
            return doctorCount >= 5 && doctorCount < 10;
          case 'low':
            return doctorCount < 5;
          default:
            return true;
        }
      });
    }
    
    // Filter by service count
    if (selectedServiceCount) {
      filtered = filtered.filter(specialty => {
        const serviceCount = specialty.serviceCount || 0;
        
        switch(selectedServiceCount) {
          case 'high':
            return serviceCount >= 10;
          case 'medium':
            return serviceCount >= 5 && serviceCount < 10;
          case 'low':
            return serviceCount < 5;
          default:
            return true;
        }
      });
    }
    
    // Apply sorting
    if (selectedSort) {
      filtered.sort((a, b) => {
        switch(selectedSort) {
          case 'name-asc':
            return a.name.localeCompare(b.name);
          case 'name-desc':
            return b.name.localeCompare(a.name);
          case 'doctors-high':
            return (b.doctorCount || 0) - (a.doctorCount || 0);
          case 'services-high':
            return (b.serviceCount || 0) - (a.serviceCount || 0);
          default:
            return 0;
        }
      });
    }
    
    setFilteredSpecialties(filtered);
  }, [specialties, searchQuery, selectedDoctorCount, selectedServiceCount, selectedSort]);

  // Count active filters
  useEffect(() => {
    let count = 0;
    if (selectedDoctorCount) count++;
    if (selectedServiceCount) count++;
    if (selectedSort) count++;
    setActiveFilters(count);
  }, [selectedDoctorCount, selectedServiceCount, selectedSort]);

  // Handler functions
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleDoctorCountChange = (e) => {
    setSelectedDoctorCount(e.target.value);
  };

  const handleServiceCountChange = (e) => {
    setSelectedServiceCount(e.target.value);
  };

  const handleSortChange = (e) => {
    setSelectedSort(e.target.value);
  };

  const clearFilters = () => {
    setSelectedDoctorCount('');
    setSelectedServiceCount('');
    setSelectedSort('');
  };
  
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] p-4">
        <div className="inline-block w-10 h-10 border-4 border-gray-200 rounded-full border-l-primary animate-spin"></div>
        <p className="mt-4 text-gray-600">Đang tải danh sách chuyên khoa...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center max-w-2xl mx-auto my-8">
        <h2 className="text-2xl font-bold text-red-600 mb-3">Đã xảy ra lỗi!</h2>
        <p className="text-gray-700 mb-4">{error}</p>
        <button onClick={() => window.location.reload()} className="bg-primary text-white hover:bg-primary-dark px-4 py-2 rounded font-medium transition-all">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary to-blue-700 relative py-20 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <img 
            src="https://img.freepik.com/free-photo/doctors-stethoscopes-medical-uniform-medicine-health-care-concept_1150-14414.jpg"
            alt="Specialties background" 
            className="w-full h-full object-cover object-center opacity-20" 
          />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white" data-aos="fade-up">Chuyên Khoa</h1>
            <p className="text-xl opacity-90 mb-8" data-aos="fade-up" data-aos-delay="100">
              Khám phá các chuyên khoa y tế của chúng tôi và tìm hiểu thêm về các dịch vụ chăm sóc sức khỏe
            </p>
            <div className="relative max-w-xl mx-auto" data-aos="fade-up" data-aos-delay="200">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full bg-white/90 backdrop-blur-sm border-0 pl-10 pr-10 py-4 rounded-full shadow-lg focus:ring-2 focus:ring-primary-light placeholder-gray-500 text-gray-800"
                placeholder="Tìm kiếm chuyên khoa..."
                value={searchQuery}
                onChange={handleSearchChange}
              />
              {searchQuery && (
                <button 
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                  onClick={() => setSearchQuery('')}
                >
                  <span className="text-xl">&times;</span>
                </button>
              )}
            </div>
          </div>
        </div>
        <svg className="absolute bottom-0 left-0 w-full text-gray-50" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 100">
          <path fill="currentColor" fillOpacity="1" d="M0,32L80,42.7C160,53,320,75,480,74.7C640,75,800,53,960,48C1120,43,1280,53,1360,58.7L1440,64L1440,100L1360,100C1280,100,1120,100,960,100C800,100,640,100,480,100C320,100,160,100,80,100L0,100Z"></path>
        </svg>
      </section>

      <div className="container mx-auto px-4 py-12">
        <div className="mb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-blue-50 p-8 rounded-xl text-center shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300" data-aos="fade-up">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl shadow-md">
                <FaUserMd />
              </div>
              <h3 className="text-xl font-semibold text-blue-900 mb-3">Bác sĩ chuyên khoa</h3>
              <p className="text-gray-600 leading-relaxed">
                Đội ngũ y bác sĩ chuyên khoa giàu kinh nghiệm, được đào tạo bài bản
              </p>
            </div>
            
            <div className="bg-blue-50 p-8 rounded-xl text-center shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300" data-aos="fade-up" data-aos-delay="100">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl shadow-md">
                <FaStethoscope />
              </div>
              <h3 className="text-xl font-semibold text-blue-900 mb-3">Dịch vụ đa dạng</h3>
              <p className="text-gray-600 leading-relaxed">
                Đa dạng dịch vụ y tế, đáp ứng mọi nhu cầu chăm sóc sức khỏe
              </p>
            </div>
            
            <div className="bg-blue-50 p-8 rounded-xl text-center shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300" data-aos="fade-up" data-aos-delay="200">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-2xl shadow-md">
                <FaCalendarAlt />
              </div>
              <h3 className="text-xl font-semibold text-blue-900 mb-3">Đặt lịch dễ dàng</h3>
              <p className="text-gray-600 leading-relaxed">
                Đặt lịch khám trực tuyến nhanh chóng, thuận tiện và tiết kiệm thời gian
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <div className="flex items-center justify-between mb-6" data-aos="fade-up">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              <FaStethoscope className="text-primary mr-2" />
              Danh Sách Chuyên Khoa
            </h2>
            <div className="text-gray-600 flex items-center">
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full text-sm font-medium mr-2">{filteredSpecialties.length}</span>
              chuyên khoa
            </div>
          </div>
        </div>

        {filteredSpecialties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {filteredSpecialties.map((specialty, index) => (
              <div key={specialty._id} data-aos="fade-up" data-aos-delay={index % 3 * 100}>
                <SpecialtyCard specialty={specialty} />
              </div>
              ))}
            </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center mb-16">
            <h3 className="text-2xl text-gray-700 mb-4">Không tìm thấy chuyên khoa</h3>
            <p className="text-gray-600 mb-8">
              Không tìm thấy chuyên khoa nào phù hợp với tiêu chí tìm kiếm của bạn.
            </p>
            <button 
              onClick={() => {
                setSearchQuery('');
                clearFilters();
              }}
              className="bg-primary hover:bg-primary-dark text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center mx-auto"
            >
              <FaTimes className="mr-2" />
              Xóa bộ lọc
            </button>
          </div>
        )}

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-primary to-blue-700 rounded-xl p-8 md:p-12 text-white shadow-lg relative overflow-hidden" data-aos="fade-up" data-aos-delay="100">
          <div className="absolute inset-0 opacity-10">
            <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
              <defs>
                <pattern id="pattern" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <rect width="100%" height="100%" fill="none"/>
                  <circle cx="20" cy="20" r="1.5" fill="currentColor" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#pattern)" />
            </svg>
        </div>
          <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-4 text-white">Cần Tư Vấn Về Chuyên Khoa?</h2>
            <p className="text-lg opacity-90 mb-6 max-w-2xl">
              Liên hệ với chúng tôi để được tư vấn miễn phí và chọn đúng chuyên khoa phù hợp với tình trạng sức khỏe của bạn.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/appointment" className="bg-white text-primary hover:bg-gray-100 px-6 py-3 rounded-lg font-medium transition-all flex items-center">
                <FaCalendarAlt className="mr-2" /> Đặt Lịch Tư Vấn
              </Link>
              <Link to="/contact" className="bg-transparent border-2 border-white text-white hover:bg-white/10 px-6 py-3 rounded-lg font-medium transition-all">
                Liên Hệ Ngay
            </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Specialties; 
