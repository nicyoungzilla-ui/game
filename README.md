# 3D First-Person Movement Demo

A dependency-free browser demo that implements a simple first-person controller on an HTML canvas.

## Controls

- **WASD**: Move around the arena
- **Mouse**: Look around after pointer lock starts
- **Space**: Jump while grounded
- **Shift**: Sprint
- **Esc**: Release pointer lock

## Run locally

Serve the repository root with any static file server, then open the printed localhost URL.

```bash
python3 -m http.server 8000
```

The game runs from `index.html` and does not require a build step.
