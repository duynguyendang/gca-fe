import { useEffect } from 'react';
import { ASTNode, FlatGraph } from '../types';
import { logger } from '../logger';

export const useSessionStorage = (
  astData: ASTNode | FlatGraph | null,
  sandboxFiles: Record<string, any>,
  dataApiBase: string
) => {
  // Persist AST data to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('gca_ast_data', JSON.stringify(astData));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        logger.debug('Session storage quota exceeded, persistence disabled for this session.');
      } else {
        logger.warn('Failed to save AST data to session storage:', e);
      }
    }
  }, [astData]);

  // Persist sandbox files to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('gca_sandbox_files', JSON.stringify(sandboxFiles));
    } catch (e) {
      logger.warn('Failed to save sandbox files to session storage:', e);
    }
  }, [sandboxFiles]);

  // Persist API base URL
  useEffect(() => {
    if (dataApiBase) {
      sessionStorage.setItem('gca_api_base_v2', dataApiBase);
    }
  }, [dataApiBase]);
};
