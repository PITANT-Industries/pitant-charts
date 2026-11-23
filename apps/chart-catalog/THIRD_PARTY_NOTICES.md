# Third-party notices

| Source | Adaptations | License |
| --- | --- | --- |
| [shadcn/ui registry](https://github.com/shadcn-ui/ui) | Button and Tabs source, card slots, and Recharts line, area and bar examples | [MIT](licenses/shadcn-ui-MIT.md) |
| [Fumadocs](https://github.com/fuma-nama/fumadocs) | Documentation layout, provider and navigation | [MIT](licenses/Fumadocs-MIT.txt) |
| [Bklit UI](https://github.com/bklit/bklit-ui/tree/a02b9496b0ea4b665bd12f234d75ec2aa87baa5a/packages/ui/src/charts) | Gauge notch geometry, sunburst layout, sign-sensitive line segments, sparkline fixtures and path builders, radial climate, age-band, device, and hourly-energy examples, line event tooltip content and marker fan geometry, Bar value-label fitting and layout, and choropleth camera/manual zoom math and delayed tooltip state | [MIT](licenses/Bklit-UI-MIT.md) |
| [TanStack Charts 1.5.0](https://github.com/TanStack/charts/tree/b236dae2d57f1921b9e0296b6ecf023bf012bb5f/packages/charts-core/src) | Analytic spring sampler for chart motion and tooltip placement | [MIT](licenses/TanStack-Charts-MIT.txt) |
| [Simplify Charts](https://github.com/simplifyingai/ui.simplifyingai.com) | Density estimation, box plot statistics, and waterfall accumulation | [MIT](licenses/Simplify-Charts-MIT.md) |
| [EvilCharts registry](https://evilcharts.com/r/echarts-tooltip.json) | Shared chart tooltip and color treatment | [MIT](licenses/EvilCharts-MIT.txt) |
| [D3 Sankey](https://github.com/d3/d3-sankey) | Sankey node positioning and weighted links | [BSD-3-Clause](licenses/dependencies/d3-sankey-0.12.3-LICENSE) |
| [D3 Hierarchy](https://github.com/d3/d3-hierarchy) | Squarified and binary treemap layouts | [ISC](licenses/dependencies/d3-hierarchy-3.1.2-LICENSE) |
| [D3 Hexbin](https://github.com/d3/d3-hexbin) | Staggered hexagonal nearest-cell calculation | [BSD-3-Clause](licenses/d3-hexbin-BSD.txt) |
| [Number Flow](https://github.com/barvian/number-flow) | Rolling pie and ring center values | [MIT](licenses/dependencies/number-flow-react-0.6.2-LICENSE.md) |
| [PITANT Charts](https://github.com/PITANT-Industries/pitant-charts/tree/7f655b31227ab31b9aac625c758cde1b9bae7a2c/packages/charts/src) | Shared Canvas2D backend and dense line min/max sampling | [MIT](licenses/PITANT-Charts-MIT.txt) |

React and Recharts use MIT. Apache ECharts and Vercel Labs UI SDK use Apache-2.0. ECharts also supplies a [NOTICE](licenses/dependencies/echarts-6.1.0-NOTICE) and a [BSD-3-Clause license for its embedded D3 code](licenses/dependencies/echarts-6.1.0-LICENSE-d3). The D3 packages are versioned independently. Refer to the applicable license files in [dependency licenses](licenses/dependencies).

Lucide, TopoJSON Client, and World Atlas use ISC. Geist, Geist Mono, and Hanken Grotesk use OFL-1.1. World Atlas geography is derived from Natural Earth public-domain data.

Some catalog example names and the Line examples’ simulated latency and dense sampling behavior are based on the [shadcn.io React chart gallery](https://www.shadcn.io/charts) and its [Line examples](https://www.shadcn.io/charts/line).

## Scientific datasets

- [NOAA Global Monitoring Laboratory](https://doi.org/10.15138/yaf1-bk21) provides the monthly Mauna Loa CO₂ observations under CC0-1.0.
- [Palmer Station LTER and Kristen Gorman](https://allisonhorst.github.io/palmerpenguins/) collected the penguin observations. The palmerpenguins data package by Horst, Hill, and Gorman provides the CC0-1.0 snapshot used here.
- [Steel Plates Faults](https://doi.org/10.24432/C5J88N) by M. Buscema, S. Terzi, and W. Tastle (2010), UCI Machine Learning Repository, is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The example adapts four feature columns across 1,941 records to compute a Pearson correlation matrix.
- [NIST's Heat Flow Meter case study](https://itl.nist.gov/div898/handbook/eda/section4/eda4281.htm) provides Bob Zarr's calibration-factor measurements.
- [Adeel Zafar's diffraction data](https://doi.org/10.7910/DVN/ACPWBG) supplies the DyNiC₂ temperature series from Harvard Dataverse V1 under CC0-1.0. The peak tracker derives local pseudo-Voigt fits from three windows in the same measured scans.
- [CMS Run2010B dimuon events](https://doi.org/10.7483/OPENDATA.CMS.CB8H.MFFA) by Thomas McCauley (2014), CERN Open Data Portal, is released under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The example counts the 100,000 published invariant mass values into a histogram.
- [Bearing Vibration Data under Time-varying Rotational Speed Conditions, version 2](https://doi.org/10.17632/v43hmbwxpm.2) by Huan Huang and Natalie Baddour (2019), University of Ottawa, is available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The Campbell diagram converts the H-A-1 and I-A-1 accelerometer and encoder recordings into relative vibration spectra indexed by measured shaft speed. The wavelet scalogram transforms a filtered and normalized excerpt of the I-A-1 accelerometer record into relative time–frequency power. The bearing envelope example derives broadband power and angularly resampled envelope spectra from H-A-1 and I-A-1.
- [Vibration signals of different fault conditions in a generic rotating machine](https://doi.org/10.5281/zenodo.14388093) by Amanda Lucatto Marra and Claudio Garcia (2024), Universidade de São Paulo, is available under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The coherence and phase comparison derives cross-spectral estimates from the paired horizontal accelerometer channels in two 30 Hz test-rig recordings.
- [Data for “Coherent Optical Clock Down-Conversion for Microwave Frequencies with 10⁻¹⁸ Instability”](https://doi.org/10.18434/M32206) by Takuma Nakamura et al. (2020), National Institute of Standards and Technology, is available under [NIST data terms](https://www.nist.gov/open/license). PITANT derived overlapping Allan deviations on November 23, 2026, by converting the measured phase to time error, differencing the synchronized records for the residual, and aggregating all three series over discrete averaging times. The original data are provided as is under NIST’s published terms.
- [Damped Pendulum Dataset](https://github.com/EnzeXu/Damped_Pendulum_Dataset/tree/cbf82673641ecd65e902ad5c38a048387649a2a0) by Enze Xu et al. is licensed under [Apache-2.0](licenses/Damped-Pendulum-Dataset-Apache-2.0.txt). The phase-plane example excerpts three 0.607 m trials from release, rebases their timestamps, and retains every fourth sensor sample.
