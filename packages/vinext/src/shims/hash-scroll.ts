export function decodeHashFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    // Malformed percent escapes cannot be decoded; keep navigation alive and
    // attempt browser-style matching against the raw fragment.
    return fragment;
  }
}

export function scrollToHashTarget(hash: string): void {
  const fragment = decodeHashFragment(hash.startsWith("#") ? hash.slice(1) : hash);

  if (fragment === "" || fragment === "top") {
    window.scrollTo(0, 0);
    return;
  }

  const idElement = document.getElementById(fragment);
  if (idElement) {
    idElement.scrollIntoView({ behavior: "auto" });
    return;
  }

  document.getElementsByName(fragment)[0]?.scrollIntoView({ behavior: "auto" });
}

export function scrollToHashTargetOnNextFrame(hash: string): void {
  requestAnimationFrame(() => {
    scrollToHashTarget(hash);
  });
}
