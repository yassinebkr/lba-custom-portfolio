"""Synthetic-only tests of private v8 A/B bundles and mixed-mode CUE packaging."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parents[2]


def load(name):
    p = ROOT / "scripts/runtime" / name
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), p)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v8 = load("prepare-jsdos8-bundle.py")
cdda = load("make-cdda-probe.py")


class MediaProbeTest(unittest.TestCase):
    def setUp(self):
        (ROOT / "output").mkdir(exist_ok=True)
        self.tmp = tempfile.TemporaryDirectory(prefix="r05-media-", dir=ROOT / "output")
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.source = self.root / "r05-sb16-8.jsdos"
        self.v8target = self.root / "r05-v8-sb16-8.jsdos"
        self.cddatarget = self.root / "r05-cdda-tone.jsdos"
        self.entries = {
            ".jsdos/dosbox.conf": b"[sblaster]\r\nsbtype=sb16\r\ndma=1\r\nhdma=5\r\n",
            "LBA.CFG": b"WaveDriver: W_SB16_8.DLL\r\nMixerDriver: NoMixer\r\n",
            "RELENT.EXE": b"synthetic dos stub",
            "LBA.ISO": b"synthetic data-only ISO",
            "S003.LBA": b"synthetic museum save",
            "W_SB16_8.DLL": b"synthetic driver bytes",
        }
        with zipfile.ZipFile(self.source, "w", zipfile.ZIP_DEFLATED) as z:
            for name, value in self.entries.items():
                z.writestr(name, value)

    def test_v8_preserves_all_game_bytes_and_adds_autoexec(self):
        result = v8.prepare(self.source, self.v8target)
        self.assertEqual(result["unchangedEntries"], len(self.entries) - 1)
        with zipfile.ZipFile(self.v8target) as z:
            self.assertIn(b"[autoexec]\r\n", z.read(".jsdos/dosbox.conf"))
            self.assertIn(b"mount c .\r\n", z.read(".jsdos/dosbox.conf"))
            self.assertIn(b"imgmount d LBA.ISO -t iso\r\n", z.read(".jsdos/dosbox.conf"))
            self.assertIn(b"RELENT.EXE\r\n", z.read(".jsdos/dosbox.conf"))
            for name in self.entries:
                if name != ".jsdos/dosbox.conf":
                    self.assertEqual(z.read(name), self.entries[name])

    def test_v8_supports_private_cue_only_when_cue_exists(self):
        with self.assertRaisesRegex(ValueError, "LBA.CUE"):
            v8.prepare(self.source, self.v8target, "LBA.CUE")
        cdda.make(self.source, self.cddatarget, mode="tone", tone_seconds=1)
        data = v8.prepare(self.cddatarget, self.v8target, "LBA.CUE")
        self.assertEqual(data["cdImage"], "LBA.CUE")
        with zipfile.ZipFile(self.v8target) as z:
            self.assertIn(b"imgmount d LBA.CUE -t iso", z.read(".jsdos/dosbox.conf"))

    def test_cdda_generates_nine_sector_aligned_nonproprietary_tones(self):
        result = cdda.make(self.source, self.cddatarget, mode="tone", tone_seconds=1)
        self.assertEqual(result["trackCount"], 9)
        with zipfile.ZipFile(self.cddatarget) as z:
            cue = z.read("LBA.CUE").decode("ascii")
            self.assertIn('FILE "LBA.ISO" BINARY', cue)
            self.assertIn("TRACK 01 MODE1/2048", cue)
            self.assertIn('FILE "track_02.bin" BINARY', cue)
            self.assertIn("TRACK 10 AUDIO", cue)
            self.assertEqual(len(z.read("track_02.bin")), 44100 * 4)
            self.assertEqual(len(z.read("track_02.bin")) % 2352, 0)
            for name, value in self.entries.items():
                self.assertEqual(z.read(name), value)

    def test_owner_mp3_mode_requires_all_nine_source_files(self):
        music = self.root / "gog/Common/Music"
        music.mkdir(parents=True)
        with self.assertRaisesRegex(ValueError, "02"):
            cdda.make(self.source, self.cddatarget, mode="owner-mp3", gog_root=self.root / "gog")
        for number in range(2, 11):
            (music / f"Track_{number:02d}.mp3").write_bytes(b"\xff\xfb\x90\x64" + b"\x00" * 2048)
        result = cdda.make(self.source, self.cddatarget, mode="owner-mp3", gog_root=self.root / "gog")
        self.assertEqual(result["trackCount"], 9)
        with zipfile.ZipFile(self.cddatarget) as z:
            self.assertIn('FILE "Track_10.mp3" MP3', z.read("LBA.CUE").decode("ascii"))
            self.assertEqual(z.read("Track_09.mp3")[:4], b"\xff\xfb\x90\x64")

    def test_refuses_public_output_and_unsupported_profile(self):
        with self.assertRaisesRegex(ValueError, "ignored output"):
            v8.prepare(self.source, ROOT / "web_deploy/test-private.jsdos")
        with self.assertRaisesRegex(ValueError, "ignored output"):
            cdda.make(self.source, ROOT / "web_deploy/test-private.jsdos", mode="tone")
        with self.assertRaisesRegex(ValueError, "Unsupported CD image"):
            v8.prepare(self.source, self.v8target, "LBA.PATH")


if __name__ == "__main__":
    unittest.main()
