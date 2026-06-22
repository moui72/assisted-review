import { useTheme } from '../theme.tsx';

export function Logo({ className, variant = 'full' }: { className?: string; variant?: 'full' | 'icon' }) {
  const { theme } = useTheme();
  const light = variant === 'icon' ? '/icon.svg' : '/logo.svg';
  const dark = variant === 'icon' ? '/icon-dark.svg' : '/logo-dark.svg';
  return (
    <img
      className={className}
      src={theme === 'light' ? light : dark}
      alt="assisted-review"
    />
  );
}
