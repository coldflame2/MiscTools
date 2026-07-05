
import React from 'react';

export const MergeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5"/>
        <path d="M8 3H3v5"/>
        <path d="M12 22v-8"/>
        <path d="M12 8l-4 4"/>
        <path d="m21 3-9 9-9-9"/>
    </svg>
);