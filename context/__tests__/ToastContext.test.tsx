import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { ToastProvider, useToast } from '../ToastContext';

function TestConsumer() {
  const { toasts, addToast, removeToast, success, error, info, warning } = useToast();
  return (
    <div>
      <div data-testid="toast-count">{toasts.length}</div>
      <button data-testid="add-toast" onClick={() => addToast('test msg', 'info')}>Add</button>
      <button data-testid="add-success" onClick={() => success('success msg')}>Success</button>
      <button data-testid="add-error" onClick={() => error('error msg')}>Error</button>
      <button data-testid="add-info" onClick={() => info('info msg')}>Info</button>
      <button data-testid="add-warning" onClick={() => warning('warning msg')}>Warning</button>
      {toasts.map(t => (
        <div key={t.id} data-testid={`toast-${t.id}`}>
          <span data-testid={`toast-msg-${t.id}`}>{t.message}</span>
          <span data-testid={`toast-type-${t.id}`}>{t.type}</span>
          <button data-testid={`remove-${t.id}`} onClick={() => removeToast(t.id)}>X</button>
        </div>
      ))}
    </div>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <TestConsumer />
    </ToastProvider>
  );
}

describe('ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('starts with no toasts', () => {
    renderWithProvider();
    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });

  it('adds a toast via addToast', () => {
    renderWithProvider();
    act(() => { screen.getByTestId('add-toast').click(); });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });

  it('removes a toast via removeToast', () => {
    renderWithProvider();
    act(() => { screen.getByTestId('add-toast').click(); });
    const toastId = screen.getByTestId('toast-count').textContent;
    expect(toastId).toBe('1');
    const removeBtn = document.querySelector('[data-testid^="remove-"]') as HTMLElement;
    act(() => { removeBtn.click(); });
    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });

  it('auto-removes toast after duration', () => {
    renderWithProvider();
    act(() => { screen.getByTestId('add-toast').click(); });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByTestId('toast-count').textContent).toBe('0');
  });

  it('adds toast via success convenience method', () => {
    renderWithProvider();
    act(() => { screen.getByTestId('add-success').click(); });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });

  it('adds toast via error convenience method', () => {
    renderWithProvider();
    act(() => { screen.getByTestId('add-error').click(); });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });

  it('adds toast via info convenience method', () => {
    renderWithProvider();
    act(() => { screen.getByTestId('add-info').click(); });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });

  it('adds toast via warning convenience method', () => {
    renderWithProvider();
    act(() => { screen.getByTestId('add-warning').click(); });
    expect(screen.getByTestId('toast-count').textContent).toBe('1');
  });

  it('throws when useToast is used outside provider', () => {
    function Broken() { useToast(); return null; }
    expect(() => render(<Broken />)).toThrow('useToast must be used within ToastProvider');
  });
});
