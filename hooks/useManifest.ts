
import { useState, useEffect } from 'react';
import { fetchManifest } from '../services/graphService';

interface ManifestData {
    F: Record<string, string>;
    S: Record<string, number>;
}

export function useManifest(apiBase: string, projectId: string) {
    const [manifest, setManifest] = useState<ManifestData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!apiBase || !projectId) return;

        setLoading(true);
        fetchManifest(apiBase, projectId)
            .then(data => {
                setManifest(data);
                setLoading(false);
                console.log('[useManifest] Loaded manifest:', {
                    files: Object.keys(data.F).length,
                    symbols: Object.keys(data.S).length
                });
            })
            .catch(err => {
                console.error('[useManifest] Error loading manifest:', err);
                setError(err.message);
                setLoading(false);
            });
    }, [apiBase, projectId]);

    return { manifest, loading, error };
}
