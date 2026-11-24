export interface MassFragment {
  mz: number
  intensity: number
}

export interface TandemMassSpectrum {
  label: string
  peaks: readonly MassFragment[]
  acquisition?: string
  source?: { label: string; href: string }
}

export interface MassSpectrumMirrorData {
  query: TandemMassSpectrum
  reference: TandemMassSpectrum
}

export interface RelativeFragment extends MassFragment {
  relativeIntensity: number
}

interface PreparedSpectra {
  query: readonly RelativeFragment[]
  reference: readonly RelativeFragment[]
  massRange: readonly [number, number]
}

interface FragmentMatches {
  queryToReference: ReadonlyMap<number, number>
  referenceToQuery: ReadonlyMap<number, number>
}

interface Candidate {
  queryIndex: number
  referenceIndex: number
  distance: number
}

function preparePeaks(peaks: readonly MassFragment[] | undefined): RelativeFragment[] | null {
  if (!Array.isArray(peaks)) return null

  let maximum = 0
  for (const peak of peaks) {
    if (!peak || !Number.isFinite(peak.mz) || peak.mz <= 0 ||
      !Number.isFinite(peak.intensity) || peak.intensity < 0) return null
    maximum = Math.max(maximum, peak.intensity)
  }
  if (maximum === 0) return null

  const sorted = [...peaks].sort((a, b) => a.mz - b.mz)
  if (sorted.some((peak, index) => index > 0 && peak.mz === sorted[index - 1].mz)) return null

  return sorted.map(({ mz, intensity }) => ({
    mz,
    intensity,
    relativeIntensity: intensity / maximum * 100,
  }))
}

export function prepareSpectra(data: MassSpectrumMirrorData): PreparedSpectra | null {
  const query = preparePeaks(data?.query?.peaks)
  const reference = preparePeaks(data?.reference?.peaks)
  if (!query || !reference) return null

  return {
    query,
    reference,
    massRange: [
      Math.min(query[0].mz, reference[0].mz),
      Math.max(query[query.length - 1].mz, reference[reference.length - 1].mz),
    ],
  }
}

function withinTolerance(queryMz: number, referenceMz: number, distance: number, toleranceMz: number) {
  if (distance <= toleranceMz) return true
  // Decimal input can round a boundary difference up by a unit in the last place.
  return toleranceMz > 0 && distance - toleranceMz <= Number.EPSILON * Math.max(queryMz, referenceMz)
}

/**
 * Greedily assigns the closest available pair from spectra sorted by ascending m/z.
 * Equal distances are resolved by query index and then reference index.
 */
export function matchFragments(
  query: readonly MassFragment[],
  reference: readonly MassFragment[],
  toleranceMz: number,
): FragmentMatches {
  const queryToReference = new Map<number, number>()
  const referenceToQuery = new Map<number, number>()
  if (!Number.isFinite(toleranceMz) || toleranceMz < 0) return { queryToReference, referenceToQuery }

  const candidates: Candidate[] = []
  let left = 0
  for (const [queryIndex, { mz: queryMz }] of query.entries()) {
    while (left < reference.length && reference[left].mz < queryMz &&
      !withinTolerance(queryMz, reference[left].mz, queryMz - reference[left].mz, toleranceMz)) left++

    for (let referenceIndex = left; referenceIndex < reference.length; referenceIndex++) {
      const { mz: referenceMz } = reference[referenceIndex]
      const distance = Math.abs(queryMz - referenceMz)
      if (!withinTolerance(queryMz, referenceMz, distance, toleranceMz)) break
      candidates.push({ queryIndex, referenceIndex, distance })
    }
  }

  candidates.sort((a, b) => a.distance - b.distance || a.queryIndex - b.queryIndex || a.referenceIndex - b.referenceIndex)
  for (const { queryIndex, referenceIndex } of candidates) {
    if (queryToReference.has(queryIndex) || referenceToQuery.has(referenceIndex)) continue
    queryToReference.set(queryIndex, referenceIndex)
    referenceToQuery.set(referenceIndex, queryIndex)
  }

  return { queryToReference, referenceToQuery }
}
