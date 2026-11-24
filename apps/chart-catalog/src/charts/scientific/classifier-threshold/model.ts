export interface ClassifierPrediction {
  id: string
  /** Larger scores provide stronger evidence for the positive class. */
  score: number
  actual: boolean
}

export interface ClassifierThresholdData {
  predictions: readonly ClassifierPrediction[]
  positiveLabel: string
  negativeLabel: string
}

export interface ClassifierOperatingPoint {
  /** Includes scores equal to this cutoff. Null predicts no positives. */
  threshold: number | null
  tp: number
  fp: number
  fn: number
  tn: number
  tpr: number
  fpr: number
  /** Undefined when the classifier predicts no positives. */
  precision: number | null
}

export interface PreparedClassifierThreshold {
  points: readonly ClassifierOperatingPoint[]
  positives: number
  negatives: number
  rocAuc: number
  averagePrecision: number
}

export function prepareClassifierThreshold(data: ClassifierThresholdData): PreparedClassifierThreshold | null {
  const ids = new Set<string>()
  let positives = 0
  for (const prediction of data.predictions) {
    if (typeof prediction.id !== 'string' || !prediction.id.trim() || ids.has(prediction.id) ||
      !Number.isFinite(prediction.score) || typeof prediction.actual !== 'boolean') return null
    ids.add(prediction.id)
    if (prediction.actual) positives++
  }
  const negatives = data.predictions.length - positives
  if (positives === 0 || negatives === 0) return null

  const ordered = [...data.predictions].sort((left, right) => right.score - left.score)
  const points: ClassifierOperatingPoint[] = [
    { threshold: null, tp: 0, fp: 0, fn: positives, tn: negatives, tpr: 0, fpr: 0, precision: null },
  ]

  let tp = 0
  let fp = 0
  let twiceRocArea = 0
  let precisionSum = 0
  let index = 0
  while (index < ordered.length) {
    const threshold = ordered[index].score
    const previousTp = tp
    const previousFp = fp
    // Every case with this score enters the predicted-positive set together.
    do {
      if (ordered[index].actual) tp++
      else fp++
      index++
    } while (index < ordered.length && ordered[index].score === threshold)

    const precision = tp / (tp + fp)
    points.push({
      threshold,
      tp,
      fp,
      fn: positives - tp,
      tn: negatives - fp,
      tpr: tp / positives,
      fpr: fp / negatives,
      precision,
    })

    // Integrate the ROC trapezoid and the precision-recall step in count space.
    twiceRocArea += (fp - previousFp) * (previousTp + tp)
    precisionSum += (tp - previousTp) * precision
  }

  return {
    points,
    positives,
    negatives,
    rocAuc: twiceRocArea / (2 * positives * negatives),
    averagePrecision: precisionSum / positives,
  }
}

/** Find the most inclusive operating point whose observed score is at least the cutoff. */
export function classifierPointIndex(points: readonly ClassifierOperatingPoint[], threshold: number): number {
  let low = 1
  let high = points.length
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    const score = points[middle].threshold
    if (score !== null && score >= threshold) low = middle + 1
    else high = middle
  }
  return low - 1
}
