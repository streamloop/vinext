import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  hoistStreamedMetadata,
  STREAMED_METADATA_CONTAINER_ATTR,
} from "../packages/vinext/src/shims/hoist-streamed-metadata.js";

/**
 * `hoistStreamedMetadata` is the DOM pass that moves streamed metadata out of
 * its hidden body container and into `<head>`.
 *
 * On a document load the container's parser-inserted `<script>` runs it. On a
 * CLIENT NAVIGATION React inserts the identical markup through `innerHTML`,
 * and the HTML spec never executes a script inserted that way — so the browser
 * entry must call this function explicitly. These tests therefore exercise the
 * function directly, with the script left INERT, which is exactly the state a
 * client navigation produces.
 */
function setupDocument(headHtml: string, bodyHtml: string) {
  const dom = new JSDOM(
    `<!doctype html><html><head>${headHtml}</head><body>${bodyHtml}</body></html>`,
  );
  vi.stubGlobal("document", dom.window.document);
  return dom;
}

function container(inner: string) {
  // The inert script mirrors what React's innerHTML insertion produces.
  return `<div hidden ${STREAMED_METADATA_CONTAINER_ATTR}="">${inner}<script>/* never runs */</script></div>`;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("hoistStreamedMetadata", () => {
  it("moves streamed tags into head when the container's script never ran", () => {
    const dom = setupDocument(
      "<title>Previous page</title>",
      container('<title>New page</title><meta name="description" content="new">'),
    );

    hoistStreamedMetadata();

    // The regression this guards: without an explicit call the document keeps
    // reporting the PREVIOUS page's title after a client navigation.
    expect(dom.window.document.title).toBe("New page");
    expect(dom.window.document.head.querySelectorAll("title")).toHaveLength(1);
    expect(
      dom.window.document.head.querySelector('meta[name="description"]')?.getAttribute("content"),
    ).toBe("new");
    expect(dom.window.document.body.querySelector("title")).toBeNull();
  });

  it("evicts the stale same-key tags it replaces", () => {
    const dom = setupDocument(
      '<title>Old</title><meta name="description" content="old"><link rel="canonical" href="/old">',
      container(
        '<title>New</title><meta name="description" content="new"><link rel="canonical" href="/new">',
      ),
    );

    hoistStreamedMetadata();

    const head = dom.window.document.head;
    expect(head.querySelectorAll("title")).toHaveLength(1);
    expect(head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
    expect(head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(head.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe("/new");
  });

  it("keeps legitimate repeats of the same key", () => {
    const dom = setupDocument(
      "",
      container(
        '<meta property="og:image" content="/a.png"><meta property="og:image" content="/b.png">',
      ),
    );

    hoistStreamedMetadata();

    // Both arrive in the same batch, so neither evicts the other — a page may
    // legitimately declare several og:images.
    expect(dom.window.document.head.querySelectorAll('meta[property="og:image"]')).toHaveLength(2);
  });

  it("scopes hreflang eviction to the matching locale", () => {
    const dom = setupDocument(
      '<link rel="alternate" hreflang="es" href="/es/old"><link rel="alternate" hreflang="tr" href="/tr/keep">',
      container('<link rel="alternate" hreflang="es" href="/es/new">'),
    );

    hoistStreamedMetadata();

    const head = dom.window.document.head;
    expect(head.querySelector('link[hreflang="es"]')?.getAttribute("href")).toBe("/es/new");
    // A different locale is a different key and must survive.
    expect(head.querySelector('link[hreflang="tr"]')?.getAttribute("href")).toBe("/tr/keep");
  });

  it("is idempotent — a second pass has nothing left to move", () => {
    const dom = setupDocument("<title>Old</title>", container("<title>New</title>"));

    hoistStreamedMetadata();
    hoistStreamedMetadata();

    expect(dom.window.document.title).toBe("New");
    expect(dom.window.document.head.querySelectorAll("title")).toHaveLength(1);
  });

  it("drains every pending container, not just the first", () => {
    const dom = setupDocument(
      "",
      container('<meta name="a" content="1">') + container('<meta name="b" content="2">'),
    );

    hoistStreamedMetadata();

    expect(dom.window.document.head.querySelector('meta[name="a"]')).not.toBeNull();
    expect(dom.window.document.head.querySelector('meta[name="b"]')).not.toBeNull();
  });

  it("re-appends streamed icons in their declared order", () => {
    const dom = setupDocument(
      "",
      container(
        '<link data-vinext-streamed-icon="/p:2" rel="icon" href="/c.png">' +
          '<link data-vinext-streamed-icon="/p:0" rel="icon" href="/a.png">' +
          '<link data-vinext-streamed-icon="/p:1" rel="icon" href="/b.png">',
      ),
    );

    hoistStreamedMetadata();

    const hrefs = [
      ...dom.window.document.head.querySelectorAll("link[data-vinext-streamed-icon]"),
    ].map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual(["/a.png", "/b.png", "/c.png"]);
  });
});
