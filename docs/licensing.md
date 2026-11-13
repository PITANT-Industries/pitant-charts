# Licensing and third-party notices

`@pitant/charts`, `@pitant/charts-react`, and `pitant-charts` include MIT license files and declare MIT in their package manifests. The catalog is a private npm workspace in a public GitHub repository. It has third-party notices and its manifest has no license field. The repository currently has no root license file. [Core license](../packages/charts/LICENSE) · [Industrial React license](../packages/charts-react/LICENSE) · [Dashboard license](../packages/charts-ui/LICENSE)

## License options for PITANT-owned code

| License | When it fits |
| --- | --- |
| [MIT](https://opensource.org/license/mit) | Keeps the existing package terms and supports adoption in commercial and open-source applications. Redistributed copies retain the copyright and permission notices. |
| [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) | A permissive option if PITANT wants an explicit contributor patent grant and patent termination terms. The distribution requirements include applicable notices and attribution. |
| [MPL-2.0](https://www.mozilla.org/en-US/MPL/2.0/FAQ/) | A file-level copyleft option if PITANT wants recipients of distributed software to have access to modifications to covered files. Applications can combine those files with differently licensed code. |

MIT is the closest fit if the goal is broad reuse with the terms the shipped packages already use. To establish a repository-wide default, confirm the intended copyright holder and the rights to license the original catalog, documentation, and configuration. Then add a root `LICENSE` that describes the intended scope and align package metadata where applicable. [GitHub repository licensing guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)

## Preserve third-party terms

Upstream terms continue to apply to vendored source, libraries, fonts, and other assets. The catalog uses MIT components and adaptations, Apache-2.0 for Apache ECharts and Vercel Labs UI SDK, BSD-3-Clause for the bundled D3 Sankey version, ISC for Lucide and the listed TopoJSON packages, and OFL-1.1 for the bundled font families. Before distributing an archive or gallery build, review the licenses and applicable notice files for what it contains. Keep original attribution in adapted source and retain ECharts’ `NOTICE` where applicable. [Catalog notices](../apps/chart-catalog/THIRD_PARTY_NOTICES.md) · [Dashboard notices](../packages/charts-ui/THIRD_PARTY_NOTICES.md)
