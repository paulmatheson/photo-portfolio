const GALLERY_BATCH_SIZE = 10;
// Matches the c_limit width used for thumbUrl in functions/getPhotos.js.
const GALLERY_THUMB_MAX_WIDTH = 600;

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const parseCaption = (title) => {
  const caption = String(title || "photo").trim();
  const match = caption.match(/^(.+),\s*(\d{4})$/);

  if (!match) {
    const locationSlug = caption
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return {
      caption,
      locationKey: locationSlug || "photo",
      locationLabel: caption,
      year: null,
    };
  }

  const place = match[1].trim();
  const year = match[2];
  const parts = place.split(",").map((part) => part.trim());
  const locationLabel =
    parts.length >= 2
      ? `${parts[0]} (${parts.slice(1).join(", ")})`
      : place;
  const locationKey = place
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return {
    caption,
    locationKey: locationKey || "photo",
    locationLabel,
    year,
  };
};

const getThumbSize = (photo) => {
  const width = Number(photo.width);
  const height = Number(photo.height);

  if (!width || !height || width < 0 || height < 0) return null;

  const scale = Math.min(1, GALLERY_THUMB_MAX_WIDTH / width);

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
};

const parseCategory = (category) => {
  const label = String(category || "").trim();
  if (!label) return null;

  const key = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (!key) return null;

  return { key, label };
};

const buildCategoryIndex = (photos) => {
  const categories = new Map();

  photos.forEach((photo) => {
    const parsed = parseCategory(photo.category);
    if (parsed && !categories.has(parsed.key)) {
      categories.set(parsed.key, parsed.label);
    }
  });

  return [...categories.entries()]
    .sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB))
    .map(([key, label]) => ({ key, label }));
};

const renderCategoryIndex = (categories) => {
  if (!categories.length) return "";

  return `
    <ul class="photo-index-list">
      ${categories
        .map(
          ({ key, label }) => `
            <li>
              <button
                class="photo-index-button"
                type="button"
                data-category="${escapeAttr(key)}"
              >${escapeHtml(label)}</button>
            </li>
          `,
        )
        .join("")}
    </ul>
  `;
};


async function init() {
  try {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const response = await fetch("/.netlify/functions/getPhotos");
    const photos = await response.json();

    if (!response.ok) {
      throw new Error(
        photos.error || `Photo request failed with ${response.status}`,
      );
    }

    if (!Array.isArray(photos)) {
      throw new Error("Photo response was not an array");
    }

    const grid = document.querySelector(".grid");
    const loadMoreButton = document.getElementById("load-more-photos");
    const photoIndex = document.getElementById("photo-index");

    if (!grid) {
      throw new Error("Photo grid element was not found");
    }

    if (!window.imagesLoaded || !window.Isotope || !window.lightGallery) {
      throw new Error("Gallery layout libraries did not load");
    }

    const enrichedPhotos = photos.map((photo) => {
      const parsed = parseCaption(photo.title);
      const category = parseCategory(photo.category);

      return {
        ...photo,
        meta: {
          ...parsed,
          year: parsed.year || "Unknown",
          categoryKey: category?.key || "",
          categoryLabel: category?.label || "",
          thumbSize: getThumbSize(photo),
        },
      };
    });

    if (photoIndex) {
      const categories = buildCategoryIndex(enrichedPhotos);
      const showIndex = categories.length > 0;

      photoIndex.innerHTML = showIndex ? renderCategoryIndex(categories) : "";
      photoIndex.hidden = !showIndex;
    }

    let visiblePhotoCount = Math.min(GALLERY_BATCH_SIZE, enrichedPhotos.length);
    let galleryLayout;
    let galleryLightbox;
    let activeFilter = "*";

    const getPhotosForCategory = (categoryKey) => {
      if (!categoryKey) {
        return enrichedPhotos.slice(0, visiblePhotoCount);
      }

      return enrichedPhotos.filter(
        (photo) => photo.meta.categoryKey === categoryKey,
      );
    };

    const getPhotoMarkup = (photo, { eager = false } = {}) => {
      const { caption, categoryKey, thumbSize } = photo.meta;
      const categoryAttr = categoryKey
        ? ` data-category="${escapeAttr(categoryKey)}"`
        : "";
      const loadingAttr = eager ? "" : ' loading="lazy"';
      // Intrinsic dimensions let the browser reserve the final height before
      // the image downloads, so masonry positions items once and never shifts.
      const sizeAttrs = thumbSize
        ? ` width="${thumbSize.width}" height="${thumbSize.height}"`
        : "";

      return `
        <a
          class="grid-item"
          data-src="${photo.fullUrl}"
          data-sub-html="${escapeAttr(caption)}"${categoryAttr}
        >
          <img src="${photo.thumbUrl}"${sizeAttrs}${loadingAttr} decoding="async" alt="${escapeAttr(photo.alt || caption)}" />
          <span class="grid-item-caption">${escapeHtml(caption)}</span>
        </a>
      `;
    };

    const getMasonryGutter = () =>
      window.matchMedia("(min-width: 900px)").matches ? 24 : 16;

    const createGalleryLayout = () =>
      new Isotope(grid, {
        itemSelector: ".grid-item",
        layoutMode: "masonry",
        masonry: { gutter: getMasonryGutter() },
        transitionDuration: 0,
      });

    // Catches cached images that finished before the load listener attached.
    const markImagesLoaded = () => {
      grid.querySelectorAll(".grid-item img").forEach((img) => {
        if (img.complete) img.classList.add("is-loaded");
      });
    };

    // Each image fades itself in on arrival; a failed image is still marked so
    // its alt text is not left invisible.
    grid.addEventListener(
      "load",
      (event) => {
        if (event.target.matches(".grid-item img")) {
          event.target.classList.add("is-loaded");
        }
      },
      true,
    );

    grid.addEventListener(
      "error",
      (event) => {
        if (event.target.matches(".grid-item img")) {
          event.target.classList.add("is-loaded");
        }
      },
      true,
    );

    // Photos Cloudinary reported without dimensions can only be measured once
    // they load, so correct the layout in a single pass when that happens.
    const relayoutOnLoad = (target, onDone) =>
      imagesLoaded(target, () => {
        galleryLayout?.layout();
        markImagesLoaded();
        onDone?.();
      });

    const rebuildGallery = (photos) =>
      new Promise((resolve) => {
        galleryLayout?.destroy();
        grid.style.height = "";
        grid.innerHTML = photos
          .map((photo) => getPhotoMarkup(photo, { eager: true }))
          .join("");

        galleryLayout = createGalleryLayout();
        galleryLightbox?.refresh();
        revealItems(grid.querySelectorAll(".grid-item"));
        relayoutOnLoad(grid, resolve);
      });

    const updateLoadMoreButton = () => {
      if (!loadMoreButton) return;

      const hasMorePhotos = visiblePhotoCount < enrichedPhotos.length;
      loadMoreButton.hidden = !hasMorePhotos || activeFilter !== "*";
      loadMoreButton.disabled = false;
    };

    const revealItems = (items) => {
      if (!items.length) return;

      if (reducedMotion || !window.gsap) return;

      gsap.fromTo(
        items,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.35,
          stagger: 0.03,
          ease: "power1.out",
          clearProps: "opacity",
        },
      );
    };

    const setActiveIndexButton = (button) => {
      photoIndex
        ?.querySelectorAll(".photo-index-button.is-active")
        .forEach((item) => item.classList.remove("is-active"));

      button?.classList.add("is-active");
    };

    const applyFilter = async (categoryKey, button) => {
      activeFilter = categoryKey || "*";
      await rebuildGallery(getPhotosForCategory(categoryKey));
      setActiveIndexButton(button);
      updateLoadMoreButton();
    };

    const appendNextPhotos = () => {
      if (!galleryLayout || activeFilter !== "*") return;

      const nextPhotos = enrichedPhotos.slice(
        visiblePhotoCount,
        visiblePhotoCount + GALLERY_BATCH_SIZE,
      );
      if (!nextPhotos.length) return;

      if (loadMoreButton) {
        loadMoreButton.disabled = true;
      }

      grid.insertAdjacentHTML(
        "beforeend",
        nextPhotos.map((photo) => getPhotoMarkup(photo, { eager: true })).join(""),
      );
      visiblePhotoCount += nextPhotos.length;

      const newItems = Array.from(grid.querySelectorAll(".grid-item")).slice(
        -nextPhotos.length,
      );

      // `appended` places only the new items, leaving the existing ones put.
      galleryLayout.appended(newItems);
      galleryLightbox?.refresh();
      revealItems(newItems);
      updateLoadMoreButton();
      relayoutOnLoad(newItems);
    };

    grid.innerHTML = enrichedPhotos
      .slice(0, visiblePhotoCount)
      .map((photo) => getPhotoMarkup(photo))
      .join("");

    galleryLayout = createGalleryLayout();

    galleryLightbox = lightGallery(grid, {
      controls: true,
      counter: false,
      download: false,
      thumbnail: true,
      plugins: [lgThumbnail],
    });

    photoIndex?.addEventListener("click", async (event) => {
      const button = event.target.closest(".photo-index-button");
      if (!button) return;

      const { category } = button.dataset;
      const isActive = button.classList.contains("is-active");

      await applyFilter(isActive ? null : category, isActive ? null : button);
    });

    revealItems(grid.querySelectorAll(".grid-item"));
    relayoutOnLoad(grid);

    loadMoreButton?.addEventListener("click", appendNextPhotos);
    updateLoadMoreButton();
  } catch (error) {
    console.error("Error loading Cloudinary photos:", error.message);
  }
}

function animatePageIntro() {
  if (
    !window.gsap ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  gsap
    .timeline({ defaults: { ease: "power2.out" } })
    .from(".photo-nav-item, .photo-nav-theme, .photo-nav-theme-mobile", {
      opacity: 0,
      y: -8,
      duration: 0.35,
      stagger: 0.04,
      clearProps: "opacity,transform",
    })
    .from(".photo-title-line", { opacity: 0, y: 12, duration: 0.45, stagger: 0.06 }, "-=0.2")
    .from(
      ".photo-index-button",
      {
        opacity: 0,
        y: 8,
        duration: 0.3,
        stagger: 0.04,
        clearProps: "opacity,transform",
      },
      "-=0.15",
    );
}

animatePageIntro();
init();
