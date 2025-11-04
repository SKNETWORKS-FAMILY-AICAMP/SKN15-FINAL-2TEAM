import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Button,
  Typography,
  Box,
  Chip,
  TextField,
} from '@mui/material';
import { ScheduleItem } from '../../types/planner';

interface DayPlanningCardProps {
  dayNumber: number;
  date: string;
  schedules: ScheduleItem[];
  onOpenDetail: (dayNumber: number, date: string) => void;
  onCopyPrevDay: (dayNumber: number) => void;
  onSearchPlace?: (dayNumber: number) => void;
  isSelected?: boolean;
  onSelect?: (dayNumber: number) => void;
  onUpdateTime?: (dayNumber: number, scheduleIndex: number, newTime: string) => void;
}

const DayPlanningCard: React.FC<DayPlanningCardProps> = ({
  dayNumber,
  date,
  schedules,
  onOpenDetail,
  onCopyPrevDay,
  onSearchPlace,
  isSelected = false,
  onSelect,
  onUpdateTime,
}) => {
  const isEmpty = !schedules || schedules.length === 0;
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [tempTime, setTempTime] = useState<string>('');

  // Generate summary of schedules
  const generateSummary = () => {
    if (isEmpty) {
      return (
        <>
          아직 계획이 설정되지 않았습니다.
          <br />
          상세 계획을 설정해보세요!
        </>
      );
    }

    const handleTimeClick = (index: number, currentTime: string) => {
      setEditingTimeIndex(index);
      setTempTime(currentTime);
    };

    const handleTimeSave = (index: number) => {
      if (onUpdateTime && tempTime) {
        onUpdateTime(dayNumber, index, tempTime);
      }
      setEditingTimeIndex(null);
      setTempTime('');
    };

    const handleTimeCancel = () => {
      setEditingTimeIndex(null);
      setTempTime('');
    };

    return (
      <Box>
        {schedules.slice(0, 3).map((schedule, index) => (
          <Box
            key={index}
            sx={{
              mb: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            {editingTimeIndex === index ? (
              <TextField
                type="time"
                value={tempTime}
                onChange={(e) => setTempTime(e.target.value)}
                onBlur={() => handleTimeSave(index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTimeSave(index);
                  if (e.key === 'Escape') handleTimeCancel();
                }}
                autoFocus
                size="small"
                sx={{
                  width: '100px',
                  '& input': {
                    fontSize: '0.875rem',
                    padding: '4px 8px',
                  }
                }}
              />
            ) : (
              <Typography
                variant="body2"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTimeClick(index, schedule.time);
                }}
                sx={{
                  minWidth: '50px',
                  color: '#666',
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  '&:hover': {
                    bgcolor: '#f5f5f5',
                    color: '#1976d2',
                  }
                }}
              >
                {schedule.time}
              </Typography>
            )}
            <Typography variant="body2" sx={{ color: '#666' }}>
              {schedule.icon}
            </Typography>
            <Typography variant="body2" sx={{ color: '#666' }}>
              {schedule.location}
            </Typography>
          </Box>
        ))}
        {schedules.length > 3 && (
          <Typography variant="body2" sx={{ color: '#999', mt: 0.5 }}>
            외 {schedules.length - 3}개 일정
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Card
      onClick={() => onSelect && onSelect(dayNumber)}
      sx={{
        background: 'white',
        border: isSelected ? '3px solid #364C84' : '2px solid #e0e0e0',
        borderRadius: '15px',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isSelected ? '0 8px 25px rgba(54, 76, 132, 0.3)' : 'none',
        transform: isSelected ? 'scale(1.02)' : 'none',
        '&:hover': {
          borderColor: '#364C84',
          transform: isSelected ? 'scale(1.02)' : 'translateY(-5px)',
          boxShadow: '0 8px 25px rgba(33, 150, 243, 0.15)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 2,
          }}
        >
          <Box>
            <Typography
              variant="h6"
              sx={{
                fontSize: '1.2rem',
                fontWeight: 600,
                color: '#364C84',
                mb: 0.5,
              }}
            >
              Day {dayNumber}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                fontSize: '0.9rem',
                color: '#666',
              }}
            >
              {date}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {isSelected && (
              <Chip
                label="선택됨"
                size="small"
                sx={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: '#364C84',
                  color: 'white',
                }}
              />
            )}
            <Chip
              label={isEmpty ? '계획 없음' : '계획됨'}
              size="small"
              sx={{
                fontSize: '0.8rem',
                fontWeight: 600,
                ...(isEmpty
                  ? {
                      background: '#f5f5f5',
                      color: '#999',
                    }
                  : {
                      background: '#e8f5e8',
                      color: '#4CAF50',
                    }),
              }}
            />
          </Box>
        </Box>

        {/* Summary */}
        <Box
          sx={{
            mb: 2,
            color: '#666',
            fontSize: '0.9rem',
            minHeight: '60px',
          }}
        >
          {generateSummary()}
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', gap: 1.25, flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', gap: 1.25 }}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => onOpenDetail(dayNumber, date)}
              sx={{
                py: 1,
                borderRadius: '8px',
                fontSize: '0.9rem',
                textTransform: 'none',
                background: '#364C84',
                color: 'white',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: '#1976D2',
                },
              }}
            >
              📋 상세 계획
            </Button>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => onCopyPrevDay(dayNumber)}
              disabled={dayNumber === 1}
              sx={{
                py: 1,
                borderRadius: '8px',
                fontSize: '0.9rem',
                textTransform: 'none',
                border: '1px solid #f2f7d0',
                background: 'white',
                color: '#364C84',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: '#364C84',
                  color: 'white',
                  border: '1px solid #364C84',
                },
                '&.Mui-disabled': {
                  opacity: 0.5,
                },
              }}
            >
              📋 이전 일차 복사
            </Button>
          </Box>
          {onSearchPlace && (
            <Button
              variant="contained"
              fullWidth
              onClick={() => onSearchPlace(dayNumber)}
              sx={{
                py: 1,
                borderRadius: '8px',
                fontSize: '0.9rem',
                textTransform: 'none',
                background: '#4CAF50',
                color: 'white',
                transition: 'all 0.3s ease',
                '&:hover': {
                  background: '#45a049',
                },
              }}
            >
              🗺️ 장소 검색하기
            </Button>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default DayPlanningCard;
