# Audio concepts

Twelve candidates for satisfying button feedback and separate voices for Cerberus's Pom, larger dog, and tabby cat heads.

Open [the offline listening gallery](index.html) to compare individual clips, adjust review volume, and play [the complete reel](listening-reel.wav). Nothing autoplays. The gallery uses only local files and also works directly from `file://`.

## Samples

Six button options explore clicks, plucks, a drop, and a longer confirmation accent. Each head has two alternatives. The small-dog recordings stand in for the Pom; these are stock recordings rather than recordings of the user's pets. Voice candidates are selected for brevity and distinct sources; choose their character by listening in the gallery.

| Clip                                            | Group   | Length | Source creator                                                             |
| ----------------------------------------------- | ------- | ------ | -------------------------------------------------------------------------- |
| [Click](buttons/button-01-click.wav)            | Buttons | 0.093s | [Kenney](https://kenney.nl/assets/interface-sounds)                        |
| [Tick](buttons/button-02-tick.wav)              | Buttons | 0.050s | [Kenney](https://kenney.nl/assets/interface-sounds)                        |
| [Pluck A](buttons/button-03-pluck.wav)          | Buttons | 0.128s | [Kenney](https://kenney.nl/assets/interface-sounds)                        |
| [Pluck B](buttons/button-04-pluck.wav)          | Buttons | 0.176s | [Kenney](https://kenney.nl/assets/interface-sounds)                        |
| [Drop](buttons/button-05-drop.wav)              | Buttons | 0.160s | [Kenney](https://kenney.nl/assets/interface-sounds)                        |
| [Confirmation](buttons/button-06-confirm.wav)   | Buttons | 0.318s | [Kenney](https://kenney.nl/assets/interface-sounds)                        |
| [Puppy bark](heads/pom-01-puppy-bark.wav)       | Pom     | 1.461s | [AntumDeluge](https://freesound.org/people/AntumDeluge/sounds/583142/)     |
| [Short bark](heads/pom-02-short-bark.wav)       | Pom     | 0.317s | [Glitchedtones](https://freesound.org/people/Glitchedtones/sounds/372524/) |
| [Single bark](heads/dog-01-single-bark.wav)     | Dog     | 0.254s | [kwahmah_02](https://freesound.org/people/kwahmah_02/sounds/277058/)       |
| [Bark alternative](heads/dog-02-short-bark.wav) | Dog     | 0.374s | [Sadiquecat](https://freesound.org/people/Sadiquecat/sounds/850824/)       |
| [Meow A](heads/cat-01-meow.wav)                 | Cat     | 1.572s | [tuberatanka](https://freesound.org/people/tuberatanka/sounds/110011/)     |
| [Meow B](heads/cat-02-short-meow.wav)           | Cat     | 1.457s | [skymary](https://freesound.org/people/skymary/sounds/412017/)             |

## Sources and processing

All twelve source assets are published under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). Credits and direct source links are retained in [manifest.json](manifest.json); Kenney's supplied license is in [sources/KENNEY-LICENSE.txt](sources/KENNEY-LICENSE.txt). Source files in `sources/` are untouched copies. Animal sources are publicly available HQ MP3 previews, not original lossless downloads; the WAV conversions do not restore lost fidelity.

Review WAVs are mono, 44.1 kHz, 16-bit PCM. Animal clips have a 90 Hz high-pass and 8 kHz low-pass filter. Excess silence is trimmed, tiny fades protect boundaries, and all clips are peak-balanced to -12 dBFS with a short onset/tail pad. Exact processing, source URLs, durations, RMS/peak levels, and SHA-256 checksums are recorded in the manifest. [reel-cues.json](reel-cues.json) maps the reel's timestamps to individual clips.

## Direction for review

Try Click or Pluck A for a frequent tap, and Confirmation for an occasional deliberate submit. Compare both alternatives for each head. Every numeric button would share the same feedback sound, independently of the chosen value. These are concept files; app audio behavior is a separate implementation step after selection.
