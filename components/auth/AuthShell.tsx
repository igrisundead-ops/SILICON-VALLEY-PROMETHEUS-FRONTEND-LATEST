'use client';

import Link from 'next/link';
import React from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeftIcon, Grid2x2PlusIcon, AppleIcon, GithubIcon } from 'lucide-react';
import { FloatingPaths, GoogleIcon, AuthSeparator } from './auth-visuals';

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  showMobileBrandRow?: boolean;
};

export function AuthShell({ title, subtitle, children, showMobileBrandRow = true }: AuthShellProps) {
  return (
    <main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      <div className="bg-muted/60 relative hidden h-full flex-col border-r p-10 lg:flex">
        <div className="from-background absolute inset-0 z-10 bg-gradient-to-t to-transparent" />
        <div className="z-10 flex items-center gap-2">
          <Grid2x2PlusIcon className="size-6" />
          <p className="text-xl font-semibold">Asme</p>
        </div>

        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl">
              &ldquo;This Platform has helped me to save time and serve my clients faster than ever before.&rdquo;
            </p>
            <footer className="font-mono text-sm font-semibold">~ Ali Hassan</footer>
          </blockquote>
        </div>

        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>

      <div className="relative flex min-h-screen flex-col justify-center p-4">
        <div aria-hidden className="absolute inset-0 isolate contain-strict -z-10 opacity-60">
          <div className="bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)] absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 [translate:5%_-50%] rounded-full" />
          <div className="bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full" />
        </div>

        <Button variant="ghost" className="absolute top-7 left-5" asChild>
          <Link href="/">
            <ChevronLeftIcon className="size-4 me-2" />
            Home
          </Link>
        </Button>

        <div className="mx-auto space-y-4 sm:w-sm">
          {showMobileBrandRow ? (
            <div className="flex items-center gap-2 lg:hidden">
              <Grid2x2PlusIcon className="size-6" />
              <p className="text-xl font-semibold">Asme</p>
            </div>
          ) : null}

          <div className="flex flex-col space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-wide">{title}</h1>
            <p className="text-muted-foreground text-base">{subtitle}</p>
          </div>

          <div className="space-y-2">
            <Button type="button" size="lg" className="w-full">
              <GoogleIcon className="size-4 me-2" />
              Continue with Google
            </Button>
            <Button type="button" size="lg" className="w-full">
              <AppleIcon className="size-4 me-2" />
              Continue with Apple
            </Button>
            <Button type="button" size="lg" className="w-full">
              <GithubIcon className="size-4 me-2" />
              Continue with GitHub
            </Button>
          </div>

          <AuthSeparator />

          {children}

          <p className="text-muted-foreground mt-8 text-sm">
            By clicking continue, you agree to our{' '}
            <Link href="/terms" className="hover:text-primary underline underline-offset-4">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:text-primary underline underline-offset-4">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

