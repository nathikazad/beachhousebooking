
import '@/styles/globals.css';
import '@/styles/globalIcon.css';
import { Plus_Jakarta_Sans } from 'next/font/google'

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Next.js and Supabase Starter Kit",
  description: "The fastest way to build apps with Next.js and Supabase",
};

const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["400", "700"],
  subsets: ['latin'],
  display: 'swap',
})

import type { AppProps } from 'next/app';
import ProtectedLayout from 'src/layouts/ProtectedLayout';
import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/utils/supabase/client';

const DefaultLayout = ({ children }: { children: ReactNode }) => {
  return (
    <>
      {children}
    </>
  );
};
function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const currentPath = router.pathname;
  const [isLaptopOrMore, setisLaptopOrMore] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setisLaptopOrMore(window.innerWidth > 1023);
    };

    // Set the initial state
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;

      if (userId) {
        if (currentPath === '/login') {
          router.push('/protected/logs');
        }
      } else {
        if ((currentPath !== '/login') && (currentPath !== '/client') && (currentPath !== '/privacy')) {
          router.push('/login');
        }
      }
    };

    checkUser();
  }, [currentPath, router]);


  const useNoLayout = (!isLaptopOrMore && (currentPath === '/protected/booking/create' || currentPath === '/protected/booking/[id]')) || currentPath === '/client' || currentPath === '/login' || currentPath === '/privacy'
  const Layout = !useNoLayout ? ProtectedLayout : DefaultLayout;
  return <main className={`${plusJakartaSans.className} min-h-screen flex flex-col items-center w-full container !select-none`}> <Layout><Component {...pageProps} /></Layout> </main>
}

export default MyApp;

