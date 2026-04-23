import { analyzeMusicIntent } from '@/lib/music-intent'
import { buildMusicPreviewUrl, buildVideoContextText, normalizeMusicPreference, type MusicCatalogTrack } from '@/lib/music-catalog'
import type {
  MusicEnergy,
  MusicMatchBreakdown,
  MusicMood,
  MusicPreference,
  MusicRecommendation,
  MusicRecommendationGroup,
  MusicRecommendationGroupKey,
  MusicRecommendationPhase,
  MusicRecommendationPipelineResult,
  MusicSoundtrackProfile,
  MusicVideoContext,
} from '@/lib/types'

export type MusicRecommendationPipelineInput = {
  query: string
  projectTitle?: string
  initialPrompt?: string
  preference?: Partial<MusicPreference> | null
  videoContext?: MusicVideoContext | null
  limit?: number
  variantHint?: string
  recentlyUsedTrackIds?: string[]
  catalog: MusicCatalogTrack[]
  profileOverride?: MusicSoundtrackProfile | null
  profileSource?: 'groq' | 'heuristic'
}

type ScoredTrack = {
  track: MusicCatalogTrack
  baseScore: number
  finalScore: number
  fitReasons: string[]
  matchedTerms: string[]
  breakdown: MusicMatchBreakdown
  diversityPenalty: number
  usagePenalty: number
  freshnessScore: number
  qualityScore: number
  index: number
}

const GROUP_STYLE: Record<
  MusicRecommendationGroupKey,
  { label: string; description: string; accent: string; take: number }
> = {
  'best-fit': {
    label: 'Top recommended',
    description: 'Closest to the inferred soundtrack profile.',
    accent: 'emerald',
    take: 3,
  },
  'safe-fit': {
    label: 'Safe fit',
    description: 'Confident matches that stay inside the lane.',
    accent: 'cyan',
    take: 2,
  },
  'creative-stretch': {
    label: 'Creative stretch',
    description: 'A little more personality without drifting off brief.',
    accent: 'amber',
    take: 2,
  },
  'high-energy-alternative': {
    label: 'High energy alternative',
    description: 'Leans harder into momentum and hook density.',
    accent: 'rose',
    take: 1,
  },
  'cinematic-alternative': {
    label: 'Cinematic alternative',
    description: 'More score-like, premium, and expansive.',
    accent: 'ice',
    take: 1,
  },
  'minimal-ambient-alternative': {
    label: 'Minimal / ambient alternative',
    description: 'Keeps the voice and visual rhythm in front.',
    accent: 'slate',
    take: 1,
  },
}

export function buildMusicRecommendationSet({
  query,
  projectTitle,
  initialPrompt,
  preference,
  videoContext,
  limit = 8,
  variantHint,
  recentlyUsedTrackIds = [],
  catalog,
  profileOverride,
  profileSource = 'heuristic',
}: MusicRecommendationPipelineInput): MusicRecommendationPipelineResult {
  const normalizedQuery = cleanInline(query)
  const contextText = [normalizedQuery, projectTitle, initialPrompt, buildVideoContextText(videoContext)].filter(Boolean).join(' ')
  const resolvedPreference = normalizeMusicPreference(preference, contextText, videoContext)
  const profile = normalizeSoundtrackProfile(
    profileOverride ?? buildHeuristicSoundtrackProfile({
      query: normalizedQuery,
      projectTitle,
      initialPrompt,
      preference: resolvedPreference,
      videoContext,
      variantHint,
    }),
  )
  const analysisStages = buildMusicAnalysisStages({
    profile,
    archiveCount: catalog.length,
    videoContext,
    variantHint,
  })
  const scored = rankArchiveTracks({
    catalog,
    profile,
    contextText,
    preference: resolvedPreference,
    videoContext,
    query: normalizedQuery,
    variantHint,
    recentlyUsedTrackIds,
  })
  const recommendationGroups = buildRecommendationGroups(scored, profile)
  const recommendations = flattenGroups(recommendationGroups, limit)
  const topScore = recommendations[0]?.matchScore ?? 0
  const topThree = recommendations.slice(0, 3)
  const averageTopScore =
    topThree.length > 0 ? topThree.reduce((sum, item) => sum + (item.matchScore ?? 0), 0) / topThree.length : 0
  const confidence = clamp01(
    profile.confidence * 0.56 +
      topScore / 100 * 0.34 +
      averageTopScore / 100 * 0.1 +
      Math.min(0.08, recommendations.length * 0.01),
  )
  const needsRefinement =
    confidence < 0.56 || topScore < 68 || recommendations.length === 0 || profile.confidence < 0.42

  return {
    profile,
    phases: analysisStages,
    recommendationGroups,
    recommendations,
    archiveCount: catalog.length,
    source: profileSource,
    fallback: profileSource !== 'groq',
    confidence,
    needsRefinement,
    reasoningSummary: profile.reasoningSummary,
    variantHint,
    query: normalizedQuery,
  }
}

export function buildHeuristicSoundtrackProfile({
  query,
  projectTitle,
  initialPrompt,
  preference,
  videoContext,
  variantHint,
}: Omit<MusicRecommendationPipelineInput, 'catalog' | 'profileOverride' | 'profileSource'>): MusicSoundtrackProfile {
  const promptText = [query, projectTitle, initialPrompt].filter(Boolean).join(' ')
  const fallbackIntent = videoContext?.intent ?? analyzeMusicIntent({
    projectTitle: projectTitle ?? '',
    promptText,
    sourceList: [],
    sourceProfile: null,
    job: null,
    pace: videoContext?.pace ?? 'medium',
  })
  const contextText = buildVideoContextText(videoContext)
  const normalizedPreference = normalizeMusicPreference(preference, [promptText, contextText].filter(Boolean).join(' '), videoContext)

  return normalizeSoundtrackProfile({
    contentCategory: resolveContentCategory({
      text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
      pace: videoContext?.pace ?? 'medium',
      variantHint,
    }),
    primaryMood: resolveProfileMood({
      preferenceMood: normalizedPreference.mood,
      intentMood: fallbackIntent.sentiment.mood,
      variantHint,
      text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary].join(' '),
    }),
    secondaryMood: resolveSecondaryMood({
      primaryMood: resolveProfileMood({
        preferenceMood: normalizedPreference.mood,
        intentMood: fallbackIntent.sentiment.mood,
        variantHint,
        text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary].join(' '),
      }),
      intentMood: fallbackIntent.sentiment.mood,
      text: [promptText, contextText, fallbackIntent.summary].join(' '),
      variantHint,
    }),
    energyLevel: resolveEnergyLevel({
      preferenceEnergy: normalizedPreference.energy,
      pace: videoContext?.pace ?? 'medium',
      hookStrength: fallbackIntent.sentiment.hookStrength,
      variantHint,
      text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
    }),
    tempoRange: resolveTempoRange({
      energyLevel: resolveEnergyLevel({
        preferenceEnergy: normalizedPreference.energy,
        pace: videoContext?.pace ?? 'medium',
        hookStrength: fallbackIntent.sentiment.hookStrength,
        variantHint,
        text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
      }),
      pace: videoContext?.pace ?? 'medium',
      variantHint,
    }),
    genreCandidates: resolveGenreCandidates({
      primaryMood: normalizedPreference.mood,
      secondaryMood: fallbackIntent.sentiment.mood,
      contentCategory: resolveContentCategory({
        text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
        pace: videoContext?.pace ?? 'medium',
        variantHint,
      }),
      intent: fallbackIntent,
      variantHint,
    }),
    instrumentationHints: resolveInstrumentationHints({
      primaryMood: normalizedPreference.mood,
      secondaryMood: fallbackIntent.sentiment.mood,
      contentCategory: resolveContentCategory({
        text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
        pace: videoContext?.pace ?? 'medium',
        variantHint,
      }),
      energyLevel: resolveEnergyLevel({
        preferenceEnergy: normalizedPreference.energy,
        pace: videoContext?.pace ?? 'medium',
        hookStrength: fallbackIntent.sentiment.hookStrength,
        variantHint,
        text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
      }),
      variantHint,
    }),
    editSyncStyle: resolveEditSyncStyle({
      pace: videoContext?.pace ?? 'medium',
      energyLevel: resolveEnergyLevel({
        preferenceEnergy: normalizedPreference.energy,
        pace: videoContext?.pace ?? 'medium',
        hookStrength: fallbackIntent.sentiment.hookStrength,
        variantHint,
        text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
      }),
      contentCategory: resolveContentCategory({
        text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
        pace: videoContext?.pace ?? 'medium',
        variantHint,
      }),
      variantHint,
    }),
    emotionalArc: resolveEmotionalArc({
      primaryMood: normalizedPreference.mood,
      secondaryMood: fallbackIntent.sentiment.mood,
      contentCategory: resolveContentCategory({
        text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
        pace: videoContext?.pace ?? 'medium',
        variantHint,
      }),
      energyLevel: resolveEnergyLevel({
        preferenceEnergy: normalizedPreference.energy,
        pace: videoContext?.pace ?? 'medium',
        hookStrength: fallbackIntent.sentiment.hookStrength,
        variantHint,
        text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
      }),
      variantHint,
    }),
    avoid: resolveAvoidHints({
      contentCategory: resolveContentCategory({
        text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
        pace: videoContext?.pace ?? 'medium',
        variantHint,
      }),
      pace: videoContext?.pace ?? 'medium',
      energyLevel: resolveEnergyLevel({
        preferenceEnergy: normalizedPreference.energy,
        pace: videoContext?.pace ?? 'medium',
        hookStrength: fallbackIntent.sentiment.hookStrength,
        variantHint,
        text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
      }),
      variantHint,
    }),
    confidence: clamp01(
      0.45 +
        (videoContext?.confidence ?? 0.28) * 0.3 +
        fallbackIntent.confidence * 0.18 +
        (videoContext?.signals?.length ?? 0) * 0.02 +
        (variantHint ? 0.03 : 0),
    ),
    reasoningSummary: buildHeuristicReasoningSummary({
      contentCategory: resolveContentCategory({
        text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
        pace: videoContext?.pace ?? 'medium',
        variantHint,
      }),
      primaryMood: normalizedPreference.mood,
      secondaryMood: fallbackIntent.sentiment.mood,
      energyLevel: resolveEnergyLevel({
        preferenceEnergy: normalizedPreference.energy,
        pace: videoContext?.pace ?? 'medium',
        hookStrength: fallbackIntent.sentiment.hookStrength,
        variantHint,
        text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
      }),
      tempoRange: resolveTempoRange({
        energyLevel: resolveEnergyLevel({
          preferenceEnergy: normalizedPreference.energy,
          pace: videoContext?.pace ?? 'medium',
          hookStrength: fallbackIntent.sentiment.hookStrength,
          variantHint,
          text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
        }),
        pace: videoContext?.pace ?? 'medium',
        variantHint,
      }),
      editSyncStyle: resolveEditSyncStyle({
        pace: videoContext?.pace ?? 'medium',
        energyLevel: resolveEnergyLevel({
          preferenceEnergy: normalizedPreference.energy,
          pace: videoContext?.pace ?? 'medium',
          hookStrength: fallbackIntent.sentiment.hookStrength,
          variantHint,
          text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
        }),
        contentCategory: resolveContentCategory({
          text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
          pace: videoContext?.pace ?? 'medium',
          variantHint,
        }),
        variantHint,
      }),
      audienceFeel: resolveAudienceFeel({
        contentCategory: resolveContentCategory({
          text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
          pace: videoContext?.pace ?? 'medium',
          variantHint,
        }),
        primaryMood: normalizedPreference.mood,
        energyLevel: resolveEnergyLevel({
          preferenceEnergy: normalizedPreference.energy,
          pace: videoContext?.pace ?? 'medium',
          hookStrength: fallbackIntent.sentiment.hookStrength,
          variantHint,
          text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
        }),
        variantHint,
      }),
      variantHint,
    }),
    audienceFeel: resolveAudienceFeel({
      contentCategory: resolveContentCategory({
        text: [promptText, contextText, fallbackIntent.summary, fallbackIntent.sentiment.summary, ...(fallbackIntent.searchTerms ?? [])].join(' '),
        pace: videoContext?.pace ?? 'medium',
        variantHint,
      }),
      primaryMood: normalizedPreference.mood,
      energyLevel: resolveEnergyLevel({
        preferenceEnergy: normalizedPreference.energy,
        pace: videoContext?.pace ?? 'medium',
        hookStrength: fallbackIntent.sentiment.hookStrength,
        variantHint,
        text: [promptText, contextText, fallbackIntent.sentiment.summary].join(' '),
      }),
      variantHint,
    }),
  })
}

export function normalizeSoundtrackProfile(profile: MusicSoundtrackProfile): MusicSoundtrackProfile {
  const tempoStart = Number.isFinite(profile.tempoRange?.[0]) ? Math.max(60, Math.round(profile.tempoRange[0])) : 84
  const tempoEnd = Number.isFinite(profile.tempoRange?.[1]) ? Math.max(tempoStart + 2, Math.round(profile.tempoRange[1])) : tempoStart + 20

  return {
    contentCategory: cleanInline(profile.contentCategory) || 'editorial cut',
    primaryMood: cleanInline(profile.primaryMood) || 'cinematic',
    secondaryMood: cleanInline(profile.secondaryMood) || 'balanced',
    energyLevel: clamp(Math.round(profile.energyLevel), 0, 100),
    tempoRange: [tempoStart, tempoEnd],
    genreCandidates: uniqueStrings(profile.genreCandidates).slice(0, 6),
    instrumentationHints: uniqueStrings(profile.instrumentationHints).slice(0, 6),
    editSyncStyle: cleanInline(profile.editSyncStyle) || 'balanced editorial',
    emotionalArc: cleanInline(profile.emotionalArc) || 'steady lift',
    avoid: uniqueStrings(profile.avoid).slice(0, 6),
    confidence: clamp01(profile.confidence),
    reasoningSummary: cleanInline(profile.reasoningSummary) || 'The soundtrack should support the cut rather than fight it.',
    audienceFeel: cleanInline(profile.audienceFeel) || 'premium editorial',
  }
}

export function buildMusicAnalysisStages({
  profile,
  archiveCount,
  videoContext,
  variantHint,
}: {
  profile: MusicSoundtrackProfile
  archiveCount: number
  videoContext?: MusicVideoContext | null
  variantHint?: string
}): MusicRecommendationPhase[] {
  const pace = videoContext?.pace ?? 'medium'
  const variantLine = variantHint ? ` Refine mode: ${variantHint}.` : ''

  return [
    {
      key: 'analyzing-vibe',
      label: 'Analyzing video vibe',
      detail: `Reading ${profile.contentCategory} signals and the current ${pace} pace.${variantLine}`,
      progress: 0.12,
    },
    {
      key: 'detecting-pacing',
      label: 'Detecting pacing',
      detail: `Targeting ${formatTempoRange(profile.tempoRange)} BPM for ${profile.editSyncStyle}.`,
      progress: 0.26,
    },
    {
      key: 'inferring-mood',
      label: 'Inferring mood',
      detail: `${profile.primaryMood} with ${profile.secondaryMood} support for ${profile.audienceFeel}.`,
      progress: 0.41,
    },
    {
      key: 'building-profile',
      label: 'Building soundtrack profile',
      detail: `Focusing on ${profile.genreCandidates.slice(0, 3).join(', ')} and ${profile.instrumentationHints.slice(0, 3).join(', ')}.`,
      progress: 0.56,
    },
    {
      key: 'searching-archive',
      label: 'Searching archive',
      detail: `Scanning ${archiveCount} local tracks before anything external.`,
      progress: 0.72,
    },
    {
      key: 'ranking-matches',
      label: 'Ranking best matches',
      detail: `Balancing mood, tempo, freshness, and fit reasons.`,
      progress: 0.86,
    },
    {
      key: 'balancing-diversity',
      label: 'Balancing diversity',
      detail: variantHint
        ? `Using a ${variantHint} seed so refinements stay relevant without repeating the same cue.`
        : 'Keeping the top picks distinct so the lane feels curated instead of repetitive.',
      progress: 1,
    },
  ]
}

function rankArchiveTracks({
  catalog,
  profile,
  contextText,
  preference,
  videoContext,
  query,
  variantHint,
  recentlyUsedTrackIds,
}: {
  catalog: MusicCatalogTrack[]
  profile: MusicSoundtrackProfile
  contextText: string
  preference: MusicPreference
  videoContext?: MusicVideoContext | null
  query: string
  variantHint?: string
  recentlyUsedTrackIds: string[]
}) {
  const tokenSet = uniqueStrings([
    ...extractKeywords(contextText),
    ...(videoContext?.signals ?? []),
    ...(videoContext?.intent?.searchTerms ?? []),
    ...(videoContext?.intent?.trends?.flatMap((trend) => trend.tags) ?? []),
  ])
  const recentUsageCounts = recentlyUsedTrackIds.reduce<Record<string, number>>((counts, trackId) => {
    const key = normalizeText(trackId)
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})
  const variantSeed = hashString(
    [query, profile.contentCategory, profile.primaryMood, profile.secondaryMood, variantHint ?? 'default', contextText].join('|'),
  )

  const baseRanked = catalog.map((track, index) => {
    const trackText = buildTrackSearchText(track)
    const matchedTerms = findMatchedTokens(trackText, tokenSet)
    const trackMood = resolveTrackMood(track)
    const trackEnergyScore = resolveTrackEnergyScore(track)
    const trackTempoRange = track.tempoRange ?? [Math.max(72, track.bpm - 10), Math.min(180, track.bpm + 10)]
    const moodMatch = scoreMoodMatch(profile, trackMood, trackText, track)
    const energyMatch = scoreEnergyMatch(profile.energyLevel, trackEnergyScore, track.energy)
    const tempoMatch = scoreTempoMatch(profile.tempoRange, trackTempoRange, track.bpm)
    const genreMatch = scoreGenreMatch(profile.genreCandidates, trackText, track)
    const instrumentationMatch = scoreInstrumentationMatch(profile.instrumentationHints, trackText, track)
    const contextMatch = scoreContextMatch(tokenSet, trackText, track)
    const avoidPenalty = scoreAvoidPenalty(profile.avoid, trackText, track)
    const freshnessScore = resolveFreshnessScore(track)
    const qualityScore = resolveQualityScore(track)
    const usagePenalty = resolveUsagePenalty(track, recentUsageCounts)
    const baseScore = clamp(
      Math.round(
        moodMatch * 24 +
          energyMatch * 18 +
          tempoMatch * 16 +
          genreMatch * 16 +
          instrumentationMatch * 10 +
          contextMatch * 8 +
          freshnessScore * 4 +
          qualityScore * 4 -
          avoidPenalty * 14 -
          usagePenalty * 10,
      ),
      0,
      100,
    )
    const fitReasons = buildTrackFitReasons({
      profile,
      track,
      matchedTerms,
      moodMatch,
      energyMatch,
      tempoMatch,
      genreMatch,
      instrumentationMatch,
      contextMatch,
      avoidPenalty,
    })

    return {
      track,
      baseScore,
      finalScore: baseScore,
      fitReasons,
      matchedTerms,
      breakdown: {
        mood: Math.round(moodMatch * 100),
        energy: Math.round(energyMatch * 100),
        tempo: Math.round(tempoMatch * 100),
        genre: Math.round(genreMatch * 100),
        instrumentation: Math.round(instrumentationMatch * 100),
        context: Math.round(contextMatch * 100),
        avoid: Math.round(avoidPenalty * 100),
        freshness: Math.round(freshnessScore * 100),
        diversity: 0,
        usage: Math.round(usagePenalty * 100),
        quality: Math.round(qualityScore * 100),
      },
      diversityPenalty: 0,
      usagePenalty,
      freshnessScore,
      qualityScore,
      index,
    }
  })

  const selectedGenreCounts = new Map<string, number>()
  const selectedMoodCounts = new Map<string, number>()
  const selectedArtistCounts = new Map<string, number>()

  return baseRanked
    .sort((a, b) => b.baseScore - a.baseScore || hashTieBreaker(variantSeed, a.track.id) - hashTieBreaker(variantSeed, b.track.id) || a.index - b.index)
    .map((candidate, orderIndex) => {
      const diversityPenalty = resolveDiversityPenalty(candidate.track, selectedGenreCounts, selectedMoodCounts, selectedArtistCounts)
      const finalScore = clamp(Math.round(candidate.baseScore - diversityPenalty), 0, 100)
      selectedGenreCounts.set(normalizeText(candidate.track.genre), (selectedGenreCounts.get(normalizeText(candidate.track.genre)) ?? 0) + 1)
      selectedMoodCounts.set(candidate.track.mood, (selectedMoodCounts.get(candidate.track.mood) ?? 0) + 1)
      selectedArtistCounts.set(normalizeText(candidate.track.artist), (selectedArtistCounts.get(normalizeText(candidate.track.artist)) ?? 0) + 1)
      return {
        ...candidate,
        finalScore,
        diversityPenalty,
        breakdown: {
          ...candidate.breakdown,
          diversity: Math.round(diversityPenalty * 100),
        },
        fitReasons: enrichTrackFitReasons(candidate.fitReasons, candidate.track, preference, videoContext),
        matchedTerms: candidate.matchedTerms,
        orderIndex,
      }
    })
    .sort((a, b) => b.finalScore - a.finalScore || b.baseScore - a.baseScore || a.index - b.index)
}

function buildRecommendationGroups(scored: ReturnType<typeof rankArchiveTracks>, profile: MusicSoundtrackProfile): MusicRecommendationGroup[] {
  const usedTrackIds = new Set<string>()

  const takeForGroup = (groupKey: MusicRecommendationGroupKey, predicate: (item: (typeof scored)[number], orderIndex: number) => boolean) => {
    const style = GROUP_STYLE[groupKey]
    const tracks = scored
      .filter((item, orderIndex) => !usedTrackIds.has(item.track.id) && predicate(item, orderIndex))
      .slice(0, style.take)
      .map((item) => {
        usedTrackIds.add(item.track.id)
        return decorateRecommendation(item, groupKey, style.label, profile)
      })

    if (tracks.length === 0) return null

    return {
      key: groupKey,
      label: style.label,
      description: style.description,
      accent: style.accent,
      tracks,
    } satisfies MusicRecommendationGroup
  }

  const groups = [
    takeForGroup('best-fit', (_item, orderIndex) => orderIndex < 3),
    takeForGroup('safe-fit', (item) => item.finalScore >= 72 && item.finalScore < 92),
    takeForGroup('creative-stretch', (item) => item.finalScore >= 60 && item.fitReasons.some((reason) => hasAny(normalizeText(reason), ['creative', 'distinct', 'unexpected', 'lift', 'contrast']))),
    takeForGroup('high-energy-alternative', (item) => item.track.energy === 'high' || (item.track.cinematicTags?.some((tag) => hasAny(normalizeText(tag), ['impact', 'trailer', 'drive', 'launch', 'hero'])) ?? false)),
    takeForGroup('cinematic-alternative', (item) => item.track.mood === 'cinematic' || (item.track.cinematicTags?.some((tag) => hasAny(normalizeText(tag), ['cinematic', 'orchestral', 'score', 'luxury', 'trailer'])) ?? false)),
    takeForGroup('minimal-ambient-alternative', (item) => item.track.mood === 'minimal' || item.track.energy === 'low' || (item.track.cinematicTags?.some((tag) => hasAny(normalizeText(tag), ['ambient', 'underscore', 'soft', 'quiet'])) ?? false)),
  ]

  const resolved = groups.filter((group): group is MusicRecommendationGroup => Boolean(group))
  if (resolved.length === 0) {
    const fallbackTracks = scored.slice(0, 3).map((item) => decorateRecommendation(item, 'best-fit', GROUP_STYLE['best-fit'].label, profile))
    return [
      {
        key: 'best-fit',
        label: GROUP_STYLE['best-fit'].label,
        description: GROUP_STYLE['best-fit'].description,
        accent: GROUP_STYLE['best-fit'].accent,
        tracks: fallbackTracks,
      },
    ]
  }

  return resolved
}

function flattenGroups(groups: MusicRecommendationGroup[], limit: number) {
  const tracks: MusicRecommendation[] = []
  const seen = new Set<string>()

  for (const group of groups) {
    for (const track of group.tracks) {
      if (seen.has(track.id)) continue
      seen.add(track.id)
      tracks.push(track)
      if (tracks.length >= limit) return tracks
    }
  }

  return tracks
}

function decorateRecommendation(
  item: ReturnType<typeof rankArchiveTracks>[number],
  groupKey: MusicRecommendationGroupKey,
  groupLabel: string,
  profile: MusicSoundtrackProfile,
): MusicRecommendation {
  const previewUrl = buildMusicPreviewUrl(item.track.id)
  return {
    id: item.track.id,
    title: item.track.title,
    artist: item.track.artist,
    producer: item.track.producer,
    genre: item.track.genre,
    bpm: item.track.bpm,
    vibeTags: item.track.vibeTags,
    coverArtUrl: item.track.coverArtUrl,
    coverArtPosition: item.track.coverArtPosition,
    previewUrl,
    reason: buildRecommendationReason(item, profile, groupLabel),
    mood: item.track.mood,
    energy: item.track.energy,
    sourcePlatform: item.track.sourcePlatform,
    durationSec: item.track.durationSec,
    subtitle: item.track.subtitle,
    description: item.track.description,
    album: item.track.album,
    releaseYear: item.track.releaseYear,
    storageKey: item.track.storageKey,
    sourceUrl: item.track.sourceUrl,
    license: item.track.license,
    matchScore: item.finalScore,
    matchedTerms: item.matchedTerms,
    exactMatch: item.finalScore >= 96,
    fitReasons: item.fitReasons,
    groupKey,
    groupLabel,
    profileConfidence: profile.confidence,
    tempoWindow: profile.tempoRange,
    matchBreakdown: item.breakdown,
    usagePenalty: item.usagePenalty,
    diversityPenalty: item.diversityPenalty,
    freshnessScore: item.freshnessScore,
    qualityScore: item.qualityScore,
  }
}

function buildRecommendationReason(
  item: ReturnType<typeof rankArchiveTracks>[number],
  profile: MusicSoundtrackProfile,
  groupLabel: string,
) {
  const reasons = item.fitReasons.slice(0, 3)
  const reasonLine = reasons.length > 0 ? reasons.join(' ') : 'It stays close to the ideal soundtrack profile.'
  return `${groupLabel}. ${reasonLine} ${profile.reasoningSummary}`.trim()
}

function buildTrackFitReasons({
  profile,
  track,
  matchedTerms,
  moodMatch,
  energyMatch,
  tempoMatch,
  genreMatch,
  instrumentationMatch,
  contextMatch,
  avoidPenalty,
}: {
  profile: MusicSoundtrackProfile
  track: MusicCatalogTrack
  matchedTerms: string[]
  moodMatch: number
  energyMatch: number
  tempoMatch: number
  genreMatch: number
  instrumentationMatch: number
  contextMatch: number
  avoidPenalty: number
}) {
  const reasons: string[] = []
  const moodPhrase = cleanInline(profile.primaryMood)
  const secondaryPhrase = cleanInline(profile.secondaryMood)

  if (moodMatch >= 0.75) {
    reasons.push(`Matches the ${moodPhrase} mood lane.`)
  } else if (moodMatch >= 0.55) {
    reasons.push(`Sits comfortably near the ${moodPhrase} tone.`)
  }

  if (tempoMatch >= 0.7) {
    reasons.push(`Tempo sits inside the ${formatTempoRange(profile.tempoRange)} BPM window.`)
  }

  if (energyMatch >= 0.7) {
    reasons.push(`${track.energy === 'low' ? 'Stays under dialogue' : track.energy === 'high' ? 'Pushes cut energy' : 'Keeps the cut moving'} without forcing the frame.`)
  }

  if (genreMatch >= 0.55) {
    reasons.push(`Lines up with ${profile.genreCandidates.slice(0, 2).join(' and ')} cues.`)
  }

  if (instrumentationMatch >= 0.5) {
    reasons.push(`Instrumentation leans toward ${profile.instrumentationHints.slice(0, 2).join(' and ')}.`)
  }

  if (contextMatch >= 0.45 && matchedTerms.length > 0) {
    reasons.push(`Picked up ${matchedTerms.slice(0, 2).join(' and ')} signals from the edit context.`)
  }

  if (avoidPenalty === 0 && profile.avoid.length > 0) {
    reasons.push(`Avoids the busy ${profile.avoid[0]} lane the brief does not want.`)
  }

  if (reasons.length === 0) {
    reasons.push(`Balances ${moodPhrase} against ${secondaryPhrase} so the cue stays editorial.`)
  }

  return uniqueStrings(reasons).slice(0, 4)
}

function enrichTrackFitReasons(
  reasons: string[],
  track: MusicCatalogTrack,
  preference: MusicPreference,
  videoContext?: MusicVideoContext | null,
) {
  const enriched = [...reasons]
  if (preference.energy === 'high' && track.energy === 'high') {
    enriched.push('Strong fit for a more energetic pass.')
  }
  if (preference.mood === 'minimal' && track.energy !== 'high') {
    enriched.push('Keeps the mix minimal and supportive.')
  }
  if (videoContext?.pace === 'fast' && track.energy === 'high') {
    enriched.push('Matches fast-cut rhythm cleanly.')
  }
  if (videoContext?.pace === 'slow' && track.energy === 'low') {
    enriched.push('Leaves room for slower, reflective pacing.')
  }
  return uniqueStrings(enriched).slice(0, 5)
}

function buildTrackSearchText(track: MusicCatalogTrack) {
  return normalizeText(
    [
      track.title,
      track.subtitle,
      track.description,
      track.album,
      track.artist,
      track.producer,
      track.genre,
      track.subgenre,
      track.vibeTags.join(' '),
      track.moodTags?.join(' '),
      track.rankingKeywords.join(' '),
      track.instrumentation?.join(' '),
      track.cinematicTags?.join(' '),
      track.emotionalTone,
      track.idealUseCases?.join(' '),
      track.avoidContexts?.join(' '),
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function scoreMoodMatch(profile: MusicSoundtrackProfile, trackMood: MusicMood, trackText: string, track: MusicCatalogTrack) {
  const primaryMood = resolveMoodToken(profile.primaryMood, track.mood)
  const secondaryMood = resolveMoodToken(profile.secondaryMood, track.mood)

  if (trackMood === primaryMood) return 1
  if (trackMood === secondaryMood) return 0.84
  if (hasAny(trackText, [primaryMood, secondaryMood])) return 0.7
  if (track.moodTags?.some((tag) => hasAny(normalizeText(tag), [primaryMood, secondaryMood]))) return 0.62
  if (track.cinematicTags?.some((tag) => hasAny(normalizeText(tag), [primaryMood, secondaryMood]))) return 0.58
  if (profile.genreCandidates.some((genre) => hasAny(trackText, [normalizeText(genre)]))) return 0.44
  return 0.2
}

function scoreEnergyMatch(targetEnergyLevel: number, trackEnergyScore: number, trackEnergy: MusicEnergy) {
  const energyGap = Math.abs(targetEnergyLevel - trackEnergyScore)
  const energyMatch = clamp01(1 - energyGap / 100)
  const moodBoost = trackEnergy === 'high' && targetEnergyLevel >= 72 ? 0.06 : trackEnergy === 'low' && targetEnergyLevel <= 40 ? 0.06 : 0
  return clamp01(energyMatch + moodBoost)
}

function scoreTempoMatch(targetRange: [number, number], trackRange: [number, number], bpm: number) {
  const [targetMin, targetMax] = targetRange
  const [trackMin, trackMax] = trackRange
  const overlap = Math.max(0, Math.min(targetMax, trackMax) - Math.max(targetMin, trackMin))
  const overlapRatio = overlap / Math.max(1, targetMax - targetMin)
  if (overlapRatio > 0) return clamp01(overlapRatio)
  const centerTarget = (targetMin + targetMax) / 2
  const centerGap = Math.abs(centerTarget - bpm)
  return clamp01(1 - centerGap / 48)
}

function scoreGenreMatch(profileGenres: string[], trackText: string, track: MusicCatalogTrack) {
  const haystack = normalizeText([track.genre, track.subgenre, track.rankingKeywords.join(' '), track.cinematicTags?.join(' ')].filter(Boolean).join(' '))
  let hits = 0
  for (const genre of profileGenres) {
    const normalized = normalizeText(genre)
    if (!normalized) continue
    if (haystack.includes(normalized) || trackText.includes(normalized)) hits += 1
  }
  if (hits === 0 && hasAny(haystack, ['cinematic', 'score', 'trailer', 'ambient', 'electronic', 'piano', 'orchestral'])) {
    hits = 0.35
  }
  return clamp01(hits / Math.max(1, profileGenres.length > 0 ? Math.min(profileGenres.length, 4) : 4))
}

function scoreInstrumentationMatch(hints: string[], trackText: string, track: MusicCatalogTrack) {
  const haystack = normalizeText([track.instrumentation?.join(' '), track.cinematicTags?.join(' '), track.emotionalTone].filter(Boolean).join(' '))
  let hits = 0
  for (const hint of hints) {
    const normalized = normalizeText(hint)
    if (!normalized) continue
    if (haystack.includes(normalized) || trackText.includes(normalized)) hits += 1
  }
  if (hits === 0 && hasAny(haystack, ['pulse', 'pad', 'strings', 'piano', 'drums', 'bass', 'synth'])) {
    hits = 0.32
  }
  return clamp01(hits / Math.max(1, hints.length > 0 ? Math.min(hints.length, 4) : 4))
}

function scoreContextMatch(tokens: string[], trackText: string, track: MusicCatalogTrack) {
  const scoredTokens = tokens.filter((token) => token.length >= 3 && trackText.includes(token)).length
  const useCaseHits = track.idealUseCases?.reduce((sum, value) => sum + (hasAny(trackText, [normalizeText(value)]) ? 1 : 0), 0) ?? 0
  return clamp01((scoredTokens + useCaseHits) / Math.max(3, Math.min(8, tokens.length + (track.idealUseCases?.length ?? 0) || 4)))
}

function scoreAvoidPenalty(avoidTerms: string[], trackText: string, track: MusicCatalogTrack) {
  const avoidMatches = avoidTerms.filter((term) => term.length >= 3 && trackText.includes(normalizeText(term))).length
  const contextAvoidMatches = track.avoidContexts?.filter((term) => {
    const normalized = normalizeText(term)
    return avoidTerms.some((avoid) => normalized.includes(normalizeText(avoid)) || normalizeText(avoid).includes(normalized))
  }).length ?? 0
  return clamp01((avoidMatches + contextAvoidMatches) / Math.max(1, Math.min(4, avoidTerms.length + (track.avoidContexts?.length ?? 0) || 1)))
}

function resolveFreshnessScore(track: MusicCatalogTrack) {
  if (typeof track.freshnessScore === 'number' && Number.isFinite(track.freshnessScore)) {
    return clamp01(track.freshnessScore / 100)
  }

  const year = track.releaseYear
  const currentYear = new Date().getFullYear()
  const yearGap = Math.max(0, currentYear - year)
  return clamp01(1 - Math.min(8, yearGap) / 8)
}

function resolveQualityScore(track: MusicCatalogTrack) {
  if (typeof track.qualityScore === 'number' && Number.isFinite(track.qualityScore)) {
    return clamp01(track.qualityScore / 100)
  }

  return clamp01(
    0.55 +
      (track.vibeTags.length > 2 ? 0.1 : 0) +
      (track.idealUseCases?.length ? 0.12 : 0) +
      (track.instrumentation?.length ? 0.1 : 0),
  )
}

function resolveUsagePenalty(track: MusicCatalogTrack, recentUsageCounts: Record<string, number>) {
  const recentCount = recentUsageCounts[normalizeText(track.id)] ?? 0
  const archiveUsage = track.usageCount ?? 0
  return clamp01((recentCount * 0.35 + archiveUsage * 0.05) / 2)
}

function resolveDiversityPenalty(
  track: MusicCatalogTrack,
  selectedGenreCounts: Map<string, number>,
  selectedMoodCounts: Map<string, number>,
  selectedArtistCounts: Map<string, number>,
) {
  const genrePenalty = (selectedGenreCounts.get(normalizeText(track.genre)) ?? 0) * 0.045
  const moodPenalty = (selectedMoodCounts.get(track.mood) ?? 0) * 0.028
  const artistPenalty = (selectedArtistCounts.get(normalizeText(track.artist)) ?? 0) * 0.08
  return clamp01(genrePenalty + moodPenalty + artistPenalty)
}

function resolveTrackMood(track: MusicCatalogTrack): MusicMood {
  return track.mood
}

function resolveTrackEnergyScore(track: MusicCatalogTrack) {
  if (typeof track.energyScore === 'number' && Number.isFinite(track.energyScore)) {
    return clamp(track.energyScore, 0, 100)
  }

  switch (track.energy) {
    case 'low':
      return 30
    case 'high':
      return 82
    case 'medium':
    default:
      return 58
  }
}

function resolveProfileMood({
  preferenceMood,
  intentMood,
  text,
  variantHint,
}: {
  preferenceMood: MusicMood
  intentMood: MusicMood
  text: string
  variantHint?: string
}) {
  if (variantHint === 'minimal' || variantHint === 'less-intense') return 'minimal'
  if (variantHint === 'energetic') return 'uplifting'
  if (variantHint === 'cinematic') return 'cinematic'
  if (variantHint === 'emotional') return hasAny(normalizeText(text), ['dark', 'tension', 'dramatic', 'reflective']) ? 'minimal' : 'cinematic'
  if (hasAny(normalizeText(text), ['playful', 'bouncy', 'friendly', 'light'])) return 'playful'
  if (hasAny(normalizeText(text), ['ambient', 'documentary', 'under dialogue', 'voice-led', 'reflective'])) return 'minimal'
  if (hasAny(normalizeText(text), ['trailer', 'hero', 'impact', 'launch', 'sales', 'strong'])) return 'uplifting'
  if (hasAny(normalizeText(text), ['dark', 'moody', 'night', 'tension'])) return 'dark'
  if (hasAny(normalizeText(text), ['luxury', 'premium', 'cinematic', 'score'])) return 'cinematic'
  return intentMood || preferenceMood
}

function resolveSecondaryMood({
  primaryMood,
  intentMood,
  text,
  variantHint,
}: {
  primaryMood: MusicMood
  intentMood: MusicMood
  text: string
  variantHint?: string
}) {
  if (variantHint === 'energetic') return 'uplifting'
  if (variantHint === 'minimal' || variantHint === 'less-intense') return 'minimal'
  if (variantHint === 'emotional') return 'minimal'
  if (primaryMood === 'cinematic' && hasAny(normalizeText(text), ['luxury', 'premium'])) return 'dark'
  if (primaryMood === 'uplifting') return 'cinematic'
  if (primaryMood === 'dark') return 'cinematic'
  return intentMood === primaryMood ? 'minimal' : intentMood
}

function resolveEnergyLevel({
  preferenceEnergy,
  pace,
  hookStrength,
  variantHint,
  text,
}: {
  preferenceEnergy: MusicEnergy
  pace: MusicVideoContext['pace']
  hookStrength: number
  variantHint?: string
  text: string
}) {
  const base = preferenceEnergy === 'low' ? 34 : preferenceEnergy === 'high' ? 78 : 56
  const paceBoost = pace === 'fast' ? 12 : pace === 'slow' ? -10 : 0
  const hookBoost = hookStrength >= 0.6 ? 10 : hookStrength >= 0.35 ? 4 : 0
  const variantBoost = variantHint === 'energetic' ? 12 : variantHint === 'minimal' || variantHint === 'less-intense' ? -14 : variantHint === 'emotional' ? -4 : 0
  const editorialBoost = hasAny(normalizeText(text), ['launch', 'hero', 'impact', 'trailer']) ? 10 : hasAny(normalizeText(text), ['documentary', 'reflective', 'under dialogue']) ? -8 : 0
  return clamp(base + paceBoost + hookBoost + variantBoost + editorialBoost, 0, 100)
}

function resolveTempoRange({
  energyLevel,
  pace,
  variantHint,
}: {
  energyLevel: number
  pace: MusicVideoContext['pace']
  variantHint?: string
}): [number, number] {
  let center = 96
  if (energyLevel >= 82) center = 132
  else if (energyLevel >= 64) center = 120
  else if (energyLevel >= 48) center = 108
  else center = 90

  if (pace === 'fast') center += 6
  if (pace === 'slow') center -= 6
  if (variantHint === 'energetic') center += 8
  if (variantHint === 'minimal' || variantHint === 'less-intense') center -= 10

  const spread = energyLevel >= 72 ? 12 : energyLevel >= 50 ? 10 : 8
  return [Math.max(70, Math.round(center - spread)), Math.min(168, Math.round(center + spread))]
}

function resolveContentCategory({
  text,
  pace,
  variantHint,
}: {
  text: string
  pace: MusicVideoContext['pace']
  variantHint?: string
}) {
  const normalized = normalizeText(text)
  if (variantHint === 'energetic') return 'high-energy social'
  if (variantHint === 'minimal' || variantHint === 'less-intense') return 'minimal editorial'
  if (variantHint === 'emotional') return 'emotional story'
  if (hasAny(normalized, ['documentary', 'interview', 'founder', 'story', 'testimonial'])) return 'founder story'
  if (hasAny(normalized, ['tutorial', 'educational', 'explainer', 'lesson', 'walkthrough'])) return 'educational'
  if (hasAny(normalized, ['luxury', 'premium', 'high end', 'cinematic'])) return 'luxury product'
  if (hasAny(normalized, ['launch', 'promo', 'ad', 'sales', 'reel', 'instagram', 'tiktok'])) return 'social launch'
  if (pace === 'fast') return 'short-form edit'
  if (pace === 'slow') return 'reflective cut'
  return 'editorial cut'
}

function resolveGenreCandidates({
  primaryMood,
  secondaryMood,
  contentCategory,
  intent,
  variantHint,
}: {
  primaryMood: string
  secondaryMood: string
  contentCategory: string
  intent: ReturnType<typeof analyzeMusicIntent>
  variantHint?: string
}) {
  const tags = uniqueStrings([
    primaryMood,
    secondaryMood,
    intent.sentiment.mood,
    intent.sentiment.energy === 'high' ? 'driving electronic' : intent.sentiment.energy === 'low' ? 'ambient' : 'cinematic',
    contentCategory,
    variantHint === 'energetic' ? 'electronic' : '',
    variantHint === 'minimal' || variantHint === 'less-intense' ? 'ambient' : '',
    variantHint === 'emotional' ? 'orchestral' : '',
  ])

  if (hasAny(contentCategory, ['luxury'])) {
    return uniqueStrings(['cinematic', 'electronic', 'luxury', ...tags]).slice(0, 5)
  }
  if (hasAny(contentCategory, ['founder', 'reflective'])) {
    return uniqueStrings(['ambient', 'piano', 'cinematic', ...tags]).slice(0, 5)
  }
  if (hasAny(contentCategory, ['launch', 'social', 'short-form'])) {
    return uniqueStrings(['pop', 'electronic', 'hybrid trailer', ...tags]).slice(0, 5)
  }
  return tags.slice(0, 5)
}

function resolveInstrumentationHints({
  primaryMood,
  secondaryMood,
  contentCategory,
  energyLevel,
  variantHint,
}: {
  primaryMood: string
  secondaryMood: string
  contentCategory: string
  energyLevel: number
  variantHint?: string
}) {
  const base = [
    primaryMood.includes('minimal') ? 'piano' : '',
    primaryMood.includes('cinematic') ? 'strings' : '',
    energyLevel >= 72 ? 'percussion' : '',
    energyLevel <= 40 ? 'pads' : '',
    contentCategory.includes('luxury') ? 'synth pulse' : '',
    contentCategory.includes('founder') ? 'textural bed' : '',
    contentCategory.includes('launch') ? 'tight drums' : '',
    variantHint === 'emotional' ? 'warm piano' : '',
    variantHint === 'energetic' ? 'driving drums' : '',
    variantHint === 'minimal' || variantHint === 'less-intense' ? 'soft pads' : '',
    secondaryMood.includes('dark') ? 'low strings' : '',
  ]

  return uniqueStrings(base).slice(0, 5)
}

function resolveEditSyncStyle({
  pace,
  energyLevel,
  contentCategory,
  variantHint,
}: {
  pace: MusicVideoContext['pace']
  energyLevel: number
  contentCategory: string
  variantHint?: string
}) {
  if (variantHint === 'energetic') return 'fast-cut friendly'
  if (variantHint === 'minimal' || variantHint === 'less-intense') return 'under-dialogue restraint'
  if (variantHint === 'emotional') return 'slow-burn lift'
  if (contentCategory.includes('luxury')) return 'polished editorial pulse'
  if (contentCategory.includes('founder')) return 'story-first support'
  if (pace === 'fast' || energyLevel >= 72) return 'fast-cut friendly'
  if (pace === 'slow' || energyLevel <= 40) return 'breathing room'
  return 'balanced editorial'
}

function resolveEmotionalArc({
  primaryMood,
  secondaryMood,
  contentCategory,
  energyLevel,
  variantHint,
}: {
  primaryMood: string
  secondaryMood: string
  contentCategory: string
  energyLevel: number
  variantHint?: string
}) {
  if (variantHint === 'energetic') return 'build tension into a clean payoff'
  if (variantHint === 'minimal' || variantHint === 'less-intense') return 'keep the emotional lift restrained and spacious'
  if (variantHint === 'emotional') return 'start intimate, then widen into an earned release'
  if (contentCategory.includes('luxury')) return 'sleek build with controlled lift'
  if (contentCategory.includes('founder')) return 'reflective opening into a confident finish'
  if (energyLevel >= 72) return 'hook forward, then keep momentum climbing'
  if (energyLevel <= 40) return 'open softly and stay breathable'
  return `${primaryMood} lead with ${secondaryMood} support`
}

function resolveAvoidHints({
  contentCategory,
  pace,
  energyLevel,
  variantHint,
}: {
  contentCategory: string
  pace: MusicVideoContext['pace']
  energyLevel: number
  variantHint?: string
}) {
  const hints = [
    contentCategory.includes('founder') || pace === 'slow' ? 'busy vocals' : '',
    contentCategory.includes('luxury') ? 'cheap-sounding drops' : '',
    energyLevel <= 40 ? 'overly aggressive drums' : '',
    variantHint === 'minimal' || variantHint === 'less-intense' ? 'dense percussion' : '',
    variantHint === 'energetic' ? 'flat ambient beds' : '',
  ]

  return uniqueStrings(hints).slice(0, 5)
}

function resolveAudienceFeel({
  contentCategory,
  primaryMood,
  energyLevel,
  variantHint,
}: {
  contentCategory: string
  primaryMood: string
  energyLevel: number
  variantHint?: string
}) {
  if (variantHint === 'energetic') return 'hype and immediate'
  if (variantHint === 'minimal' || variantHint === 'less-intense') return 'calm and premium'
  if (variantHint === 'emotional') return 'reflective and human'
  if (contentCategory.includes('luxury')) return 'premium and polished'
  if (contentCategory.includes('founder')) return 'trustworthy and thoughtful'
  if (energyLevel >= 72) return 'motivated and kinetic'
  if (primaryMood.includes('cinematic')) return 'cinematic and elevated'
  return 'editorial and balanced'
}

function buildHeuristicReasoningSummary({
  contentCategory,
  primaryMood,
  secondaryMood,
  energyLevel,
  tempoRange,
  editSyncStyle,
  audienceFeel,
  variantHint,
}: {
  contentCategory: string
  primaryMood: string
  secondaryMood: string
  energyLevel: number
  tempoRange: [number, number]
  editSyncStyle: string
  audienceFeel: string
  variantHint?: string
}) {
  const variantLine = variantHint ? ` The ${variantHint} refinement keeps the lane distinct.` : ''
  return `A ${contentCategory} cue with ${primaryMood} lead and ${secondaryMood} support, tuned for ${editSyncStyle} at ${formatTempoRange(tempoRange)} BPM and shaped to feel ${audienceFeel}.${variantLine}`
}

function formatTempoRange(range: [number, number]) {
  return `${range[0]}-${range[1]}`
}

function findMatchedTokens(trackText: string, tokens: string[]) {
  return uniqueStrings(tokens.filter((token) => token.length >= 3 && trackText.includes(normalizeText(token)))).slice(0, 4)
}

function resolveMoodToken(value: string, fallback: MusicMood): MusicMood {
  const text = normalizeText(value)
  if (hasAny(text, ['playful', 'bouncy', 'light', 'warm', 'friendly'])) return 'playful'
  if (hasAny(text, ['minimal', 'ambient', 'subtle', 'under dialogue', 'documentary', 'reflective'])) return 'minimal'
  if (hasAny(text, ['dark', 'moody', 'night', 'tension', 'drama', 'trailer'])) return 'dark'
  if (hasAny(text, ['uplifting', 'driving', 'launch', 'promo', 'anthem', 'hero', 'bright', 'kinetic'])) return 'uplifting'
  if (hasAny(text, ['cinematic', 'luxury', 'premium', 'score', 'orchestral', 'editorial'])) return 'cinematic'
  return fallback
}

function hashTieBreaker(seed: number, value: string) {
  return hashString(`${seed}:${value}`) % 1000
}

function uniqueStrings(values: string[]) {
  return values
    .map((value) => cleanInline(value))
    .filter(Boolean)
    .filter((value, index, all) => all.indexOf(value) === index)
}

function extractKeywords(value: string) {
  return normalizeText(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOPWORDS.has(token))
}

function cleanInline(value: string | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || ''
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim()
}

function hasAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle))
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return clamp(value, 0, 1)
}

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
  'your',
  'music',
  'sound',
  'soundtrack',
  'track',
  'tracks',
  'cue',
])
