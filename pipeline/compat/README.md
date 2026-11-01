# M2 — Original PNG / indexed compatibility

Local only: accepts an original PNG and a declared creator, generates a **new palette from that PNG**, produces a private indexed sprite or brick and performs a byte-exact indexed round-trip. The public runtime **does not** require this LBA-compatible binary.

Commands:

    cd pipeline/compat
    npm install --no-audit --no-fund
    npm test
    cd ../..
    node pipeline/compat/cli.mjs original.png /tmp/atlas-export --id original-camera --creator project-owner --kind brick

The export includes source PNG, independently generated palette, binary codec fixture and JSON manifest. Publication defaults to pending review and false. No RESS.HQR, original palette or any game artwork is read. M2 is a codec integration test, **not** an artistic approval.
