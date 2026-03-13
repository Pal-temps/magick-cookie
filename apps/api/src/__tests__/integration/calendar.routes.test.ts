import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { request, cleanDb, closeDb } from "./setup";

afterAll(async () => {
  await closeDb();
});

describe("Calendar routes", () => {
  beforeEach(async () => {
    await cleanDb();
  });

  // ----------------------------------------------------------------
  // POST /api/calendars
  // ----------------------------------------------------------------
  describe("POST /api/calendars", () => {
    test("creates a calendar with valid body and returns 201", async () => {
      const res = await request("POST", "/api/calendars", {
        name: "Work",
        color: "#ff0000",
      });

      expect(res.status).toBe(201);

      const { data } = await res.json();
      expect(data.name).toBe("Work");
      expect(data.color).toBe("#ff0000");
      expect(data.id).toBeDefined();
    });

    test("returns 400 when name is empty", async () => {
      const res = await request("POST", "/api/calendars", {
        name: "",
      });

      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.error).toBe("Validation error");
    });

    test("returns 400 when body is missing name", async () => {
      const res = await request("POST", "/api/calendars", {
        color: "#aabbcc",
      });

      expect(res.status).toBe(400);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/calendars
  // ----------------------------------------------------------------
  describe("GET /api/calendars", () => {
    test("returns an empty list when no calendars exist", async () => {
      const res = await request("GET", "/api/calendars");
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data).toEqual([]);
    });

    test("returns created calendars", async () => {
      await request("POST", "/api/calendars", { name: "Work" });
      await request("POST", "/api/calendars", { name: "Personal" });

      const res = await request("GET", "/api/calendars");
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data).toHaveLength(2);

      const names = data.map((c: any) => c.name).sort();
      expect(names).toEqual(["Personal", "Work"]);
    });
  });

  // ----------------------------------------------------------------
  // GET /api/calendars/:id
  // ----------------------------------------------------------------
  describe("GET /api/calendars/:id", () => {
    test("returns a calendar by id", async () => {
      const createRes = await request("POST", "/api/calendars", {
        name: "Work",
      });
      const { data: created } = await createRes.json();

      const res = await request("GET", `/api/calendars/${created.id}`);
      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.id).toBe(created.id);
      expect(data.name).toBe("Work");
    });

    test("returns 404 for non-existent id", async () => {
      const res = await request(
        "GET",
        "/api/calendars/00000000-0000-0000-0000-000000000000",
      );
      expect(res.status).toBe(404);

      const json = await res.json();
      expect(json.error).toBe("Calendar not found");
    });
  });

  // ----------------------------------------------------------------
  // PUT /api/calendars/:id
  // ----------------------------------------------------------------
  describe("PUT /api/calendars/:id", () => {
    test("updates name and color", async () => {
      const createRes = await request("POST", "/api/calendars", {
        name: "Old Name",
        color: "#111111",
      });
      const { data: created } = await createRes.json();

      const res = await request("PUT", `/api/calendars/${created.id}`, {
        name: "New Name",
        color: "#222222",
      });

      expect(res.status).toBe(200);

      const { data } = await res.json();
      expect(data.name).toBe("New Name");
      expect(data.color).toBe("#222222");
    });

    test("returns 404 when calendar does not exist", async () => {
      const res = await request(
        "PUT",
        "/api/calendars/00000000-0000-0000-0000-000000000000",
        { name: "Nope" },
      );

      expect(res.status).toBe(404);
    });
  });

  // ----------------------------------------------------------------
  // DELETE /api/calendars/:id
  // ----------------------------------------------------------------
  describe("DELETE /api/calendars/:id", () => {
    test("deletes a calendar and subsequent GET returns 404", async () => {
      const createRes = await request("POST", "/api/calendars", {
        name: "ToDelete",
      });
      const { data: created } = await createRes.json();

      const deleteRes = await request(
        "DELETE",
        `/api/calendars/${created.id}`,
      );
      expect(deleteRes.status).toBe(200);

      const { data } = await deleteRes.json();
      expect(data.success).toBe(true);

      // Verify it's gone
      const getRes = await request("GET", `/api/calendars/${created.id}`);
      expect(getRes.status).toBe(404);
    });

    test("returns 404 when deleting non-existent calendar", async () => {
      const res = await request(
        "DELETE",
        "/api/calendars/00000000-0000-0000-0000-000000000000",
      );
      expect(res.status).toBe(404);
    });
  });
});
