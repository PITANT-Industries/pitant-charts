/** Uniform rectangular beam bending through its thickness. */
export type ModeShapeBeam = {
  lengthM: number;
  widthM: number;
  thicknessM: number;
  youngsModulusPa: number;
  densityKgM3: number;
};

export type CantileverMode = {
  number: number;
  frequencyHz: number;
  /** Signed displacements sampled uniformly from the clamp to the free tip. */
  displacements: readonly number[];
  /** Interior zero crossings as fractions of length measured from the clamp. */
  nodeFractions: readonly number[];
};

/** Illustrative steel beam parameters for the simulated example. */
export const demoCantilever: ModeShapeBeam = {
  lengthM: 0.6,
  widthM: 0.03,
  thicknessM: 0.003,
  youngsModulusPa: 200e9,
  densityKgM3: 7850,
};

export const modeSampleCount = 121;
const sampleIntervals = modeSampleCount - 1;

// The first four positive roots of cosh(kL) cos(kL) + 1 = 0.
// Eisenträger et al., https://doi.org/10.1002/zamm.202200422, Table 2.
const clampedFreeRoots = [
  1.875104068711961,
  4.694091132974175,
  7.854757438237613,
  10.995540734875467,
] as const;

function bisectNode(
  shape: (fraction: number) => number,
  leftFraction: number,
  rightFraction: number,
  leftDisplacement: number,
): number {
  let left = leftFraction;
  let right = rightFraction;
  const leftSign = Math.sign(leftDisplacement);
  for (let iteration = 0; iteration < 40; iteration++) {
    const middle = (left + right) / 2;
    const middleSign = Math.sign(shape(middle));
    if (middleSign === 0) return middle;
    if (middleSign === leftSign) {
      left = middle;
    } else {
      right = middle;
    }
  }
  return (left + right) / 2;
}

/** Solve the first four undamped Euler–Bernoulli clamped-free bending modes. */
export function cantileverModes(beam: ModeShapeBeam): readonly CantileverMode[] {
  const { lengthM, widthM, thicknessM, youngsModulusPa, densityKgM3 } = beam;
  const dimensions = [lengthM, widthM, thicknessM, youngsModulusPa, densityKgM3];
  if (!dimensions.every((value) => Number.isFinite(value) && value > 0)) return [];

  // For this rectangular section I/A = thickness²/12, so width cancels from the frequency.
  const frequencyScale =
    (thicknessM / lengthM / lengthM) * (Math.sqrt(youngsModulusPa / densityKgM3 / 12) / (2 * Math.PI));
  if (!(frequencyScale > 0) || !Number.isFinite(frequencyScale * clampedFreeRoots[3] ** 2)) {
    return [];
  }

  return clampedFreeRoots.map((root, index) => {
    const coefficient = (Math.cosh(root) + Math.cos(root)) / (Math.sinh(root) + Math.sin(root));
    // The clamp has zero displacement and slope. The free tip has zero moment and shear.
    const shape = (fraction: number) => {
      const position = root * fraction;
      return (
        Math.cosh(position) - Math.cos(position) -
        coefficient * (Math.sinh(position) - Math.sin(position))
      );
    };
    const tipDisplacement = shape(1);
    const normalizedShape = (fraction: number) => shape(fraction) / tipDisplacement;
    const displacements = Array.from({ length: modeSampleCount }, (_, sample) =>
      normalizedShape(sample / sampleIntervals),
    );
    displacements[0] = 0;

    const nodeFractions: number[] = [];
    for (let sample = 1; sample < sampleIntervals; sample++) {
      const leftDisplacement = displacements[sample];
      if (leftDisplacement === 0) {
        nodeFractions.push(sample / sampleIntervals);
      } else if (leftDisplacement * displacements[sample + 1] < 0) {
        nodeFractions.push(
          bisectNode(normalizedShape, sample / sampleIntervals, (sample + 1) / sampleIntervals, leftDisplacement),
        );
      }
    }

    return { number: index + 1, frequencyHz: root ** 2 * frequencyScale, displacements, nodeFractions };
  });
}
