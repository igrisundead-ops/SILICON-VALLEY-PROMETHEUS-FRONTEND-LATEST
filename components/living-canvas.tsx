"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AudioWaveform,
  ChevronDown,
  Droplets,
  Film,
  Scissors,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProcessingJob } from "@/lib/types";

type NodeKind = "source" | "grade" | "cut" | "transition" | "audio" | "prompt";

type CanvasNode = {
  id: string;
  parentId?: string;
  kind: NodeKind;
  title: string;
  prompt: string;
  startMs: number;
  endMs: number;
  x: number;
  y: number;
  fromPipeline?: boolean;
};

type CanvasEdge = {
  id: string;
  from: CanvasNode;
  to: CanvasNode;
  path: string;
};

type ViewportState = {
  x: number;
  y: number;
  scale: number;
};

type Ripple = {
  id: string;
  x: number;
  y: number;
};

export interface LivingCanvasProps {
  projectId: string;
  job: ProcessingJob | null;
  className?: string;
}

const CANVAS_WORLD_WIDTH = 2800;
const CANVAS_WORLD_HEIGHT = 1700;
const BLOCK_WIDTH = 320;
const BLOCK_HEIGHT = 208;
const CHRONO_WIDTH = 280;
const CHRONO_HEIGHT = 140;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 1.8;

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatHms(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hh = `${Math.floor(totalSec / 3600)}`.padStart(2, "0");
  const mm = `${Math.floor((totalSec % 3600) / 60)}`.padStart(2, "0");
  const ss = `${totalSec % 60}`.padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function inferKindFromPrompt(prompt: string): NodeKind {
  const p = prompt.toLowerCase();
  if (p.includes("color") || p.includes("tone") || p.includes("grade")) return "grade";
  if (p.includes("cut") || p.includes("trim") || p.includes("pace")) return "cut";
  if (p.includes("transition")) return "transition";
  if (p.includes("audio") || p.includes("sound") || p.includes("voice") || p.includes("music")) {
    return "audio";
  }
  return "prompt";
}

function nodeIcon(kind: NodeKind) {
  switch (kind) {
    case "grade":
      return Droplets;
    case "cut":
      return Scissors;
    case "transition":
      return Film;
    case "audio":
      return AudioWaveform;
    case "source":
      return Sparkles;
    default:
      return WandSparkles;
  }
}

function nodeBlockLabel(kind: NodeKind) {
  switch (kind) {
    case "source":
      return "Source Block";
    case "grade":
      return "Color Block";
    case "cut":
      return "Rhythm Block";
    case "transition":
      return "Transition Block";
    case "audio":
      return "Audio Block";
    default:
      return "Follow-up Block";
  }
}

function excerpt(text: string, size: number) {
  if (text.length <= size) return text;
  return `${text.slice(0, size).trim()}...`;
}

function buildSeedNodes(job: ProcessingJob | null): CanvasNode[] {
  const prompt = job?.input.prompt?.trim() || "Initial upload prepared for cinematic refinement.";
  const scenes = job?.artifacts.scenes ?? [];
  const totalMs = scenes.length > 0 ? scenes[scenes.length - 1]!.endMs : 66_000;

  const root: CanvasNode = {
    id: "root",
    kind: "source",
    title: "Source Ingest",
    prompt,
    startMs: 0,
    endMs: Math.max(4_000, Math.round(totalMs * 0.12)),
    x: 220,
    y: 560,
    fromPipeline: true,
  };

  const steps = job?.steps ?? [
    { key: "video-analysis", title: "Video Analysis" },
    { key: "scene-detection", title: "Scene Detection" },
    { key: "audio-processing", title: "Audio Processing" },
    { key: "ai-enhancement", title: "AI Enhancement" },
  ];

  const pipeline: CanvasNode[] = steps.map((step, idx) => {
    const startMs = Math.round((idx / (steps.length + 1)) * totalMs);
    const endMs = Math.round(((idx + 1.15) / (steps.length + 1)) * totalMs);
    const yOffsetPattern = [-120, -20, 90, -70, 65, -40];
    const kindByStep =
      step.key === "audio-processing"
        ? "audio"
        : step.key === "scene-detection"
          ? "cut"
          : step.key === "ai-enhancement"
            ? "grade"
            : "prompt";
    const promptByStep =
      step.key === "video-analysis"
        ? "Analyze motion and identify key pacing inflection points."
        : step.key === "scene-detection"
          ? "Tighten cuts and improve rhythm around the strongest beats."
          : step.key === "audio-processing"
            ? "Balance voice, shape music bed, and remove harsh frequencies."
            : "Enhance cinematic polish with nuanced contrast and depth.";
    return {
      id: `pipeline_${idx + 1}`,
      parentId: idx === 0 ? root.id : `pipeline_${idx}`,
      kind: kindByStep,
      title: step.title,
      prompt: promptByStep,
      startMs,
      endMs,
      x: 640 + idx * 450,
      y: 540 + yOffsetPattern[idx % yOffsetPattern.length]!,
      fromPipeline: true,
    };
  });

  return [root, ...pipeline];
}

function buildEdge(from: CanvasNode, to: CanvasNode): CanvasEdge {
  const sx = from.x + BLOCK_WIDTH;
  const sy = from.y + BLOCK_HEIGHT / 2;
  const ex = to.x;
  const ey = to.y + BLOCK_HEIGHT / 2;
  const curvature = Math.max(130, Math.abs(ex - sx) * 0.42);
  const c1x = sx + curvature;
  const c1y = sy;
  const c2x = ex - curvature;
  const c2y = ey;
  return {
    id: `${from.id}->${to.id}`,
    from,
    to,
    path: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${ex} ${ey}`,
  };
}

export function LivingCanvas({ projectId, job, className }: LivingCanvasProps) {
  const surfaceRef = React.useRef<HTMLDivElement>(null);
  const [surfaceSize, setSurfaceSize] = React.useState({ width: 0, height: 0 });
  const [viewport, setViewport] = React.useState<ViewportState>({ x: 120, y: -20, scale: 0.8 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [nodes, setNodes] = React.useState<CanvasNode[]>(() => buildSeedNodes(job));
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = React.useState<string | null>(null);
  const [recentNodeId, setRecentNodeId] = React.useState<string | null>(null);
  const [refineNodeId, setRefineNodeId] = React.useState<string | null>(null);
  const [refineDraft, setRefineDraft] = React.useState("");
  const [refiningNodeId, setRefiningNodeId] = React.useState<string | null>(null);
  const [commandPrompt, setCommandPrompt] = React.useState("");
  const [ripples, setRipples] = React.useState<Ripple[]>([]);
  const panRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  React.useEffect(() => {
    setNodes(buildSeedNodes(job));
    setHoveredNodeId(null);
    setFocusedNodeId(null);
    setRecentNodeId(null);
    setRefineNodeId(null);
    setCommandPrompt("");
  }, [projectId, job?.id]);

  React.useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const read = () => setSurfaceSize({ width: el.clientWidth, height: el.clientHeight });
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const edges = React.useMemo(() => {
    const byId = new Map(nodes.map((n) => [n.id, n]));
    return nodes
      .filter((n) => n.parentId)
      .map((node) => {
        const parent = byId.get(node.parentId!);
        if (!parent) return null;
        return buildEdge(parent, node);
      })
      .filter(Boolean) as CanvasEdge[];
  }, [nodes]);

  const totalDurationMs = React.useMemo(() => {
    const nodeMax = nodes.reduce((max, n) => Math.max(max, n.endMs), 0);
    const sceneMax = job?.artifacts.scenes.length
      ? job.artifacts.scenes[job.artifacts.scenes.length - 1]!.endMs
      : 0;
    return Math.max(nodeMax, sceneMax, 60_000);
  }, [job, nodes]);

  const hoveredNode = React.useMemo(
    () => nodes.find((node) => node.id === hoveredNodeId) ?? null,
    [hoveredNodeId, nodes]
  );

  const chronoPosition = React.useMemo(() => {
    if (!hoveredNode || surfaceSize.width === 0) return null;
    const centerX = viewport.x + (hoveredNode.x + BLOCK_WIDTH / 2) * viewport.scale;
    const y = viewport.y + (hoveredNode.y - CHRONO_HEIGHT - 14) * viewport.scale;
    const left = clamp(centerX - CHRONO_WIDTH / 2, 12, Math.max(12, surfaceSize.width - CHRONO_WIDTH - 12));
    const top = clamp(y, 12, Math.max(12, surfaceSize.height - CHRONO_HEIGHT - 12));
    return { left, top };
  }, [hoveredNode, surfaceSize.height, surfaceSize.width, viewport.scale, viewport.x, viewport.y]);

  const triggerRipple = React.useCallback((x: number, y: number) => {
    const id = uid("ripple");
    setRipples((prev) => [...prev, { id, x, y }]);
    window.setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== id));
    }, 1200);
  }, []);

  const suggestNodePlacement = React.useCallback(
    (parent: CanvasNode | null) => {
      if (!parent) {
        return {
          x: 280 + nodes.length * 340,
          y: 560 + ((nodes.length % 2 === 0 ? -1 : 1) * 86),
        };
      }
      const siblingCount = nodes.filter((n) => n.parentId === parent.id).length;
      const yOffsets = [-160, -48, 72, 148, -210, 230];
      return {
        x: parent.x + 450,
        y: parent.y + yOffsets[siblingCount % yOffsets.length]!,
      };
    },
    [nodes]
  );

  const spawnNode = React.useCallback(
    (params: { parentId?: string; title: string; prompt: string; kind: NodeKind; startMs: number; endMs: number }) => {
      const parent = params.parentId ? nodes.find((n) => n.id === params.parentId) ?? null : null;
      const position = suggestNodePlacement(parent);
      const id = uid("node");
      const nextNode: CanvasNode = {
        id,
        parentId: params.parentId,
        title: params.title,
        prompt: params.prompt,
        kind: params.kind,
        startMs: params.startMs,
        endMs: params.endMs,
        x: position.x,
        y: position.y,
      };
      setNodes((prev) => [...prev, nextNode]);
      setRecentNodeId(id);
      setFocusedNodeId(id);
      setHoveredNodeId(id);
      triggerRipple(position.x + BLOCK_WIDTH / 2, position.y + BLOCK_HEIGHT / 2);
    },
    [nodes, suggestNodePlacement, triggerRipple]
  );

  const handleCommandSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = commandPrompt.trim();
    if (!prompt) return;

    const parent = focusedNodeId ? nodes.find((n) => n.id === focusedNodeId) : nodes[nodes.length - 1];
    const startMs = parent?.endMs ?? 0;
    const endMs = startMs + 10_000;
    const kind = inferKindFromPrompt(prompt);
    const title =
      kind === "grade"
        ? "Cinematic Color Grade"
        : kind === "cut"
          ? "Rhythm Cut Pass"
          : kind === "audio"
            ? "Audio Sculpt"
            : kind === "transition"
              ? "Transition Weave"
              : "Prompt Refinement";

    spawnNode({
      parentId: parent?.id,
      title,
      prompt,
      kind,
      startMs,
      endMs,
    });
    setCommandPrompt("");
  };

  const handleRefineSubmit = () => {
    const targetId = refineNodeId;
    const nextPrompt = refineDraft.trim();
    if (!targetId || !nextPrompt) return;

    const targetNode = nodes.find((node) => node.id === targetId);
    if (!targetNode) return;

    const updatedKind = inferKindFromPrompt(nextPrompt);
    setNodes((prev) =>
      prev.map((node) =>
        node.id === targetId
          ? {
              ...node,
              prompt: nextPrompt,
              kind: updatedKind,
              title:
                updatedKind === "grade"
                  ? "Cinematic Color Grade"
                  : updatedKind === "cut"
                    ? "Rhythm Cut Pass"
                    : updatedKind === "audio"
                      ? "Audio Sculpt"
                      : updatedKind === "transition"
                        ? "Transition Weave"
                        : "Prompt Refinement",
            }
          : node
      )
    );

    const significantDelta = Math.abs(nextPrompt.length - targetNode.prompt.length) > 22;
    const looksLikeBranch = /\b(alternative|variant|instead|different path|branch)\b/i.test(nextPrompt);
    if (significantDelta || looksLikeBranch) {
      spawnNode({
        parentId: targetId,
        title: "Alternative Branch",
        prompt: nextPrompt,
        kind: updatedKind,
        startMs: targetNode.startMs,
        endMs: targetNode.endMs,
      });
    } else {
      triggerRipple(targetNode.x + BLOCK_WIDTH / 2, targetNode.y + BLOCK_HEIGHT / 2);
    }

    setRefiningNodeId(targetId);
    setRefineNodeId(null);
    window.setTimeout(() => setRefiningNodeId(null), 900);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const zoomDirection = event.deltaY > 0 ? 0.92 : 1.08;

    setViewport((prev) => {
      const nextScale = clamp(prev.scale * zoomDirection, ZOOM_MIN, ZOOM_MAX);
      const worldX = (cursorX - prev.x) / prev.scale;
      const worldY = (cursorY - prev.y) / prev.scale;
      return {
        scale: nextScale,
        x: cursorX - worldX * nextScale,
        y: cursorY - worldY * nextScale,
      };
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-node='true']") || target.closest("[data-chrono='true']")) return;

    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    const nextX = pan.originX + (event.clientX - pan.startX);
    const nextY = pan.originY + (event.clientY - pan.startY);
    setViewport((prev) => ({ ...prev, x: nextX, y: nextY }));
  };

  const stopPanning = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current && panRef.current.pointerId === event.pointerId) {
      event.currentTarget.releasePointerCapture(event.pointerId);
      panRef.current = null;
      setIsPanning(false);
    }
  };

  const fitView = () => {
    if (!surfaceRef.current) return;
    const width = surfaceRef.current.clientWidth;
    const height = surfaceRef.current.clientHeight;
    setViewport({
      scale: 0.76,
      x: width * 0.03,
      y: height * 0.14,
    });
  };

  return (
    <div className={cn("relative flex h-full min-h-[560px] w-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-black/70", className)}>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(185,142,255,0.14)_0%,transparent_34%),radial-gradient(circle_at_84%_14%,rgba(112,73,195,0.12)_0%,transparent_42%),linear-gradient(180deg,rgba(7,7,10,0.94)_0%,rgba(4,4,6,0.98)_100%)]" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.26) 0.8px, rgba(255,255,255,0) 1px)",
            backgroundSize: "26px 26px",
          }}
        />
        <motion.div
          className="absolute inset-0 opacity-16"
          animate={{ backgroundPositionX: ["0%", "40%", "0%"] }}
          transition={{ duration: 28, ease: "linear", repeat: Number.POSITIVE_INFINITY }}
          style={{
            backgroundImage:
              "repeating-radial-gradient(ellipse at 50% 120%, rgba(110,78,198,0.33) 0px, rgba(110,78,198,0.33) 1px, transparent 2px, transparent 34px)",
            backgroundSize: "100% 260px",
            maskImage: "linear-gradient(to top, transparent 4%, black 16%, black 84%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative z-10 flex items-center justify-between border-b border-white/8 bg-black/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-white/55">
            Living Canvas
          </span>
          <span className="text-[11px] text-white/42">
            Drag to pan, wheel to zoom, hover to refine.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={fitView}
            className="h-7 rounded-full border-white/15 bg-transparent px-3 text-[11px] text-white/75 hover:bg-white/[0.08] hover:text-white"
          >
            Fit View
          </Button>
          <div className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] text-white/60">
            Zoom {Math.round(viewport.scale * 100)}%
          </div>
        </div>
      </div>

      <div
        ref={surfaceRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPanning}
        onPointerCancel={stopPanning}
        className={cn(
          "relative flex-1 overflow-hidden",
          isPanning ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: CANVAS_WORLD_WIDTH,
            height: CANVAS_WORLD_HEIGHT,
            transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
            transformOrigin: "0 0",
            willChange: "transform",
          }}
        >
          <svg
            className="absolute left-0 top-0 h-full w-full pointer-events-none"
            viewBox={`0 0 ${CANVAS_WORLD_WIDTH} ${CANVAS_WORLD_HEIGHT}`}
            fill="none"
          >
            <defs>
              <linearGradient id="node-thread" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(138,43,226,0.08)" />
                <stop offset="48%" stopColor="rgba(190,143,255,0.45)" />
                <stop offset="100%" stopColor="rgba(138,43,226,0.1)" />
              </linearGradient>
            </defs>

            {edges.map((edge) => {
              const hot = hoveredNodeId && (edge.from.id === hoveredNodeId || edge.to.id === hoveredNodeId);
              return (
                <g key={edge.id}>
                  <path
                    d={edge.path}
                    stroke={hot ? "rgba(208,176,255,0.62)" : "url(#node-thread)"}
                    strokeWidth={hot ? 1.8 : 1.2}
                    fill="none"
                  />
                  <motion.path
                    d={edge.path}
                    stroke={hot ? "rgba(219,190,255,0.95)" : "rgba(206,173,255,0.72)"}
                    strokeWidth={1}
                    strokeDasharray="4 14"
                    fill="none"
                    animate={{ strokeDashoffset: [0, -190], opacity: hot ? [0.35, 0.85, 0.35] : [0.2, 0.55, 0.2] }}
                    transition={{
                      strokeDashoffset: { duration: 4.2, ease: "linear", repeat: Number.POSITIVE_INFINITY },
                      opacity: { duration: 2.3, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY },
                    }}
                  />
                </g>
              );
            })}
          </svg>

          {nodes.map((node) => {
            const Icon = nodeIcon(node.kind);
            const parent = node.parentId ? nodes.find((item) => item.id === node.parentId) ?? null : null;
            const isHovered = node.id === hoveredNodeId;
            const isFocused = node.id === focusedNodeId;
            const isRefining = node.id === refiningNodeId;
            const isRecent = node.id === recentNodeId;
            const blockLabel = nodeBlockLabel(node.kind);
            const leadLine = excerpt(node.prompt, 86);
            const followLine =
              node.kind === "audio"
                ? "Then balance vocal clarity and ambient texture."
                : node.kind === "grade"
                  ? "Then tune cinematic contrast with cooler highlights."
                  : node.kind === "cut"
                    ? "Then tighten pacing around the strongest beats."
                    : node.kind === "transition"
                      ? "Then blend transitions with calmer visual rhythm."
                      : "Then continue refinement from this branch.";

            const initial = isRecent && parent
              ? { x: parent.x + BLOCK_WIDTH * 0.45 - node.x, y: parent.y + BLOCK_HEIGHT * 0.45 - node.y, scale: 0.28, opacity: 0.35 }
              : { scale: 1, opacity: 1 };

            return (
              <motion.button
                key={node.id}
                data-node="true"
                type="button"
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => {
                  setHoveredNodeId((current) => (current === node.id ? null : current));
                }}
                onClick={() => {
                  setFocusedNodeId(node.id);
                  triggerRipple(node.x + BLOCK_WIDTH / 2, node.y + BLOCK_HEIGHT / 2);
                }}
                className="absolute rounded-[26px] border border-white/16 bg-[linear-gradient(180deg,rgba(16,16,20,0.92)_0%,rgba(10,10,14,0.95)_100%)] px-4 py-3 text-left text-white/88 shadow-[0_0_0_1px_rgba(255,255,255,0.06)_inset,0_12px_40px_-24px_rgba(0,0,0,0.95)] backdrop-blur-xl outline-none transition-colors"
                style={{
                  width: BLOCK_WIDTH,
                  height: BLOCK_HEIGHT,
                  left: node.x,
                  top: node.y,
                }}
                initial={initial}
                animate={{
                  x: 0,
                  y: 0,
                  opacity: 1,
                  scale: isRefining ? [1, 1.012, 1] : isHovered ? [1, 1.006, 1] : [1, 1.004, 1],
                  boxShadow: isFocused
                    ? "0 0 0 1px rgba(222,198,255,0.9), 0 0 30px rgba(152,94,241,0.5), 0 12px 36px -24px rgba(0,0,0,0.95)"
                    : isHovered
                      ? "0 0 0 1px rgba(189,151,248,0.72), 0 0 22px rgba(141,88,228,0.42), 0 10px 34px -26px rgba(0,0,0,0.95)"
                      : "0 0 0 1px rgba(255,255,255,0.06), 0 8px 24px -20px rgba(0,0,0,0.95)",
                }}
                transition={{
                  duration: isRecent ? 0.6 : 0.3,
                  ease: isRecent ? [0.34, 1.56, 0.64, 1] : "easeOut",
                  scale: {
                    duration: isHovered ? 1.8 : 3,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  },
                }}
                aria-label={node.title}
              >
                <span className="absolute -left-2 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black text-[10px] text-white/65">
                  {node.parentId ? "+" : ""}
                </span>
                <span className="absolute -right-2 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black text-[10px] text-white/65">
                  +
                </span>
                <span className="absolute -bottom-2 left-1/2 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full border border-white/20 bg-black text-[10px] text-white/65">
                  +
                </span>

                <div className="flex h-full flex-col rounded-[18px] border border-white/10 bg-white/[0.01] p-3">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/56">
                    <span>{blockLabel}</span>
                    <span className="inline-flex items-center gap-1 text-white/40">
                      <Icon className="h-3.5 w-3.5" />
                      <ChevronDown className="h-3 w-3" />
                    </span>
                  </div>

                  <div className="mt-3 flex-1 space-y-2 text-[13px] leading-relaxed text-white/80">
                    <p>
                      <span className="text-emerald-300">When</span> {leadLine}
                    </p>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/52">
                      Refinement prompt node - timeline-aware branch
                    </div>
                    <p>
                      <span className="text-emerald-300">Then</span> {followLine}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {ripples.map((ripple) => {
          const x = viewport.x + ripple.x * viewport.scale;
          const y = viewport.y + ripple.y * viewport.scale;
          return (
            <motion.span
              key={ripple.id}
              className="pointer-events-none absolute rounded-full border border-[#B995FF]/55"
              style={{ left: x, top: y }}
              initial={{ width: 8, height: 8, opacity: 0.5, x: -4, y: -4 }}
              animate={{ width: 220, height: 220, opacity: 0, x: -110, y: -110 }}
              transition={{ duration: 1.15, ease: "easeOut" }}
            />
          );
        })}

        <AnimatePresence>
          {hoveredNode && chronoPosition && (
            <motion.div
              data-chrono="true"
              key={hoveredNode.id}
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="absolute rounded-2xl border border-white/14 bg-[linear-gradient(180deg,rgba(17,16,24,0.9)_0%,rgba(10,10,14,0.94)_100%)] p-3 shadow-[0_24px_55px_-32px_rgba(0,0,0,0.95)] backdrop-blur-xl"
              style={{ width: CHRONO_WIDTH, left: chronoPosition.left, top: chronoPosition.top }}
            >
              {refineNodeId === hoveredNode.id ? (
                <div className="space-y-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/52">
                    Refine Prompt
                  </div>
                  <Input
                    autoFocus
                    value={refineDraft}
                    onChange={(event) => setRefineDraft(event.target.value)}
                    className="h-9 border-blue-300/35 bg-black/35 text-xs text-white/90 shadow-[0_0_0_1px_rgba(96,165,250,0.25),0_0_18px_rgba(96,165,250,0.18)]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setRefineNodeId(null)}
                      className="h-7 rounded-full border-white/15 bg-transparent px-3 text-xs text-white/70 hover:bg-white/[0.08]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={handleRefineSubmit}
                      disabled={!refineDraft.trim()}
                      className="h-7 rounded-full bg-[#9d6cff] px-3 text-xs text-white hover:bg-[#ad7dff]"
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="truncate text-sm font-semibold text-white/92">{hoveredNode.title}</div>
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2">
                    <div className="relative h-2 rounded-full bg-white/10">
                      <div
                        className="absolute top-0 h-2 rounded-full bg-gradient-to-r from-[#B691FF] via-[#A56BFF] to-[#8A2BE2] shadow-[0_0_16px_rgba(165,107,255,0.65)]"
                        style={{
                          left: `${(hoveredNode.startMs / totalDurationMs) * 100}%`,
                          width: `${Math.max(8, ((hoveredNode.endMs - hoveredNode.startMs) / totalDurationMs) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] tabular-nums text-white/48">
                      <span>{formatHms(hoveredNode.startMs)}</span>
                      <span>{formatHms(hoveredNode.endMs)}</span>
                    </div>
                  </div>
                  <p className="line-clamp-2 text-xs text-white/58">&ldquo;{hoveredNode.prompt}&rdquo;</p>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={() => {
                        setRefineNodeId(hoveredNode.id);
                        setRefineDraft(hoveredNode.prompt);
                      }}
                      className="h-7 rounded-full bg-white/[0.1] px-3 text-xs text-white/88 shadow-[0_0_14px_rgba(149,95,229,0.28)] hover:bg-white/[0.16]"
                    >
                      Refine
                    </Button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 border-t border-white/10 bg-black/35 px-4 py-3">
        <form onSubmit={handleCommandSubmit} className="flex items-center gap-2">
          <Input
            value={commandPrompt}
            onChange={(event) => setCommandPrompt(event.target.value)}
            placeholder="Describe the next edit to spawn a new node..."
            className="h-10 rounded-full border-white/12 bg-white/[0.03] px-4 text-sm text-white/88 placeholder:text-white/35"
          />
          <Button
            type="submit"
            disabled={!commandPrompt.trim()}
            className="h-10 rounded-full bg-white px-4 text-black hover:bg-white/90"
          >
            Apply Edit
          </Button>
        </form>
      </div>
    </div>
  );
}

