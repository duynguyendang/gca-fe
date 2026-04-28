import React, { ReactNode } from 'react';
import { GraphProvider } from './GraphContext';
import { SearchProvider } from './SearchContext';
import { NarrativeProvider } from './NarrativeContext';
import { SettingsProvider } from './SettingsContext';
import { UIProvider } from './UIContext';
import { ToastProvider } from './ToastContext';

export const AppProviders: React.FC<{ children: ReactNode }> = ({ children }) => (
  <ToastProvider>
    <SettingsProvider>
      <UIProvider>
        <GraphProvider>
          <SearchProvider>
            <NarrativeProvider>
              {children}
            </NarrativeProvider>
          </SearchProvider>
        </GraphProvider>
      </UIProvider>
    </SettingsProvider>
  </ToastProvider>
);