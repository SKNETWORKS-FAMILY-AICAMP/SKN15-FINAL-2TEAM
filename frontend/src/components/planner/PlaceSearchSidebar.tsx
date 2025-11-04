import React, { useState, useEffect } from 'react';
import {
  Drawer,
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
  Divider,
  Button,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import MapIcon from '@mui/icons-material/Map';
import placesAPI, { Place } from '../../services/placesAPI';

interface PlaceSearchSidebarProps {
  open: boolean;
  onClose: () => void;
  onPlaceAdd: (place: Place, time?: string) => void;
  selectedDay?: number;
}

export default function PlaceSearchSidebar({
  open,
  onClose,
  onPlaceAdd,
  selectedDay,
}: PlaceSearchSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);
  const [addTime, setAddTime] = useState('09:00');

  // 검색 실행
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      const results = await placesAPI.searchPlaces(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Enter 키 처리
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 장소 선택
  const handlePlaceClick = (place: Place) => {
    setSelectedPlace(place);
  };

  // 일정에 추가
  const handleAddToSchedule = () => {
    if (selectedPlace) {
      onPlaceAdd(selectedPlace, addTime);
      setSelectedPlace(null);
      setAddTime('09:00');
      // 검색 결과 유지 (계속 추가 가능)
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 450,
          bgcolor: '#fafafa',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 헤더 */}
        <Box
          sx={{
            p: 2,
            bgcolor: '#364C84',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MapIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              장소 검색
            </Typography>
          </Box>
          <IconButton onClick={onClose} sx={{ color: 'white' }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Day 표시 */}
        {selectedDay && (
          <Box
            sx={{
              p: 1.5,
              bgcolor: '#e3f2fd',
              borderBottom: '1px solid #ddd',
            }}
          >
            <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
              📅 Day {selectedDay}에 추가
            </Typography>
          </Box>
        )}

        {/* 검색창 */}
        <Box sx={{ p: 2, bgcolor: 'white', borderBottom: '1px solid #e0e0e0' }}>
          <TextField
            fullWidth
            placeholder="장소, 주소 검색 (예: 성산일출봉)"
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
                  borderColor: '#364C84',
                },
              },
            }}
          />
          <Button
            fullWidth
            variant="contained"
            onClick={handleSearch}
            disabled={!searchQuery.trim() || loading}
            sx={{
              mt: 1,
              bgcolor: '#364C84',
              '&:hover': { bgcolor: '#2a3a66' },
            }}
          >
            검색
          </Button>
        </Box>

        {/* 검색 결과 */}
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'white' }}>
          {searchResults.length === 0 && !loading && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: 200,
                color: '#999',
              }}
            >
              <SearchIcon sx={{ fontSize: 60, mb: 2, opacity: 0.3 }} />
              <Typography variant="body2">장소를 검색해보세요</Typography>
              <Typography variant="caption" sx={{ mt: 1, color: '#bbb' }}>
                예: 제주 성산일출봉, 서울 경복궁
              </Typography>
            </Box>
          )}

          <List sx={{ p: 0 }}>
            {searchResults.map((place, index) => (
              <React.Fragment key={place.place_idx}>
                <ListItem
                  button
                  onClick={() => handlePlaceClick(place)}
                  selected={selectedPlace?.place_idx === place.place_idx}
                  sx={{
                    py: 2,
                    px: 2,
                    '&:hover': {
                      bgcolor: '#f8f9fa',
                    },
                    '&.Mui-selected': {
                      bgcolor: '#e3f2fd',
                      borderLeft: '4px solid #364C84',
                      '&:hover': {
                        bgcolor: '#e3f2fd',
                      },
                    },
                  }}
                >
                  <Box sx={{ width: '100%' }}>
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

                    {/* 평점 */}
                    {place.rating && (
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Rating
                          value={typeof place.rating === 'string' ? parseFloat(place.rating) : place.rating}
                          readOnly
                          size="small"
                          precision={0.1}
                          sx={{ mr: 1 }}
                        />
                        <Typography variant="body2" color="text.secondary">
                          {(() => {
                            const rating = typeof place.rating === 'string' ? parseFloat(place.rating) : place.rating;
                            return rating.toFixed(1);
                          })()}
                          {place.user_ratings_total && (
                            <span style={{ marginLeft: 4 }}>
                              ({place.user_ratings_total.toLocaleString()})
                            </span>
                          )}
                        </Typography>
                      </Box>
                    )}

                    {/* 주소 */}
                    {place.address && (
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                        <LocationOnIcon
                          sx={{ fontSize: 16, color: '#888', mr: 0.5, mt: 0.3 }}
                        />
                        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                          {place.address}
                        </Typography>
                      </Box>
                    )}

                    {/* 카테고리 */}
                    {place.types && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {(() => {
                          const typesArray: string[] = Array.isArray(place.types) ? place.types : [place.types];
                          return typesArray.slice(0, 3).map((type: string, idx: number) => (
                            <Chip
                              key={idx}
                              label={type}
                              size="small"
                              sx={{
                                bgcolor: '#f0f0f0',
                                fontSize: '0.7rem',
                                height: 20,
                              }}
                            />
                          ));
                        })()}
                      </Box>
                    )}
                  </Box>
                </ListItem>
                {index < searchResults.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        </Box>

        {/* 선택된 장소 추가 패널 */}
        {selectedPlace && (
          <Paper
            elevation={8}
            sx={{
              p: 2,
              bgcolor: 'white',
              borderTop: '3px solid #364C84',
            }}
          >
            <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>
              ✅ 선택된 장소
            </Typography>

            <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
              {selectedPlace.ko_name || selectedPlace.name}
            </Typography>

            {selectedPlace.address && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                📍 {selectedPlace.address}
              </Typography>
            )}

            {/* 시간 선택 */}
            <TextField
              fullWidth
              type="time"
              label="시작 시간"
              value={addTime}
              onChange={(e) => setAddTime(e.target.value)}
              sx={{ mb: 2 }}
              InputLabelProps={{
                shrink: true,
              }}
            />

            {/* 추가 버튼 */}
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddToSchedule}
              sx={{
                bgcolor: '#364C84',
                py: 1.2,
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#2a3a66',
                },
              }}
            >
              {selectedDay ? `Day ${selectedDay} 일정에 추가` : '일정에 추가'}
            </Button>
          </Paper>
        )}
      </Box>
    </Drawer>
  );
}
