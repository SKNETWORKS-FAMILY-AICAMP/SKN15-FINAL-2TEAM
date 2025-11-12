import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Paper,
  List,
  ListItem,
  ListItemText,
  Grid,
  InputAdornment,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import StarIcon from '@mui/icons-material/Star';
import { ScheduleItem, SearchType, BudgetFilter, Location, Accommodation } from '../../types/planner';
import { mockAccommodations } from '../../data/mockData';
import placesAPI, { Place } from '../../services/placesAPI';

interface ScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (scheduleItem: ScheduleItem, dayNumber?: number) => void;
  dayNumber?: number;
  editItem?: ScheduleItem;
}

const ICONS = ['📍', '🏛️', '🍽️', '🛍️', '🌸', '🗼', '🏖️', '🏨', '🚗', '✈️'];

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  open,
  onClose,
  onSave,
  dayNumber,
  editItem,
}) => {
  const isEdit = !!editItem;

  // Form state
  const [selectedDay, setSelectedDay] = useState<number>(dayNumber || 1);
  const [time, setTime] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [selectedIcon, setSelectedIcon] = useState<string>('📍');
  const [budget, setBudget] = useState<string>('');

  // Travel info state
  const [travelTime, setTravelTime] = useState<string>('');
  const [travelDistance, setTravelDistance] = useState<string>('');
  const [travelMethod, setTravelMethod] = useState<string>('도보');

  // Search state
  const [searchType, setSearchType] = useState<SearchType>('location');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [budgetFilter, setBudgetFilter] = useState<BudgetFilter>('all');
  const [searchResults, setSearchResults] = useState<(Location | Accommodation)[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);

  // Initialize form with edit data
  useEffect(() => {
    if (editItem) {
      setTime(editItem.time || '');
      setLocation(editItem.location || '');
      setDescription(editItem.description || '');
      setSelectedIcon(editItem.icon || '📍');
      if (editItem.travel) {
        setTravelTime(editItem.travel.time || '');
        setTravelDistance(editItem.travel.distance || '');
        setTravelMethod(editItem.travel.method || '도보');
      }
    } else {
      // Reset form for new item
      setTime('');
      setLocation('');
      setDescription('');
      setSelectedIcon('📍');
      setBudget('');
      setTravelTime('');
      setTravelDistance('');
      setTravelMethod('도보');
    }
  }, [editItem, open]);

  // Load all places when modal opens for location search
  useEffect(() => {
    if (open && searchType === 'location' && !searchQuery) {
      loadAllPlaces();
    }
  }, [open, searchType]);

  const loadAllPlaces = async () => {
    try {
      // Load all places from database with pagination
      const response = await placesAPI.getPlaces({ limit: 100 });
      const results: Location[] = response.results.map((place: Place) => ({
        name: place.name,
        description: place.address,
        city: place.province,
        rating: place.rating ? parseFloat(place.rating) : undefined,
        reviews: place.user_ratings_total,
        placeData: place,
      }));
      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Failed to load places:', error);
    }
  };

  const handleSearchTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newType: SearchType | null
  ) => {
    if (newType !== null) {
      setSearchType(newType);
      setSearchQuery('');
      setSearchResults([]);
      setShowResults(false);
    }
  };

  const handleBudgetFilterChange = (filter: BudgetFilter) => {
    setBudgetFilter(filter);
  };

  const performSearch = async () => {
    if (!searchQuery.trim()) {
      setShowResults(false);
      return;
    }

    let results: (Location | Accommodation)[] = [];

    if (searchType === 'location') {
      // Search locations using Places API
      try {
        const places = await placesAPI.searchPlaces(searchQuery);

        // Convert Place to Location format
        results = places.map((place: Place) => ({
          name: place.name,
          description: place.address,
          city: place.province,
          rating: place.rating ? parseFloat(place.rating) : undefined,
          reviews: place.user_ratings_total,
          placeData: place, // Store original place data
        }));
      } catch (error) {
        console.error('Failed to search places:', error);
        alert('장소 검색에 실패했습니다. 다시 시도해주세요.');
      }
    } else {
      // Search accommodations (still using mock data)
      Object.keys(mockAccommodations).forEach((city) => {
        if (city.includes(searchQuery)) {
          let accommodations = mockAccommodations[city];

          // Apply budget filter
          if (budgetFilter !== 'all') {
            accommodations = accommodations.filter(
              (acc) => acc.budget === budgetFilter
            );
          }

          results = results.concat(
            accommodations.map((acc) => ({ ...acc, city }))
          );
        }
      });

      Object.keys(mockAccommodations).forEach((city) => {
        mockAccommodations[city].forEach((accommodation) => {
          if (
            accommodation.name.includes(searchQuery) &&
            !results.find((r) => r.name === accommodation.name)
          ) {
            // Apply budget filter
            if (budgetFilter === 'all' || accommodation.budget === budgetFilter) {
              results.push({ ...accommodation, city });
            }
          }
        });
      });
    }

    setSearchResults(results);
    setShowResults(true);
  };

  const handleSelectFromSearch = (item: Location | Accommodation) => {
    setLocation(item.name);
    setDescription(item.description || `${item.city}의 ${item.name}`);
    setSearchQuery('');
    setShowResults(false);

    // Auto-fill budget for accommodations
    if ('price' in item) {
      const priceNumber = item.price.replace(/[^0-9]/g, '');
      if (priceNumber) {
        setBudget(priceNumber);
      }
    }

    // Auto-select icon based on type
    let autoIcon = '📍';

    if ('type' in item) {
      // Accommodation
      autoIcon = '🏨';
    } else {
      // Location - match by keywords
      const iconMap: Record<string, string> = {
        궁: '🏛️',
        절: '🏛️',
        성당: '🏛️',
        박물관: '🏛️',
        시장: '🛍️',
        쇼핑: '🛍️',
        몰: '🛍️',
        맛집: '🍽️',
        레스토랑: '🍽️',
        카페: '🍽️',
        타워: '🗼',
        전망대: '🗼',
        해수욕장: '🏖️',
        해변: '🏖️',
        바다: '🏖️',
        호텔: '🏨',
        숙소: '🏨',
        펜션: '🏨',
        공항: '✈️',
        역: '🚗',
      };

      for (const [keyword, icon] of Object.entries(iconMap)) {
        if (item.name.includes(keyword)) {
          autoIcon = icon;
          break;
        }
      }
    }

    setSelectedIcon(autoIcon);
  };

  const handleSave = () => {
    if (!time || !location) {
      alert('시간과 장소는 필수 입력 항목입니다.');
      return;
    }

    const scheduleItem: ScheduleItem = {
      time,
      location,
      description: description || '상세 설명 없음',
      icon: selectedIcon,
    };

    // Add travel info if provided (only for new items)
    if (!isEdit && travelTime && travelDistance) {
      scheduleItem.travel = {
        time: travelTime,
        distance: travelDistance,
        method: travelMethod,
      };
    }

    onSave(scheduleItem, selectedDay);
    onClose();
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullScreen
      sx={{
        '& .MuiDialog-paper': {
          background: 'white',
        },
      }}
    >
      {/* Header */}
      <DialogTitle
        sx={{
          background: 'linear-gradient(135deg, #364C84)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px 25px',
        }}
      >
        <Typography variant="h6" fontWeight={600}>
          {isEdit ? '✏️ 일정 수정' : '➕ 새 일정 추가'}
        </Typography>
        <IconButton
          onClick={handleClose}
          sx={{
            color: 'white',
            background: 'rgba(255, 255, 255, 0.2)',
            '&:hover': {
              background: 'rgba(255, 255, 255, 0.3)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      {/* Body */}
      <DialogContent
        sx={{
          padding: '25px',
          maxHeight: 'calc(100vh - 140px)',
          overflowY: 'auto',
        }}
      >
        <Box sx={{ maxWidth: '700px', margin: '0 auto' }}>
          {/* Budget Summary */}
          <Paper
            elevation={0}
            sx={{
              background: '#f8f9fa',
              padding: '15px',
              borderRadius: '12px',
              marginBottom: '20px',
            }}
          >
            <Box sx={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <Typography variant="body2">☀️ 맑음 25°C</Typography>
              <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                💰 예상 비용:
                <TextField
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0"
                  size="small"
                  sx={{
                    width: '100px',
                    '& .MuiInputBase-root': {
                      background: 'transparent',
                    },
                    '& input': {
                      color: '#364C84',
                      fontWeight: 'bold',
                      padding: '4px 8px',
                    },
                    '& fieldset': {
                      border: 'none',
                    },
                  }}
                />
                원
              </Typography>
            </Box>
          </Paper>

          {/* Location/Accommodation Search Section */}
          <Paper
            elevation={0}
            sx={{
              border: '1px solid #e9ecef',
              borderRadius: '10px',
              padding: '20px',
              marginBottom: '20px',
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: '#364C84', marginBottom: '15px' }}
            >
              🔍 장소 & 숙소 검색
            </Typography>

            {/* Search Type Toggle */}
            <Box sx={{ marginBottom: '15px' }}>
              <ToggleButtonGroup
                value={searchType}
                exclusive
                onChange={handleSearchTypeChange}
                sx={{
                  '& .MuiToggleButton-root': {
                    borderRadius: '20px',
                    border: '2px solid #e9ecef',
                    padding: '8px 16px',
                    textTransform: 'none',
                    '&.Mui-selected': {
                      background: '#364C84',
                      color: 'white',
                      borderColor: '#364C84',
                      '&:hover': {
                        background: '#2d3f6f',
                      },
                    },
                  },
                }}
              >
                <ToggleButton value="location">🗺️ 관광지</ToggleButton>
                <ToggleButton value="accommodation">🏨 숙소</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {/* Search Input */}
            <Box sx={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
              <TextField
                fullWidth
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && performSearch()}
                placeholder={
                  searchType === 'location'
                    ? '장소를 검색해보세요 (예: 경복궁, 명동)'
                    : '숙소를 검색해보세요 (예: 도쿄, 호텔)'
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                onClick={performSearch}
                sx={{
                  background: '#364C84',
                  minWidth: '80px',
                  '&:hover': {
                    background: '#2d3f6f',
                  },
                }}
              >
                🔍
              </Button>
            </Box>

            {/* Budget Filters (for accommodations) */}
            {searchType === 'accommodation' && (
              <Box sx={{ marginBottom: '15px' }}>
                <Typography
                  variant="body2"
                  sx={{ marginBottom: '8px', color: '#666' }}
                >
                  예산대 (1박 기준)
                </Typography>
                <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Chip
                    label="💰 저렴"
                    onClick={() => handleBudgetFilterChange('low')}
                    sx={{
                      background: budgetFilter === 'low' ? '#364C84' : 'white',
                      color: budgetFilter === 'low' ? 'white' : '#495057',
                      border: '1px solid',
                      borderColor: budgetFilter === 'low' ? '#364C84' : '#dee2e6',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: '#364C84',
                        background: budgetFilter === 'low' ? '#2d3f6f' : '#f8f9fa',
                      },
                    }}
                  />
                  <Chip
                    label="💵 중급"
                    onClick={() => handleBudgetFilterChange('mid')}
                    sx={{
                      background: budgetFilter === 'mid' ? '#364C84' : 'white',
                      color: budgetFilter === 'mid' ? 'white' : '#495057',
                      border: '1px solid',
                      borderColor: budgetFilter === 'mid' ? '#364C84' : '#dee2e6',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: '#364C84',
                        background: budgetFilter === 'mid' ? '#2d3f6f' : '#f8f9fa',
                      },
                    }}
                  />
                  <Chip
                    label="💸 고급"
                    onClick={() => handleBudgetFilterChange('high')}
                    sx={{
                      background: budgetFilter === 'high' ? '#364C84' : 'white',
                      color: budgetFilter === 'high' ? 'white' : '#495057',
                      border: '1px solid',
                      borderColor: budgetFilter === 'high' ? '#364C84' : '#dee2e6',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: '#364C84',
                        background: budgetFilter === 'high' ? '#2d3f6f' : '#f8f9fa',
                      },
                    }}
                  />
                  <Chip
                    label="전체"
                    onClick={() => handleBudgetFilterChange('all')}
                    sx={{
                      background: budgetFilter === 'all' ? '#364C84' : 'white',
                      color: budgetFilter === 'all' ? 'white' : '#495057',
                      border: '1px solid',
                      borderColor: budgetFilter === 'all' ? '#364C84' : '#dee2e6',
                      cursor: 'pointer',
                      '&:hover': {
                        borderColor: '#364C84',
                        background: budgetFilter === 'all' ? '#2d3f6f' : '#f8f9fa',
                      },
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* Search Results */}
            {showResults && (
              <Box>
                <Typography
                  variant="body2"
                  sx={{ marginBottom: '8px', color: '#666', fontWeight: 600 }}
                >
                  {searchQuery ? `"${searchQuery}" 검색 결과` : '📍 전체 장소'} ({searchResults.length}개)
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    maxHeight: '300px',
                    overflowY: 'auto',
                    border: '1px solid #e9ecef',
                    borderRadius: '8px',
                  }}
                >
                  {searchResults.length === 0 ? (
                    <Box sx={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                      검색 결과가 없습니다
                    </Box>
                  ) : (
                  <List sx={{ padding: 0 }}>
                    {searchResults.map((item, index) => {
                      const isAccommodation = 'price' in item;
                      return (
                        <ListItem
                          key={index}
                          sx={{
                            borderBottom:
                              index < searchResults.length - 1
                                ? '1px solid #f0f0f0'
                                : 'none',
                            cursor: 'pointer',
                            '&:hover': {
                              background: '#f8f9fa',
                            },
                          }}
                        >
                          <ListItemText
                            primary={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography fontWeight={600} color="#333">
                                  {item.name}{' '}
                                  {isAccommodation && `(${(item as Accommodation).type})`}
                                </Typography>
                                {!isAccommodation && 'rating' in item && item.rating ? (
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <StarIcon sx={{ fontSize: 14, color: '#ffc107' }} />
                                    <Typography variant="caption" color="#666">
                                      {item.rating} ({item.reviews?.toLocaleString() || 0})
                                    </Typography>
                                  </Box>
                                ) : null}
                              </Box>
                            }
                            secondary={
                              <>
                                <Typography variant="body2" color="#666">
                                  {item.description}
                                </Typography>
                                <Typography variant="caption" color="#999">
                                  <LocationOnIcon sx={{ fontSize: 12, verticalAlign: 'middle' }} /> {item.city}
                                  {isAccommodation && (
                                    <span
                                      style={{
                                        marginLeft: '10px',
                                        color: '#364C84',
                                        fontWeight: 600,
                                      }}
                                    >
                                      {(item as Accommodation).price}
                                    </span>
                                  )}
                                </Typography>
                              </>
                            }
                          />
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleSelectFromSearch(item)}
                            sx={{
                              background: '#28a745',
                              '&:hover': {
                                background: '#218838',
                              },
                            }}
                          >
                            선택
                          </Button>
                        </ListItem>
                      );
                    })}
                  </List>
                )}
              </Paper>
              </Box>
            )}
          </Paper>

          {/* Schedule Form */}
          <Paper
            elevation={0}
            sx={{
              background: '#f8f9fa',
              padding: '20px',
              borderRadius: '12px',
            }}
          >
            <Typography
              variant="h6"
              sx={{ color: '#364C84', marginBottom: '20px' }}
            >
              📋 일정 정보
            </Typography>

            <Grid container spacing={2}>
              {/* Day Selection */}
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>날짜 선택</InputLabel>
                  <Select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(Number(e.target.value))}
                    label="날짜 선택"
                  >
                    {[1, 2, 3, 4, 5].map((day) => (
                      <MenuItem key={day} value={day}>
                        Day {day}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Time */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="시간"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {/* Location */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="장소명"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="장소명을 입력하세요"
                  InputProps={{
                    readOnly: true,
                  }}
                  sx={{
                    '& .MuiInputBase-root': {
                      background: '#f8f9fa',
                    },
                  }}
                  helperText="위 검색 기능을 사용하여 장소를 선택하세요"
                />
              </Grid>

              {/* Icon Selector */}
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ marginBottom: '10px' }}>
                  아이콘
                </Typography>
                <Box sx={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ICONS.map((icon) => (
                    <Box
                      key={icon}
                      onClick={() => setSelectedIcon(icon)}
                      sx={{
                        width: '45px',
                        height: '45px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '24px',
                        border: '2px solid',
                        borderColor: selectedIcon === icon ? '#364C84' : '#dee2e6',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: selectedIcon === icon ? '#e8ecf5' : 'white',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: '#364C84',
                          transform: 'scale(1.1)',
                        },
                      }}
                    >
                      {icon}
                    </Box>
                  ))}
                </Box>
              </Grid>

              {/* Description */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="상세 설명"
                  multiline
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="상세 설명을 입력하세요"
                />
              </Grid>

              {/* Travel Info (only for new items) */}
              {!isEdit && (
                <>
                  <Grid item xs={12}>
                    <Typography
                      variant="body2"
                      sx={{ marginBottom: '10px', fontWeight: 600 }}
                    >
                      이전 장소에서 이동시간 (선택사항)
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="이동시간"
                      value={travelTime}
                      onChange={(e) => setTravelTime(e.target.value)}
                      placeholder="예: 25분"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField
                      fullWidth
                      label="거리"
                      value={travelDistance}
                      onChange={(e) => setTravelDistance(e.target.value)}
                      placeholder="예: 12km"
                    />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl fullWidth>
                      <InputLabel>이동수단</InputLabel>
                      <Select
                        value={travelMethod}
                        onChange={(e) => setTravelMethod(e.target.value)}
                        label="이동수단"
                      >
                        <MenuItem value="도보">도보</MenuItem>
                        <MenuItem value="지하철">지하철</MenuItem>
                        <MenuItem value="버스">버스</MenuItem>
                        <MenuItem value="택시">택시</MenuItem>
                        <MenuItem value="자가용">자가용</MenuItem>
                        <MenuItem value="기타">기타</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </>
              )}
            </Grid>
          </Paper>
        </Box>
      </DialogContent>

      {/* Footer */}
      <DialogActions
        sx={{
          background: '#f8f9fa',
          padding: '20px 25px',
          gap: '12px',
        }}
      >
        <Button
          onClick={handleClose}
          sx={{
            background: '#f8f9fa',
            color: '#495057',
            border: '1px solid #dee2e6',
            padding: '12px 24px',
            fontWeight: 600,
            '&:hover': {
              background: '#e9ecef',
              borderColor: '#adb5bd',
            },
          }}
        >
          취소
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          sx={{
            background: 'linear-gradient(135deg, #364c84)',
            padding: '12px 24px',
            fontWeight: 600,
            boxShadow: '0 4px 12px rgba(54, 76, 132, 0.3)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 6px 16px rgba(54, 76, 132, 0.4)',
            },
          }}
        >
          {isEdit ? '수정하기' : '추가하기'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ScheduleModal;
