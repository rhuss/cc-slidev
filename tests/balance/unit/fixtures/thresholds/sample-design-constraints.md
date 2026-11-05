# Sample design constraints

Some prose before the block. A plain JSON block must be ignored:

```json
{ "fill_ratio": { "min": 0.99, "max": 0.99 } }
```

## Visual Balance

```json balance-thresholds
{
  "fill_ratio": { "min": 0.35, "max": 0.75 },
  "vertical_spread_min": 0.55,
  "body_text_min_pt": 18,
  "diagram_label_min_pt": 14,
  "column_ratio_min": 0.75,
  "zoom": { "min": 1.0, "max": 1.5, "step": 0.1 },
  "max_rounds": 3,
  "density_exempt_layouts": ["cover", "image", "section", "statement", "fact", "quote", "end"],
  "rhythm": { "same_layout_run": 4, "fill_swing": 0.40 },
  "hard_limits": { "max_elements": 6, "max_words": 50 }
}
```

Prose after the block.
