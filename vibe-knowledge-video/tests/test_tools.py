"""Behavioral tests with generated fixtures; no private project files required."""
from __future__ import annotations

from fractions import Fraction
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import wave

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "skills" / "vibe-knowledge-video" / "scripts"
sys.path.insert(0, str(SCRIPTS))
from analyze_bgm import analyze, decode_audio
from check_timeline import validate
from inspect_media import inspect, contact_sheet
from prepare_reference_review import extract


def make_movie(path, with_audio=True):
    import av
    import numpy as np
    with av.open(str(path), "w") as output:
        video = output.add_stream("libx264", rate=30)
        video.width, video.height, video.pix_fmt = 320, 180, "yuv420p"
        video.options = {"crf": "25", "preset": "fast"}
        audio = output.add_stream("aac", rate=48000) if with_audio else None
        if audio:
            audio.layout = "stereo"
        for index in range(60):
            pixels = np.zeros((180, 320, 3), dtype=np.uint8)
            pixels[:, :, 2] = 30
            left = index*4
            pixels[50:130, left:left+30, :2] = [40, 220]
            frame = av.VideoFrame.from_ndarray(pixels, format="rgb24")
            frame.pts, frame.time_base = index, Fraction(1, 30)
            for packet in video.encode(frame):
                output.mux(packet)
        for packet in video.encode(None):
            output.mux(packet)
        if audio:
            for start in range(0, 96000, 1024):
                n = min(1024, 96000-start)
                mono = (.2*np.sin(2*np.pi*440*(np.arange(n)+start)/48000)).astype(np.float32)
                frame = av.AudioFrame.from_ndarray(np.stack((mono, mono)), format="fltp", layout="stereo")
                frame.sample_rate, frame.pts, frame.time_base = 48000, start, Fraction(1, 48000)
                for packet in audio.encode(frame):
                    output.mux(packet)
            for packet in audio.encode(None):
                output.mux(packet)


class ToolTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        import numpy as np
        (ROOT / ".validation").mkdir(exist_ok=True)
        cls.temp = tempfile.TemporaryDirectory(prefix="tools-", dir=ROOT / ".validation")
        cls.directory = Path(cls.temp.name)
        cls.movie = cls.directory / "fixture.mp4"
        cls.silent = cls.directory / "silent.mp4"
        make_movie(cls.movie)
        make_movie(cls.silent, False)
        rate = 22050
        cls.clicks = np.zeros(rate*20, dtype=np.float32)
        pulse_n = int(rate*.06)
        t = np.arange(pulse_n)/rate
        pulse = .7*np.exp(-t*90)*np.sin(2*np.pi*120*t)
        for beat in np.arange(.5, 19.6, .5):
            start = int(beat*rate)
            cls.clicks[start:start+pulse_n] += pulse
        cls.wav = cls.directory / "clicks.wav"
        with wave.open(str(cls.wav), "wb") as handle:
            handle.setparams((1, 2, rate, 0, "NONE", "not compressed"))
            handle.writeframes((cls.clicks*32767).astype("<i2").tobytes())

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def timeline(self):
        return {"schema_version": 1, "fps": 60, "duration_frames": 240,
                "captions": [{"id": "c1", "start_frame": 0, "end_frame": 120, "text": "条件满足，门才打开。"},
                             {"id": "c2", "start_frame": 120, "end_frame": 240, "text": "两个信号，缺一不可。"}],
                "events": [{"id": "e1", "animation_start_frame": 20,
                            "visible_peak_frame": 60, "audio_peak_frame": 60, "tolerance_frames": 2}]}

    def test_tempo_and_transients(self):
        report = analyze(self.clicks, 22050)
        self.assertTrue(any(abs(c["bpm"]-120) < 2 for c in report["tempo_candidates"]), report["tempo_candidates"])
        self.assertTrue(any(abs(p["time_seconds"]-5.0) < .08 for p in report["onset_candidates"]))
        self.assertAlmostEqual(report["decoded_duration_seconds"], 20)

    def test_silence_does_not_invent_beats(self):
        import numpy as np
        report = analyze(np.zeros(22050*3, dtype=np.float32), 22050)
        self.assertEqual(report["tempo_candidates"], [])
        self.assertEqual(report["onset_candidates"], [])
        self.assertIsNone(report["last_sample_above_minus50db_seconds"])

    def test_media_audio_decoder(self):
        y, info = decode_audio(self.movie, 22050, 10)
        self.assertGreater(len(y), 22050)
        self.assertEqual(info["codec"], "aac")

    def test_no_audio_is_explicit(self):
        with self.assertRaisesRegex(ValueError, "no audio"):
            decode_audio(self.silent, 22050, 10)

    def test_timeline_result_peak_not_start(self):
        data = self.timeline()
        findings, metrics = validate(data)
        self.assertEqual(findings, [])
        self.assertEqual(metrics["events"][0]["animation_lead_frames"], 40)
        data["events"][0]["visible_peak_frame"] = 78
        findings, _ = validate(data)
        self.assertTrue(any(x["code"] == "event_sync" and x["level"] == "FAIL" for x in findings))

    def test_reading_warning_is_not_failure(self):
        data = self.timeline()
        data["duration_frames"] = 900
        data["captions"][1]["end_frame"] = 900
        findings, _ = validate(data)
        self.assertTrue(any(x["code"] == "long_dwell" and x["level"] == "WARN" for x in findings))
        self.assertFalse(any(x["level"] == "FAIL" for x in findings))

    def test_nested_overlaps_and_invalid_frames(self):
        data = self.timeline()
        data["captions"][0]["end_frame"] = 239
        data["captions"].append({"id": "c3", "start_frame": 180, "end_frame": 200, "text": "第三句"})
        findings, _ = validate(data)
        self.assertEqual(sum(x["code"] == "caption_overlap" for x in findings), 3)
        data["events"][0]["audio_peak_frame"] = 240
        findings, _ = validate(data)
        self.assertTrue(any(x["code"] == "event_range" for x in findings))

    def test_changed_music_invalidates_binding(self):
        data = self.timeline()
        data["music"] = {"sha256": "a"*64}
        findings, _ = validate(data, music_analysis={"source": {"sha256": "b"*64}})
        self.assertTrue(any(x["code"] == "music_changed" for x in findings))

    def test_full_decode_and_contact_sheet(self):
        report = inspect(self.movie, 30, 320, 180, 2)
        self.assertEqual(report["status"], "PASS", report["findings"])
        self.assertEqual(report["video"]["decoded_frames"], 60)
        self.assertEqual(report["video"]["intervals_off_nominal"], 0)
        self.assertTrue(report["audio"]["present"])
        sheet = self.directory / "contact.jpg"
        times = contact_sheet(self.movie, sheet, 2, 0, 4)
        self.assertEqual(len(times), 4)
        self.assertGreater(sheet.stat().st_size, 500)

    def test_expected_export_properties_fail(self):
        report = inspect(self.movie, 60, 1920, 1080, 2)
        self.assertEqual(report["status"], "FAIL")
        self.assertTrue(any(x["code"] == "frame_count" for x in report["findings"]))
        self.assertTrue(any(x["code"] == "video_cadence" for x in report["findings"]))

    def test_silent_export_requires_opt_in(self):
        self.assertEqual(inspect(self.silent)["status"], "FAIL")
        self.assertEqual(inspect(self.silent, require_audio=False)["status"], "PASS")

    def test_cli_refuses_overwrite(self):
        output = self.directory / "sentinel.json"
        output.write_text("do not replace", encoding="utf-8")
        result = subprocess.run([sys.executable, str(SCRIPTS / "analyze_bgm.py"), str(self.wav),
            "--output", str(output)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)
        self.assertEqual(output.read_text(encoding="utf-8"), "do not replace")

    def test_reference_review_is_portable_and_preserves_source(self):
        import hashlib
        before = hashlib.sha256(self.movie.read_bytes()).hexdigest()
        target = self.directory / "reference-review"
        report = extract(self.movie, target, times=[0, .4, .4001, 1.8], per_page=3)
        self.assertEqual(len(report["samples"]), 4)
        self.assertEqual(len(report["contact_sheets"]), 2)
        self.assertEqual(len({sample["file"] for sample in report["samples"]}), 4)
        for item in report["samples"]:
            self.assertFalse(Path(item["file"]).is_absolute())
            self.assertTrue((target/item["file"]).is_file())
            self.assertLessEqual(abs(item["actual_seconds"]-item["requested_seconds"]), 1/30)
        self.assertEqual(report["source_sha256"], before)
        self.assertEqual(hashlib.sha256(self.movie.read_bytes()).hexdigest(), before)
        metadata = (target/"extraction.json").read_bytes()
        with self.assertRaisesRegex(ValueError, "exists"):
            extract(self.movie, target, times=[0])
        self.assertEqual((target/"extraction.json").read_bytes(), metadata)

    def test_reference_review_rejects_invalid_range_before_writing(self):
        target = self.directory / "invalid-reference-review"
        with self.assertRaises(ValueError):
            extract(self.movie, target, times=[float("nan")])
        self.assertFalse(target.exists())
        with self.assertRaises(ValueError):
            extract(self.movie, target, start=5, end=1)
        self.assertFalse(target.exists())


if __name__ == "__main__":
    unittest.main()
