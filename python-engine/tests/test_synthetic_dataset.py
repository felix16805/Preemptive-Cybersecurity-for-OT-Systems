"""Tests for the SafeCut synthetic coursework dataset generator."""
import unittest

from ml.generate_synthetic_ot import generate


class SyntheticDatasetTests(unittest.TestCase):
    def test_dataset_has_at_least_ten_thousand_rows(self):
        data = generate(rows=10_000, seed=42)
        self.assertEqual(len(data), 10_000)
        self.assertIn("label", data.columns)
        self.assertGreaterEqual(data["label"].nunique(), 2)

    def test_attack_metadata_matches_binary_label(self):
        data = generate(rows=10_000, seed=42)
        self.assertTrue((data.loc[data["label"] == 0, "attack_type"] == "normal").all())
        self.assertTrue((data.loc[data["label"] == 1, "attack_type"] != "normal").all())

    def test_generator_rejects_fewer_than_ten_thousand_rows(self):
        with self.assertRaises(ValueError):
            generate(rows=9_999, seed=42)


if __name__ == "__main__":
    unittest.main()
