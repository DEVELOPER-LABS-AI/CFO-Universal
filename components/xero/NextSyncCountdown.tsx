'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

/**
 * Calculates time until next 2 AM UTC sync
 */
function getTimeUntilNextSync(): {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
} {
  const now = new Date();
  const nextSync = new Date();

  // Set to 2 AM UTC
  nextSync.setUTCHours(2, 0, 0, 0);

  // If we've passed 2 AM UTC today, set to tomorrow 2 AM UTC
  if (now >= nextSync) {
    nextSync.setUTCDate(nextSync.getUTCDate() + 1);
  }

  const totalMs = nextSync.getTime() - now.getTime();
  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);

  return { hours, minutes, seconds, totalMs };
}

export function NextSyncCountdown() {
  const [timeUntilSync, setTimeUntilSync] = useState(getTimeUntilNextSync());

  useEffect(() => {
    // Update every second
    const interval = setInterval(() => {
      setTimeUntilSync(getTimeUntilNextSync());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Clock className="w-4 h-4" />
      <span>
        Next automatic sync in{' '}
        <span className="font-medium text-gray-900">
          {timeUntilSync.hours}h {timeUntilSync.minutes}m {timeUntilSync.seconds}s
        </span>
      </span>
    </div>
  );
}
