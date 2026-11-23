/** Simultaneous orthogonal displacements in micrometres, sampled at a uniform rate. */
export type ShaftOrbitRun = {
  id: string;
  label: string;
  sampleRateHz: number;
  xUm: readonly number[];
  yUm: readonly number[];
  /** Sample indices of consecutive once-per-revolution phase references. */
  triggerSamples: readonly number[];
};

export type ShaftOrbitData = {
  runs: readonly ShaftOrbitRun[];
};

const revolutions = 12;
const shaftFrequencyHz = 30;
const samplesPerRevolution = 192;
const finalTrigger = revolutions * samplesPerRevolution;
const triggerSamples = Array.from(
  { length: revolutions + 1 },
  (_, turn) => turn * samplesPerRevolution,
);

function removeMean(samples: readonly number[]): number[] {
  // Use the interval up to the last trigger to weight each shaft angle equally.
  const mean = samples.slice(0, -1).reduce((sum, sample) => sum + sample, 0) / finalTrigger;
  return samples.map((sample) => sample - mean);
}

function simulateRun(
  id: string,
  label: string,
  displacementAt: (shaftAngle: number) => readonly [xUm: number, yUm: number],
): ShaftOrbitRun {
  const xUm: number[] = [];
  const yUm: number[] = [];
  for (let sample = 0; sample <= finalTrigger; sample++) {
    const shaftAngle = (2 * Math.PI * sample) / samplesPerRevolution;
    const [x, y] = displacementAt(shaftAngle);
    xUm.push(x);
    yUm.push(y);
  }

  return {
    id,
    label,
    sampleRateHz: shaftFrequencyHz * samplesPerRevolution,
    xUm: removeMean(xUm),
    yUm: removeMean(yUm),
    triggerSamples,
  };
}

/** Simulated displacement waveforms for three order compositions at 1,800 RPM. */
export const demoShaftOrbits: ShaftOrbitData = {
  runs: [
    simulateRun("synchronous", "Synchronous 1×", (shaftAngle) => [
      45 * Math.cos(shaftAngle),
      28 * Math.sin(shaftAngle - Math.PI / 8),
    ]),
    simulateRun("second-order", "1× + 2×", (shaftAngle) => {
      const secondOrderAngle = 2 * shaftAngle - Math.PI / 5;
      return [
        32 * Math.cos(shaftAngle) + 24 * Math.cos(secondOrderAngle),
        22 * Math.sin(shaftAngle) + 19 * Math.sin(secondOrderAngle),
      ];
    }),
    simulateRun("subsynchronous", "Subsynchronous 0.46×", (shaftAngle) => {
      const subsynchronousAngle = 0.46 * shaftAngle + Math.PI / 6;
      return [
        17 * Math.cos(shaftAngle) + 38 * Math.cos(subsynchronousAngle),
        12 * Math.sin(shaftAngle) + 31 * Math.sin(subsynchronousAngle),
      ];
    }),
  ],
};
