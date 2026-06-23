// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { ErrorBanner } from '../../web/src/components/ErrorBanner.tsx';

describe('ErrorBanner', () => {
  it('renders its children', () => {
    render(<ErrorBanner>Something went wrong</ErrorBanner>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('applies an extra className when provided', () => {
    const { container } = render(<ErrorBanner className="mt-4">error</ErrorBanner>);
    expect(container.firstChild).toHaveClass('mt-4');
  });

  it('renders without a className when none is provided', () => {
    const { container } = render(<ErrorBanner>error</ErrorBanner>);
    // Should still render the root element
    expect(container.firstChild).toBeInTheDocument();
  });
});
