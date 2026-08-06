
import { motion, useAnimation } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export default function RevealRow({ children, delay = 0, once = false }) {
  const controls = useAnimation();
  const ref = useRef(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          controls.start({
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: {
              duration: 0.7,
              ease: [0.25, 0.46, 0.45, 0.94],
              delay,
            },
          });
          setHasAnimated(true);
        } else {
          // Only fade out if scrolling away (already animated once)
          if (hasAnimated && !once) {
            controls.start({
              opacity: 0,
              y: entry.boundingClientRect.top > 0 ? 50 : -30,
              filter: "blur(6px)",
              transition: { duration: 0.4, ease: "easeIn" },
            });
          }
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -60px 0px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [controls, delay, hasAnimated, once]);

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0, y: 50, filter: "blur(6px)" }}
      animate={controls}
      style={{ marginBottom: 32 }}
    >
      {children}
    </motion.section>
  );
}
