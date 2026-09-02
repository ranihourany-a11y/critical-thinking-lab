import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'جلسة التفكير الناقد',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
