# Panchayat rainfall model data

The browser prototype currently uses illustrative Panchayat terrain values and
sample block forecasts. They are not training inputs and must not be reported
as observed/IMD data.

## Required paired observations

Start with `paired_rainfall_template.csv`. Each row must contain:

- the IMD forecast issue time, valid time, and source for one rainfall value
  (`forecast_issue_time`, `valid_time`, `imd_source`, `imd_rainfall_mm`);
- the actual rainfall measured by a local gauge for that same valid time and
  Panchayat (`gauge_id`, `gauge_source`, `gauge_rainfall_mm`);
- a consistent rainfall accumulation window in hours (`rain_window_hours`);
- a stable Panchayat identifier and sourced terrain values (`terrain_source`).
- time-stamped farmer observations available before the forecast was issued,
  summarized into the `*_12h` signal columns. Exclude demo reports and reports
  after `forecast_issue_time`; keep the report source and snapshot time.

Use consistent rainfall accumulation windows, units, timestamps, and gauge
quality checks. Keep a source and provenance record for each input dataset.
Do not fill missing observations with invented or interpolated training targets.

## Candidate training and chronological holdout

Install backend packages, then run:

```sh
python -m pip install -r backend/requirements.txt
python backend/train_panchayat_rainfall.py path/to/real_paired_rainfall.csv
```

The script compares terrain-only and terrain-plus-farmer-signal Random Forest
candidates on the latest 20% of distinct valid dates, compares them with the
raw IMD rainfall baseline, and selects farmer-signal features only when they
reduce a separate chronological validation MAE. The report includes overall
MAE/RMSE/bias/R², selected-model error by observed rain-intensity band, MAE
skill versus the raw IMD baseline, and a separate time-plus-location holdout
for Panchayats excluded from fitting (when enough Panchayats are present).
This spatial holdout uses the predeclared base features and must be interpreted
separately from the temporal holdout. It saves the model plus metrics under
`backend/artifacts/`. It rejects missing,
duplicate, invalid, or too-short data instead of manufacturing a score.

This is a research pipeline, not a claim that the model is ready for farmer
use. One temporal split and one spatial split are not enough to establish
reliability. Require multiple seasons, independent gauge quality review,
coverage in every intended Panchayat, and a baseline skill improvement that
holds across rain regimes before considering operational use. The browser
prototype currently uses a hand-coded terrain heuristic, not this trained
Random Forest artifact. The app still needs authorized forecast inputs and
verified local gauge observations before it can train or serve live Panchayat
predictions.
