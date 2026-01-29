/**
 * useResizePanels - Hook for handling panel resize
 * Extracted from App.tsx handleMouseMove/handleMouseUp
 */
import { useRef, useEffect, useCallback, useState } from 'react';

interface ResizePanelsConfig {
    initialSidebarWidth?: number;
    initialCodePanelWidth?: number;
    initialSynthesisHeight?: number;
}

export const useResizePanels = (config: ResizePanelsConfig = {}) => {
    const {
        initialSidebarWidth = 280,
        initialCodePanelWidth,
        initialSynthesisHeight,
    } = config;

    // Calculate responsive defaults
    const defaultCodePanelWidth = typeof window !== 'undefined'
        ? Math.round(window.innerWidth * 0.35)
        : 500;
    const defaultSynthesisHeight = typeof window !== 'undefined'
        ? Math.round(window.innerHeight * 0.5)
        : 400;

    const [sidebarWidth, setSidebarWidth] = useState(initialSidebarWidth);
    const [codePanelWidth, setCodePanelWidth] = useState(initialCodePanelWidth ?? defaultCodePanelWidth);
    const [synthesisHeight, setSynthesisHeight] = useState(initialSynthesisHeight ?? defaultSynthesisHeight);

    const [isCodeCollapsed, setIsCodeCollapsed] = useState(false);
    const [isSynthesisCollapsed, setIsSynthesisCollapsed] = useState(false);

    const isResizingSidebar = useRef(false);
    const isResizingCode = useRef(false);
    const isResizingSynthesis = useRef(false);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isResizingSidebar.current) {
            setSidebarWidth(Math.max(200, Math.min(500, e.clientX)));
        } else if (isResizingCode.current) {
            setCodePanelWidth(Math.max(300, window.innerWidth - e.clientX));
        } else if (isResizingSynthesis.current) {
            // Calculate from bottom of viewport
            const newHeight = window.innerHeight - e.clientY;
            setSynthesisHeight(Math.max(100, Math.min(window.innerHeight - 200, newHeight)));
        }
    }, []);

    const handleMouseUp = useCallback(() => {
        isResizingSidebar.current = false;
        isResizingCode.current = false;
        isResizingSynthesis.current = false;
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

    const startResizeCodePanel = useCallback(() => {
        isResizingCode.current = true;
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    }, []);

    const startResizeSynthesis = useCallback(() => {
        isResizingSynthesis.current = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
    }, []);

    return {
        // Dimensions
        sidebarWidth,
        codePanelWidth,
        synthesisHeight,
        setSynthesisHeight,

        // Collapse states
        isCodeCollapsed,
        setIsCodeCollapsed,
        isSynthesisCollapsed,
        setIsSynthesisCollapsed,

        // Resize handlers
        startResizeSidebar,
        startResizeCodePanel,
        startResizeSynthesis,
    };
};

export default useResizePanels;
