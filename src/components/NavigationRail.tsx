
import React, { useState } from 'react';
import { MenuIcon } from './icons/MenuIcon';
import { CreditsIcon } from './icons/CreditsIcon';
import { FileSheetIcon } from './icons/FileSheetIcon';
import { ChartBarIcon } from './icons/ChartBarIcon';
import { HistoryIcon } from './icons/HistoryIcon';
import { ExportIcon } from './icons/ExportIcon';
import { DataHealthIcon } from './icons/DataHealthIcon';
import type { ActiveView } from '../types';


interface NavItemProps {
    icon: React.ReactNode;
    label: string;
    isExpanded: boolean;
    isActive?: boolean;
    onClick: () => void;
    badgeCount?: number;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, isExpanded, isActive, onClick, badgeCount }) => {
    return (
        <li className="relative">
            <button 
                onClick={onClick}
                className={`flex items-center w-full p-3 rounded-lg transition-colors duration-200 group ${isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-100'} ${!isExpanded ? 'justify-center' : ''}`}
                title={isExpanded ? undefined : label}
            >
                {icon}
                <span className={`ml-4 font-semibold text-sm transition-all duration-200 ease-in-out whitespace-nowrap overflow-hidden ${isExpanded ? 'opacity-100' : 'opacity-0 max-w-0'}`}>
                    {label}
                </span>
            </button>
            {badgeCount !== undefined && badgeCount > 0 && !isExpanded && (
                <span className="absolute top-1 right-1 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
            {badgeCount !== undefined && badgeCount > 0 && isExpanded && (
                <span className="absolute top-1/2 -translate-y-1/2 right-3 flex items-center justify-center h-5 min-w-[1.25rem] px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {badgeCount}
                </span>
            )}
        </li>
    );
};

interface NavigationRailProps {
    activeView: ActiveView;
    onNavigate: (view: ActiveView) => void;
    dataValidationIssues: number;
}


export const NavigationRail: React.FC<NavigationRailProps> = ({ activeView, onNavigate, dataValidationIssues }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <aside className={`flex-shrink-0 border-r border-slate-200 transition-all duration-300 ease-in-out ${isExpanded ? 'w-56' : 'w-20'}`}>
            <nav className="flex flex-col h-full p-1">
                <div className="mb-4 border-b border-slate-200 pb-1">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="w-full flex justify-center items-center p-1 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    aria-label={isExpanded ? "Collapse navigation" : "Expand navigation"}
                  >
                    <MenuIcon className="w-7 h-7 text-stone-700" />
                  </button>
                </div>

                
                <ul className="space-y-2">
                    <NavItem 
                        icon={<CreditsIcon className="w-6 h-6 flex-shrink-0" />} 
                        label="Credits" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'credits'} 
                        onClick={() => onNavigate('credits')} 
                    />
                    <NavItem 
                        icon={<FileSheetIcon className="w-6 h-6 flex-shrink-0" />} 
                        label="Uploaded Log" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'uploadedLog'} 
                        onClick={() => onNavigate('uploadedLog')} 
                    />
                    <NavItem 
                        icon={<DataHealthIcon className="w-6 h-6 flex-shrink-0" />} 
                        label="Data Health" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'dataHealth'} 
                        onClick={() => onNavigate('dataHealth')} 
                        badgeCount={dataValidationIssues}
                    />
                    <NavItem 
                        icon={<ChartBarIcon className="w-6 h-6 flex-shrink-0" />} 
                        label="Analysis" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'analysis'}
                        onClick={() => onNavigate('analysis')} 
                    />
                    <NavItem 
                        icon={<HistoryIcon className="w-6 h-6 flex-shrink-0" />} 
                        label="History" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'history'}
                        onClick={() => onNavigate('history')} 
                    />
                    <NavItem 
                        icon={<ExportIcon className="w-6 h-6 flex-shrink-0" />} 
                        label="Export" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'export'}
                        onClick={() => onNavigate('export')} 
                    />
                </ul>
            </nav>
        </aside>
    );
};
