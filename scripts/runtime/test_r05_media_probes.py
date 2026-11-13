"""Synthetic-only tests of private v8 A/B bundles and mixed-mode CUE packaging."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest import mock
from types import SimpleNamespace
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
pcm = load("make-cdda-pcm-preview.py")


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
            "LBA.CFG": b"FlagKeepVoice: OFF\r\nWaveDriver: W_SB16_8.DLL\r\nMixerDriver: NoMixer\r\n",
            "RELENT.EXE": b"synthetic dos stub",
            "LBA.ISO": b"synthetic data-only ISO",
            "S003.LBA": b"synthetic museum save",
            "W_SB16_8.DLL": b"synthetic driver bytes",
            "W_SB16.DLL": b"synthetic 16-bit driver bytes",
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

    def test_v8_16bit_driver_switch_only_changes_dos_game_config(self):
        result = v8.prepare(self.source, self.v8target, wave_driver="W_SB16.DLL")
        self.assertEqual(result["waveDriver"], "W_SB16.DLL")
        self.assertEqual(result["unchangedEntries"], len(self.entries) - 2)
        with zipfile.ZipFile(self.v8target) as z:
            cfg = z.read("LBA.CFG")
            self.assertIn(b"WaveDriver: W_SB16.DLL\r\n", cfg)
            self.assertIn(b"MixerDriver: NoMixer\r\n", cfg)
            self.assertEqual(
                cfg,
                self.entries["LBA.CFG"].replace(
                    b"WaveDriver: W_SB16_8.DLL", b"WaveDriver: W_SB16.DLL"
                ),
            )
            for name, value in self.entries.items():
                if name not in ("LBA.CFG", ".jsdos/dosbox.conf"):
                    self.assertEqual(z.read(name), value)

    def test_v8_private_voice_files_are_opt_in_and_preserved(self):
        voices = self.root / "owned-voice"
        voices.mkdir()
        (voices / "EN_SYS.VOX").write_bytes(b"synthetic original voice" * 20)
        (voices / "EN_043.VOX").write_bytes(b"synthetic museum voice" * 20)
        (voices / "FR_001.VOX").write_bytes(b"synthetic French voice" * 20)
        original = (voices / "EN_SYS.VOX").read_bytes()
        result = v8.prepare(self.source, self.v8target, voice_dir=voices)
        self.assertEqual(result["voiceFiles"], 2)
        with zipfile.ZipFile(self.v8target) as z:
            self.assertEqual(z.read("VOX/EN_SYS.VOX"), original)
            self.assertEqual(z.read("VOX/EN_043.VOX"), (voices / "EN_043.VOX").read_bytes())
            self.assertNotIn("VOX/FR_001.VOX", z.namelist())
            self.assertIn(b"FlagKeepVoice: ON\r\n", z.read("LBA.CFG"))
            self.assertIn(b"WaveDriver: W_SB16_8.DLL\r\n", z.read("LBA.CFG"))
            self.assertEqual(z.read("RELENT.EXE"), self.entries["RELENT.EXE"])
        self.assertEqual((voices / "EN_SYS.VOX").read_bytes(), original)

    def test_v8_voice_inputs_are_validated_without_corrupting_reference(self):
        voices = self.root / "invalid-voices"
        voices.mkdir()
        (voices / "secret.txt").write_bytes(b"no")
        with self.assertRaisesRegex(ValueError, "Unexpected legacy voice"):
            v8.prepare(self.source, self.v8target, voice_dir=voices)
        self.assertFalse(self.v8target.exists())
        (voices / "secret.txt").unlink()
        (voices / "EN_SYS.VOX").write_bytes(b"synthetic original voice" * 20)
        (voices / "EN_LINK.VOX").symlink_to(voices / "EN_SYS.VOX")
        with self.assertRaisesRegex(ValueError, "regular files only"):
            v8.prepare(self.source, self.v8target, voice_dir=voices)
        self.assertFalse(self.v8target.exists())

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

    def test_one_real_track_transcode_is_bounded_and_preserves_other_tracks(self):
        tone = self.root / "r05-original-tone.jsdos"
        cdda.make(self.source, tone, mode="tone", tone_seconds=1)
        gog = self.root / "gog"
        music = gog / "Common/Music"
        music.mkdir(parents=True)
        (music / "Track_02.mp3").write_bytes(b"synthetic MP3 metadata" * 80)
        target = self.root / "r05-cdda-original-preview.jsdos"
        # No real GOG data or FFmpeg process is required in CI.
        with mock.patch.object(pcm.shutil, "which", return_value="ffmpeg"), \
             mock.patch.object(pcm.subprocess, "run", return_value=SimpleNamespace(
                 returncode=0, stdout=bytes([0, 12, 24, 36]) * 44100, stderr=b""
             )):
            report = pcm.make(tone, target, gog_root=gog, track=2, seconds=30)
        self.assertEqual(report["selectedTrack"], 2)
        self.assertEqual(report["durationSeconds"], 1)
        with zipfile.ZipFile(tone) as src, zipfile.ZipFile(target) as out:
            self.assertEqual(len(out.read("track_02.bin")), 176400)
            for name in src.namelist():
                if name != "track_02.bin":
                    self.assertEqual(out.read(name), src.read(name))
            self.assertEqual(out.read("LBA.CUE"), src.read("LBA.CUE"))

    def test_pcm_preview_rejects_bad_track_and_public_output(self):
        tone = self.root / "r05-original-tone.jsdos"
        cdda.make(self.source, tone, mode="tone", tone_seconds=1)
        gog = self.root / "gog"
        gog.mkdir()
        with self.assertRaisesRegex(ValueError, "02..10"):
            pcm.make(tone, self.root / "invalid.jsdos", gog_root=gog, track=11)
        with self.assertRaisesRegex(ValueError, "ignored output"):
            pcm.make(tone, ROOT / "web_deploy/public.jsdos", gog_root=gog)

    def test_refuses_public_output_and_unsupported_profile(self):
        with self.assertRaisesRegex(ValueError, "ignored output"):
            v8.prepare(self.source, ROOT / "web_deploy/test-private.jsdos")
        with self.assertRaisesRegex(ValueError, "ignored output"):
            cdda.make(self.source, ROOT / "web_deploy/test-private.jsdos", mode="tone")
        with self.assertRaisesRegex(ValueError, "Unsupported CD image"):
            v8.prepare(self.source, self.v8target, "LBA.PATH")


if __name__ == "__main__":
    unittest.main()
