"use client";

import { useEffect, useState } from "react";

const FALLBACK_IMAGE = "/jarpa.png";

export function getImageSource(value, fallback = FALLBACK_IMAGE) {
  let source = value;

  if (source && typeof source === "object") {
    source = source.url || source.src || source.downloadURL || source.downloadUrl || source.imageUrl || source.imageURL || source.banner;
  }

  if (typeof source !== "string" || !source.trim()) return fallback;

  const trimmedSource = source.trim();
  if (trimmedSource.startsWith("//")) {
    const protocol = typeof window === "undefined" ? "https:" : window.location.protocol;
    return `${protocol}${trimmedSource}`;
  }

  const googleDriveMatch = trimmedSource.match(/drive\.google\.com\/file\/d\/([^/]+)/i);
  if (googleDriveMatch) return `https://drive.google.com/uc?export=view&id=${googleDriveMatch[1]}`;

  if (trimmedSource.includes("dropbox.com/")) {
    return trimmedSource.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace(/[?&]dl=0$/, "");
  }

  return trimmedSource;
}

export default function BannerImage({ src, alt, fallback = FALLBACK_IMAGE, className = "", ...props }) {
  const [imageSource, setImageSource] = useState(() => getImageSource(src, fallback));

  useEffect(() => {
    setImageSource(getImageSource(src, fallback));
  }, [src, fallback]);

  const handleError = () => {
    if (imageSource !== fallback) setImageSource(fallback);
  };

  return (
    <img
      {...props}
      src={imageSource}
      alt={alt}
      className={className}
      onError={handleError}
      decoding="async"
    />
  );
}