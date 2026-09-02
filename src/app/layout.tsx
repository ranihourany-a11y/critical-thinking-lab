import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://critical-thinking-lab.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'مختبر التفكير الناقد | منصة الحوار السقراطي للتعليم المتوسط',
    template: '%s | مختبر التفكير الناقد',
  },
  description:
    'تطبيق تعليمي تفاعلي باللغة العربية لتعزيز مهارات التفكير الناقد وحل المشكلات عبر الحوار السقراطي الموجه بالأدلة والمصادر.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-brand-slate-50 text-brand-navy font-cairo antialiased flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
