import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Planner from '../planner';

/**
 * Dynamic route for planner using invite code
 * URL: /planner/ABC123
 *
 * This component redirects to the legacy planner page with the invite code
 * passed as a query parameter, allowing the existing planner logic to load
 * the trip using the invite code.
 */
export default function PlannerByInviteCode() {
  const router = useRouter();
  const { inviteCode } = router.query;

  useEffect(() => {
    // Only redirect once we have the invite code from the router
    if (inviteCode && typeof inviteCode === 'string') {
      // Replace the URL to use query param format for now
      // This maintains compatibility with existing planner logic
      router.replace(`/planner?inviteCode=${inviteCode}`);
    }
  }, [inviteCode, router]);

  // Show loading while redirecting
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '18px',
      color: '#666'
    }}>
      Loading trip...
    </div>
  );
}
