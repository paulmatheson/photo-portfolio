require("dotenv").config();

const PHOTO_FOLDER = process.env.CLOUDINARY_PHOTO_FOLDER || "Portfolio";
const GALLERY_THUMB_TRANSFORM = "c_limit,w_600/q_auto/f_auto";
const GALLERY_FULL_TRANSFORM = "c_limit,w_2000/q_auto/f_auto";
const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=300",
  "Netlify-CDN-Cache-Control":
    "public, max-age=3600, stale-while-revalidate=86400",
};

const getContextValue = (custom, ...keys) => {
  if (!custom) return "";

  for (const key of keys) {
    const value = custom[key];
    if (value != null && String(value).trim()) {
      return String(value).trim();
    }
  }

  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const [key, value] of Object.entries(custom)) {
    if (wanted.has(key.toLowerCase()) && value != null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
};

exports.handler = async () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      statusCode: 500,
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({ error: "Missing Cloudinary configuration" }),
    };
  }

  try {
    const params = new URLSearchParams({
      asset_folder: PHOTO_FOLDER,
      max_results: "100",
      context: "true",
    });

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/by_asset_folder?${params}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`,
        },
      },
    );

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: { "Cache-Control": "no-store" },
        body: JSON.stringify({
          error: data.error?.message || "Cloudinary request failed",
        }),
      };
    }

    const photos = data.resources.map((photo) => {
      const custom = photo.context?.custom;

      return {
        fullUrl: `https://res.cloudinary.com/${cloudName}/image/upload/${GALLERY_FULL_TRANSFORM}/${photo.public_id}`,
        thumbUrl: `https://res.cloudinary.com/${cloudName}/image/upload/${GALLERY_THUMB_TRANSFORM}/${photo.public_id}`,
        width: photo.width,
        height: photo.height,
        title:
          getContextValue(custom, "caption") ||
          photo.display_name ||
          photo.public_id,
        alt:
          getContextValue(custom, "alt") ||
          photo.display_name ||
          photo.public_id,
        category: getContextValue(custom, "category", "Category"),
      };
    });

    return {
      statusCode: 200,
      headers: CACHE_HEADERS,
      body: JSON.stringify(photos),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Cache-Control": "no-store" },
      body: JSON.stringify({ error: error.message }),
    };
  }
};
