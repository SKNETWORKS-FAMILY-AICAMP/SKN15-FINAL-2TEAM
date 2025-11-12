import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import travelInfoAPI, { WeatherDaily, ExchangeRate, TripAlert } from '../../services/travelInfoAPI';

interface TravelInfoCardProps {
  countryCode?: number;
  provinceIdx?: number;
  cityIdx?: number;
  districtIdx?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  weatherOnly?: boolean;
}

const TravelInfoCard: React.FC<TravelInfoCardProps> = ({
  countryCode,
  provinceIdx,
  cityIdx,
  districtIdx,
  startDate,
  endDate,
  weatherOnly = false,
}) => {
  const [weather, setWeather] = useState<WeatherDaily[]>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate[]>([]);
  const [travelAlert, setTravelAlert] = useState<TripAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTravelInfo = async () => {
      if (!countryCode && !provinceIdx) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch weather if location and dates are available
        if (provinceIdx && startDate && endDate) {
          try {
            // Format date without timezone issues (use local date)
            const formatLocalDate = (date: Date) => {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              return `${year}-${month}-${day}`;
            };

            const startDateStr = formatLocalDate(startDate);
            const endDateStr = formatLocalDate(endDate);

            console.log('🌤️ Fetching weather:', {
              provinceIdx,
              cityIdx,
              districtIdx,
              startDate: startDateStr,
              endDate: endDateStr
            });
            const weatherData = await travelInfoAPI.getWeatherByLocation(
              provinceIdx,
              cityIdx || undefined,
              districtIdx || undefined,
              startDateStr,
              endDateStr
            );
            console.log('🌤️ Weather data received:', weatherData.length, 'records');
            console.log('🌤️ Dates in response:', weatherData.map(d => d.forecast_date));
            setWeather(weatherData);
          } catch (err) {
            console.warn('Weather data not available', err);
          }
        }

        // Fetch exchange rate if countryCode is available
        if (countryCode) {
          try {
            const rateData = await travelInfoAPI.getExchangeRateByCountry(countryCode);
            setExchangeRate(rateData);
          } catch (err) {
            console.warn('Exchange rate data not available');
          }
        }

        // Fetch travel alert if countryCode is available
        if (countryCode) {
          try {
            const alertData = await travelInfoAPI.getTravelAlertByCountry(countryCode);
            setTravelAlert(alertData);
          } catch (err) {
            console.warn('Travel alert data not available');
          }
        }
      } catch (err) {
        setError('여행 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchTravelInfo();
  }, [countryCode, provinceIdx, cityIdx, districtIdx, startDate, endDate]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="warning" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!countryCode && !provinceIdx) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        국가와 지역을 선택하면 여행 정보를 확인할 수 있습니다.
      </Alert>
    );
  }

  const getAlertColor = (level: string) => {
    if (level.includes('철수권고') || level.includes('여행금지')) return '#dc3545';
    if (level.includes('특별여행주의보')) return '#fd7e14';
    if (level.includes('여행자제')) return '#ffc107';
    if (level.includes('여행유의')) return '#0dcaf0';
    return '#28a745';
  };

  // weatherOnly 모드일 때는 날씨만 표시
  if (weatherOnly) {
    return (
      <Box>
        {/* Weather Only */}
        {weather.length > 0 && (
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h5"
            sx={{
              mb: 3,
              color: '#1976d2',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              pb: 1.5,
              borderBottom: '3px solid #1976d2'
            }}
          >
            ☁️ 날씨 예보
            {startDate && endDate && (
              <Typography component="span" variant="body2" sx={{ color: '#666', fontWeight: 500, ml: 1 }}>
                ({startDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} - {endDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })})
              </Typography>
            )}
          </Typography>
          <Box sx={{
            display: 'flex',
            overflowX: 'auto',
            gap: 2,
            pb: 2,
            '&::-webkit-scrollbar': {
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: '#f1f1f1',
              borderRadius: '10px',
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: '#888',
              borderRadius: '10px',
              '&:hover': {
                bgcolor: '#555',
              },
            },
          }}>
            {weather.map((day, index) => {
              const date = new Date(day.forecast_date);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const forecastDate = new Date(day.forecast_date);
              forecastDate.setHours(0, 0, 0, 0);
              const isToday = forecastDate.getTime() === today.getTime();

              return (
                <Box
                  key={index}
                  sx={{
                    minWidth: '160px',
                    p: 2.5,
                    borderRadius: '16px',
                    bgcolor: isToday ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
                    background: isToday ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff',
                    boxShadow: isToday
                      ? '0 8px 16px rgba(102, 126, 234, 0.4)'
                      : '0 4px 12px rgba(0,0,0,0.08)',
                    textAlign: 'center',
                    border: isToday ? 'none' : '1px solid #e0e0e0',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: isToday
                        ? '0 12px 24px rgba(102, 126, 234, 0.5)'
                        : '0 8px 20px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  {/* 날짜 */}
                  <Typography
                    variant="caption"
                    sx={{
                      color: isToday ? '#fff' : '#666',
                      display: 'block',
                      mb: 0.5,
                      fontSize: '0.75rem',
                      fontWeight: 500
                    }}
                  >
                    {date.toLocaleDateString('ko-KR', { weekday: 'short' })}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      color: isToday ? '#fff' : '#333',
                      display: 'block',
                      mb: 2,
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}
                  >
                    {date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </Typography>

                  {/* AM/PM Weather */}
                  {(day.weather_am || day.weather_pm) ? (
                    <Box sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-around', gap: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isToday ? 'rgba(255,255,255,0.8)' : '#999',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              display: 'block',
                              mb: 0.5
                            }}
                          >
                            오전
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '1.1rem',
                              color: isToday ? '#fff' : '#333',
                              fontWeight: 600,
                              mb: 0.5
                            }}
                          >
                            {day.weather_am || '-'}
                          </Typography>
                          {day.precipitation_am !== undefined && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: isToday ? '#bbdefb' : '#2196f3',
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                            >
                              💧 {day.precipitation_am}%
                            </Typography>
                          )}
                        </Box>
                        <Box
                          sx={{
                            width: '1px',
                            bgcolor: isToday ? 'rgba(255,255,255,0.3)' : '#e0e0e0',
                            my: 0.5
                          }}
                        />
                        <Box sx={{ flex: 1 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              color: isToday ? 'rgba(255,255,255,0.8)' : '#999',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              display: 'block',
                              mb: 0.5
                            }}
                          >
                            오후
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '1.1rem',
                              color: isToday ? '#fff' : '#333',
                              fontWeight: 600,
                              mb: 0.5
                            }}
                          >
                            {day.weather_pm || '-'}
                          </Typography>
                          {day.precipitation_pm !== undefined && (
                            <Typography
                              variant="caption"
                              sx={{
                                color: isToday ? '#bbdefb' : '#2196f3',
                                display: 'block',
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                            >
                              💧 {day.precipitation_pm}%
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  ) : (
                    <Typography variant="body2" sx={{ fontSize: '1.5rem', mb: 1.5, color: isToday ? '#fff' : '#333' }}>
                      {day.weather || '☁️'}
                    </Typography>
                  )}

                  {/* Temperature */}
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 2,
                      pt: 2,
                      borderTop: `1px solid ${isToday ? 'rgba(255,255,255,0.3)' : '#f0f0f0'}`
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: isToday ? '#ffcdd2' : '#f44336',
                        fontSize: '0.95rem'
                      }}
                    >
                      ↑ {day.temp_max_c ? `${day.temp_max_c}°` : '-'}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: isToday ? '#bbdefb' : '#2196f3',
                        fontSize: '0.95rem'
                      }}
                    >
                      ↓ {day.temp_min_c ? `${day.temp_min_c}°` : '-'}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
        )}
      </Box>
    );
  }

  // 일반 모드일 때는 여행경보 + 환율만 표시
  return (
    <Box>
      {/* Travel Alert */}
      {travelAlert && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            ⚠️ 여행경보
          </Typography>
          <Box
            sx={{
              p: 2,
              borderRadius: '8px',
              bgcolor: '#fff',
              border: '2px solid',
              borderColor: getAlertColor(travelAlert.level),
            }}
          >
            <Typography variant="body1" sx={{ fontWeight: 600, color: getAlertColor(travelAlert.level), mb: 1 }}>
              {travelAlert.level}
            </Typography>
            {travelAlert.url && (
              <Typography variant="caption" sx={{ color: '#666' }}>
                <a href={travelAlert.url} target="_blank" rel="noopener noreferrer" style={{ color: '#0066cc' }}>
                  자세히 보기 →
                </a>
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Exchange Rate */}
      {exchangeRate.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            💱 환율 정보
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
            {exchangeRate.slice(0, 3).map((rate, index) => (
              <Box
                key={index}
                sx={{
                  p: 2,
                  borderRadius: '8px',
                  bgcolor: '#f8f9fa',
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                }}
              >
                <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 0.5 }}>
                  {rate.currency_code}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  살 때: {rate.buy ? `${rate.buy.toFixed(2)}원` : '-'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  팔 때: {rate.sell ? `${rate.sell.toFixed(2)}원` : '-'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#999', display: 'block', mt: 0.5 }}>
                  {rate.bank}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default TravelInfoCard;
