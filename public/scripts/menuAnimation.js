const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

let itemAnimations = [];

function menuItems(menu) {
  return Array.from(
    menu.querySelectorAll(".sidebar-links > a, .sidebar-links > ul > li"),
  );
}

function setPageInert(inert) {
  document.querySelectorAll("nav > a, main, footer").forEach((el) => {
    if (inert) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  });
}

function animateMenuItems(menu) {
  itemAnimations.forEach((animation) => animation.cancel());
  itemAnimations = [];

  if (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    typeof HTMLElement.prototype.animate !== "function"
  ) {
    return;
  }

  const items = menuItems(menu);
  const gap = items.length > 1 ? Math.min(56, 400 / (items.length - 1)) : 0;

  itemAnimations = items.map((el, index) =>
    el.animate(
      [
        { opacity: 0, transform: "translateY(8px)", filter: "blur(2px)" },
        { opacity: 1, transform: "none", filter: "blur(0px)" },
      ],
      {
        duration: 440,
        delay: index * gap,
        easing: EASE,
        fill: "backwards",
      },
    ),
  );
}

export function menuAnimation(toggle) {
  const menu = document.getElementById("slideNav");
  if (!menu) return;

  const opening = !menu.classList.contains("is-open");

  toggle.classList.toggle("change", opening);
  toggle.setAttribute("aria-expanded", opening ? "true" : "false");
  toggle.setAttribute("aria-label", opening ? "Close menu" : "Menu");
  menu.classList.toggle("is-open", opening);
  document.body.classList.toggle("no-scroll", opening);
  setPageInert(opening);

  if (opening) animateMenuItems(menu);
  else itemAnimations.forEach((animation) => animation.cancel());
}

export function initMenu(toggle) {
  if (!toggle) return;

  toggle.addEventListener("click", () => menuAnimation(toggle));

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      toggle.getAttribute("aria-expanded") === "true"
    ) {
      menuAnimation(toggle);
    }
  });
}
