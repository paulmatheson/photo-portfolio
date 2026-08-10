const GALLERY_BATCH_SIZE = 10;

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
        },
      };
    });

    if (photoIndex) {
      const categories = buildCategoryIndex(enrichedPhotos);
      const showIndex = categories.length > 0;

      photoIndex.innerHTML = showIndex ? renderCategoryIndex(categories) : "";
      photoIndex.hidden = !showIndex;
      document
        .getElementById("photo-index-bottom-rule")
        ?.toggleAttribute("hidden", !showIndex);
    }

    let visiblePhotoCount = Math.min(GALLERY_BATCH_SIZE, enrichedPhotos.length);
    let galleryLayout;
    let galleryLightbox;
    let activeFilter = "*";
    let gridHeightFrame = null;
    let gridResizeObserver;

    const getPhotosForCategory = (categoryKey) => {
      if (!categoryKey) {
        return enrichedPhotos.slice(0, visiblePhotoCount);
      }

      return enrichedPhotos.filter(
        (photo) => photo.meta.categoryKey === categoryKey,
      );
    };

    const getPhotoMarkup = (photo, { eager = false } = {}) => {
      const { caption, categoryKey } = photo.meta;
      const categoryAttr = categoryKey
        ? ` data-category="${escapeAttr(categoryKey)}"`
        : "";
      const loadingAttr = eager ? "" : ' loading="lazy"';

      return `
        <a
          class="grid-item"
          data-src="${photo.fullUrl}"
          data-sub-html="${escapeAttr(caption)}"${categoryAttr}
        >
          <img src="${photo.thumbUrl}"${loadingAttr} alt="${escapeAttr(photo.alt || caption)}" />
          <span class="grid-item-caption">${escapeHtml(caption)}</span>
        </a>
      `;
    };

    const areItemsUnpositioned = (items) => {
      if (items.length < 2) return false;

      return items.every((item) => {
        const top = parseFloat(item.style.top) || 0;
        const left = parseFloat(item.style.left) || 0;
        return top < 1 && left < 1;
      });
    };

    const measureGridHeight = () => {
      const items = galleryLayout.getItemElements();
      if (!items.length) return 0;

      if (areItemsUnpositioned(items)) return 0;

      const gridTop = grid.getBoundingClientRect().top;
      let maxBottom = 0;

      items.forEach((item) => {
        const top = parseFloat(item.style.top) || 0;
        const positionedBottom = top + item.offsetHeight;
        const renderedBottom = item.getBoundingClientRect().bottom - gridTop;
        maxBottom = Math.max(maxBottom, positionedBottom, renderedBottom);
      });

      return Math.ceil(maxBottom);
    };

    const applyGridHeight = () => {
      const items = galleryLayout?.getItemElements() || [];
      if (areItemsUnpositioned(items)) {
        galleryLayout?.layout();
        return;
      }

      const nextHeight = measureGridHeight();
      if (nextHeight > 0) {
        grid.style.height = `${nextHeight}px`;
      } else {
        grid.style.height = "0px";
      }
    };

    const scheduleLayout = () => {
      if (gridHeightFrame) cancelAnimationFrame(gridHeightFrame);
      gridHeightFrame = requestAnimationFrame(() => {
        gridHeightFrame = null;
        galleryLayout?.layout();
      });
    };

    const finalizeGridLayout = () => {
      galleryLayout?.layout();
      requestAnimationFrame(applyGridHeight);
      window.setTimeout(applyGridHeight, 200);
      window.setTimeout(applyGridHeight, 600);
    };

    const observeGridImages = () => {
      gridResizeObserver?.disconnect();
      gridResizeObserver = new ResizeObserver(scheduleLayout);
      grid.querySelectorAll(".grid-item").forEach((item) => {
        gridResizeObserver.observe(item);
      });
      grid.querySelectorAll(".grid-item img").forEach((img) => {
        gridResizeObserver.observe(img);
      });
    };

    grid.addEventListener(
      "load",
      (event) => {
        if (event.target.matches(".grid-item img")) {
          scheduleLayout();
        }
      },
      true,
    );

    const getMasonryGutter = () =>
      window.matchMedia("(min-width: 900px)").matches ? 24 : 16;

    const createGalleryLayout = () => {
      const layout = new Isotope(grid, {
        itemSelector: ".grid-item",
        layoutMode: "masonry",
        masonry: { gutter: getMasonryGutter() },
      });

      layout.on("layoutComplete", applyGridHeight);
      return layout;
    };

    const rebuildGallery = (photos) =>
      new Promise((resolve) => {
        gridResizeObserver?.disconnect();

        galleryLayout?.destroy();
        grid.style.height = "";
        grid.innerHTML = photos
          .map((photo) => getPhotoMarkup(photo, { eager: true }))
          .join("");

        galleryLayout = createGalleryLayout();

        const imgLoad = imagesLoaded(grid);
        let settled = false;

        const finishRebuild = () => {
          if (settled) return;
          settled = true;

          galleryLayout.once("layoutComplete", applyGridHeight);
          galleryLayout.layout();
          observeGridImages();
          finalizeGridLayout();
          galleryLightbox?.refresh();
          revealItems(
            grid.querySelectorAll(".grid-item:not(.is-revealed)"),
          );
          grid.querySelectorAll(".grid-item").forEach((item) => {
            item.classList.add("is-revealed");
          });
          resolve();
        };

        imgLoad.on("progress", scheduleLayout);

        imgLoad.on("always", finishRebuild);

        if (imgLoad.isComplete) {
          finishRebuild();
        }
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

    const revealInitialItems = () => {
      observeGridImages();
      finalizeGridLayout();
      revealItems(
        grid.querySelectorAll(".grid-item:not(.is-revealed)"),
      );
      grid.querySelectorAll(".grid-item").forEach((item) => {
        item.classList.add("is-revealed");
      });
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

      galleryLayout.appended(newItems);
      observeGridImages();

      const imgLoad = imagesLoaded(newItems);
      let appendSettled = false;

      const finishAppend = () => {
        if (appendSettled) return;
        appendSettled = true;

        finalizeGridLayout();
        galleryLightbox?.refresh();
        revealItems(newItems);
        updateLoadMoreButton();
      };

      galleryLayout.once("layoutComplete", applyGridHeight);
      galleryLayout.layout();

      imgLoad.on("progress", scheduleLayout);
      imgLoad.on("always", finishAppend);

      if (imgLoad.isComplete) {
        finishAppend();
      }
    };

    grid.innerHTML = enrichedPhotos
      .slice(0, visiblePhotoCount)
      .map(getPhotoMarkup)
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

    const imgLoad = imagesLoaded(grid);

    imgLoad.on("progress", scheduleLayout);

    imgLoad.on("always", revealInitialItems);

    if (imgLoad.isComplete) {
      revealInitialItems();
    }

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
