import { AppShell } from '@/components/app-shell';

export default function Layout({ children }: LayoutProps<'/'>) {
  return <AppShell>{children}</AppShell>;
}
