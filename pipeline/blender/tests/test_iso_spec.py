import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from iso_spec import camera_position,frame_numbers,export_plan


class TestOriginalRenderPlan(unittest.TestCase):
    def test_four_isometric_directions_share_distance_and_elevation(self):
        points=[camera_position((0,0,0),3,d) for d in ("ne","nw","sw","se")]
        self.assertEqual(len({round(x[2],6) for x in points}),1)
        self.assertEqual(len({round(sum(n*n for n in x),6) for x in points}),1)
        self.assertEqual(len({(round(x[0],3),round(x[1],3)) for x in points}),4)

    def test_frame_paths_and_duration(self):
        doc=export_plan("walk",frame_numbers("0,4,8,12"),12)
        self.assertEqual(len(doc["directions"]),4)
        self.assertEqual(doc["directions"]["se"][0]["path"],"se/walk-00000.png")
        self.assertEqual(doc["directions"]["ne"][-1]["durationMs"],83)

    def test_bad_frames_rejected(self):
        for frames in ("", "-1", "1,,2", "3,3", "100001"):
            with self.assertRaises(ValueError):
                frame_numbers(frames)
        with self.assertRaises(ValueError):
            export_plan("bad id",[1],12)

    def test_invalid_angles_rejected(self):
        with self.assertRaises(ValueError):
            camera_position((0,0,0),2,"front")
        with self.assertRaises(ValueError):
            camera_position((0,0,0),2,"se",100)


if __name__=="__main__":
    unittest.main()
