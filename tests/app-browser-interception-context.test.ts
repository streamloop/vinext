import { describe, expect, it } from "vite-plus/test";
import { resolveManifestNavigationInterceptionContext } from "../packages/vinext/src/server/app-browser-interception-context.js";
import type {
  RouteManifest,
  RouteManifestInterception,
} from "../packages/vinext/src/routing/app-route-graph.js";

function createRouteManifest(interceptions: readonly RouteManifestInterception[]): RouteManifest {
  return {
    graphVersion: "test",
    segmentGraph: {
      boundaries: new Map(),
      defaults: new Map(),
      interceptions: new Map(interceptions.map((interception) => [interception.id, interception])),
      interceptionsBySlotId: new Map(),
      layouts: new Map(),
      pages: new Map(),
      rootBoundaries: new Map(),
      routeHandlers: new Map(),
      routes: new Map(),
      slotBindings: new Map(),
      slots: new Map(),
      templates: new Map(),
    },
  };
}

const feedPhotoInterception: RouteManifestInterception = {
  id: "interception:slot:modal:/feed->/photos/:id",
  interceptingRouteId: "route:/feed",
  ownerLayoutId: "layout:/feed",
  slotId: "slot:modal:/feed",
  sourcePattern: "/feed",
  sourcePatternParts: ["feed"],
  targetPattern: "/photos/:id",
  targetPatternParts: ["photos", ":id"],
  targetRouteId: "route:/photos/:id",
};

describe("resolveManifestNavigationInterceptionContext", () => {
  it("uses manifest-declared interception rules for first-hop browser navigations", () => {
    expect(
      resolveManifestNavigationInterceptionContext({
        basePath: "",
        currentPathname: "/feed",
        routeManifest: createRouteManifest([feedPhotoInterception]),
        targetPathname: "/photos/42",
      }),
    ).toBe("/feed");
  });

  it("strips basePath before matching and returning the interception context", () => {
    expect(
      resolveManifestNavigationInterceptionContext({
        basePath: "/app",
        currentPathname: "/app/feed",
        routeManifest: createRouteManifest([feedPhotoInterception]),
        targetPathname: "/app/photos/42",
      }),
    ).toBe("/feed");
  });

  it("does not infer interception context without a matching manifest rule", () => {
    expect(
      resolveManifestNavigationInterceptionContext({
        basePath: "",
        currentPathname: "/about",
        routeManifest: createRouteManifest([feedPhotoInterception]),
        targetPathname: "/photos/42",
      }),
    ).toBeNull();

    expect(
      resolveManifestNavigationInterceptionContext({
        basePath: "",
        currentPathname: "/feed",
        routeManifest: createRouteManifest([feedPhotoInterception]),
        targetPathname: "/about",
      }),
    ).toBeNull();
  });
});
