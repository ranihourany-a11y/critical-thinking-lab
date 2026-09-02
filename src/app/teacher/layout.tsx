import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'بوابة المعلم',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
