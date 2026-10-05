
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
                className={`flex items-center w-full px-2.5 py-2 rounded-lg transition-colors duration-150 group cursor-pointer ${
                    isActive 
                        ? 'bg-blue-600 text-white shadow-2xs font-semibold' 
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                } ${!isExpanded ? 'justify-center' : 'gap-3'}`}
                title={label}
            >
                <div className="shrink-0 flex items-center justify-center">
                    {icon}
                </div>
                {isExpanded && (
                    <span className="font-medium text-xs whitespace-nowrap overflow-hidden text-ellipsis text-left flex-1">
                        {label}
                    </span>
                )}
            </button>
            {badgeCount !== undefined && badgeCount > 0 && !isExpanded && (
                <span className="absolute top-1 right-1 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            )}
            {badgeCount !== undefined && badgeCount > 0 && isExpanded && (
                <span className={`absolute top-1/2 -translate-y-1/2 right-2 flex items-center justify-center h-4 min-w-[1rem] px-1 text-[10px] font-bold rounded-full ${
                    isActive ? 'bg-white text-blue-700' : 'bg-red-500 text-white'
                }`}>
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
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export const NavigationRail: React.FC<NavigationRailProps> = ({ 
    activeView, 
    onNavigate, 
    dataValidationIssues,
    isExpanded = false,
    onToggleExpand
}) => {
    return (
        <aside className={`bg-white border border-slate-200/90 rounded-xl shadow-2xs flex-shrink-0 transition-all duration-200 ease-in-out ${isExpanded ? 'w-48' : 'w-14'} overflow-hidden flex flex-col`}>
            {/* Top section of the drawer with hamburger button right at the top */}
            <div className="h-9 px-1.5 border-b border-slate-100 flex items-center shrink-0">
                <button
                    onClick={onToggleExpand}
                    className={`flex items-center w-full py-1 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer ${
                        !isExpanded ? 'justify-center px-1' : 'px-2 gap-2.5'
                    }`}
                    title={isExpanded ? "Collapse navigation drawer" : "Expand navigation drawer"}
                    aria-label={isExpanded ? "Collapse navigation drawer" : "Expand navigation drawer"}
                >
                    <MenuIcon className="w-5 h-5 text-slate-700 shrink-0" />
                    {isExpanded && (
                        <span className="font-semibold text-xs text-slate-700 select-none whitespace-nowrap overflow-hidden">
                            Navigation
                        </span>
                    )}
                </button>
            </div>

            <nav className="flex flex-col h-full p-1.5">
                <ul className="space-y-1.5">
                    <NavItem 
                        icon={<FileSheetIcon className="w-5 h-5 flex-shrink-0" />} 
                        label="Uploaded Log" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'uploadedLog'} 
                        onClick={() => onNavigate('uploadedLog')} 
                    />
                    <NavItem 
                        icon={<CreditsIcon className="w-5 h-5 flex-shrink-0" />} 
                        label="Credits" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'credits'} 
                        onClick={() => onNavigate('credits')} 
                    />
                    <NavItem 
                        icon={<DataHealthIcon className="w-5 h-5 flex-shrink-0" />} 
                        label="Data Health" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'dataHealth'} 
                        onClick={() => onNavigate('dataHealth')} 
                        badgeCount={dataValidationIssues}
                    />
                    <NavItem 
                        icon={<ChartBarIcon className="w-5 h-5 flex-shrink-0" />} 
                        label="Analysis" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'analysis'}
                        onClick={() => onNavigate('analysis')} 
                    />
                    <NavItem 
                        icon={<HistoryIcon className="w-5 h-5 flex-shrink-0" />} 
                        label="History" 
                        isExpanded={isExpanded} 
                        isActive={activeView === 'history'}
                        onClick={() => onNavigate('history')} 
                    />
                    <NavItem 
                        icon={<ExportIcon className="w-5 h-5 flex-shrink-0" />} 
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
