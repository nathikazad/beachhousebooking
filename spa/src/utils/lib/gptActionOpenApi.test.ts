import { describe, expect, it } from "vitest";
import { createGptActionOpenApi } from "./gptActionOpenApi";

describe("GPT action OpenAPI document", () => {
  it("publishes only read-only operations protected by bearer authentication", () => {
    const document = createGptActionOpenApi("https://booking.example.com/");
    expect(document.openapi).toBe("3.1.0");
    expect(document.servers).toEqual([{ url: "https://booking.example.com" }]);
    expect(document.security).toEqual([{ BearerAuth: [] }]);

    const operations = Object.values(document.paths).flatMap((path) =>
      Object.keys(path)
    );
    expect(operations).toEqual(["get", "get", "get", "get", "get"]);
    expect(document.paths["/api/gpt/v1/metrics"].get.operationId).toBe(
      "getBusinessMetrics"
    );
  });
});
