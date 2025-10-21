import React from 'react';
import { Box, Typography } from '@mui/material';
import { WeatherData } from '../../types/planner';

interface WeatherWidgetProps {
  weather: WeatherData;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ weather }) => {
  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
        🌤️ 날씨 정보
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {/* Current Weather */}
        <Box
          sx={{
            flex: 1,
            minWidth: '200px',
            background: 'linear-gradient(135deg, #D0D9F5 0%, #E7F1A5 100%)',
            color: '#364C84',
            p: 2.5,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography sx={{ fontSize: '2.5rem' }}>{weather.current.icon}</Typography>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 'bold', mb: 0.5 }}>
              {weather.current.temp}°C
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', opacity: 0.9, mb: 0.25 }}>
              {weather.current.description}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', opacity: 0.8 }}>
              체감 {weather.current.feelsLike}°C
            </Typography>
          </Box>
        </Box>

        {/* Forecast */}
        {weather.forecast.map((day, index) => (
          <Box
            key={index}
            sx={{
              textAlign: 'center',
              p: 1.5,
              bgcolor: '#f8f9fa',
              borderRadius: '8px',
              minWidth: '70px',
            }}
          >
            <Typography sx={{ fontSize: '0.8rem', color: '#666', mb: 0.5 }}>
              {day.day}
            </Typography>
            <Typography sx={{ fontSize: '1.2rem', mb: 0.5 }}>{day.icon}</Typography>
            <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: '#333' }}>
              {day.temp}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default WeatherWidget;
