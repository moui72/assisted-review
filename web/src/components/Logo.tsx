import { useTheme } from '../theme.tsx';

export function Logo({ className }: { className?: string }) {
  const { theme } = useTheme();
  return (
    <img
      className={className}
      src={theme === 'light' ? '/logo.svg' : '/logo-dark.svg'}
      alt="assisted-review"
    />
  );
}
