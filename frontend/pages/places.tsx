import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  TextField,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Box,
  Chip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Rating,
  CircularProgress,
  Pagination,
  Stack,
  IconButton,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import StarIcon from '@mui/icons-material/Star';
import MapIcon from '@mui/icons-material/Map';
import FilterListIcon from '@mui/icons-material/FilterList';
import placesAPI, { Place } from '../src/services/placesAPI';

const PlacesPage = () => {
  const [places, setPlaces] = useState<Place[]>([]);
  const [popularPlaces, setPopularPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [region1Filter, setRegion1Filter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [minRating, setMinRating] = useState<number | ''>('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const itemsPerPage = 12;

  // Load popular places on mount
  useEffect(() => {
    loadPopularPlaces();
  }, []);

  // Load places when filters change
  useEffect(() => {
    loadPlaces();
  }, [page, region1Filter, typeFilter, minRating]);

  const loadPopularPlaces = async () => {
    try {
      const data = await placesAPI.getPopularPlaces(10);
      setPopularPlaces(data);
    } catch (error) {
      console.error('Failed to load popular places:', error);
    }
  };

  const loadPlaces = async () => {
    try {
      setLoading(true);
      const params: any = {
        limit: itemsPerPage,
        page: page,
      };

      if (region1Filter) params.region1 = region1Filter;
      if (typeFilter) params.type = typeFilter;
      if (minRating) params.min_rating = minRating;

      const data = await placesAPI.getPlaces(params);
      setPlaces(data.results);
      setTotalCount(data.count);
    } catch (error) {
      console.error('Failed to load places:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadPlaces();
      return;
    }

    try {
      setLoading(true);
      const data = await placesAPI.searchPlaces(searchQuery);
      setPlaces(data);
      setTotalCount(data.length);
      setPage(1);
    } catch (error) {
      console.error('Failed to search places:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getPlaceTypes = (types: string): string[] => {
    return types.split(',').map(t => t.trim()).slice(0, 3);
  };

  const getTypeLabel = (type: string): string => {
    const typeLabels: { [key: string]: string } = {
      'tourist_attraction': '관광지',
      'restaurant': '맛집',
      'museum': '박물관',
      'park': '공원',
      'historical_landmark': '역사 유적',
      'cultural_landmark': '문화재',
      'amusement_park': '놀이공원',
      'market': '시장',
      'point_of_interest': '명소',
      'establishment': '시설',
    };
    return typeLabels[type] || type;
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold" color="primary">
          여행지 탐색
        </Typography>
        <Typography variant="h6" color="text.secondary">
          {totalCount.toLocaleString()}개의 여행지를 찾아보세요
        </Typography>
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="여행지 이름, 주소를 검색하세요 (예: 경복궁, 부산)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleSearchKeyPress}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Tooltip title="필터">
                  <IconButton onClick={() => setShowFilters(!showFilters)}>
                    <FilterListIcon />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backgroundColor: 'white',
            },
          }}
        />
      </Box>

      {/* Filters */}
      {showFilters && (
        <Box sx={{ mb: 4, p: 3, backgroundColor: '#f5f5f5', borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>지역</InputLabel>
                <Select
                  value={region1Filter}
                  label="지역"
                  onChange={(e) => {
                    setRegion1Filter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value="Seoul">서울</MenuItem>
                  <MenuItem value="Busan">부산</MenuItem>
                  <MenuItem value="Incheon">인천</MenuItem>
                  <MenuItem value="Daegu">대구</MenuItem>
                  <MenuItem value="Gyeonggi">경기</MenuItem>
                  <MenuItem value="Gangwon">강원</MenuItem>
                  <MenuItem value="Jeju">제주</MenuItem>
                  <MenuItem value="Gyeongsangbuk">경상북도</MenuItem>
                  <MenuItem value="Gyeongsangnam">경상남도</MenuItem>
                  <MenuItem value="Jeollabuk">전라북도</MenuItem>
                  <MenuItem value="Jeollanam">전라남도</MenuItem>
                  <MenuItem value="Chungcheongbuk">충청북도</MenuItem>
                  <MenuItem value="Chungcheongnam">충청남도</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>유형</InputLabel>
                <Select
                  value={typeFilter}
                  label="유형"
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value="tourist_attraction">관광지</MenuItem>
                  <MenuItem value="restaurant">맛집</MenuItem>
                  <MenuItem value="museum">박물관</MenuItem>
                  <MenuItem value="park">공원</MenuItem>
                  <MenuItem value="historical_landmark">역사 유적</MenuItem>
                  <MenuItem value="cultural_landmark">문화재</MenuItem>
                  <MenuItem value="amusement_park">놀이공원</MenuItem>
                  <MenuItem value="market">시장</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>최소 평점</InputLabel>
                <Select
                  value={minRating}
                  label="최소 평점"
                  onChange={(e) => {
                    setMinRating(e.target.value as number);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">전체</MenuItem>
                  <MenuItem value={3.0}>3.0 이상</MenuItem>
                  <MenuItem value={3.5}>3.5 이상</MenuItem>
                  <MenuItem value={4.0}>4.0 이상</MenuItem>
                  <MenuItem value={4.5}>4.5 이상</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Popular Places */}
      {!searchQuery && popularPlaces.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mb: 2 }}>
            🔥 인기 여행지
          </Typography>
          <Grid container spacing={2}>
            {popularPlaces.map((place) => (
              <Grid item xs={12} sm={6} md={4} lg={2.4} key={place.place_idx}>
                <Card
                  sx={{
                    height: '100%',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4,
                    },
                  }}
                >
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="body1" fontWeight="bold" noWrap>
                      {place.name}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                      <StarIcon sx={{ fontSize: 16, color: '#ffc107' }} />
                      <Typography variant="body2" color="text.secondary">
                        {place.rating || 'N/A'} ({place.user_ratings_total.toLocaleString()})
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                      {place.region1}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* Places Grid */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : places.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="text.secondary">
            검색 결과가 없습니다
          </Typography>
        </Box>
      ) : (
        <>
          <Grid container spacing={3}>
            {places.map((place) => (
              <Grid item xs={12} sm={6} md={4} key={place.place_idx}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: 6,
                    },
                  }}
                >
                  {/* Placeholder Image */}
                  <Box
                    sx={{
                      height: 200,
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MapIcon sx={{ fontSize: 60, color: 'white', opacity: 0.5 }} />
                  </Box>

                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom fontWeight="bold">
                      {place.name}
                    </Typography>

                    {/* Rating */}
                    {place.rating && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Rating value={parseFloat(place.rating)} precision={0.1} size="small" readOnly />
                        <Typography variant="body2" color="text.secondary">
                          {place.rating} ({place.user_ratings_total.toLocaleString()})
                        </Typography>
                      </Box>
                    )}

                    {/* Location */}
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, mb: 2 }}>
                      <LocationOnIcon sx={{ fontSize: 18, color: 'text.secondary', mt: 0.2 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.4 }}>
                        {place.address}
                      </Typography>
                    </Box>

                    {/* Types */}
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {getPlaceTypes(place.types).map((type, index) => (
                        <Chip
                          key={index}
                          label={getTypeLabel(type)}
                          size="small"
                          sx={{ fontSize: '0.7rem', height: 24 }}
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={(e, value) => setPage(value)}
                color="primary"
                size="large"
              />
            </Box>
          )}
        </>
      )}
    </Container>
  );
};

export default PlacesPage;
