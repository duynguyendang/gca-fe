
/**
 * Organizes nodes into a directory tree structure based on file paths.
 */
export const stratifyPaths = (nodes: any[], filePaths: string[] = []) => {
    const root: any = { _isFolder: true, children: {} };

    if (Array.isArray(filePaths)) {
        filePaths.forEach(path => {
            if (typeof path !== 'string') return;
            const parts = path.split('/');
            let current = root;
            parts.forEach((part, i) => {
                const isLastPart = i === parts.length - 1;
                if (!current.children[part]) {
                    current.children[part] = {
                        _isFolder: !isLastPart,
                        _isFile: isLastPart,
                        children: {},
                        _symbols: []
                    };
                }
                current = current.children[part];
            });
        });
    }

    if (Array.isArray(nodes)) {
        nodes.forEach(node => {
            if (!node || !node.id) return;
            // Handle node IDs that might be just filepath or filepath:symbol
            const [filePath, symbol] = node.id.split(':');
            if (!filePath) return;

            const parts = filePath.split('/');
            let current = root;

            parts.forEach((part, i) => {
                const isLastPart = i === parts.length - 1;
                if (!current.children[part]) {
                    current.children[part] = {
                        _isFolder: !isLastPart,
                        _isFile: isLastPart,
                        children: {},
                        _symbols: []
                    };
                }
                if (isLastPart && symbol) {
                    if (!current.children[part]._symbols.find((s: any) => s.node.id === node.id)) {
                        current.children[part]._symbols.push({ name: symbol, node });
                    }
                }
                current = current.children[part];
            });
        });
    }

    return root.children;
};
