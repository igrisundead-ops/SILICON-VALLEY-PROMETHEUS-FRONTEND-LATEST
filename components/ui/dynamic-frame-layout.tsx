"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface DynamicFrame {
    id: number;
    video: string;
    poster?: string;
    defaultPos: { x: number; y: number; w: number; h: number };
    corner?: string;
    edgeHorizontal?: string;
    edgeVertical?: string;
    mediaSize?: number;
    borderThickness?: number;
    borderSize?: number;
    isHovered?: boolean;
    title?: string;
    headline?: string;
    description?: string;
    align?: "top-left" | "bottom-left" | "bottom-right";
    priority?: boolean;
}

interface FrameComponentProps {
    frame: DynamicFrame;
    width: number | string;
    height: number | string;
    className?: string;
    showFrame: boolean;
    isHovered: boolean;
}

function FrameComponent({ frame, width, height, className, showFrame, isHovered }: FrameComponentProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [shouldLoadVideo, setShouldLoadVideo] = useState(Boolean(frame.priority));
    const [videoReady, setVideoReady] = useState(false);
    const [videoErrored, setVideoErrored] = useState(false);

    useEffect(() => {
        setVideoReady(false);
        setVideoErrored(false);
        setShouldLoadVideo(Boolean(frame.priority));
    }, [frame.priority, frame.video]);

    useEffect(() => {
        if (!isHovered || shouldLoadVideo) return;
        setShouldLoadVideo(true);
    }, [isHovered, shouldLoadVideo]);

    useEffect(() => {
        if (shouldLoadVideo || frame.priority) return;

        type IdleWindow = Window & {
            requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number;
            cancelIdleCallback?: (id: number) => void;
        };

        const win = window as IdleWindow;
        let idleId: number | null = null;
        let timeoutId: number | null = null;
        const activate = () => setShouldLoadVideo(true);

        if (typeof win.requestIdleCallback === "function") {
            idleId = win.requestIdleCallback(activate, { timeout: 3000 + frame.id * 120 });
        } else {
            timeoutId = window.setTimeout(activate, 1800 + frame.id * 100);
        }

        return () => {
            if (idleId !== null && typeof win.cancelIdleCallback === "function") {
                win.cancelIdleCallback(idleId);
            }
            if (timeoutId !== null) {
                window.clearTimeout(timeoutId);
            }
        };
    }, [frame.id, frame.priority, shouldLoadVideo]);

    useEffect(() => {
        if (!videoRef.current || !shouldLoadVideo || videoErrored) return;
        if (isHovered) {
            void videoRef.current.play().catch(() => {
                // Browser can block playback if policies change.
            });
            return;
        }
        videoRef.current.pause();
    }, [isHovered, shouldLoadVideo, videoErrored]);

    const mediaSize = frame.mediaSize ?? 1;
    const borderThickness = frame.borderThickness ?? 12;
    const borderSize = frame.borderSize ?? 92;
    const hasAssetFrame = Boolean(frame.corner && frame.edgeHorizontal && frame.edgeVertical);

    const overlayAlignmentClass =
        frame.align === "bottom-left"
            ? "items-end justify-start text-left"
            : frame.align === "bottom-right"
              ? "items-end justify-end text-right"
              : "items-start justify-start text-left";

    return (
        <div
            className={cn("relative", className)}
            style={{
                width,
                height,
                transition: "width 0.35s ease-in-out, height 0.35s ease-in-out",
                contain: "layout paint size",
            }}
        >
            <div className="relative h-full w-full overflow-hidden rounded-[20px] bg-black">
                <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                        zIndex: 1,
                        transition: "all 0.35s ease-in-out",
                        padding: showFrame ? `${borderThickness}px` : "0",
                        width: showFrame ? `${borderSize}%` : "100%",
                        height: showFrame ? `${borderSize}%` : "100%",
                        left: showFrame ? `${(100 - borderSize) / 2}%` : "0",
                        top: showFrame ? `${(100 - borderSize) / 2}%` : "0",
                    }}
                >
                    <div
                        className="h-full w-full overflow-hidden rounded-[16px]"
                        style={{
                            transform: `scale(${mediaSize})`,
                            transformOrigin: "center",
                            transition: "transform 0.35s ease-in-out",
                        }}
                    >
                        <img
                            className={cn(
                                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                                videoReady && !videoErrored ? "opacity-0" : "opacity-100"
                            )}
                            src={frame.poster ?? "/placeholder.jpg"}
                            alt=""
                            loading="lazy"
                            draggable={false}
                        />
                        {shouldLoadVideo && !videoErrored && (
                            <video
                                className={cn(
                                    "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                                    videoReady ? "opacity-100" : "opacity-0"
                                )}
                                src={frame.video}
                                loop
                                muted
                                playsInline
                                preload="none"
                                ref={videoRef}
                                onLoadedData={() => setVideoReady(true)}
                                onCanPlay={() => setVideoReady(true)}
                                onError={() => setVideoErrored(true)}
                            />
                        )}
                    </div>
                </div>

                <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-black/45 via-black/10 to-transparent" />

                {(frame.title || frame.headline || frame.description) && (
                    <div className={cn("absolute inset-0 z-[4] flex p-4 sm:p-5", overlayAlignmentClass)}>
                        <div className="max-w-[88%] space-y-1.5 rounded-xl border border-white/12 bg-black/45 px-3 py-2.5 backdrop-blur-sm">
                            {frame.title && (
                                <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-white/75">{frame.title}</div>
                            )}
                            {frame.headline && (
                                <div className="font-[Georgia] text-lg font-semibold leading-tight tracking-tight text-white sm:text-2xl">
                                    {frame.headline}
                                </div>
                            )}
                            {frame.description && (
                                <div className="max-h-[2.8em] max-w-[240px] overflow-hidden text-[11px] leading-[1.35] text-white/80 sm:max-w-[280px] sm:text-xs">
                                    {frame.description}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {showFrame &&
                    (hasAssetFrame ? (
                        <div className="pointer-events-none absolute inset-0 z-[5]">
                            <div
                                className="absolute left-0 top-0 h-16 w-16 bg-contain bg-no-repeat"
                                style={{ backgroundImage: `url(${frame.corner})` }}
                            />
                            <div
                                className="absolute right-0 top-0 h-16 w-16 bg-contain bg-no-repeat"
                                style={{ backgroundImage: `url(${frame.corner})`, transform: "scaleX(-1)" }}
                            />
                            <div
                                className="absolute bottom-0 left-0 h-16 w-16 bg-contain bg-no-repeat"
                                style={{ backgroundImage: `url(${frame.corner})`, transform: "scaleY(-1)" }}
                            />
                            <div
                                className="absolute bottom-0 right-0 h-16 w-16 bg-contain bg-no-repeat"
                                style={{ backgroundImage: `url(${frame.corner})`, transform: "scale(-1, -1)" }}
                            />
                            <div
                                className="absolute left-16 right-16 top-0 h-16"
                                style={{
                                    backgroundImage: `url(${frame.edgeHorizontal})`,
                                    backgroundSize: "auto 64px",
                                    backgroundRepeat: "repeat-x",
                                }}
                            />
                            <div
                                className="absolute bottom-0 left-16 right-16 h-16"
                                style={{
                                    backgroundImage: `url(${frame.edgeHorizontal})`,
                                    backgroundSize: "auto 64px",
                                    backgroundRepeat: "repeat-x",
                                    transform: "rotate(180deg)",
                                }}
                            />
                            <div
                                className="absolute bottom-16 left-0 top-16 w-16"
                                style={{
                                    backgroundImage: `url(${frame.edgeVertical})`,
                                    backgroundSize: "64px auto",
                                    backgroundRepeat: "repeat-y",
                                }}
                            />
                            <div
                                className="absolute bottom-16 right-0 top-16 w-16"
                                style={{
                                    backgroundImage: `url(${frame.edgeVertical})`,
                                    backgroundSize: "64px auto",
                                    backgroundRepeat: "repeat-y",
                                    transform: "scaleX(-1)",
                                }}
                            />
                        </div>
                    ) : (
                        <div className="pointer-events-none absolute inset-0 z-[5] rounded-[20px] border border-white/40" />
                    ))}
            </div>
        </div>
    );
}

interface DynamicFrameLayoutProps {
    frames: DynamicFrame[];
    className?: string;
    showFrames?: boolean;
    hoverSize?: number;
    gapSize?: number;
}

export function DynamicFrameLayout({
    frames: initialFrames,
    className,
    showFrames = false,
    hoverSize = 6,
    gapSize = 4,
}: DynamicFrameLayoutProps) {
    const [frames] = useState<DynamicFrame[]>(initialFrames);
    const [hovered, setHovered] = useState<{ row: number; col: number } | null>(null);

    const getRowSizes = () => {
        if (hovered === null) return "4fr 4fr 4fr";
        const nonHoveredSize = (12 - hoverSize) / 2;
        return [0, 1, 2]
            .map((row) => (row === hovered.row ? `${hoverSize}fr` : `${nonHoveredSize}fr`))
            .join(" ");
    };

    const getColSizes = () => {
        if (hovered === null) return "4fr 4fr 4fr";
        const nonHoveredSize = (12 - hoverSize) / 2;
        return [0, 1, 2]
            .map((col) => (col === hovered.col ? `${hoverSize}fr` : `${nonHoveredSize}fr`))
            .join(" ");
    };

    const getTransformOrigin = (x: number, y: number) => {
        const vertical = y === 0 ? "top" : y === 4 ? "center" : "bottom";
        const horizontal = x === 0 ? "left" : x === 4 ? "center" : "right";
        return `${vertical} ${horizontal}`;
    };

    return (
        <div
            className={cn("relative h-full w-full", className)}
            style={{
                display: "grid",
                gridTemplateRows: getRowSizes(),
                gridTemplateColumns: getColSizes(),
                gap: `${gapSize}px`,
                transition: "grid-template-rows 0.34s ease, grid-template-columns 0.34s ease",
            }}
        >
            {frames.map((frame) => {
                const row = Math.floor(frame.defaultPos.y / 4);
                const col = Math.floor(frame.defaultPos.x / 4);
                const transformOrigin = getTransformOrigin(frame.defaultPos.x, frame.defaultPos.y);

                return (
                    <motion.div
                        key={frame.id}
                        className="relative"
                        style={{
                            transformOrigin,
                            transition: "transform 0.34s ease",
                        }}
                        onMouseEnter={() =>
                            setHovered((prev) =>
                                prev && prev.row === row && prev.col === col ? prev : { row, col }
                            )
                        }
                        onMouseLeave={() => setHovered(null)}
                    >
                        <FrameComponent
                            frame={frame}
                            width="100%"
                            height="100%"
                            className="absolute inset-0"
                            showFrame={showFrames}
                            isHovered={hovered?.row === row && hovered?.col === col}
                        />
                    </motion.div>
                );
            })}
        </div>
    );
}
