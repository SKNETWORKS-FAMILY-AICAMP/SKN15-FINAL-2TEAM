import React from 'react';
import {
  Card,
  CardContent,
  Button,
  Typography,
  Box,
  Chip,
} from '@mui/material';
import { ScheduleItem } from '../../types/planner';

interface DayPlanningCardProps {
  dayNumber: number;
  date: string;
  schedules: ScheduleItem[];
  onOpenDetail: (dayNumber: number, date: string) => void;
  onCopyPrevDay: (dayNumber: number) => void;
}

const DayPlanningCard: React.FC<DayPlanningCardProps> = ({
  dayNumber,
  date,
  schedules,
  onOpenDetail,
  onCopyPrevDay,
}) => {
  const isEmpty = !schedules || schedules.length === 0;

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

    return (
      <Box>
        {schedules.slice(0, 3).map((schedule, index) => (
          <Typography
            key={index}
            variant="body2"
            sx={{
              color: '#666',
              mb: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <span style={{ minWidth: '50px' }}>{schedule.time}</span>
            <span>{schedule.icon}</span>
            <span>{schedule.location}</span>
          </Typography>
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
      sx={{
        background: 'white',
        border: '2px solid #e0e0e0',
        borderRadius: '15px',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          borderColor: '#364C84',
          transform: 'translateY(-5px)',
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
      </CardContent>
    </Card>
  );
};

export default DayPlanningCard;
