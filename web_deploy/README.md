# GitHub Pages js-dos 6.22 loader

[Open the local-bundle import interface](https://yassinebkr.github.io/lba-custom-portfolio/web_deploy/).

The public page distributes the browser emulator and a file chooser. The visitor selects a `.jsdos` ZIP from their own computer; the browser loads it from a temporary blob URL. No game archive is uploaded or hosted.

## Private Debian bundle

Use the [R05 owner-local construction guide](../docs/R05_PRIVATE_DOS_BUILD.md). The resulting private ZIP should contain:

~~~text
.jsdos/
.jsdos/dosbox.conf
RELENT.EXE
LBA.ISO
LBA.CFG
RESS.HQR
SPRITES.HQR
SCENE.HQR
LBA_BRK.HQR
LBA_BLL.HQR
LBA_GRI.HQR
...other owner-provided game files...
~~~

The existing launcher executes `imgmount d LBA.ISO -t iso` and then `RELENT.EXE`. The reconstructed runtime has passed synthetic packaging and browser ZIP-extraction checks. Full commercial-game boot and in-engine rendering are pending an owner-local test with a clean lawful installation.

The historical PowerShell and Windows ISO build scripts are preserved in `scripts/hqr-tools/` for reference. The canonical Debian script is `scripts/runtime/build-private-jsdos.py`.

Keep game files, executable, HQR archives, ISO images and resulting bundles out of Git and public Pages.
