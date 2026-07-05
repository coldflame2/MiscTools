import React from 'react';

export const SquareIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        className={className} 
        fill="none" 
        viewBox="0 0 24 24" 
        stroke="currentColor" 
        strokeWidth={1.5}
    >
        <rect x="4" y="4" width="16" height="16" rx="2" />
    </svg>
);
