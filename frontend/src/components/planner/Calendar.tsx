import React, { useState, useEffect } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { ChevronLeft, ChevronRight } from '@mui/icons-material';

interface CalendarProps {
  onDateSelect: (startDate: Date | null, endDate: Date | null) => void;
  selectedStart: Date | null;
  selectedEnd: Date | null;
}

const Calendar: React.FC<CalendarProps> = ({ onDateSelect, selectedStart, selectedEnd }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [isSelectingEndDate, setIsSelectingEndDate] = useState(false);

  // Update calendar view when start date is selected
  useEffect(() => {
    if (selectedStart) {
      setCurrentMonth(selectedStart.getMonth());
      setCurrentYear(selectedStart.getFullYear());
    }
  }, [selectedStart]);

  const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDateClick = (date: Date) => {
    console.log('📅 Calendar: Date clicked', date);
    if (!isSelectingEndDate) {
      // 첫 번째 날짜 선택
      console.log('📅 Calendar: Selecting start date', date);
      onDateSelect(date, null);
      setIsSelectingEndDate(true);
    } else {
      // 두 번째 날짜 선택
      if (selectedStart && date < selectedStart) {
        // 종료일이 시작일보다 빠르면 다시 시작
        console.log('📅 Calendar: End date before start, restarting', date);
        onDateSelect(date, null);
      } else {
        console.log('📅 Calendar: Selecting end date', { start: selectedStart, end: date });
        onDateSelect(selectedStart, date);
        setIsSelectingEndDate(false);
      }
    }
  };

  const renderCalendar = () => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const prevMonth = new Date(currentYear, currentMonth, 0);
    const daysInPrevMonth = prevMonth.getDate();

    const days: JSX.Element[] = [];
    const today = new Date();
    const todayWithoutTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 이전 달 날짜들
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push(
        <Box
          key={`prev-${i}`}
          sx={{
            p: 1,
            textAlign: 'center',
            color: '#ccc',
            fontSize: '0.85rem',
          }}
        >
          {daysInPrevMonth - i}
        </Box>
      );
    }

    // 현재 달 날짜들
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      // 이미 선택된 날짜 범위라면 과거 날짜도 허용
      const hasSelectedDates = selectedStart !== null;
      const isPast = !hasSelectedDates && date < todayWithoutTime;
      const isToday = date.toDateString() === today.toDateString();
      const isSelectedStart =
        selectedStart &&
        selectedStart.getFullYear() === date.getFullYear() &&
        selectedStart.getMonth() === date.getMonth() &&
        selectedStart.getDate() === date.getDate();
      const isSelectedEnd =
        selectedEnd &&
        selectedEnd.getFullYear() === date.getFullYear() &&
        selectedEnd.getMonth() === date.getMonth() &&
        selectedEnd.getDate() === date.getDate();
      const isInRange =
        selectedStart &&
        selectedEnd &&
        date > selectedStart &&
        date < selectedEnd;

      days.push(
        <Box
          key={`current-${day}`}
          onClick={() => !isPast && handleDateClick(date)}
          sx={{
            p: 1,
            textAlign: 'center',
            cursor: isPast ? 'not-allowed' : 'pointer',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: isToday ? 'bold' : 'normal',
            color: (isSelectedStart || isSelectedEnd) ? 'white' : (isPast ? '#ddd' : '#333'),
            bgcolor: isSelectedStart || isSelectedEnd
              ? 'primary.main'
              : isInRange
              ? 'primary.light'
              : isToday
              ? 'rgba(54, 76, 132, 0.1)'
              : 'transparent',
            border: isToday ? '2px solid' : 'none',
            borderColor: 'primary.main',
            '&:hover': {
              bgcolor: !isPast && !isSelectedStart && !isSelectedEnd ? 'rgba(54, 76, 132, 0.1)' : undefined,
            },
          }}
        >
          {day}
        </Box>
      );
    }

    // 다음 달 날짜들
    const totalCells = days.length;
    const remainingCells = 42 - totalCells; // 6 rows * 7 days

    for (let day = 1; day <= remainingCells; day++) {
      days.push(
        <Box
          key={`next-${day}`}
          sx={{
            p: 1,
            textAlign: 'center',
            color: '#ccc',
            fontSize: '0.85rem',
          }}
        >
          {day}
        </Box>
      );
    }

    return days;
  };

  return (
    <Box
      sx={{
        border: '1px solid #e0e0e0',
        borderRadius: '15px',
        p: 2,
        bgcolor: 'white',
        mt: 2,
      }}
    >
      {/* Calendar Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <IconButton onClick={handlePrevMonth} size="small">
          <ChevronLeft />
        </IconButton>
        <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
          {currentYear}년 {monthNames[currentMonth]}
        </Typography>
        <IconButton onClick={handleNextMonth} size="small">
          <ChevronRight />
        </IconButton>
      </Box>

      {/* Day Headers */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          mb: 1,
        }}
      >
        {dayNames.map((day) => (
          <Box
            key={day}
            sx={{
              p: 1,
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '0.8rem',
              color: '#666',
            }}
          >
            {day}
          </Box>
        ))}
      </Box>

      {/* Calendar Grid */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 0.5,
        }}
      >
        {renderCalendar()}
      </Box>
    </Box>
  );
};

export default Calendar;
