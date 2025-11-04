import React, { useState } from 'react';
import { Box, Typography, IconButton, Button, TextField } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
import { ScheduleItem, TripData } from '../../types/planner';

interface TimelineViewProps {
  tripData: TripData;
  onEdit?: (dayNumber: number, itemIndex: number) => void;
  onDelete?: (dayNumber: number, itemIndex: number) => void;
  onAdd?: (dayNumber: number) => void;
  selectedDayNo?: number | null;
  onSelectDay?: (dayNumber: number) => void;
  onUpdateTime?: (dayNumber: number, scheduleIndex: number, newTime: string) => void;
}

const TimelineView: React.FC<TimelineViewProps> = ({
  tripData,
  onEdit,
  onDelete,
  onAdd,
  selectedDayNo,
  onSelectDay,
  onUpdateTime,
}) => {
  const [editingTime, setEditingTime] = useState<{dayNo: number, index: number} | null>(null);
  const [tempTime, setTempTime] = useState<string>('');
  const totalDays = Object.keys(tripData).length;

  return (
    <Box
      sx={{
        background: 'white',
        borderRadius: '15px',
        padding: '25px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
        marginTop: '20px',
      }}
    >
      {/* Timeline Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '25px',
          paddingBottom: '15px',
          borderBottom: '2px solid #f0f0f0',
        }}
      >
        <Typography variant="h5" sx={{ fontWeight: 600, color: '#364C84' }}>
          여행 타임라인
        </Typography>
        <Typography sx={{ fontSize: '0.9rem', color: '#666' }}>
          총 {totalDays}일
        </Typography>
      </Box>

      {/* Timeline Content Wrapper */}
      <Box
        sx={{
          maxHeight: '600px',
          overflowY: 'auto',
          paddingRight: '10px',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: '#dee2e6',
            borderRadius: '3px',
          },
        }}
      >
        {Object.keys(tripData)
          .sort((a, b) => Number(a) - Number(b))
          .map((dayNum, dayIndex) => {
            const dayNumber = Number(dayNum);
            const dayData = tripData[dayNumber];
            const totalSchedules = dayData.length;

            return (
              <Box key={dayNumber}>
                {/* Day Header */}
                <Box
                  onClick={() => onSelectDay && onSelectDay(dayNumber)}
                  sx={{
                    background: selectedDayNo === dayNumber
                      ? 'linear-gradient(135deg, #1976d2, #2196f3)'
                      : 'linear-gradient(135deg, #364C84, #4a5f9f)',
                    color: 'white',
                    padding: '15px 20px',
                    borderRadius: '10px',
                    margin: dayIndex === 0 ? '0 0 15px 0' : '25px 0 15px 0',
                    fontWeight: 600,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 5,
                    cursor: onSelectDay ? 'pointer' : 'default',
                    border: selectedDayNo === dayNumber ? '3px solid #fff' : 'none',
                    boxShadow: selectedDayNo === dayNumber
                      ? '0 8px 25px rgba(25, 118, 210, 0.4)'
                      : '0 2px 8px rgba(0,0,0,0.1)',
                    transform: selectedDayNo === dayNumber ? 'scale(1.02)' : 'none',
                    transition: 'all 0.3s ease',
                    '&:hover': onSelectDay ? {
                      transform: 'scale(1.02)',
                      boxShadow: '0 8px 20px rgba(54, 76, 132, 0.3)',
                    } : {},
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography component="span" sx={{ fontSize: '1.2rem', fontWeight: 600 }}>
                      📅 Day {dayNumber}
                    </Typography>
                    {selectedDayNo === dayNumber && (
                      <Typography
                        component="span"
                        sx={{
                          fontSize: '0.75rem',
                          bgcolor: 'rgba(255,255,255,0.3)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontWeight: 600,
                        }}
                      >
                        선택됨
                      </Typography>
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontSize: '0.8rem',
                      opacity: 0.9,
                    }}
                  >
                    {totalSchedules}개 일정
                  </Typography>
                </Box>

                {/* Timeline Items */}
                {dayData.map((item, itemIndex) => (
                  <Box key={itemIndex}>
                    {/* Travel Info (if not first item and travel data exists) */}
                    {item.travel && itemIndex > 0 && (
                      <Box
                        sx={{
                          margin: '8px 0',
                          padding: '8px 15px',
                          background: 'linear-gradient(135deg, #e9ecef, #f8f9fa)',
                          borderRadius: '6px',
                          borderLeft: '3px solid #364C84',
                          fontSize: '0.8rem',
                          color: '#666',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>🚗</span>
                        <Typography component="span" sx={{ fontSize: '0.8rem', color: '#666' }}>
                          {item.travel.method} {item.travel.time} ({item.travel.distance})
                        </Typography>
                      </Box>
                    )}

                    {/* Timeline Item */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        marginBottom: '15px',
                        position: 'relative',
                        padding: '12px 0',
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: '78px',
                          top: '35px',
                          bottom: '-15px',
                          width: '2px',
                          background: 'linear-gradient(to bottom, #e3f2fd, #f3e5f5)',
                          zIndex: 1,
                          display: itemIndex === dayData.length - 1 ? 'none' : 'block',
                        },
                      }}
                    >
                      {/* Time */}
                      <Box
                        sx={{
                          minWidth: '70px',
                          fontWeight: 'bold',
                          color: '#364C84',
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          position: 'relative',
                          zIndex: 2,
                        }}
                      >
                        <span>🕐</span>
                        {editingTime?.dayNo === dayNumber && editingTime?.index === itemIndex ? (
                          <TextField
                            type="time"
                            value={tempTime}
                            onChange={(e) => setTempTime(e.target.value)}
                            onBlur={() => {
                              if (onUpdateTime && tempTime) {
                                onUpdateTime(dayNumber, itemIndex, tempTime);
                              }
                              setEditingTime(null);
                              setTempTime('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                if (onUpdateTime && tempTime) {
                                  onUpdateTime(dayNumber, itemIndex, tempTime);
                                }
                                setEditingTime(null);
                                setTempTime('');
                              }
                              if (e.key === 'Escape') {
                                setEditingTime(null);
                                setTempTime('');
                              }
                            }}
                            autoFocus
                            size="small"
                            sx={{
                              width: '100px',
                              '& input': {
                                fontSize: '0.85rem',
                                padding: '4px 8px',
                                fontWeight: 'bold',
                                color: '#364C84',
                              }
                            }}
                          />
                        ) : (
                          <Typography
                            component="span"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTime({dayNo: dayNumber, index: itemIndex});
                              setTempTime(item.time);
                            }}
                            sx={{
                              fontSize: '0.85rem',
                              fontWeight: 'bold',
                              color: '#364C84',
                              cursor: 'pointer',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              '&:hover': {
                                bgcolor: '#f5f5f5',
                                color: '#1976d2',
                              }
                            }}
                          >
                            {item.time}
                          </Typography>
                        )}
                      </Box>

                      {/* Content */}
                      <Box
                        sx={{
                          flex: 1,
                          marginLeft: '25px',
                          background: 'white',
                          border: '1px solid #e9ecef',
                          borderRadius: '8px',
                          padding: '12px 15px',
                          position: 'relative',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            borderColor: '#364C84',
                            boxShadow: '0 4px 8px rgba(54, 76, 132, 0.15)',
                            '& .timeline-actions': {
                              opacity: 1,
                            },
                          },
                        }}
                      >
                        {/* Location */}
                        <Box
                          sx={{
                            fontWeight: 600,
                            color: '#333',
                            fontSize: '0.95rem',
                            marginBottom: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{item.icon}</span>
                          <Typography component="span" sx={{ fontSize: '0.95rem', fontWeight: 600, color: '#333' }}>
                            {item.location}
                          </Typography>
                        </Box>

                        {/* Description */}
                        <Typography
                          sx={{
                            color: '#666',
                            fontSize: '0.85rem',
                            lineHeight: 1.4,
                            marginBottom: '8px',
                          }}
                        >
                          {item.description}
                        </Typography>

                        {/* Action Buttons */}
                        <Box
                          className="timeline-actions"
                          sx={{
                            display: 'flex',
                            gap: '6px',
                            opacity: 0,
                            transition: 'opacity 0.3s ease',
                          }}
                        >
                          {onEdit && (
                            <Button
                              size="small"
                              startIcon={<EditIcon sx={{ fontSize: '0.75rem' }} />}
                              onClick={() => onEdit(dayNumber, itemIndex)}
                              sx={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                background: '#e3f2fd',
                                color: '#1976d2',
                                textTransform: 'none',
                                minWidth: 'auto',
                                '&:hover': {
                                  background: '#bbdefb',
                                },
                              }}
                            >
                              수정
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              size="small"
                              startIcon={<DeleteIcon sx={{ fontSize: '0.75rem' }} />}
                              onClick={() => onDelete(dayNumber, itemIndex)}
                              sx={{
                                padding: '4px 8px',
                                fontSize: '0.75rem',
                                background: '#ffebee',
                                color: '#d32f2f',
                                textTransform: 'none',
                                minWidth: 'auto',
                                '&:hover': {
                                  background: '#ffcdd2',
                                },
                              }}
                            >
                              삭제
                            </Button>
                          )}
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                ))}

                {/* Add Schedule Button */}
                {onAdd && (
                  <Box
                    sx={{
                      textAlign: 'center',
                      padding: '12px 0',
                      marginBottom: dayIndex === totalDays - 1 ? 0 : '10px',
                    }}
                  >
                    <Button
                      startIcon={<AddIcon />}
                      onClick={() => onAdd(dayNumber)}
                      sx={{
                        padding: '8px 16px',
                        fontSize: '0.85rem',
                        background: '#f8f9fa',
                        color: '#364C84',
                        border: '1px solid #dee2e6',
                        borderRadius: '8px',
                        textTransform: 'none',
                        '&:hover': {
                          background: '#e9ecef',
                          borderColor: '#adb5bd',
                        },
                      }}
                    >
                      Day {dayNumber} 일정 추가
                    </Button>
                  </Box>
                )}
              </Box>
            );
          })}
      </Box>

      {/* Actions Bar */}
      <Box
        sx={{
          textAlign: 'center',
          padding: '20px 0',
          borderTop: '1px solid #e9ecef',
          marginTop: '25px',
        }}
      >
        <Typography sx={{ fontSize: '0.85rem', color: '#999' }}>
          타임라인이 끝났습니다
        </Typography>
      </Box>
    </Box>
  );
};

export default TimelineView;
