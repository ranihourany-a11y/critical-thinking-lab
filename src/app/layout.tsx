import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'مختبر التفكير الناقد | منصة الحوار السقراطي للتعليم المتوسط',
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
