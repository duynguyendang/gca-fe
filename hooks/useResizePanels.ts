/**
 * useResizePanels - Hook for handling panel resize
 * Extracted from App.tsx handleMouseMove/handleMouseUp
 */
import { useRef, useEffect, useCallback, useState } from 'react';

interface ResizePanelsConfig {
    initialSidebarWidth?: number;
    initialCodePanelWidth?: number;
    isCodeCollapsed?: boolean;
    setIsCodeCollapsed?: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useResizePanels = (config: ResizePanelsConfig = {}) => {
    const {
        initialSidebarWidth = 280,
        initialCodePanelWidth,
    } = config;

    // Calculate responsive defaults
    const defaultCodePanelWidth = typeof window !== 'undefined'
        ? Math.round(window.innerWidth * 0.35)
        : 500;

    const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
    const [codePanelWidth, setCodePanelWidth] = useState(initialCodePanelWidth ?? defaultCodePanelWidth);

    // Get collapse states from config (passed from useUIContext in App.tsx)
    const {
        isCodeCollapsed,
        setIsCodeCollapsed,
    } = config as any;

    const isResizingSidebar = useRef(false);
    const isResizingCode = useRef(false);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingSidebar.current) {
            setSidebarWidth(Math.max(200, Math.min(500, e.clientX)));
        } else if (isResizingCode.current) {
            setCodePanelWidth(Math.max(300, window.innerWidth - e.clientX));
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        isResizingSidebar.current = false;
        isResizingCode.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }, []);

    // Setup global mouse event listeners
    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    // Resize handlers for UI components
    const startResizeSidebar = useCallback(() => {
        isResizingSidebar.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const startResizeCode = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isResizingCode.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    return {
        // Dimensions
        sidebarWidth,
        codePanelWidth,

        // Collapse states
        isCodeCollapsed,
        setIsCodeCollapsed,

        // Resize handlers
        startResizeSidebar,
        startResizeCode,
    };
};

export default useResizePanels;
