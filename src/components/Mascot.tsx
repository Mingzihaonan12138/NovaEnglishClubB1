import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

interface MascotProps {
  speechBubble?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showText?: boolean;
}

const GOLD = '#e5bb40';

/**
 * The star is drawn inline rather than loaded from public/assets.
 *
 * The PNG that used to live there was committed corrupted — its first byte had
 * been replaced by a UTF-8 replacement character, i.e. the binary had been
 * written out through a text encoder at some point, which destroyed 16k bytes
 * of it. Vector markup inside a .tsx file cannot be damaged that way, and it
 * also gives each eye its own element for the blink/glance animations.
 */
/**
 * How far a pupil may travel, per direction.
 *
 * The artwork does not centre the pupils: both sit left of and below the middle
 * of their whites (the right pupil by 3.1 and 3.3 user units), which is what
 * gives the star its resting sideways glance. So the headroom is lopsided —
 * about 8.6 to the right against 2.4 to the left, and 10 up against 3.4 down.
 *
 * A symmetric range therefore spent only a third of the rightward room while
 * overshooting to the left, which read as "it barely looks right". These values
 * follow the drawing's own asymmetry, kept a little inside the true limits so
 * the pupil never touches the edge of the white.
 */
const GAZE = { right: 6.0, left: 2.0, up: 5.5, down: 2.8 };

/** Distance at which the star is already looking as far as it can. */
const GAZE_REACH = 210;

export function StarMascot({
  className = '',
  followPointer = false,
  fill = GOLD,
}: { className?: string; followPointer?: boolean; fill?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion();

  // Pointer position drives motion values rather than state: this updates on
  // every mouse move, and re-rendering the tree that often would stutter.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const px = useSpring(x, { stiffness: 420, damping: 26, mass: 0.28 });
  const py = useSpring(y, { stiffness: 420, damping: 26, mass: 0.28 });

  useEffect(() => {
    if (!followPointer || reduce) return;
    const onMove = (e: PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(dist / GAZE_REACH, 1);
      const ux = dx / dist;
      const uy = dy / dist;
      x.set(ux * (ux > 0 ? GAZE.right : GAZE.left) * reach);
      y.set(uy * (uy > 0 ? GAZE.down : GAZE.up) * reach);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [followPointer, reduce, x, y]);

  const gaze = followPointer && !reduce ? { x: px, y: py } : undefined;

  return (
    <svg ref={ref} viewBox="0 0 259.66 249.7" className={className} role="img" aria-label="Nova English Club mascot">
      <path
        fill={fill}
        d="M70.47,89.15c-11.68,4.93-17.61,19.8-3.49,31.37,5.55,4.54,13.13,6.98,16.79,13.15,5.39,9.11-1.82,20.83.26,31.21,1.1,5.48,4.92,10.29,9.9,12.82s11.01,2.8,16.29.95c9.69-3.39,16.96-13.41,27.23-13.59,8.6-.15,15.78,6.82,24.28,8.09,5.38.81,11.08-.85,15.19-4.42s6.54-8.99,6.48-14.43c-.09-8.54-5.92-16.65-4.32-25.04,1.23-6.46,6.52-11.23,10.04-16.79,4.17-6.59,5.83-15.26,2.4-22.27-3.48-7.1-11.42-11.08-19.25-12.22-5.58-.81-11.63-.53-16.37-3.57-8.77-5.64-8.17-19-14.94-26.94-3.52-4.13-9.05-6.48-14.47-6.14s-10.61,3.35-13.6,7.89c-3.96,6.02-3.89,13.85-6.93,20.39-2.72,5.84-7.85,10.36-13.66,13.13-3.65,1.74-7.57,2.84-11.55,3.49-3.33.54-6.19,1.29-10.28,2.93"
      />
      <g data-part="eye-right">
        <ellipse fill="#fff" cx="141.3" cy="115.61" rx="8.66" ry="11.33" transform="translate(-2.98 3.74) rotate(-1.5)" />
        {/* The pupil sits in its own group so the gaze offset composes with the
            artwork's original transform instead of replacing it. */}
        <motion.g style={gaze}>
          <ellipse fill="#040000" cx="138.21" cy="118.91" rx="3.15" ry="4.58" transform="translate(-2.56 3.05) rotate(-1.25)" />
        </motion.g>
      </g>
      <g data-part="eye-left">
        <ellipse fill="#fff" cx="118.75" cy="116.2" rx="8.66" ry="11.33" transform="translate(-3 3.15) rotate(-1.5)" />
        <motion.g style={gaze}>
          <ellipse fill="#040000" cx="116.64" cy="119.38" rx="3.15" ry="4.58" transform="translate(-2.58 2.58) rotate(-1.25)" />
        </motion.g>
      </g>
    </svg>
  );
}

export default function Mascot({
  speechBubble,
  className = '',
  size = 'md',
}: MascotProps) {
  // Map size keys to explicit width tailwind classes
  const sizeClass =
    size === 'xs' ? 'w-20' :
    size === 'sm' ? 'w-28' :
    size === 'md' ? 'w-40' :
    size === 'lg' ? 'w-56' : 'w-40';

  return (
    <div className={`flex flex-col items-center justify-center relative select-none ${className}`}>
      {/* Dynamic Speech Bubble */}
      <AnimatePresence>
        {speechBubble && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute -top-14 bg-neutral-900 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-2xl shadow-xl max-w-[15rem] text-center z-20 leading-normal pointer-events-none border border-neutral-800"
          >
            {speechBubble}
            {/* Bubble Tail */}
            <div className="absolute left-1/2 -bottom-1 -translate-x-1/2 w-2.5 h-2.5 bg-neutral-900 rotate-45 border-r border-b border-neutral-800" />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{
          y: [0, -3, 0],
          rotate: [0, 0.5, -0.5, 0]
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.97 }}
        className={`relative ${sizeClass} cursor-pointer flex flex-col items-center justify-center`}
      >
        <StarMascot className="w-full h-auto drop-shadow-sm pointer-events-none" followPointer />
      </motion.div>
    </div>
  );
}
