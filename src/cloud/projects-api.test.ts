import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CloudApiError,
  ProjectsApi,
  type ProjectSourceFiles,
} from "./projects-api";

const files: ProjectSourceFiles = {
  "composition.html": "<template></template>",
  "styles.css": "",
  "timeline.js": "export function buildTimeline() {}",
  "index.ts": "export const composition = {};",
};

function response(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProjectsApi", () => {
  it("keeps the session CSRF token and sends it on project mutations", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, {
          data: { user: { id: "user" }, csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(
        response(200, {
          data: { project: { id: "project" }, unchanged: false },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.getSession();
    await api.saveSource("project", { revision: 1, files });

    expect(fetchMock).toHaveBeenLastCalledWith(
      new URL("http://localhost:4000/v1/projects/project/source"),
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf-token" }),
      }),
    );
  });

  it("exposes revision conflict details to the editor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        response(409, {
          error: {
            code: "REVISION_CONFLICT",
            message: "The project changed since it was loaded.",
            details: { currentRevision: 7 },
          },
        }),
      ),
    );
    const api = new ProjectsApi("http://localhost:4000");

    await expect(api.getProject("project")).rejects.toMatchObject({
      status: 409,
      code: "REVISION_CONFLICT",
      details: { currentRevision: 7 },
    } satisfies Partial<CloudApiError>);
  });

  it("handles empty success responses for archived projects", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(200, {
          data: { user: { id: "user" }, csrfToken: "csrf-token" },
        }),
      )
      .mockResolvedValueOnce(response(204));
    vi.stubGlobal("fetch", fetchMock);
    const api = new ProjectsApi("http://localhost:4000");

    await api.getSession();
    await expect(api.removeProject("project", 3)).resolves.toBeUndefined();
  });
});
