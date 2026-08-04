// Streamed metadata renders as raw HTML inside a hidden `<div>` in the BODY
// (see `createAppPageRouteBodyMetadata`: hoistable React elements would make
// Fizz hold the shell flush). React can't see that HTML, so nothing hoists it
// on its own — this module owns the DOM pass that moves it into
// `document.head`.
//
// It has to run in TWO places, which is why it lives here rather than inline
// at the call site:
//
//   1. Document load — as a parser-inserted `<script>` emitted right after the
//      metadata HTML, so the head is correct the moment the streamed segment
//      arrives, long before hydration.
//   2. Client navigation — React inserts the very same markup through
//      `innerHTML`, and per the HTML spec a `<script>` inserted that way is
//      NEVER executed. Without an explicit call from the browser entry after
//      the navigation commits, the new page's tags stay parked in the hidden
//      div and `document.title` keeps reporting the PREVIOUS page's title.
//
// Both paths must apply identical rules, so there is exactly one
// implementation: the inline script is this function stringified. That means
// the function must stay SELF-CONTAINED — no imports, no module-scope
// helpers, no closure variables — because `toString()` captures only its own
// body.

/** Marks a hidden container whose children still need hoisting. */
export const STREAMED_METADATA_CONTAINER_ATTR = "data-vinext-streamed-metadata";

/**
 * Move streamed `<title>`/`<meta>`/`<link>` into `document.head`, replacing
 * any same-key tag already there (a stale title/description/canonical from the
 * previous page or an earlier boundary) while keeping legitimate repeats —
 * multiple `og:image`s, for instance — intact. Then re-append streamed icons in
 * their declared order.
 *
 * Idempotent: containers are emptied as they are processed, so running it again
 * (another streamed segment, a second navigation) is a no-op for anything
 * already hoisted.
 */
export function hoistStreamedMetadata(): void {
  const head = document.head;
  const containers = document.querySelectorAll("[data-vinext-streamed-metadata]");
  const quote = (value: string) => value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  for (const container of containers) {
    const moving = [...container.children].filter(
      (element) =>
        element.tagName === "TITLE" || element.tagName === "META" || element.tagName === "LINK",
    );

    for (const element of moving) {
      let selector: string | null = null;
      const tag = element.tagName;

      if (tag === "TITLE") {
        selector = "title";
      } else if (tag === "META") {
        const name = element.getAttribute("name");
        const property = element.getAttribute("property");
        selector = name
          ? 'meta[name="' + quote(name) + '"]'
          : property
            ? 'meta[property="' + quote(property) + '"]'
            : null;
      } else {
        const rel = element.getAttribute("rel");
        if (rel === "canonical") {
          selector = 'link[rel="canonical"]';
        } else if (rel === "alternate") {
          const hreflang = element.getAttribute("hreflang");
          if (hreflang) selector = 'link[rel="alternate"][hreflang="' + quote(hreflang) + '"]';
        }
      }

      if (selector) {
        for (const existing of head.querySelectorAll(selector)) {
          if (!moving.includes(existing)) existing.remove();
        }
      }

      head.appendChild(element);
    }
  }

  document
    .querySelectorAll('body link[rel="icon"], body link[rel="apple-touch-icon"]')
    .forEach((element) => head.appendChild(element));

  const iconAttr = "data-vinext-streamed-icon";
  const order = (element: Element) => {
    const marker = element.getAttribute(iconAttr) as string;
    return Number(marker.slice(marker.lastIndexOf(":") + 1));
  };
  [...document.querySelectorAll("link[" + iconAttr + "]")]
    .sort((left, right) => order(left) - order(right))
    .forEach((element) => head.appendChild(element));
}

/**
 * The parser-inserted form, derived from the function above so the two paths
 * can never drift apart.
 */
export const HOIST_STREAMED_METADATA_SCRIPT = `(${hoistStreamedMetadata.toString()})()`;
