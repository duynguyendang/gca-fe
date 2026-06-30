import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import SuspenseFallback from '../SuspenseFallback';

describe('SuspenseFallback', () => {
  it('renders panel variant by default with aria-busy', () => {
    render(<SuspenseFallback label="Loading Dashboard" />);
    // role="status" with aria-busy="true" lets screen readers announce
    // that a section is being loaded.
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent('Loading Dashboard');
  });

  it('uses default label when none provided', () => {
    render(<SuspenseFallback />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders inline variant without role=region', () => {
    render(<SuspenseFallback variant="inline" label="Opening…" />);
    // Inline variant is decorative — it should not announce itself as a region
    // because it lives inside already-marked-up UI (e.g. a modal trigger).
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Opening…')).toBeInTheDocument();
  });
});