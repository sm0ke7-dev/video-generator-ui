'use client';

import { useEffect, useState } from 'react';

export default function HealthIndicator() {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  async function check() {
    try {
      const res = await fetch('/api/health');
      const data = await res.json() as Record<string, unknown>;
      setHealthy(data.healthy === true);
    } catch {
      setHealthy(false);
    }
  }

  useEffect(() => {
    check();
    const interval = setInterval(check, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (healthy === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
        Checking...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm text-white">
      <span
        className={`h-2 w-2 rounded-full ${
          healthy ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
        }`}
      />
      {healthy ? 'API Online' : 'API Offline'}
    </div>
  );
}
