import React, { useEffect, useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import travelInfoAPI, { WeatherDaily, ExchangeRate, TripAlert } from '../../services/travelInfoAPI';

interface TravelInfoCardProps {
  countryCode?: number;
  cityCode?: number;
  startDate?: Date | null;
  endDate?: Date | null;
}

const TravelInfoCard: React.FC<TravelInfoCardProps> = ({
  countryCode,
  cityCode,
  startDate,
  endDate,
}) => {
  const [weather, setWeather] = useState<WeatherDaily[]>([]);
  const [exchangeRate, setExchangeRate] = useState<ExchangeRate[]>([]);
  const [travelAlert, setTravelAlert] = useState<TripAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTravelInfo = async () => {
      if (!countryCode && !cityCode) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch weather if cityCode and dates are available
        if (cityCode && startDate && endDate) {
          try {
            const weatherData = await travelInfoAPI.getWeatherByDateRange(
              cityCode,
              startDate.toISOString().split('T')[0],
              endDate.toISOString().split('T')[0]
            );
            setWeather(weatherData);
          } catch (err) {
            console.warn('Weather data not available');
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
  }, [countryCode, cityCode, startDate, endDate]);

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

  if (!countryCode && !cityCode) {
    return (
      <Alert severity="info" sx={{ mb: 2 }}>
        국가와 도시를 선택하면 여행 정보를 확인할 수 있습니다.
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

      {/* Weather */}
      {weather.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 1 }}>
            ☁️ 날씨 예보
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 2 }}>
            {weather.slice(0, 7).map((day, index) => (
              <Box
                key={index}
                sx={{
                  p: 2,
                  borderRadius: '8px',
                  bgcolor: '#f8f9fa',
                  textAlign: 'center',
                  borderLeft: '4px solid',
                  borderColor: 'primary.main',
                }}
              >
                <Typography variant="caption" sx={{ color: '#666', display: 'block', mb: 1 }}>
                  {new Date(day.forecast_date).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                </Typography>
                <Typography variant="body2" sx={{ fontSize: '1.5rem', mb: 0.5 }}>
                  {day.weather || '☁️'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#dc3545' }}>
                  {day.temp_max_c ? `${day.temp_max_c}°` : '-'}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color: '#0066cc' }}>
                  {day.temp_min_c ? `${day.temp_min_c}°` : '-'}
                </Typography>
              </Box>
            ))}
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
