"""Compare browser-rendered phone surfaces to their exported PNGs, at 2x density."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

output = Path(__file__).resolve().parent / 'output'
results = []
for width in (375, 390, 430):
    native = Image.open(output / f'parity-native-{width}.png').convert('RGB')
    exported = Image.open(output / f'parity-export-{width}.png').convert('RGB')
    assert native.size == exported.size, f'{width}: export dimensions changed'
    assert exported.width == width * 2, f'{width}: export reflowed'
    difference = ImageChops.difference(native, exported)
    mean_error = sum(ImageStat.Stat(difference).mean) / 3
    # Tolerate browser/Canvas glyph antialiasing; reject displaced text and shapes.
    channels = difference.split()
    largest = ImageChops.lighter(ImageChops.lighter(channels[0], channels[1]), channels[2])
    histogram = largest.histogram()
    changed_fraction = sum(histogram[26:]) / (native.width * native.height)
    assert mean_error < 1.5, f'{width}: mean pixel error {mean_error:.3f}'
    assert changed_fraction < .025, f'{width}: changed pixels {changed_fraction:.2%}'
    results.append({'width': width, 'pixels': list(native.size), 'mean_channel_error': round(mean_error, 4), 'pixels_different_over_25_fraction': round(changed_fraction, 6)})
    print(f'{width}: geometry and pixel comparison passed; mean error {mean_error:.3f}/255')
(output / 'parity-pixels.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
