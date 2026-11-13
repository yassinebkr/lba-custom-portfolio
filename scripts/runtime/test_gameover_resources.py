"""Synthetic HQR entry bounds tests; no commercial assets are included."""
import importlib.util
from pathlib import Path
import struct
import unittest

SCRIPT = Path(__file__).with_name("inspect_gameover_resources.py")
spec = importlib.util.spec_from_file_location("r05_gameover", SCRIPT)
assert spec and spec.loader
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def fixture(index, method=0, payload=b"sample", decoded_len=None):
    table_size = (index + 1) * 4
    header = bytearray(table_size)
    struct.pack_into("<I", header, 0, table_size)
    struct.pack_into("<I", header, index * 4, table_size)
    decoded = len(payload) if decoded_len is None else decoded_len
    return bytes(header) + struct.pack("<IIH", decoded, len(payload), method) + payload


class GameoverHqrIndexTest(unittest.TestCase):
    def test_gameover_model_entry_21(self):
        result = audit.inspect_entry(fixture(21), 21)
        self.assertEqual(result["state"], "present")
        self.assertEqual(result["entryCount"], 22)
        self.assertEqual(result["decodedBytes"], 6)
        self.assertEqual(result["compression"], 0)

    def test_gameover_sample_entry_37_lzs_layout(self):
        result = audit.inspect_entry(fixture(37, method=1, payload=b"xyz", decoded_len=512), 37)
        self.assertEqual(result["state"], "present")
        self.assertEqual(result["decodedBytes"], 512)
        self.assertEqual(result["packedBytes"], 3)

    def test_missing_entry_outside_table(self):
        result = audit.inspect_entry(fixture(21), 37)
        self.assertEqual(result["state"], "missing")

    def test_empty_offset(self):
        data = bytearray(fixture(21))
        struct.pack_into("<I", data, 21 * 4, 0)
        self.assertEqual(audit.inspect_entry(bytes(data), 21)["state"], "missing")

    def test_invalid_headers_fail_explicitly(self):
        with self.assertRaisesRegex(ValueError, "offset table"):
            audit.inspect_entry(b"\x07\x00\x00\x00" + b"x" * 20, 2)
        with self.assertRaisesRegex(ValueError, "offset outside"):
            data = bytearray(fixture(21))
            struct.pack_into("<I", data, 21 * 4, 0xFFFFFF)
            audit.inspect_entry(bytes(data), 21)
        with self.assertRaisesRegex(ValueError, "exceeds file bounds"):
            data = fixture(21)[:-1]
            audit.inspect_entry(data, 21)
        with self.assertRaisesRegex(ValueError, "compression"):
            audit.inspect_entry(fixture(21, method=9), 21)


if __name__ == "__main__":
    unittest.main()
