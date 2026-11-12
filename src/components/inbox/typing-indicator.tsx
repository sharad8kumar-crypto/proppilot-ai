"use client";

import { motion } from "framer-motion";

// Three bouncing dots in an AI-style bubble (reduced-motion users see static dots)
export function TypingIndicator() {
  return (
    <div className="flex flex-col items-end" role="status">
      <span className="sr-only">AI is typing</span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-br-md bg-primary px-4 py-3">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-primary-foreground/80"
            animate={{ y: [0, -4, 0] }}
            transition={{
              duration: 0.7,
              repeat: Infinity,
              delay: i * 0.12,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}