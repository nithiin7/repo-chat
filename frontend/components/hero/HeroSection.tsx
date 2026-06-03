"use client";

import { motion } from "framer-motion";
import { CodeXml, Zap } from "lucide-react";
import RepoInput from "@/components/repo/RepoInput";

const ease = "easeOut" as const;

const HeroSection = () => (
  <>
    {/* Badge */}
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="border-border bg-muted text-muted-foreground relative mx-auto mb-8 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium tracking-wide"
    >
      <Zap className="size-3 text-indigo-500" />
      RAG-powered · Local or Cloud LLM
    </motion.div>

    {/* Logo */}
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, delay: 0.08, ease }}
      className="relative mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-indigo-500/20 bg-indigo-500/10 shadow-lg shadow-indigo-500/5"
    >
      <CodeXml className="size-7 text-indigo-500" />
    </motion.div>

    {/* Title */}
    <motion.h1
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.16, ease }}
      className="from-foreground to-foreground/40 relative bg-linear-to-b bg-clip-text text-5xl font-bold tracking-tight text-transparent sm:text-6xl dark:from-white dark:via-white/90 dark:to-white/40"
    >
      CodeLens
    </motion.h1>

    {/* Subtitle */}
    <motion.p
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.24, ease }}
      className="text-muted-foreground relative mt-3 text-base"
    >
      Ask anything about any codebase
    </motion.p>

    {/* Input */}
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.32, ease }}
      className="relative mx-auto mt-10 max-w-2xl"
    >
      <RepoInput />
    </motion.div>
  </>
);

export default HeroSection;
