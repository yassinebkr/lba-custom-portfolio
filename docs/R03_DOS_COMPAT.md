# R03 — Original asset compatibility with the DOS engine

Status: **indexed codec and real-source conversion verified**.

The private game runtime has previously booted under js-dos 6.22. R03 produces native indexed data from the actual V5 telemetry receiver and the actual V7 workshop image. The generated files are retained as test artifacts. The original game archives remain local to the owner.

## Conversion boundary

~~~mermaid
flowchart LR
  WORLD["WorldPackage v1"] --> SELECT["Image and scene selection"]
  RADIO["V5 original radio atlas"] --> SELECT
  ROOM["V7 original workshop PNG"] --> SELECT
  SELECT --> RESAMPLE["Premultiplied area resampling"]
  RESAMPLE --> PALETTE["One shared 256-entry RGB palette"]
  PALETTE --> INDEX["8-bit index and alpha threshold"]
  INDEX --> CODEC["LBA row-RLE codec"]
  CODEC --> SPRITES["Four DOS sprite-entry payloads"]
  CODEC --> BRICK["One original scene brick payload"]
  SPRITES --> PRIVATE["Optional owner-local SPRITES.HQR overlay"]
  PRIVATE --> DOS["Private DOS runtime smoke test"]
~~~

All four orientations share one palette and one encoding convention. Palette index zero represents transparent pixels. The converter performs encode/decode verification of each sprite entry and the original-background brick.

## Verified original-image results

[GitHub Actions source-derived conversion report](https://github.com/yassinebkr/lba-custom-portfolio/actions/runs/43347166066)

The green CI run used the versioned original V5 radio atlas at 192px per direction and the original V7 960×640 workshop PNG. The generated 128px-compatible sprite uses signed offsets X = −64 and Y = −127.

| Measurement | Observed |
| --- | ---: |
| Input sprite frame | 192 × 192 px |
| DOS-compatible sprite frame | 128 × 128 px |
| Independent orientation entries | 4 |
| Original workshop brick sample | 128 × 85 px |
| Four indexed sprite payloads | 15,943 bytes |
| Original-background brick payload | 7,751 bytes |
| Total binary payloads | 23,694 bytes |
| Shared palette | 768 bytes |
| Alpha threshold changes in NE view | 1,051 pixels |
| Alpha threshold changes in NW view | 924 pixels |
| Alpha threshold changes in SW view | 1,065 pixels |
| Alpha threshold changes in SE view | 1,071 pixels |

Color differences on the two comparison backdrops are measured relative to the *resized 128px RGBA image*.

| View | Dark RMSE | Light RMSE |
| --- | ---: | ---: |
| NE | 4.102 | 5.858 |
| NW | 3.643 | 6.090 |
| SW | 3.854 | 6.442 |
| SE | 3.618 | 7.159 |
| Workshop brick | 11.649 | 11.696 |

These metrics quantify palette and alpha conversion losses after resizing. Fidelity to the original 192px input, in-engine performance and perceptual readability require separate validation.

### Compatibility constraints

- The source sprite's pivot Y = 190 exceeds the signed 8-bit offset range when exporting a 192px frame. The 128px experiment scales the pivot to Y = 127, which fits.
- Fractional alpha is reduced to binary transparency by the legacy sprite codec. The returned preview shows the actual indexed-palette result.
- The CI test generates an **independent shared palette** from original assets. Private DOS integration must use the game's existing global palette unless the engine is explicitly adapted to accept a replacement.
- Four direction images currently occupy separate sprite-entry payloads. The mapping from those entries to engine rotations or actor behavior requires a private runtime test.
- The 128×85 workshop sample verifies brick data encoding. Producing a navigable room also requires valid `LBA_GRI.HQR` and `LBA_BLL.HQR` data, including layout references and collision metadata.
- The bundled DOS game executable and archive bytes are held outside the repository. Their distribution rights remain a separate release gate.

## CLI and private validation

~~~bash
cd adapters/lba-dos
npm install --no-audit --no-fund
cd ../..

node adapters/lba-dos/cli.mjs \
  examples/world-package/telemetry.json \
  --root . \
  --target 128 \
  --out output/r03-dos-compat
~~~

The output contains the original-image palette, four encoded sprite binaries, one brick payload, re-decoded PNG previews and `report.json`. The directory is covered by repository ignore rules.

With a privately held compatible game installation:

~~~bash
node adapters/lba-dos/cli.mjs \
  examples/world-package/telemetry.json \
  --root . \
  --target 128 \
  --private-base /path/to/private/dos/game \
  --indices 10,11,12,13 \
  --out output/private-r03
~~~

The four selected indices are **examples** and require verification against the owner's actual sprite table. The private integration path reads `RESS.HQR` for the global palette and rewrites the selected entries in `SPRITES.HQR`. Every other entry is preserved by the archive repacker. The generated private HQR stays in ignored `output/`.

The workflow can then be used with the existing local bundle creation scripts after selecting the correct scene and sprite references. R03 currently has **no verified in-game screenshot** because the private DOS resources are absent from CI.

## Acceptance evidence

| Gate | Result |
| --- | --- |
| World package and original input files | Passed |
| 192px → 128px sprite conversion | Passed |
| Global generated palette + binary transparency | Passed |
| Four sprite codec round-trips | Passed |
| Workshop sample brick codec round-trip | Passed |
| Explicit private HQR entry selection | Passed unit tests |
| Private HQR parse, patch and emulator boot | Pending owner-local source files |
| Four-view actor integration | Pending scene and script mapping |
| Complete original DOS workshop layout | Pending GRI/BLL generation |
| Legal static browser release | Pending executable and resource rights review |

The next decision depends on the private in-engine visual comparison. The present experiment preserves the source PNGs and reports each irreversible conversion. The editing pipeline remains a portable project that can support additional runtime adapters.
