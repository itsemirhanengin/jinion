'use client';

import { motion } from 'motion/react';

const spring = {
  type: 'spring' as const,
  damping: 30,
  stiffness: 100,
};

export default function Home() {
  return (
    <motion.main
      initial={{ scale: 1.1, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full h-screen flex flex-col items-center justify-center text-[#000000] px-6 text-center"
    >
      <h1 className="font-normal text-[clamp(2rem,0.6rem+6vw,96px)] leading-normal">
        <span className="block overflow-hidden">
          <motion.span
            initial={{ y: '100%', opacity: 0, filter: 'blur(10px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            transition={{ ...spring, delay: 0.3 }}
            className="block font-source-serif"
          >
            A coding agent
          </motion.span>
        </span>
        <span className="block overflow-hidden">
          <motion.span
            initial={{ y: '100%', opacity: 0, filter: 'blur(10px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            transition={{ ...spring, delay: 0.55 }}
            className="block font-radio-canada-big"
          >
            for your terminal
          </motion.span>
        </span>
      </h1>
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 1 }}
        className="absolute bottom-[clamp(16px,3vh,48px)] left-1/2 -translate-x-1/2 inline-flex items-center gap-[0.35em] font-sans font-semibold text-[clamp(20px,2vw,32px)]"
      >
        <svg viewBox="0 0 32 32" className="size-[1.25em]" aria-hidden="true">
          <rect width="32" height="32" rx="7" fill="#000000" />
          <path d="M8 10.5 13.5 16 8 21.5" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16.5 22h7.5" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
        </svg>
        jinion
      </motion.div>
    </motion.main>
  );
}
