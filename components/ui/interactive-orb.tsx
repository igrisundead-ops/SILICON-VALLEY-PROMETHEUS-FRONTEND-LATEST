"use client";

import * as React from "react";
import {
    motion,
    useMotionTemplate,
    useMotionValue,
    useSpring,
    useTransform,
} from "framer-motion";
import { cn } from "@/lib/utils";

type OrbIntensity = "subtle" | "normal" | "vivid";

export interface InteractiveOrbProps {
    size?: number;
    className?: string;
    intensity?: OrbIntensity;
}

const intensityMap: Record<OrbIntensity, { glow: number; blur: number; contrast: number }> = {
    subtle: { glow: 0.42, blur: 10, contrast: 1.65 },
    normal: { glow: 0.58, blur: 13, contrast: 1.95 },
    vivid: { glow: 0.74, blur: 17, contrast: 2.25 },
};

export function InteractiveOrb({ size = 112, className, intensity = "normal" }: InteractiveOrbProps) {
    const ref = React.useRef<HTMLDivElement>(null);
    const [hovered, setHovered] = React.useState(false);

    // Pointer values in normalized -1..1 space.
    const pointerX = useMotionValue(0);
    const pointerY = useMotionValue(0);

    // Smooth springs so motion feels fluid.
    const sx = useSpring(pointerX, { stiffness: 120, damping: 18, mass: 0.35 });
    const sy = useSpring(pointerY, { stiffness: 120, damping: 18, mass: 0.35 });

    const config = intensityMap[intensity];

    const tiltX = useTransform(sy, [-1, 1], [10, -10]);
    const tiltY = useTransform(sx, [-1, 1], [-12, 12]);
    const angleA = useTransform(sx, [-1, 1], [22, 68]);
    const angleB = useTransform(sy, [-1, 1], [250, 320]);

    const c1x = useTransform(sx, [-1, 1], [28, 72]);
    const c1y = useTransform(sy, [-1, 1], [24, 68]);
    const c2x = useTransform(sx, [-1, 1], [70, 34]);
    const c2y = useTransform(sy, [-1, 1], [32, 74]);
    const c3x = useTransform(sx, [-1, 1], [42, 58]);
    const c3y = useTransform(sy, [-1, 1], [58, 42]);

    // Dynamic contour response: the conic "bands" and radial focus move with the cursor.
    const contourBackground = useMotionTemplate`
        conic-gradient(
            from ${angleA}deg at ${c1x}% ${c1y}%,
            rgba(231,196,255,0.95) 0deg,
            rgba(126,103,255,0.72) 45deg,
            transparent 108deg 276deg,
            rgba(110,203,255,0.82) 332deg,
            rgba(231,196,255,0.95) 360deg
        ),
        conic-gradient(
            from ${angleB}deg at ${c2x}% ${c2y}%,
            rgba(198,145,255,0.68) 0deg,
            transparent 70deg 290deg,
            rgba(98,225,255,0.6) 360deg
        ),
        radial-gradient(
            ellipse 105% 85% at ${c3x}% ${c3y}%,
            rgba(183,123,255,0.55) 0%,
            rgba(130,85,242,0.35) 36%,
            transparent 72%
        )
    `;

    const hotspotBackground = useMotionTemplate`
        radial-gradient(
            circle at ${c1x}% ${c1y}%,
            rgba(255,255,255,${hovered ? 0.66 : 0.52}) 0%,
            rgba(222,196,255,0.34) 24%,
            transparent 62%
        )
    `;

    const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const relativeX = (event.clientX - rect.left) / rect.width - 0.5;
        const relativeY = (event.clientY - rect.top) / rect.height - 0.5;
        pointerX.set(relativeX * 2);
        pointerY.set(relativeY * 2);
    };

    const handlePointerLeave = () => {
        setHovered(false);
        pointerX.set(0);
        pointerY.set(0);
    };

    return (
        <div
            ref={ref}
            className={cn("relative grid place-items-center", className)}
            style={{ width: size, height: size, perspective: 900 }}
            onPointerMove={handlePointerMove}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={handlePointerLeave}
        >
            <motion.div
                aria-hidden="true"
                className="absolute inset-[-28%] rounded-full"
                style={{
                    background:
                        "radial-gradient(circle, rgba(172,127,255,0.4) 0%, rgba(112,79,214,0.16) 40%, rgba(0,0,0,0) 75%)",
                    filter: "blur(22px)",
                    opacity: config.glow,
                }}
                animate={{ scale: [0.94, 1.08, 0.94], opacity: [config.glow * 0.84, config.glow, config.glow * 0.84] }}
                transition={{ duration: 5.6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />

            <motion.div
                aria-hidden="true"
                className="absolute inset-[8%] rounded-full"
                style={{
                    background: contourBackground,
                    filter: `blur(${config.blur}px) contrast(${config.contrast}) saturate(1.24)`,
                    rotateX: tiltX,
                    rotateY: tiltY,
                    transformStyle: "preserve-3d",
                }}
                animate={{ rotate: [0, 360] }}
                transition={{ duration: hovered ? 9 : 15, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />

            <motion.div
                aria-hidden="true"
                className="absolute inset-[16%] rounded-full border border-white/18"
                style={{
                    rotateX: tiltX,
                    rotateY: tiltY,
                    transformStyle: "preserve-3d",
                    background:
                        "radial-gradient(circle at 34% 25%, rgba(255,255,255,0.93) 0%, rgba(229,205,255,0.64) 20%, rgba(137,98,236,0.78) 57%, rgba(24,11,52,0.98) 100%)",
                    boxShadow: "inset -10px -14px 30px rgba(0,0,0,0.44), inset 10px 12px 26px rgba(255,255,255,0.2)",
                }}
            >
                <motion.div
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full"
                    style={{ background: hotspotBackground, mixBlendMode: "screen" }}
                />
            </motion.div>

            <motion.div
                aria-hidden="true"
                className="absolute inset-0 rounded-full border border-violet-200/18"
                animate={{
                    opacity: hovered ? [0.58, 0.16, 0.58] : [0.42, 0.12, 0.42],
                    scale: hovered ? [0.97, 1.11, 0.97] : [0.98, 1.06, 0.98],
                }}
                transition={{ duration: hovered ? 3.8 : 6.2, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            />
        </div>
    );
}
