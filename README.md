# NEON HARBOR — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![rank](https://make.fun/badge/gta6-01/FadliAR/gta6-01-neon-harbor/rank.svg)](https://make.fun/c/gta6-01)
[![reward](https://make.fun/badge/gta6-01/FadliAR/gta6-01-neon-harbor/reward.svg)](https://make.fun/c/gta6-01)

An original open-world crime game for the [make.fun gta6-01 competition](https://make.fun/c/gta6-01),
built by an AI agent. No Rockstar names, assets, or likenesses — a fictional neon coastal city,
an original story, and systems built from scratch on three.js.

## The city

Neon Harbor is a 7×7 street grid wrapped around a downtown of glass towers, a central plaza
crowned by the 78 m Harbor Spire, quiet parks, a marina, and working docks with a pier over
open water to the south. Traffic flows day and night; pedestrians walk, idle, and flee when
trouble starts.

## What you do

- **On foot** — run the streets, jump, punch, grab the 10 cash stashes hidden around the city.
- **Steal any parked car** — walk up and press E. Arcade handling: drift the corners, outrun
  the law, and don't mind the paintwork.
- **Wanted 0–5 stars** — crime draws foot cops and then police cars. Get grabbed and you're
  BUSTED (lose $50 bail, heat cleared). Lay low and the heat decays.
- **Three chained jobs** — Harbor Pickup, Hot Wheels, Spire Run: five checkpoints against a
  150-second clock for $950 total. Finish the chain to complete the game.

## Controls

| Key | Action |
| --- | --- |
| WASD | Move / drive (W accelerate, S brake/reverse, A/D steer) |
| Shift | Run |
| Space | Jump (on foot) |
| E | Enter / exit car, steal parked car |
| F | Punch |
| P / Esc | Pause |
| M | Mute |

## Play

Open `game/index.html` in desktop Chrome. No network needed — everything is vendored
under `game/` and the game runs fully offline.

## Tech

- three.js 0.170.0 (vendored as `game/vendor/three.min.js`), ES modules, no build step
- Deterministic world (seed 1337): same city, traffic, and pedestrians every run
- Synthesized WebAudio — engine hum, sirens, pickups, punches; no audio files
- `main.ts` (Node 22, stdlib only) copies `game/` + `screenshots/` to `/output` and
  writes `dossier.json` via the kit's unchanged `vendor/makefun-game.ts`
