import { switchTheme } from "./themeSwitch.js";
import { menuAnimation } from "./menuAnimation.js";

const menuButton = document.getElementById("menu-button");
const toggleLinks = document.querySelectorAll(".theme-toggle-link");
const backToTopButton = document.getElementById("back-to-top");

const dayIcon =
  '<ion-icon name="sunny-outline" class="theme-toggle-icon"></ion-icon>';
const nightIcon =
  '<ion-icon name="moon-outline" class="theme-toggle-icon"></ion-icon>';

toggleLinks.forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    switchTheme(link, dayIcon, nightIcon);
  });
});

menuButton?.addEventListener("click", () => {
  menuAnimation(menuButton);
});

backToTopButton?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function updateUnsplashStats() {
  try {
    const response = await fetch("/.netlify/functions/getUnsplashData");
    if (!response.ok) throw new Error(`Status: ${response.status}`);
    const { views, downloads } = await response.json();
    const unsplashStats = document.getElementById("unsplash-stats");
    if (!unsplashStats) return;

    unsplashStats.innerHTML = `
      <span class="site-footer-stat-line">${views.total.toLocaleString()} views</span>
      <span class="site-footer-stat-line">${downloads.total.toLocaleString()} downloads</span>
      <a class="site-footer-stat-link" href="https://unsplash.com/@paulmatheson" target="_blank" rel="noopener">Unsplash ⧉</a>`;
  } catch (error) {
    console.error("Error updating Unsplash stats:", error.message);
    const unsplashStats = document.getElementById("unsplash-stats");
    if (unsplashStats) {
      unsplashStats.innerHTML =
        '<a class="site-footer-stat-link" href="https://unsplash.com/@paulmatheson" target="_blank" rel="noopener">Unsplash ⧉</a>';
    }
  }
}

window.requestIdleCallback?.(() => updateUnsplashStats()) ??
  setTimeout(updateUnsplashStats, 0);
