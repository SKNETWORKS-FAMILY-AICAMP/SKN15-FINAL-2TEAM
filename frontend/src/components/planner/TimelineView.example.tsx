/**
 * TimelineView Component Usage Example
 *
 * This file demonstrates how to use the TimelineView component
 */

import React, { useState } from 'react';
import TimelineView from './TimelineView';
import { TripData, ScheduleItem } from '../../types/planner';

const TimelineViewExample: React.FC = () => {
  // Sample trip data
  const [tripData, setTripData] = useState<TripData>({
    1: [
      {
        time: '09:00',
        location: '인천공항',
        description: '인천공항에서 출발',
        icon: '✈️',
      },
      {
        time: '14:00',
        location: '도쿄 나리타공항',
        description: '나리타공항 도착 및 입국 수속',
        icon: '🛬',
        travel: {
          time: '3시간',
          distance: '1,200km',
          method: '비행기',
        },
      },
      {
        time: '16:30',
        location: '아사쿠사 센소지',
        description: '도쿄의 대표적인 사찰 방문',
        icon: '⛩️',
        travel: {
          time: '1시간 30분',
          distance: '60km',
          method: '전철',
        },
      },
    ],
    2: [
      {
        time: '10:00',
        location: '츠키지 시장',
        description: '신선한 해산물 시장 둘러보기',
        icon: '🐟',
      },
      {
        time: '13:00',
        location: '도쿄타워',
        description: '도쿄타워 전망대 관람',
        icon: '🗼',
        travel: {
          time: '30분',
          distance: '5km',
          method: '지하철',
        },
      },
      {
        time: '16:00',
        location: '시부야 스크램블',
        description: '세계에서 가장 바쁜 교차로 체험',
        icon: '🚦',
        travel: {
          time: '20분',
          distance: '3km',
          method: '지하철',
        },
      },
    ],
    3: [
      {
        time: '08:00',
        location: '후지산',
        description: '후지산 5합목 관광',
        icon: '🗻',
      },
      {
        time: '15:00',
        location: '하코네 온천',
        description: '전통 온천 체험',
        icon: '♨️',
        travel: {
          time: '1시간',
          distance: '30km',
          method: '버스',
        },
      },
    ],
  });

  // Handler functions
  const handleEdit = (dayNumber: number, itemIndex: number) => {
    console.log(`Edit item: Day ${dayNumber}, Index ${itemIndex}`);
    // Implement edit logic here
    // For example, open a modal or navigate to edit page
  };

  const handleDelete = (dayNumber: number, itemIndex: number) => {
    console.log(`Delete item: Day ${dayNumber}, Index ${itemIndex}`);

    // Confirm before deleting
    if (window.confirm('이 일정을 삭제하시겠습니까?')) {
      setTripData((prevData) => {
        const newData = { ...prevData };
        const dayData = [...newData[dayNumber]];
        dayData.splice(itemIndex, 1);

        if (dayData.length === 0) {
          delete newData[dayNumber];
        } else {
          newData[dayNumber] = dayData;
        }

        return newData;
      });
    }
  };

  const handleAdd = (dayNumber: number) => {
    console.log(`Add new schedule to Day ${dayNumber}`);
    // Implement add logic here
    // For example, open a modal to add new schedule
  };

  return (
    <div style={{ padding: '20px', background: '#f5f5f5', minHeight: '100vh' }}>
      <h1 style={{ color: '#364C84', marginBottom: '20px' }}>
        TimelineView Component Example
      </h1>

      <TimelineView
        tripData={tripData}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onAdd={handleAdd}
      />
    </div>
  );
};

export default TimelineViewExample;
