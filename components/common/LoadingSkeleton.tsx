'use client';

import React from 'react';

export function LoadingSkeleton() {
  return (
    <div className="loading-skeleton" aria-label="Initializing Command Bridge" role="status">
      <div className="loading-skeleton__status-bar" />
      <div className="loading-skeleton__body">
        <div className="loading-skeleton__panel" />
        <div className="loading-skeleton__main">
          <div className="loading-skeleton__card" />
          <div className="loading-skeleton__card" />
          <div className="loading-skeleton__card" />
        </div>
        <div className="loading-skeleton__panel" />
      </div>
      <div className="loading-skeleton__dock" />
    </div>
  );
}
