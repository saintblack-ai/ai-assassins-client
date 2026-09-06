# SPYMASTER v0.4 — First Light 3D

Mobile-first, first-person Three.js prototype by Saint Black / AI Assassins.

Published route: https://saintblack-ai.github.io/ai-assassins-client/game-v04/

Vite copies `public/game-v04/` into `dist/game-v04/`. The existing GitHub Pages workflow publishes `dist`. No dashboard configuration or deployment workflow changes are needed.

## Play

- Phone: left joystick moves; drag the scene to look.
- Desktop: WASD or arrows move; drag to look; Space pulses; E interacts; Escape pauses.
- Pulse auto-targets the nearest live hostile within 30 m.
- Collect three cyan shards, hack the uplink within 3 m, defeat the Warden, return to extraction and interact.
- Agent abilities have 15-second cooldowns. Upgrades cost 500 Legacy, capped at level 3.
- Pause or backgrounding suspends the operation. Restart discards the current operation's unbanked score.

## Progress and compatibility

Uses `sb009v4` local storage, importing numeric values from `sb009v3` on first visit. The old save is never overwritten. Saves belong to the current browser and origin; they do not sync between devices. If storage is blocked, gameplay continues for the current session.

Requires WebGL and network access for the pinned Three.js 0.169.0 module from jsDelivr. Loading and GPU errors show recovery text and a classic-game link. No model downloads, accounts, payments, or API keys are required.

This is a procedural 3D prototype, not a photorealistic film. Architecture is outside the bounded playable plaza; movement is planar, with no rigid-body physics. Pixel ratio is capped at 1.5, city windows are instanced, and there are no dynamic shadows or expensive post-processing passes. Real iPhone performance still needs device testing.
