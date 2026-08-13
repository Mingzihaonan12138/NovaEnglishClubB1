import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface MascotProps {
  speechBubble?: string;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Mascot({
  speechBubble,
  className = '',
  size = 'md',
  showText = true,
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

      {/* Mascot PNG Image */}
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
        <img
          src="/assets/mascot/mascot-transparent-clean.png?v=2"
          alt="Nova English Club Mascot"
          className="w-full h-auto object-contain rounded-2xl drop-shadow-sm pointer-events-none"
          referrerPolicy="no-referrer"
          onError={(e) => {
            // Fallback to nova-mascot.png if mascot-transparent-clean.png fails
            const target = e.currentTarget;
            if (target.src.includes('mascot-transparent-clean.png')) {
              target.src = '/assets/mascot/nova-mascot.png?v=2';
            }
          }}
        />
      </motion.div>
    </div>
  );
}


