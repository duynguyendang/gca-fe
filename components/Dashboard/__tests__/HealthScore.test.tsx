import { describe, it, expect } from 'vitest';
import { HealthScore } from '../HealthScore';
import { render } from '@testing-library/react';

describe('HealthScore', () => {
  it('renders score between 0-100', () => {
    const { container } = render(<HealthScore score={75} />);
    expect(container.textContent).toContain('75');
  });

  it('shows Healthy label for score >= 80', () => {
    const { container } = render(<HealthScore score={85} />);
    expect(container.textContent).toContain('Healthy');
  });

  it('shows Warning label for score >= 50 and < 80', () => {
    const { container } = render(<HealthScore score={65} />);
    expect(container.textContent).toContain('Warning');
  });

  it('shows Critical label for score < 50', () => {
    const { container } = render(<HealthScore score={30} />);
    expect(container.textContent).toContain('Critical');
  });

  it('renders SVG arc elements', () => {
    const { container } = render(<HealthScore score={60} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('handles edge case score of 0', () => {
    const { container } = render(<HealthScore score={0} />);
    expect(container.textContent).toContain('Critical');
  });

  it('handles max score of 100', () => {
    const { container } = render(<HealthScore score={100} />);
    expect(container.textContent).toContain('Healthy');
  });
});