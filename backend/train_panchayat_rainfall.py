"""Train and time-check a Panchayat rainfall downscaling model on paired observations.

Each CSV row must pair one IMD/grid forecast with the corresponding local
rain-gauge observation for the same valid time and Panchayat. Synthetic data
must not be used for training or reported as validation.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_FEATURES = [
    "imd_rainfall_mm",
    "forecast_lead_hours",
    "elevation_m",
    "slope_deg",
    "aspect_alignment",
    "distance_to_river_km",
    "ndvi",
]
REPORT_FEATURES = [
    "farmer_report_count_12h",
    "signal_ant_migration_12h",
    "signal_frog_chorus_12h",
    "signal_dragonfly_swallow_low_12h",
    "signal_dark_cumulus_base_12h",
    "signal_cool_sw_gusts_12h",
    "signal_solar_lunar_halo_12h",
    "signal_foliage_curl_odor_12h",
]
FEATURES = [*BASE_FEATURES, *REPORT_FEATURES]
REQUIRED = [
    "forecast_issue_time",
    "valid_time",
    "report_snapshot_time",
    "panchayat_id",
    "imd_source",
    "gauge_id",
    "gauge_source",
    "report_source",
    "terrain_source",
    "rain_window_hours",
    "gauge_rainfall_mm",
    "imd_rainfall_mm",
    "elevation_m",
    "slope_deg",
    "aspect_alignment",
    "distance_to_river_km",
    "ndvi",
    *REPORT_FEATURES,
]


def read_paired_observations(path: Path) -> pd.DataFrame:
    """Load and validate real forecast/gauge pairs; fail closed on bad inputs."""
    data = pd.read_csv(path)
    missing = sorted(set(REQUIRED) - set(data.columns))
    if missing:
        raise ValueError(f"Missing required CSV columns: {', '.join(missing)}")
    if data.empty:
        raise ValueError("No paired forecast and gauge observations were supplied.")

    data = data[REQUIRED].copy()
    for column in ["panchayat_id", "imd_source", "gauge_id", "gauge_source", "terrain_source", "report_source"]:
        if data[column].isna().any() or data[column].astype(str).str.strip().eq("").any():
            raise ValueError(f"Every row must include {column} for traceable data provenance.")
    data["forecast_issue_time"] = pd.to_datetime(data["forecast_issue_time"], errors="coerce", utc=True)
    data["valid_time"] = pd.to_datetime(data["valid_time"], errors="coerce", utc=True)
    data["report_snapshot_time"] = pd.to_datetime(data["report_snapshot_time"], errors="coerce", utc=True)
    if data[["forecast_issue_time", "valid_time", "report_snapshot_time"]].isna().any().any():
        raise ValueError("Every issue/valid/report-snapshot timestamp must be an ISO date/time.")
    if (data["forecast_issue_time"] > data["valid_time"]).any():
        raise ValueError("A forecast issue time cannot be later than its valid time.")
    if (data["report_snapshot_time"] > data["forecast_issue_time"]).any():
        raise ValueError("Report features may only include observations recorded by forecast issue time.")
    data["forecast_lead_hours"] = (
        (data["valid_time"] - data["forecast_issue_time"]).dt.total_seconds() / 3600
    )

    for column in ["rain_window_hours", "gauge_rainfall_mm", *FEATURES]:
        data[column] = pd.to_numeric(data[column], errors="coerce")
        if not np.isfinite(data[column].to_numpy(dtype=float)).all():
            raise ValueError(f"{column} must contain finite numeric values on every row.")

    nonnegative = ["imd_rainfall_mm", "elevation_m", "slope_deg", "distance_to_river_km", "gauge_rainfall_mm"]
    for column in nonnegative:
        if (data[column] < 0).any():
            raise ValueError(f"{column} cannot be negative.")
    if not data["aspect_alignment"].between(-1, 1).all():
        raise ValueError("aspect_alignment must be between -1 and 1.")
    if not data["ndvi"].between(-1, 1).all():
        raise ValueError("ndvi must be between -1 and 1.")
    for column in REPORT_FEATURES[1:]:
        if not data[column].isin([0, 1]).all():
            raise ValueError(f"{column} must be 0 or 1 (no report / one or more real reports).")
    if (data["farmer_report_count_12h"] < 0).any():
        raise ValueError("farmer_report_count_12h cannot be negative.")
    if (data["rain_window_hours"] <= 0).any() or data["rain_window_hours"].nunique() != 1:
        raise ValueError("Use one consistent positive rainfall accumulation window across the dataset.")
    if data.duplicated(["forecast_issue_time", "valid_time", "panchayat_id"]).any():
        raise ValueError("Duplicate forecast_issue_time + valid_time + panchayat_id pairs found.")
    return data.sort_values("valid_time").reset_index(drop=True)


def build_model() -> RandomForestRegressor:
    """Return the candidate model; its quality is unknown until real data is checked."""
    return RandomForestRegressor(
        n_estimators=300,
        min_samples_leaf=2,
        max_features=1.0,
        random_state=42,
        n_jobs=-1,
    )


def train_and_evaluate(data: pd.DataFrame, model_path: Path) -> dict:
    """Use the latest 20% of distinct dates as a chronological holdout."""
    dates = pd.Index(data["valid_time"].dt.floor("D").drop_duplicates().sort_values())
    if len(dates) < 5:
        raise ValueError("At least 5 distinct valid dates are needed for a chronological holdout.")
    split_index = max(1, int(np.floor(len(dates) * 0.8)))
    if split_index >= len(dates):
        split_index = len(dates) - 1
    cutoff = dates[split_index]
    train = data[data["valid_time"].dt.floor("D") < cutoff]
    test = data[data["valid_time"].dt.floor("D") >= cutoff]
    if train.empty or test.empty:
        raise ValueError("Could not create non-empty chronological training and holdout sets.")

    training_dates = pd.Index(train["valid_time"].dt.floor("D").drop_duplicates().sort_values())
    if len(training_dates) < 3:
        raise ValueError("Not enough training dates to make a separate feature-selection validation split.")
    validation_index = max(1, int(np.floor(len(training_dates) * 0.8)))
    if validation_index >= len(training_dates):
        validation_index = len(training_dates) - 1
    validation_cutoff = training_dates[validation_index]
    inner_train = train[train["valid_time"].dt.floor("D") < validation_cutoff]
    validation = train[train["valid_time"].dt.floor("D") >= validation_cutoff]
    if inner_train.empty or validation.empty:
        raise ValueError("Could not create a separate chronological feature-selection split.")

    observed = test["gauge_rainfall_mm"].to_numpy()
    imd_baseline = test["imd_rainfall_mm"].to_numpy()

    def scores(actual: np.ndarray, predicted: np.ndarray) -> dict:
        mae = float(mean_absolute_error(actual, predicted))
        return {
            "mae_mm": round(mae, 3),
            "rmse_mm": round(float(np.sqrt(mean_squared_error(actual, predicted))), 3),
            "bias_mm": round(float(np.mean(predicted - actual)), 3),
            "r2": round(float(r2_score(actual, predicted)), 3) if len(actual) > 1 else None,
        }

    def stratified_scores(frame: pd.DataFrame, predicted: np.ndarray) -> dict:
        """Expose skill by observed rain regime; never hide dry-day dominance."""
        actual = frame["gauge_rainfall_mm"].to_numpy()
        results = {}
        for label, lower, upper in [
            ("dry_0_to_1mm", 0.0, 1.0),
            ("light_1_to_10mm", 1.0, 10.0),
            ("moderate_10_to_25mm", 10.0, 25.0),
            ("heavy_25mm_plus", 25.0, float("inf")),
        ]:
            mask = (actual >= lower) & (actual < upper)
            if mask.any():
                results[label] = {
                    "samples": int(mask.sum()),
                    "mae_mm": round(float(mean_absolute_error(actual[mask], predicted[mask])), 3),
                    "bias_mm": round(float(np.mean(predicted[mask] - actual[mask])), 3),
                }
            else:
                results[label] = {"samples": 0, "mae_mm": None, "bias_mm": None}
        return results

    terrain_selection_model = build_model()
    terrain_selection_model.fit(inner_train[BASE_FEATURES], inner_train["gauge_rainfall_mm"])
    terrain_validation_predictions = np.maximum(0, terrain_selection_model.predict(validation[BASE_FEATURES]))
    full_selection_model = build_model()
    full_selection_model.fit(inner_train[FEATURES], inner_train["gauge_rainfall_mm"])
    full_validation_predictions = np.maximum(0, full_selection_model.predict(validation[FEATURES]))
    validation_observed = validation["gauge_rainfall_mm"].to_numpy()
    terrain_validation_scores = scores(validation_observed, terrain_validation_predictions)
    full_validation_scores = scores(validation_observed, full_validation_predictions)
    report_signals_helped = full_validation_scores["mae_mm"] < terrain_validation_scores["mae_mm"]
    selected_features = FEATURES if report_signals_helped else BASE_FEATURES

    terrain_model = build_model()
    terrain_model.fit(train[BASE_FEATURES], train["gauge_rainfall_mm"])
    terrain_predictions = np.maximum(0, terrain_model.predict(test[BASE_FEATURES]))
    full_model = build_model()
    full_model.fit(train[FEATURES], train["gauge_rainfall_mm"])
    full_predictions = np.maximum(0, full_model.predict(test[FEATURES]))
    terrain_scores = scores(observed, terrain_predictions)
    full_scores = scores(observed, full_predictions)

    # Spatial transfer check: hold out Panchayats entirely, using only earlier
    # dates and the predeclared base features. This avoids using held-out sites
    # to choose report features and measures transfer beyond represented sites.
    all_ids = sorted(data["panchayat_id"].astype(str).unique())
    heldout_ids = all_ids[::2]
    spatial_test = test[test["panchayat_id"].astype(str).isin(heldout_ids)]
    spatial_train = train[~train["panchayat_id"].astype(str).isin(heldout_ids)]
    spatial_scores = None
    if len(all_ids) >= 3 and not spatial_test.empty and not spatial_train.empty:
        spatial_model = build_model()
        spatial_model.fit(spatial_train[BASE_FEATURES], spatial_train["gauge_rainfall_mm"])
        spatial_pred = np.maximum(0, spatial_model.predict(spatial_test[BASE_FEATURES]))
        spatial_scores = {
            "heldout_panchayat_count": int(spatial_test["panchayat_id"].nunique()),
            "heldout_panchayats": sorted(spatial_test["panchayat_id"].astype(str).unique()),
            "features": BASE_FEATURES,
            "samples": len(spatial_test),
            "mae_mm": round(float(mean_absolute_error(spatial_test["gauge_rainfall_mm"], spatial_pred)), 3),
            "rmse_mm": round(float(np.sqrt(mean_squared_error(spatial_test["gauge_rainfall_mm"], spatial_pred))), 3),
            "bias_mm": round(float(np.mean(spatial_pred - spatial_test["gauge_rainfall_mm"].to_numpy())), 3),
        }

    report = {
        "status": "trained_and_chronologically_evaluated",
        "rows": len(data),
        "panchayats": int(data["panchayat_id"].nunique()),
        "distinct_dates": len(dates),
        "training_rows": len(train),
        "feature_selection_validation_rows": len(validation),
        "holdout_rows": len(test),
        "feature_selection_validation_start_utc": validation_cutoff.isoformat(),
        "holdout_start_utc": cutoff.isoformat(),
        "feature_selection_validation_terrain_only": terrain_validation_scores,
        "feature_selection_validation_with_farmer_signals": full_validation_scores,
        "terrain_model_holdout": terrain_scores,
        "terrain_plus_farmer_signals_holdout": full_scores,
        "selected_model_rain_regime_holdout": stratified_scores(test, terrain_predictions if selected_features == BASE_FEATURES else full_predictions),
        "spatial_transfer_holdout": spatial_scores,
        "mae_skill_vs_imd_baseline_pct": (
            round((1 - (terrain_scores["mae_mm"] if selected_features == BASE_FEATURES else full_scores["mae_mm"]) / scores(observed, imd_baseline)["mae_mm"]) * 100, 2)
            if scores(observed, imd_baseline)["mae_mm"] > 0 else None
        ),
        "farmer_signals_improved_feature_selection_validation_mae": report_signals_helped,
        "imd_baseline_holdout": scores(observed, imd_baseline),
        "selected_features": selected_features,
        "report_features_only_used_if_they_improve_chronological_validation_mae": True,
        "warning": "Research evaluation only. A single temporal split and spatial holdout do not establish operational skill; require multi-season independent validation and gauge quality review.",
    }

    # Save a production candidate fitted to every supplied paired row only
    # after the held-out evaluation has completed.
    final_model = build_model()
    final_model.fit(data[selected_features], data["gauge_rainfall_mm"])
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": final_model, "features": selected_features, "report": report}, model_path)
    model_path.with_suffix(".metrics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path, help="CSV containing real paired IMD forecast and gauge rows")
    parser.add_argument("--model-out", type=Path, default=Path("backend/artifacts/panchayat_rainfall.joblib"))
    args = parser.parse_args()
    report = train_and_evaluate(read_paired_observations(args.csv), args.model_out)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
