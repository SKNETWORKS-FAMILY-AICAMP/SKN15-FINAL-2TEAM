import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
  Chip,
  Rating,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import StarIcon from '@mui/icons-material/Star';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import configAPI from '../services/configAPI';

declare global {
  interface Window {
    kakao: any;
  }
}

// Kakao Place Search Result Type
interface KakaoPlace {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  place_url: string;
  distance?: string;
}

// Convert to our Place format for compatibility
interface Place {
  place_idx?: number;
  place_id: string;
  name: string;
  ko_name?: string;
  country?: string;
  province?: string;
  city?: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: string;
  user_ratings_total?: number;
  types: string;
  phone?: string;
  place_url?: string;
}

// Schedule item from planner
interface ScheduleItem {
  time: string;
  location: string;
  description: string;
  icon: string;
  travel?: {
    method: string;
    time: string;
    distance: string;
  };
}

// Trip data structure
interface TripData {
  [dayNumber: number]: ScheduleItem[];
}

interface KakaoMapSearchProps {
  onPlaceSelect?: (place: Place) => void;
  onPlaceAdd?: (place: Place) => void; // + 버튼으로 장소 추가
  initialCenter?: { lat: number; lng: number };
  initialZoom?: number;
  recommendedPlaces?: string[]; // 챗봇이 추천한 장소명 리스트
  selectedDayNo?: number | null; // 선택된 Day 번호
  tripData?: TripData; // 일차별 계획 데이터
}

// Ref methods
export interface KakaoMapSearchHandle {
  search: (keyword: string) => void;
}

const KakaoMapSearch = forwardRef<KakaoMapSearchHandle, KakaoMapSearchProps>((props, ref) => {
  const {
    onPlaceSelect,
    onPlaceAdd,
    initialCenter = { lat: 33.450701, lng: 126.570667 },
    initialZoom = 10,
    recommendedPlaces = [],
    selectedDayNo = null,
    tripData = {},
  } = props;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);
  const [map, setMap] = useState<any>(null);
  const [markers, setMarkers] = useState<any[]>([]);
  const [recommendedMarkers, setRecommendedMarkers] = useState<any[]>([]); // 추천 장소 마커
  const [scheduleMarkers, setScheduleMarkers] = useState<any[]>([]); // 일정 장소 마커
  const [ps, setPs] = useState<any>(null); // Places Service

  const mapRef = useRef<HTMLDivElement>(null);

  // 카카오맵 초기화
  useEffect(() => {
    const initializeMap = async () => {
      try {
        // Get Kakao Map API Key from backend
        const config = await configAPI.getConfig();
        const apiKey = config.kakaoMapApiKey;

        if (!apiKey) {
          console.error('Kakao Map API key not found');
          return;
        }

        // Load Kakao Maps SDK with Places library
        if (!window.kakao || !window.kakao.maps) {
          const script = document.createElement('script');
          script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
          script.async = true;

          script.onload = () => {
            window.kakao.maps.load(() => {
              if (mapRef.current) {
                const mapOption = {
                  center: new window.kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
                  level: initialZoom,
                  // 줌/휠 컨트롤 개선
                  scrollwheel: true,
                  disableDoubleClick: false,
                  disableDoubleClickZoom: false,
                  draggable: true,
                };
                const kakaoMap = new window.kakao.maps.Map(mapRef.current, mapOption);

                // 부드러운 줌 애니메이션 활성화
                kakaoMap.setZoomable(true);

                // 타일 로딩 속도 개선을 위한 설정
                // 마우스 휠 줌 시 한 번에 1레벨씩만 변경 (기본값: 1)
                if (window.kakao.maps.event) {
                  window.kakao.maps.event.addListener(kakaoMap, 'zoom_changed', () => {
                    // 줌 변경 시 즉시 타일 로딩 (잔상 최소화)
                  });
                }

                setMap(kakaoMap);

                // Initialize Places service
                const placesService = new window.kakao.maps.services.Places();
                setPs(placesService);
                console.log('✅ Kakao Map and Places service initialized');
              }
            });
          };

          script.onerror = () => {
            console.error('Failed to load Kakao Maps SDK');
          };

          document.head.appendChild(script);
        } else {
          // SDK already loaded
          if (mapRef.current) {
            const mapOption = {
              center: new window.kakao.maps.LatLng(initialCenter.lat, initialCenter.lng),
              level: initialZoom,
              // 줌/휠 컨트롤 개선
              scrollwheel: true,
              disableDoubleClick: false,
              disableDoubleClickZoom: false,
              draggable: true,
            };
            const kakaoMap = new window.kakao.maps.Map(mapRef.current, mapOption);

            // 부드러운 줌 애니메이션 활성화
            kakaoMap.setZoomable(true);

            // 타일 로딩 속도 개선을 위한 설정
            if (window.kakao.maps.event) {
              window.kakao.maps.event.addListener(kakaoMap, 'zoom_changed', () => {
                // 줌 변경 시 즉시 타일 로딩 (잔상 최소화)
              });
            }

            setMap(kakaoMap);

            const placesService = new window.kakao.maps.services.Places();
            setPs(placesService);
          }
        }
      } catch (error) {
        console.error('Failed to initialize map:', error);
      }
    };

    initializeMap();
  }, [initialCenter.lat, initialCenter.lng, initialZoom]);

  // 챗봇이 추천한 장소들을 자동으로 검색하고 마커 표시
  useEffect(() => {
    if (!ps || !map || recommendedPlaces.length === 0) return;

    console.log('🤖 챗봇 추천 장소:', recommendedPlaces);

    // 기존 추천 마커 제거
    recommendedMarkers.forEach(marker => marker.setMap(null));
    const newRecommendedMarkers: any[] = [];

    // 각 추천 장소를 검색하고 마커 표시
    recommendedPlaces.forEach((placeName, index) => {
      ps.keywordSearch(placeName, (data: KakaoPlace[], status: any) => {
        if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
          const place = data[0]; // 첫 번째 결과 사용
          console.log(`✅ "${placeName}" 검색 성공:`, place.place_name);

          // 추천 마커는 다른 색상으로 표시
          const markerPosition = new window.kakao.maps.LatLng(
            parseFloat(place.y),
            parseFloat(place.x)
          );

          // 커스텀 마커 이미지 생성 (별 모양 또는 다른 색상)
          const imageSrc = 'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png';
          const imageSize = new window.kakao.maps.Size(24, 35);
          const markerImage = new window.kakao.maps.MarkerImage(imageSrc, imageSize);

          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            map: map,
            image: markerImage,
            title: place.place_name,
          });

          // 인포윈도우 생성
          const infowindow = new window.kakao.maps.InfoWindow({
            content: `<div style="padding:5px;font-size:12px;">🤖 ${place.place_name}</div>`,
          });

          // 마커 클릭 시 인포윈도우 표시 및 장소 선택
          window.kakao.maps.event.addListener(marker, 'click', () => {
            infowindow.open(map, marker);
            const convertedPlace = convertKakaoPlaceToPlace(place);
            handlePlaceClick(convertedPlace);
          });

          newRecommendedMarkers.push(marker);

          // 첫 번째 추천 장소로 지도 이동
          if (index === 0) {
            map.setCenter(markerPosition);
            map.setLevel(8); // 여러 장소를 볼 수 있도록 줌 아웃
          }
        } else {
          console.warn(`⚠️ "${placeName}" 검색 결과 없음`);
        }
      });
    });

    setRecommendedMarkers(newRecommendedMarkers);
  }, [recommendedPlaces, ps, map]);

  // 일정(tripData)의 장소들을 지도에 마커로 표시
  useEffect(() => {
    if (!ps || !map || !tripData || Object.keys(tripData).length === 0) return;

    console.log('📍 일정 장소 마커 표시:', tripData, 'selectedDayNo:', selectedDayNo);

    // 기존 일정 마커 제거
    scheduleMarkers.forEach((item: any) => {
      if (item.marker) item.marker.setMap(null);
      if (item.infowindow) item.infowindow.close();
    });
    const newScheduleMarkers: any[] = [];
    const bounds = new window.kakao.maps.LatLngBounds(); // 모든 마커를 포함하는 영역

    // tripData가 변경되었는지 확인 (selectedDayNo 변경만으로는 범위 조정 안 함)
    const shouldAdjustBounds = scheduleMarkers.length === 0 ||
      Object.keys(tripData).length !== scheduleMarkers.length;

    // Day별 색상 정의 (최대 7일까지 다른 색상)
    const dayColors = [
      '#FF6B6B', // Day 1: 빨강
      '#4ECDC4', // Day 2: 청록
      '#45B7D1', // Day 3: 하늘색
      '#FFA07A', // Day 4: 연한 주황
      '#98D8C8', // Day 5: 민트
      '#F7B731', // Day 6: 노랑
      '#5F27CD', // Day 7: 보라
    ];

    // 모든 Day의 일정 수집
    const allPlaces: { dayNo: number; schedule: ScheduleItem; index: number }[] = [];
    Object.keys(tripData).forEach(dayNoStr => {
      const dayNo = parseInt(dayNoStr);
      const schedules = tripData[dayNo];
      if (schedules && Array.isArray(schedules)) {
        schedules.forEach((schedule, index) => {
          if (schedule.location) {
            allPlaces.push({ dayNo, schedule, index });
          }
        });
      }
    });

    console.log(`📍 총 ${allPlaces.length}개 장소 마커 표시 예정, 범위 조정: ${shouldAdjustBounds}`);

    let markersCreated = 0;
    const totalMarkers = allPlaces.length;

    // 각 장소를 검색하고 마커 표시
    allPlaces.forEach(({ dayNo, schedule, index }) => {
      ps.keywordSearch(schedule.location, (data: KakaoPlace[], status: any) => {
        if (status === window.kakao.maps.services.Status.OK && data.length > 0) {
          const place = data[0]; // 첫 번째 결과 사용
          console.log(`✅ Day ${dayNo} "${schedule.location}" 검색 성공:`, place.place_name);

          const markerPosition = new window.kakao.maps.LatLng(
            parseFloat(place.y),
            parseFloat(place.x)
          );

          // bounds에 마커 위치 추가
          bounds.extend(markerPosition);

          // Day별 색상 선택 (선택된 Day는 강조)
          const dayColor = selectedDayNo === dayNo
            ? '#1976d2'
            : dayColors[(dayNo - 1) % dayColors.length];

          console.log(`🎨 Day ${dayNo} 색상: ${dayColor}, 선택된 Day: ${selectedDayNo}`);

          // 일정 마커 생성 (기본 마커 사용하지 않고 CustomOverlay로만 표시)
          // Day별 색상 마커를 CustomOverlay로 생성
          // 고유 ID 생성
          const markerId = `schedule-marker-${dayNo}-${index}`;

          const markerContent = `
            <div id="${markerId}" style="
              position: relative;
              width: 36px;
              height: 48px;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
            ">
              <svg width="36" height="48" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 0C8.059 0 0 8.059 0 18c0 13.5 18 30 18 30s18-16.5 18-30c0-9.941-8.059-18-18-18z"
                      fill="${dayColor}"
                      stroke="white"
                      stroke-width="2"/>
                <circle cx="18" cy="18" r="8" fill="white"/>
              </svg>
              <div style="
                position: absolute;
                top: 10px;
                left: 50%;
                transform: translateX(-50%);
                color: ${dayColor};
                font-weight: bold;
                font-size: 12px;
                text-shadow: 0 0 2px white;
                pointer-events: none;
              ">
                ${dayNo}
              </div>
            </div>
          `;

          const marker = new window.kakao.maps.CustomOverlay({
            position: markerPosition,
            content: markerContent,
            yAnchor: 1,
            zIndex: 2,
          });

          marker.setMap(map);

          // 인포윈도우 생성
          const infowindow = new window.kakao.maps.InfoWindow({
            position: markerPosition,
            content: `
              <div style="padding:10px;font-size:12px;min-width:150px;">
                <strong style="color: ${dayColor};">Day ${dayNo}</strong> - ${schedule.time}<br/>
                📍 ${place.place_name}<br/>
                <small>${place.address_name || ''}</small>
              </div>
            `,
          });

          // 마커가 지도에 추가된 후 클릭 이벤트 추가
          setTimeout(() => {
            const markerElement = document.getElementById(markerId);
            if (markerElement) {
              markerElement.addEventListener('click', () => {
                infowindow.open(map);
                map.setCenter(markerPosition);
                map.setLevel(4);
              });
            }
          }, 100);

          newScheduleMarkers.push({ marker, infowindow, position: markerPosition, dayNo });
          markersCreated++;

          // 모든 마커가 생성되면 지도 범위 조정
          if (markersCreated === totalMarkers) {
            console.log('📍 모든 마커 생성 완료, 지도 범위 조정');

            // selectedDayNo가 있으면 해당 Day만, 없으면 전체 표시
            if (selectedDayNo) {
              console.log(`🔍 Day ${selectedDayNo}의 마커만 표시`);
              const selectedDayBounds = new window.kakao.maps.LatLngBounds();
              let selectedDayMarkerCount = 0;

              newScheduleMarkers.forEach((item: any) => {
                if (item.dayNo === selectedDayNo && item.position) {
                  selectedDayBounds.extend(item.position);
                  selectedDayMarkerCount++;
                }
              });

              if (!selectedDayBounds.isEmpty()) {
                map.setBounds(selectedDayBounds);
                setTimeout(() => {
                  const currentLevel = map.getLevel();
                  // 마커가 1개면 적당히 줌인, 여러 개면 약간의 여유
                  if (selectedDayMarkerCount === 1) {
                    map.setLevel(4);
                  } else {
                    map.setLevel(currentLevel + 1);
                  }
                }, 100);
              }
            } else if (shouldAdjustBounds) {
              // Day가 선택되지 않았고 첫 로드나 일정 변경 시: 전체 마커 표시
              console.log('📍 전체 마커 표시');
              if (!bounds.isEmpty()) {
                map.setBounds(bounds);
                setTimeout(() => {
                  const currentLevel = map.getLevel();
                  map.setLevel(currentLevel + 1);
                }, 100);
              }
            }
          }
        } else {
          console.warn(`⚠️ Day ${dayNo} "${schedule.location}" 검색 결과 없음`);
          markersCreated++;

          // 검색 실패한 경우에도 카운트해서 범위 조정
          if (markersCreated === totalMarkers) {
            if (selectedDayNo) {
              const selectedDayBounds = new window.kakao.maps.LatLngBounds();
              let selectedDayMarkerCount = 0;

              newScheduleMarkers.forEach((item: any) => {
                if (item.dayNo === selectedDayNo && item.position) {
                  selectedDayBounds.extend(item.position);
                  selectedDayMarkerCount++;
                }
              });

              if (!selectedDayBounds.isEmpty()) {
                map.setBounds(selectedDayBounds);
                setTimeout(() => {
                  const currentLevel = map.getLevel();
                  if (selectedDayMarkerCount === 1) {
                    map.setLevel(4);
                  } else {
                    map.setLevel(currentLevel + 1);
                  }
                }, 100);
              }
            } else if (shouldAdjustBounds && !bounds.isEmpty()) {
              map.setBounds(bounds);
              setTimeout(() => {
                const currentLevel = map.getLevel();
                map.setLevel(currentLevel + 1);
              }, 100);
            }
          }
        }
      });
    });

    setScheduleMarkers(newScheduleMarkers);
  }, [tripData, ps, map, selectedDayNo]);

  // Kakao Place를 우리 Place 형식으로 변환
  const convertKakaoPlaceToPlace = (kakaoPlace: KakaoPlace): Place => {
    return {
      place_id: kakaoPlace.id,
      name: kakaoPlace.place_name,
      ko_name: kakaoPlace.place_name,
      address: kakaoPlace.road_address_name || kakaoPlace.address_name,
      latitude: parseFloat(kakaoPlace.y),
      longitude: parseFloat(kakaoPlace.x),
      types: kakaoPlace.category_name,
      phone: kakaoPlace.phone,
      place_url: kakaoPlace.place_url,
    };
  };

  // 검색 실행 - SDK Places 서비스 사용
  const handleSearch = () => {
    if (!searchQuery.trim() || !ps || !map) {
      console.log('검색 조건 미충족:', { searchQuery, ps: !!ps, map: !!map });
      return;
    }

    setLoading(true);

    // Kakao Places SDK로 키워드 검색
    ps.keywordSearch(searchQuery, (data: KakaoPlace[], status: any) => {
      setLoading(false);

      if (status === window.kakao.maps.services.Status.OK) {
        console.log('✅ 검색 성공:', data.length, '개 결과');

        // Kakao 결과를 우리 형식으로 변환
        const convertedResults = data.map(convertKakaoPlaceToPlace);
        setSearchResults(convertedResults);

        // 기존 마커 제거
        markers.forEach((item: any) => {
          if (item.marker) item.marker.setMap(null);
          if (item.label) item.label.setMap(null);
        });

        // 새 마커 생성 (검색 결과는 빨간색 기본 마커)
        const newMarkers = data.map((place: KakaoPlace, index: number) => {
          const markerPosition = new window.kakao.maps.LatLng(
            parseFloat(place.y),
            parseFloat(place.x)
          );

          // 기본 빨간색 마커 (검색 결과)
          const marker = new window.kakao.maps.Marker({
            position: markerPosition,
            map: map,
          });

          // 마커 클릭 이벤트
          const convertedPlace = convertKakaoPlaceToPlace(place);
          window.kakao.maps.event.addListener(marker, 'click', () => {
            handlePlaceClick(convertedPlace);
          });

          return { marker };
        });

        setMarkers(newMarkers);

        // 첫 번째 결과로 지도 이동
        if (data.length > 0) {
          const moveLatLon = new window.kakao.maps.LatLng(
            parseFloat(data[0].y),
            parseFloat(data[0].x)
          );
          map.setCenter(moveLatLon);
          map.setLevel(5);
        }
      } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
        console.log('⚠️ 검색 결과 없음');
        setSearchResults([]);
        markers.forEach((item: any) => {
          if (item.marker) item.marker.setMap(null);
          if (item.label) item.label.setMap(null);
        });
        setMarkers([]);
      } else {
        console.error('❌ 검색 실패:', status);
        setSearchResults([]);
      }
    });
  };

  // 장소 클릭
  const handlePlaceClick = (place: Place) => {
    setSelectedPlace(place);

    if (map && place.latitude && place.longitude) {
      const moveLatLon = new window.kakao.maps.LatLng(place.latitude, place.longitude);
      map.setCenter(moveLatLon);
      map.setLevel(5);
    }

    if (onPlaceSelect) {
      onPlaceSelect(place);
    }
  };

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Expose search function via ref
  useImperativeHandle(ref, () => ({
    search: (keyword: string) => {
      console.log('🗺️ External search triggered:', keyword);
      setSearchQuery(keyword);

      // Wait for searchQuery state to update, then search
      setTimeout(() => {
        if (!keyword.trim() || !ps || !map) {
          console.log('검색 조건 미충족:', { keyword, ps: !!ps, map: !!map });
          return;
        }

        setLoading(true);

        // Kakao Places SDK로 키워드 검색
        ps.keywordSearch(keyword, (data: KakaoPlace[], status: any) => {
          setLoading(false);

          if (status === window.kakao.maps.services.Status.OK) {
            console.log('✅ 검색 성공:', data.length, '개 결과');

            const convertedResults = data.map(convertKakaoPlaceToPlace);
            setSearchResults(convertedResults);

            markers.forEach((item: any) => {
              if (item.marker) item.marker.setMap(null);
              if (item.label) item.label.setMap(null);
            });

            const newMarkers = data.map((place: KakaoPlace, index: number) => {
              const markerPosition = new window.kakao.maps.LatLng(
                parseFloat(place.y),
                parseFloat(place.x)
              );

              // 기본 빨간색 마커 (검색 결과)
              const marker = new window.kakao.maps.Marker({
                position: markerPosition,
                map: map,
              });

              const convertedPlace = convertKakaoPlaceToPlace(place);
              window.kakao.maps.event.addListener(marker, 'click', () => {
                handlePlaceClick(convertedPlace);
              });

              return { marker };
            });

            setMarkers(newMarkers);

            if (data.length > 0) {
              const moveLatLon = new window.kakao.maps.LatLng(
                parseFloat(data[0].y),
                parseFloat(data[0].x)
              );
              map.setCenter(moveLatLon);
              map.setLevel(5);
            }
          } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
            console.log('⚠️ 검색 결과 없음');
            setSearchResults([]);
            markers.forEach((item: any) => {
              if (item.marker) item.marker.setMap(null);
              if (item.label) item.label.setMap(null);
            });
            setMarkers([]);
          } else {
            console.error('❌ 검색 실패:', status);
            setSearchResults([]);
          }
        });
      }, 100);
    }
  }));

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* 왼쪽 검색 패널 */}
      <Box
        sx={{
          width: 400,
          bgcolor: 'white',
          borderRight: '1px solid #e0e0e0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* 검색창 */}
        <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <TextField
            fullWidth
            placeholder="장소, 주소 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#888' }} />
                </InputAdornment>
              ),
              endAdornment: loading && (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                bgcolor: '#f5f5f5',
                '& fieldset': {
                  borderColor: 'transparent',
                },
                '&:hover fieldset': {
                  borderColor: '#ddd',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#1976d2',
                },
              },
            }}
          />
        </Box>

        {/* 검색 결과 리스트 */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {searchResults.length === 0 && !loading && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#999',
              }}
            >
              <SearchIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
              <Typography variant="body2">장소를 검색해보세요</Typography>
            </Box>
          )}

          <List sx={{ p: 0 }}>
            {searchResults.map((place, index) => (
              <React.Fragment key={place.place_id}>
                <ListItem
                  button
                  onClick={() => handlePlaceClick(place)}
                  selected={selectedPlace?.place_id === place.place_id}
                  sx={{
                    py: 2,
                    px: 2,
                    '&:hover': {
                      bgcolor: '#f8f9fa',
                    },
                    '&.Mui-selected': {
                      bgcolor: '#e3f2fd',
                      '&:hover': {
                        bgcolor: '#e3f2fd',
                      },
                    },
                  }}
                  secondaryAction={
                    selectedDayNo && onPlaceAdd ? (
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlaceAdd(place);
                        }}
                        sx={{
                          bgcolor: '#4CAF50',
                          color: 'white',
                          '&:hover': {
                            bgcolor: '#45a049',
                          },
                        }}
                      >
                        <AddCircleIcon />
                      </IconButton>
                    ) : null
                  }
                >
                  <Box sx={{ width: '100%', pr: selectedDayNo ? 6 : 0 }}>
                    {/* 장소명 */}
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 600,
                        color: '#333',
                        mb: 0.5,
                      }}
                    >
                      {place.ko_name || place.name}
                    </Typography>

                    {/* 카테고리 */}
                    {place.types && (
                      <Box sx={{ mb: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {place.types}
                        </Typography>
                      </Box>
                    )}

                    {/* 주소 */}
                    {place.address && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <LocationOnIcon sx={{ fontSize: 16, color: '#888', mr: 0.5 }} />
                        <Typography variant="body2" color="text.secondary">
                          {place.address}
                        </Typography>
                      </Box>
                    )}

                    {/* 전화번호 */}
                    {place.phone && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        📞 {place.phone}
                      </Typography>
                    )}
                  </Box>
                </ListItem>
                {index < searchResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Box>

        {/* 선택된 장소 정보 (하단) */}
        {selectedPlace && (
          <Paper
            elevation={3}
            sx={{
              p: 2,
              borderTop: '2px solid #1976d2',
              bgcolor: '#f8f9fa',
            }}
          >
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
              선택된 장소
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
              {selectedPlace.ko_name || selectedPlace.name}
            </Typography>
            {selectedPlace.address && (
              <Typography variant="body2" color="text.secondary">
                {selectedPlace.address}
              </Typography>
            )}
          </Paper>
        )}
      </Box>

      {/* 오른쪽 지도 */}
      <Box
        ref={mapRef}
        sx={{
          flex: 1,
          bgcolor: '#f0f0f0',
          // 하드웨어 가속 및 렌더링 최적화
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
          WebkitFontSmoothing: 'antialiased',
          // 잔상 방지 - transition 제거!
        }}
      />
    </Box>
  );
});

KakaoMapSearch.displayName = 'KakaoMapSearch';

export default KakaoMapSearch;
