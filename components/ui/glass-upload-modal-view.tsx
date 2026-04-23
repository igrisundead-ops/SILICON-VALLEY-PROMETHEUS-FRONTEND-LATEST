'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  FileText,
  Link as LinkIcon,
  MonitorIcon,
  Music2,
  PlusIcon,
  Send,
  Upload,
  Video,
} from 'lucide-react';

import type { SourceProfile } from '@/lib/types';
import {
  formatAspectFamily,
  formatDurationBucket,
  formatProcessingClass,
  formatSourceProfileMetric,
  formatTimeProfile,
  formatWeightBucket,
} from '@/lib/media/source-profile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { GlassBubbleCard, GlassUploadBackdrop } from '@/components/ui/glass-upload-shell';
import { Input } from '@/components/ui/input';
import { MediaUpscaleComparison } from '@/components/ui/media-upscale-comparison';

type PendingUploadKind = 'video' | 'image' | 'audio' | 'file';

type PendingUpload = {
  file: File;
  previewUrl: string;
  kind: PendingUploadKind;
  sourceProfile?: SourceProfile | null;
  inspectionState?: 'idle' | 'inspecting' | 'ready' | 'failed';
  inspectionError?: string | null;
};

type GlassUploadModalViewProps = {
  addSourceMode: 'link' | 'upload';
  isSourceDragOver: boolean;
  onApplyUploadToPrompt: () => void;
  onClearPendingUpload: () => void;
  onImportSourceLink: () => void;
  onModeChange: (mode: 'link' | 'upload') => void;
  onSourceDragLeave: () => void;
  onSourceDragOver: React.DragEventHandler<HTMLDivElement>;
  onSourceDrop: React.DragEventHandler<HTMLDivElement>;
  onSourceFileInputChange: React.ChangeEventHandler<HTMLInputElement>;
  onSourceUrlChange: (value: string) => void;
  pendingUpload: PendingUpload | null;
  sourceDetail: string;
  sourceDisplayName: string;
  sourceExtension: string;
  sourceFileInputRef: React.RefObject<HTMLInputElement | null>;
  sourcePrimaryBadge: string;
  sourceReady: boolean;
  sourceUrl: string;
  sourceUrlValue: string;
};

export function GlassUploadModalView({
  addSourceMode,
  isSourceDragOver,
  onApplyUploadToPrompt,
  onClearPendingUpload,
  onImportSourceLink,
  onModeChange,
  onSourceDragLeave,
  onSourceDragOver,
  onSourceDrop,
  onSourceFileInputChange,
  onSourceUrlChange,
  pendingUpload,
  sourceDetail,
  sourceDisplayName,
  sourceExtension,
  sourceFileInputRef,
  sourcePrimaryBadge,
  sourceReady,
  sourceUrl,
  sourceUrlValue,
}: GlassUploadModalViewProps) {
  const handleAttach = addSourceMode === 'link' ? onImportSourceLink : onApplyUploadToPrompt;
  const showSendAction = addSourceMode === 'upload' && !!pendingUpload;
  const openSourcePicker = () => sourceFileInputRef.current?.click();
  const sourceMetrics = pendingUpload?.sourceProfile ? formatSourceProfileMetric(pendingUpload.sourceProfile) : null;
  const previewStageClassName =
    'relative flex h-full min-h-[280px] w-full flex-col items-center justify-center px-5 py-6 text-center sm:px-6';
  const comparisonPreviewStageClassName =
    'relative flex h-full min-h-[320px] w-full items-stretch justify-stretch px-3 py-3 sm:px-4 sm:py-4';

  return (
    <GlassUploadBackdrop className="mx-auto flex h-[calc(100svh-1rem)] w-full max-w-[940px] max-h-[calc(100svh-1rem)] flex-col sm:h-[min(820px,calc(100svh-2rem))] sm:max-h-[calc(100svh-2rem)]">
      <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-9 sm:px-4 sm:pb-4 sm:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-[900px]"
        >
          <GlassBubbleCard className="w-full overflow-hidden">
            <div className="max-h-[calc(100svh-7rem)] overflow-y-auto px-4 pb-4 pt-4 text-white sm:px-5 sm:pb-5 sm:pt-5 lg:px-6 lg:pb-6 lg:pt-6">
              <div className="flex flex-col gap-4 border-b border-white/10 pb-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-xl">
                  <div className="text-[10px] uppercase tracking-[0.32em] text-white/38">
                    Source Studio
                  </div>
                  <DialogTitle className="mt-2.5 text-[clamp(1.9rem,4vw,3.2rem)] font-medium leading-[0.92] tracking-[-0.03em] text-white">
                    Upload Source
                  </DialogTitle>
                  <DialogDescription className="mt-2.5 max-w-md text-[13px] leading-5 text-white/54">
                    Stage one source, preview it cleanly, and attach it to the prompt without visual clutter.
                  </DialogDescription>
                </div>

                <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                  <div className="inline-flex rounded-full border border-white/12 bg-white/[0.04] p-1 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={() => onModeChange('upload')}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all duration-300',
                        addSourceMode === 'upload'
                          ? 'bg-white text-black'
                          : 'text-white/62 hover:text-white',
                      )}
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </button>
                    <button
                      type="button"
                      onClick={() => onModeChange('link')}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-all duration-300',
                        addSourceMode === 'link'
                          ? 'bg-white text-black'
                          : 'text-white/62 hover:text-white',
                      )}
                    >
                      <LinkIcon className="h-4 w-4" />
                      Link
                    </button>
                  </div>

                  {showSendAction ? (
                    <button
                      type="button"
                      onClick={handleAttach}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white px-3.5 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-black shadow-[0_16px_34px_-24px_rgba(255,255,255,0.85)] transition-all duration-200 hover:bg-white/92"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </button>
                  ) : (
                    <div className="rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-white/56 backdrop-blur-md">
                      {sourceReady ? 'Ready' : 'Standby'}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 py-4 lg:grid-cols-[minmax(0,1.05fr)_300px]">
                <section className="flex min-h-[300px] min-w-0 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(20,22,28,0.84)_0%,rgba(8,9,12,0.96)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3.5">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                        Preview
                      </div>
                      <div className="mt-1 text-[13px] text-white/72">{sourcePrimaryBadge}</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white/48">
                      {sourceExtension}
                    </div>
                  </div>

                  <div className="relative flex flex-1 overflow-hidden">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_18%,rgba(0,0,0,0.35)_100%),radial-gradient(circle_at_22%_22%,rgba(255,110,84,0.09)_0%,rgba(255,110,84,0)_24%),radial-gradient(circle_at_78%_10%,rgba(108,128,255,0.08)_0%,rgba(108,128,255,0)_20%)]"
                    />
                    {addSourceMode === 'link' ? (
                      <div className={previewStageClassName}>
                        <div className="rounded-full border border-white/12 bg-white/[0.05] p-4 text-white/86">
                          <LinkIcon className="h-7 w-7" />
                        </div>
                        <div className="mt-5 text-[clamp(1.45rem,2.7vw,2rem)] font-medium leading-tight text-white">
                          Remote source
                          <span className="block text-white/58">will render here</span>
                        </div>
                        {sourceUrlValue ? (
                          <div className="mt-5 max-w-[85%] truncate rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs text-white/72">
                            {sourceUrlValue}
                          </div>
                        ) : (
                          <div className="mt-4 max-w-sm text-sm leading-6 text-white/50">
                            Paste a link on the right to stage it into the preview.
                          </div>
                        )}
                      </div>
                    ) : pendingUpload?.kind === 'video' ? (
                      <div className={comparisonPreviewStageClassName}>
                        <MediaUpscaleComparison
                          src={pendingUpload.previewUrl}
                          alt={pendingUpload.file.name}
                          kind="video"
                          className="h-full max-w-none"
                          viewportClassName="h-full min-h-[360px]"
                        />
                      </div>
                    ) : pendingUpload?.kind === 'image' ? (
                      <div className={comparisonPreviewStageClassName}>
                        <MediaUpscaleComparison
                          src={pendingUpload.previewUrl}
                          alt={pendingUpload.file.name}
                          kind="image"
                          className="h-full max-w-none"
                          viewportClassName="h-full min-h-[360px]"
                        />
                      </div>
                    ) : pendingUpload?.kind ? (
                      <div className={previewStageClassName}>
                        <div className="rounded-full border border-white/12 bg-white/[0.05] p-4 text-white/84">
                          {pendingUpload.kind === 'audio' ? (
                            <Music2 className="h-7 w-7" />
                          ) : (
                            <FileText className="h-7 w-7" />
                          )}
                        </div>
                        <div className="mt-5 text-lg font-medium text-white">{pendingUpload.file.name}</div>
                        <div className="mt-3 max-w-sm text-[13px] leading-5 text-white/50">
                          This file is staged and ready, even though it does not have a visual preview.
                        </div>
                      </div>
                    ) : (
                      <div className={previewStageClassName}>
                        <div className="rounded-full border border-white/12 bg-white/[0.05] p-3.5 text-white/84 shadow-[0_0_0_16px_rgba(255,110,84,0.05)]">
                          <MonitorIcon className="h-7 w-7" />
                        </div>
                        <div className="mt-4 text-[clamp(1.3rem,2.4vw,1.7rem)] font-medium leading-tight text-white">
                          Clip stage
                        </div>
                        <div className="mt-2 max-w-[15rem] text-[12px] leading-5 text-white/50">
                          Upload to preview.
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                <aside className="flex flex-col gap-4">
                  <input
                    ref={sourceFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={onSourceFileInputChange}
                  />

                  <AnimatePresence mode="wait">
                    {addSourceMode === 'upload' ? (
                      <motion.div
                        key="upload-mode"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,20,26,0.9)_0%,rgba(9,10,13,0.94)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      >
                        <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                          Upload
                        </div>
                        <div className="mt-2 text-base font-medium text-white">Drop video</div>
                        <div
                          onDragOver={onSourceDragOver}
                          onDragLeave={onSourceDragLeave}
                          onDrop={onSourceDrop}
                          onClick={openSourcePicker}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openSourcePicker();
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'group mt-4 flex min-h-[216px] cursor-pointer flex-col items-center justify-center rounded-[22px] border border-dashed px-5 py-8 text-center transition-all duration-300 focus:outline-none focus-visible:border-[#ff9a73]/55 focus-visible:shadow-[0_0_0_1px_rgba(255,154,115,0.45),0_0_0_10px_rgba(255,110,84,0.08)]',
                            isSourceDragOver
                              ? 'border-[#f0ff57]/45 bg-[#f0ff57]/8 shadow-[0_0_0_1px_rgba(240,255,87,0.12),0_26px_46px_-30px_rgba(240,255,87,0.18)]'
                              : 'border-white/12 bg-white/[0.03] hover:border-[#ff9a73]/34 hover:bg-[rgba(255,255,255,0.05)]',
                          )}
                        >
                          <div
                            className={cn(
                              'rounded-full border bg-white/[0.05] p-3 text-white/90 transition-all duration-300',
                              isSourceDragOver
                                ? 'border-[#f0ff57]/48 shadow-[0_0_0_14px_rgba(240,255,87,0.08),0_0_22px_rgba(240,255,87,0.18)]'
                                : 'border-white/12 group-hover:border-[#ff9a73]/45 group-hover:text-white group-hover:shadow-[0_0_0_14px_rgba(255,110,84,0.08),0_0_30px_rgba(255,110,84,0.28)]',
                            )}
                          >
                            <Upload className="h-5 w-5" />
                          </div>
                          <div className="mt-4 text-sm font-medium text-white">Drop video to stage it</div>
                          <div className="mt-2 text-xs text-white/66">MP4, MOV, WEBM supported</div>
                          <Button
                            type="button"
                            variant="outline"
                            className="mt-5 rounded-full border-white/14 bg-white px-4 py-2 text-xs text-black shadow-[0_16px_34px_-24px_rgba(255,255,255,0.85)] hover:bg-white/92"
                            onClick={(event) => {
                              event.stopPropagation();
                              openSourcePicker();
                            }}
                          >
                            Choose File
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="link-mode"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,20,26,0.9)_0%,rgba(9,10,13,0.94)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                      >
                        <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                          Link
                        </div>
                        <div className="mt-2 text-base font-medium text-white">Paste source</div>
                        <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                          <Input
                            value={sourceUrl}
                            onChange={(event) => onSourceUrlChange(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && sourceUrlValue) {
                                event.preventDefault();
                                onImportSourceLink();
                              }
                            }}
                            placeholder="https://"
                            className="h-12 rounded-[18px] border-white/10 bg-black/30 text-white placeholder:text-white/28"
                          />
                          <div className="mt-3 text-sm leading-6 text-white/48">
                            Stage a remote video or reference link into the preview.
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(17,18,24,0.88)_0%,rgba(9,10,13,0.94)_100%)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                      Active Source
                    </div>
                    <div className="mt-3 flex items-start gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[16px] border border-white/10 bg-white/[0.04]">
                        {pendingUpload?.kind === 'image' ? (
                          <img
                            src={pendingUpload.previewUrl}
                            alt={pendingUpload.file.name}
                            className="h-full w-full object-cover"
                          />
                        ) : pendingUpload?.kind === 'video' ? (
                          <video
                            src={pendingUpload.previewUrl}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/58">
                            {addSourceMode === 'link' ? (
                              <LinkIcon className="h-4 w-4" />
                            ) : pendingUpload?.kind === 'audio' ? (
                              <Music2 className="h-4 w-4" />
                            ) : pendingUpload?.kind === 'file' ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <Video className="h-4 w-4" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-white">{sourceDisplayName}</div>
                        <div className="mt-1 text-xs text-white/48">{sourceDetail}</div>
                      </div>
                    </div>

                    {addSourceMode === 'upload' ? (
                      <div className="mt-4 rounded-[18px] border border-white/8 bg-white/[0.03] p-3.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[10px] uppercase tracking-[0.24em] text-white/38">
                            Source Profile
                          </div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">
                            {pendingUpload?.inspectionState === 'inspecting'
                              ? 'Inspecting'
                              : pendingUpload?.inspectionState === 'failed'
                                ? 'Inspection issue'
                                : pendingUpload?.sourceProfile
                                  ? 'Ready'
                                  : 'Waiting'}
                          </div>
                        </div>

                        {pendingUpload?.inspectionState === 'inspecting' ? (
                          <div className="mt-3 space-y-2">
                            <div className="h-2 rounded-full bg-white/[0.06]">
                              <div className="h-full w-1/2 animate-pulse rounded-full bg-white/[0.3]" />
                            </div>
                            <div className="text-xs text-white/46">
                              Inspecting resolution, duration, audio, and processing weight.
                            </div>
                          </div>
                        ) : pendingUpload?.inspectionState === 'failed' ? (
                          <div className="mt-3 text-xs leading-5 text-rose-200/72">
                            {pendingUpload.inspectionError ?? 'This source could not be profiled yet.'}
                          </div>
                        ) : pendingUpload?.sourceProfile && sourceMetrics ? (
                          <>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/74">
                                {formatAspectFamily(pendingUpload.sourceProfile.aspectFamily)}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/74">
                                {formatTimeProfile(pendingUpload.sourceProfile.timeProfile)}
                              </span>
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] text-white/74">
                                {formatProcessingClass(pendingUpload.sourceProfile.processingClass)}
                              </span>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                              <ProfileMetric label="Resolution" value={sourceMetrics.resolution} />
                              <ProfileMetric label="Duration" value={sourceMetrics.duration} />
                              <ProfileMetric label="Weight" value={formatWeightBucket(pendingUpload.sourceProfile.weightBucket)} />
                              <ProfileMetric label="Audio" value={sourceMetrics.audio} />
                              <ProfileMetric label="Bucket" value={formatDurationBucket(pendingUpload.sourceProfile.durationBucket)} />
                              <ProfileMetric
                                label="Bitrate"
                                value={
                                  pendingUpload.sourceProfile.inspection.estimatedBitrateMbps
                                    ? `${pendingUpload.sourceProfile.inspection.estimatedBitrateMbps.toFixed(1)} Mbps`
                                    : 'Unavailable'
                                }
                              />
                            </div>
                          </>
                        ) : (
                          <div className="mt-3 text-xs text-white/46">
                            Select a source to inspect it locally before upload.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </aside>
              </div>

              <div className="flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-white/42">One source. One preview. One action.</div>

                <div className="flex flex-wrap items-center gap-3">
                  {pendingUpload && addSourceMode === 'upload' && (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full border-white/14 bg-transparent text-white hover:bg-white/[0.06]"
                      onClick={onClearPendingUpload}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </GlassBubbleCard>
        </motion.div>
      </div>
    </GlassUploadBackdrop>
  );
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/34">{label}</div>
      <div className="mt-1 text-[11px] leading-5 text-white/72">{value}</div>
    </div>
  );
}
