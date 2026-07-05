
import React from 'react';

export const UploadIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={1.5}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M3 17.25V21h18v-3.75M13.5 10.5h-3"
    />
     <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 12.75v3" />
     <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75v3" />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 13.5v-7.5A2.25 2.25 0 015.25 3h13.5A2.25 2.25 0 0121 5.25v7.5"
    />
  </svg>
);