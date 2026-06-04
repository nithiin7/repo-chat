import React from "react";

const MOTION_PROPS = new Set([
  "initial",
  "animate",
  "exit",
  "transition",
  "variants",
  "whileHover",
  "whileTap",
  "whileFocus",
  "whileInView",
  "layout",
  "layoutId",
  "custom",
]);

function stripMotionProps(props: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    if (!MOTION_PROPS.has(k)) out[k] = v;
  }
  return out;
}

function makeMock(tag: string) {
  return React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<unknown>) =>
    React.createElement(tag, { ...stripMotionProps(props), ref }, children)
  );
}

export const motion = new Proxy({} as Record<string, ReturnType<typeof makeMock>>, {
  get: (_, tag: string) => makeMock(tag),
});

export const AnimatePresence = ({ children }: { children: React.ReactNode }) => <>{children}</>;
