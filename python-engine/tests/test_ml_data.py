"""Lightweight unit checks for dataset label handling (run from python-engine)."""
import unittest
import pandas as pd
from ml.train import detect_target_column, normalize_binary_labels


class DatasetLabelTests(unittest.TestCase):
    def test_ton_iot_binary_labels(self):
        self.assertEqual(normalize_binary_labels(pd.Series([0, 1, 0, 1])).tolist(), [0.0, 1.0, 0.0, 1.0])

    def test_swat_text_labels(self):
        self.assertEqual(normalize_binary_labels(pd.Series(["Normal", "Attack", "Attack"])).tolist(), [0.0, 1.0, 1.0])

    def test_missing_label_stays_missing(self):
        values = normalize_binary_labels(pd.Series([0, 1, None]))
        self.assertEqual(values.iloc[0], 0.0)
        self.assertEqual(values.iloc[1], 1.0)
        self.assertTrue(pd.isna(values.iloc[2]))

    def test_target_auto_detect(self):
        self.assertEqual(detect_target_column(["src_port", "label", "type"]), "label")
        self.assertEqual(detect_target_column(["Timestamp", "Normal/Attack"]), "Normal/Attack")


if __name__ == "__main__":
    unittest.main()
