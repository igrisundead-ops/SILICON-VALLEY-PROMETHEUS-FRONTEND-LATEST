'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from "motion/react";
import { AtSignIcon, AppleIcon, ChevronLeftIcon, GithubIcon, Grid2x2PlusIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function FloatingPaths({ position }: { position: number }) {
	const paths = Array.from({ length: 36 }, (_, i) => ({
		id: i,
		d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
			380 - i * 5 * position
		} -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
			152 - i * 5 * position
		} ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
			684 - i * 5 * position
		} ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
		color: `rgba(15,23,42,${0.1 + i * 0.03})`,
		width: 0.5 + i * 0.03,
	}));

	return (
		<div className="pointer-events-none absolute inset-0">
			<svg
				className="h-full w-full text-slate-950 dark:text-white"
				fill="none"
				viewBox="0 0 696 316"
			>
				<title>Background Paths</title>
				{paths.map((path) => (
					<motion.path
						animate={{
							pathLength: 1,
							opacity: [0.3, 0.6, 0.3],
							pathOffset: [0, 1, 0],
						}}
						d={path.d}
						initial={{ pathLength: 0.3, opacity: 0.6 }}
						key={path.id}
						stroke="currentColor"
						strokeOpacity={0.1 + path.id * 0.03}
						strokeWidth={path.width}
						transition={{
							duration: 20 + ((path.id * 13) % 10),
							repeat: Number.POSITIVE_INFINITY,
							ease: "linear",
						}}
					/>
				))}
			</svg>
		</div>
	);
}

export function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        d="M21.35 11.1H12v2.9h5.35c-.24 1.3-1.5 3.8-5.35 3.8-3.22 0-5.86-2.66-5.86-5.9s2.64-5.9 5.86-5.9c1.84 0 3.07.79 3.78 1.47l2.58-2.48C16.87 3.6 14.7 2.5 12 2.5 6.98 2.5 2.9 6.6 2.9 11.9S6.98 21.3 12 21.3c6.93 0 8.62-4.87 8.62-7.39 0-.5-.05-.88-.12-1.21z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AuthSeparator() {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background text-muted-foreground px-2">Or continue with email</span>
      </div>
    </div>
  );
}

export function AuthPage() {
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
          <div className="flex items-center gap-2 lg:hidden">
            <Grid2x2PlusIcon className="size-6" />
            <p className="text-xl font-semibold">Asme</p>
          </div>

          <div className="flex flex-col space-y-1">
            <h1 className="font-heading text-2xl font-bold tracking-wide">Welcome back</h1>
            <p className="text-muted-foreground text-base">Continue with OAuth or email.</p>
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

          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-sm font-medium" htmlFor="auth-email">
                Email
              </label>
              <div className="mt-2 relative">
                <AtSignIcon className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                <Input id="auth-email" type="email" placeholder="you@domain.com" className="peer ps-9" />
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full">
              Continue With Email
            </Button>
          </form>

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
