import { describe, it, expect } from "bun:test";
import { register, httpRequestsTotal, metricsMiddleware, metricsHandler } from "./metrics";
import type { Request, Response, NextFunction } from "express";

describe("Prometheus Metrics", () => {
  it("registers default and custom metrics", async () => {
    const output = await register.metrics();
    expect(output).toContain("quill_http_requests_total");
    expect(output).toContain("quill_http_request_duration_seconds");
    expect(output).toContain("quill_http_active_requests");
  });

  it("increments httpRequestsTotal counter", async () => {
    httpRequestsTotal.inc({ method: "GET", route: "/api/test", status_code: "200" });
    const output = await register.metrics();
    expect(output).toContain('quill_http_requests_total{method="GET",route="/api/test",status_code="200"}');
  });

  it("handles metrics HTTP endpoint handler", async () => {
    let sentMetrics = "";
    let contentType = "";

    const req = {} as Request;
    const res = {
      setHeader: (name: string, value: string) => {
        if (name === "Content-Type") contentType = value;
      },
      send: (body: string) => {
        sentMetrics = body;
      },
    } as unknown as Response;

    await metricsHandler(req, res);

    expect(contentType).toContain("text/plain");
    expect(sentMetrics).toContain("quill_");
  });
});

