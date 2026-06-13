import { useEffect, useRef } from "react";
import { loadThree } from "../../services/loadThree.js";

/* ============================================================
 * HamsterRoom — 3D hamster habitat (a genuinely working component)
 * ------------------------------------------------------------
 * This is the highest-value hand-migrated piece, and it bakes in the two
 * fixes called out in the reference notes:
 *
 *   1) env.an MUST be passed.  The engine keeps a persistent
 *      animation/camera-state object and mutates it every frame
 *      (rotation, zoom, pan, the pointer map, behaviour state, the
 *      one-time spawn roll...). It dereferences that object WITHOUT null
 *      checks (e.g. a.PTS[id], a.blinkT, a.pw). If you don't pass env.an,
 *      the room throws at runtime the moment the first frame runs or the
 *      user touches the canvas. We keep it in a ref so it survives React
 *      re-renders instead of being recreated (which would also reset the
 *      camera and re-roll the hamster's spawn).
 *
 *   2) Build the WebGL scene ONCE.  The original rebuilt the entire scene
 *      whenever hamster state changed — leaking GPU buffers and snapping
 *      the camera back. Here the engine is created a single time on mount
 *      and torn down via dispose() on unmount.
 *
 * Engine contract (see ./oriexHamu3D.js):
 *   const controller = window.OriexHamu3D(canvas, env);  // -> { dispose }
 * It reads env.mood / env.sc / env.isLight / env.stR ONCE at creation,
 * calls env.getEdit() live every frame, and owns env.an thereafter.
 * Because mood/scale/light are creation-time inputs, changing them needs
 * a controlled re-create (the effect below is keyed on them) — NOT a
 * re-create on every unrelated render. Camera state in `animRef` carries
 * across a re-create, so the view doesn't jump.
 *
 * three.js is loaded ON DEMAND via loadThree() (services/loadThree.js): the
 * effect below awaits it before touching window.THREE, so this works whether
 * or not three was preloaded, and never blocks initial render.
 *
 * STATUS: not yet wired into the running app — the legacy bundle still
 * renders the live hamster room. To adopt it, render <HamsterRoom/> from
 * App.jsx and delete the corresponding screen from the bundle. See
 * MIGRATION.md.
 * ============================================================ */

// Canonical "freshly opened room" camera state. Matches the values the
// engine treats as defaults (it nudges this to a nicer angle on first open).
const freshCameraState = () => ({ rot: 0.55, pit: 0.46, zoom: 1, panX: 0, panY: 0, PTS: {} });

export default function HamsterRoom({
  mood = 60,            // 0–100, affects the hamster's liveliness (read once)
  scale = 0.9,          // habitat scale (read once)
  light = true,         // light vs dark room (read once)
  studyRef = null,      // optional object the engine reads as env.stR
  getEditId = () => null, // id of the furniture being edited, read live
  className = "",
}) {
  const canvasRef = useRef(null);
  // Persistent across renders — THIS is the crash fix (env.an).
  const animRef = useRef(freshCameraState());
  // Keep the latest getEdit callback reachable without re-creating the scene.
  const getEditRef = useRef(getEditId);
  getEditRef.current = getEditId;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof window === "undefined") return;

    let controller = null;
    let disposed = false;

    // Load three.js on demand, THEN start the engine. Failures fail soft.
    loadThree()
      .then(() => {
        if (disposed) return;
        if (typeof window.OriexHamu3D !== "function" || !window.THREE) {
          // Engine or three.js not present (e.g. SSR / test env). Fail soft.
          return;
        }
        const env = {
          an: animRef.current, // persistent — never recreated here
          mood,
          sc: scale,
          isLight: light,
          stR: studyRef,
          getEdit: () => getEditRef.current(),
        };
        try {
          controller = window.OriexHamu3D(canvas, env);
        } catch (err) {
          // Don't take the whole app down if the GL context can't be created.
          console.error("HamsterRoom: failed to start 3D engine", err);
        }
      })
      .catch((err) => {
        console.warn("HamsterRoom: three.js load failed", err);
      });

    return () => {
      disposed = true;
      try {
        controller && controller.dispose && controller.dispose();
      } catch (err) {
        console.error("HamsterRoom: dispose failed", err);
      }
    };
    // Re-create only when creation-time inputs change.
  }, [mood, scale, light, studyRef]);

  return (
    <div
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: "3 / 4", borderRadius: 18, overflow: "hidden" }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }} />
    </div>
  );
}
