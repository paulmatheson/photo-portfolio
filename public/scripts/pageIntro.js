const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const CONTROLS = {
  transform: "translateX(8px) scale(0.95, 1)",
  filter: "blur(4px)",
  duration: 320,
  stagger: 60,
};

const CONTENT = {
  transform: "translateY(8px)",
  filter: "blur(2px)",
  duration: 440,
};

function motionDisabled() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof HTMLElement.prototype.animate !== "function"
  );
}

function finishIntro(root, phase) {
  document.documentElement.removeAttribute("data-intro-boot");
  root.setAttribute("data-page-intro", phase);
}

// Same rise-and-blur used for page content, for pieces that arrive after
// the first paint (category chips, photos, the load-more button).
export function animateEntrance(elements, { startDelay = 0 } = {}) {
  const targets = Array.from(elements).filter(
    (el) => el instanceof HTMLElement && el.getClientRects().length > 0,
  );
  if (!targets.length || motionDisabled()) return [];

  const gap =
    targets.length > 1 ? Math.min(56, 400 / (targets.length - 1)) : 0;

  return targets.map((el, index) =>
    el.animate(
      [
        {
          opacity: 0,
          transform: CONTENT.transform,
          filter: CONTENT.filter,
        },
        { opacity: 1, transform: "none", filter: "blur(0px)" },
      ],
      {
        duration: CONTENT.duration,
        delay: startDelay + index * gap,
        easing: EASE,
        fill: "backwards",
      },
    ),
  );
}

export function playPageIntro() {
  const root = document.querySelector("[data-page-intro]");
  if (!root || root.getAttribute("data-page-intro") === "complete") return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const active = document.activeElement;
  const focusedInside =
    active && active !== document.body && root.contains(active);

  if (reduce.matches || focusedInside || motionDisabled()) {
    finishIntro(root, "skipped");
    return;
  }

  const candidates = Array.from(
    root.querySelectorAll(
      "[data-intro], [data-intro-group] > *, [data-intro-controls] > *",
    ),
  ).filter(
    (el) =>
      !el.hasAttribute("data-intro-group") &&
      !el.closest(".sidebar") &&
      el.getClientRects().length > 0,
  );

  const targets = candidates.filter(
    (el) => !candidates.some((other) => other !== el && other.contains(el)),
  );

  if (!targets.length) {
    finishIntro(root, "skipped");
    return;
  }

  const explicitDelay = (el) => {
    const value = Number(el.dataset.introDelay);
    return Number.isFinite(value) && value >= 0 ? value : null;
  };
  const inView = (el) => el.getBoundingClientRect().top < window.innerHeight;
  const visibleCount = targets.filter(
    (el) =>
      !el.parentElement?.hasAttribute("data-intro-controls") &&
      explicitDelay(el) === null &&
      inView(el),
  ).length;
  const gap = visibleCount > 1 ? Math.min(56, 400 / (visibleCount - 1)) : 0;

  let index = 0;
  const animations = targets.map((el) => {
    const controls = el.parentElement?.hasAttribute("data-intro-controls")
      ? targets.filter((item) => item.parentElement === el.parentElement)
      : null;
    const preset = controls ? CONTROLS : CONTENT;
    const override = explicitDelay(el);
    const delay = controls
      ? (controls.length - 1 - controls.indexOf(el)) * CONTROLS.stagger
      : override !== null
        ? Math.min(override, 900 - preset.duration)
        : (inView(el) ? index++ : Math.max(index - 1, 0)) * gap;

    const from = {
      opacity: 0,
      transform: preset.transform,
      filter: preset.filter,
    };
    const to = {
      opacity: 1,
      transform: "none",
      filter: "blur(0px)",
    };

    if (controls) {
      from.transformOrigin = "right center";
      to.transformOrigin = "right center";
    }

    return el.animate([from, to], {
      duration: preset.duration,
      delay,
      easing: EASE,
      fill: "backwards",
    });
  });

  finishIntro(root, "playing");

  let cancelled = false;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true;
    animations.forEach((animation) => animation.cancel());
    root.setAttribute("data-page-intro", "skipped");
  };

  Promise.all(animations.map((animation) => animation.finished)).then(
    () => {
      if (!cancelled) root.setAttribute("data-page-intro", "complete");
    },
    () => {},
  );

  root.addEventListener("focusin", cancel, { once: true });
  reduce.addEventListener(
    "change",
    () => {
      if (reduce.matches) cancel();
    },
    { once: true },
  );
}

document.addEventListener("DOMContentLoaded", playPageIntro);
