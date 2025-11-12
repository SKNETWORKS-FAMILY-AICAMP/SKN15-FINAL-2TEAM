import React, { useState } from 'react';
import { Box, Typography, IconButton, Button, TextField } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, DragIndicator } from '@mui/icons-material';
import { ScheduleItem, TripData } from '../../types/planner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TimelineViewProps {
  tripData: TripData;
  onEdit?: (dayNumber: number, itemIndex: number) => void;
  onDelete?: (dayNumber: number, itemIndex: number) => void;
  onAdd?: (dayNumber: number) => void;
  selectedDayNo?: number | null;
  onSelectDay?: (dayNumber: number) => void;
  onUpdateTime?: (dayNumber: number, scheduleIndex: number, newTime: string) => void;
  onReorder?: (dayNumber: number, oldIndex: number, newIndex: number) => void;
  onMoveToDay?: (sourceDayNo: number, sourceIndex: number, targetDayNo: number) => void;
}

interface SortableItemProps {
  id: string;
  item: ScheduleItem;
  dayNumber: number;
  itemIndex: number;
  totalItems: number;
  editingTime: {dayNo: number, index: number} | null;
  tempTime: string;
  onTimeEditStart: (dayNo: number, index: number, time: string) => void;
  onTimeEditEnd: (dayNo: number, index: number, time: string) => void;
  onTimeEditCancel: () => void;
  onEdit?: (dayNumber: number, itemIndex: number) => void;
  onDelete?: (dayNumber: number, itemIndex: number) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({
  id,
  item,
  dayNumber,
  itemIndex,
  totalItems,
  editingTime,
  tempTime,
  onTimeEditStart,
  onTimeEditEnd,
  onTimeEditCancel,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box ref={setNodeRef} style={style}>
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
            display: itemIndex === totalItems - 1 ? 'none' : 'block',
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
              onChange={(e) => onTimeEditStart(dayNumber, itemIndex, e.target.value)}
              onBlur={() => onTimeEditEnd(dayNumber, itemIndex, tempTime)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onTimeEditEnd(dayNumber, itemIndex, tempTime);
                }
                if (e.key === 'Escape') {
                  onTimeEditCancel();
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
                onTimeEditStart(dayNumber, itemIndex, item.time);
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
          {/* Drag Handle */}
          <Box
            {...attributes}
            {...listeners}
            sx={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              cursor: 'grab',
              color: '#999',
              '&:active': {
                cursor: 'grabbing',
              },
              '&:hover': {
                color: '#364C84',
              },
            }}
          >
            <DragIndicator />
          </Box>

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
              paddingRight: '40px', // Space for drag handle
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
  );
};

const TimelineView: React.FC<TimelineViewProps> = ({
  tripData,
  onEdit,
  onDelete,
  onAdd,
  selectedDayNo,
  onSelectDay,
  onUpdateTime,
  onReorder,
  onMoveToDay,
}) => {
  const [editingTime, setEditingTime] = useState<{dayNo: number, index: number} | null>(null);
  const [tempTime, setTempTime] = useState<string>('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const totalDays = Object.keys(tripData).length;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setActiveId(null);
      return;
    }

    // Parse IDs: "day-1-item-0" → {dayNo: 1, index: 0}
    const parseId = (id: string) => {
      const parts = id.split('-');
      return {
        dayNo: parseInt(parts[1]),
        index: parseInt(parts[3]),
      };
    };

    const source = parseId(active.id as string);
    const target = parseId(over.id as string);

    if (source.dayNo === target.dayNo) {
      // Same day: reorder
      if (onReorder && source.index !== target.index) {
        onReorder(source.dayNo, source.index, target.index);
      }
    } else {
      // Different day: move to another day
      if (onMoveToDay) {
        onMoveToDay(source.dayNo, source.index, target.dayNo);
      }
    }

    setActiveId(null);
  };

  const handleTimeEditStart = (dayNo: number, index: number, time: string) => {
    setEditingTime({ dayNo, index });
    setTempTime(time);
  };

  const handleTimeEditEnd = (dayNo: number, index: number, time: string) => {
    if (onUpdateTime && time) {
      onUpdateTime(dayNo, index, time);
    }
    setEditingTime(null);
    setTempTime('');
  };

  const handleTimeEditCancel = () => {
    setEditingTime(null);
    setTempTime('');
  };

  // Get active item for drag overlay
  const getActiveItem = () => {
    if (!activeId) return null;
    const parts = activeId.split('-');
    const dayNo = parseInt(parts[1]);
    const index = parseInt(parts[3]);
    return tripData[dayNo]?.[index];
  };

  const activeItem = getActiveItem();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
              const items = dayData.map((_, index) => `day-${dayNumber}-item-${index}`);

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

                  {/* Timeline Items with Drag and Drop */}
                  <SortableContext items={items} strategy={verticalListSortingStrategy}>
                    {dayData.map((item, itemIndex) => (
                      <SortableItem
                        key={`day-${dayNumber}-item-${itemIndex}`}
                        id={`day-${dayNumber}-item-${itemIndex}`}
                        item={item}
                        dayNumber={dayNumber}
                        itemIndex={itemIndex}
                        totalItems={dayData.length}
                        editingTime={editingTime}
                        tempTime={tempTime}
                        onTimeEditStart={handleTimeEditStart}
                        onTimeEditEnd={handleTimeEditEnd}
                        onTimeEditCancel={handleTimeEditCancel}
                        onEdit={onEdit}
                        onDelete={onDelete}
                      />
                    ))}
                  </SortableContext>

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

      {/* Drag Overlay */}
      <DragOverlay>
        {activeItem ? (
          <Box
            sx={{
              background: 'white',
              border: '2px solid #364C84',
              borderRadius: '8px',
              padding: '12px 15px',
              boxShadow: '0 8px 20px rgba(54, 76, 132, 0.3)',
              minWidth: '300px',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{activeItem.icon}</span>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 600 }}>
                {activeItem.location}
              </Typography>
            </Box>
          </Box>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default TimelineView;
