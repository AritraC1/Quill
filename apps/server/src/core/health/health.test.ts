import { describe, it, expect, mock } from "bun:test";
import { healthCheckHandler } from "./health";
import type { Request, Response } from "express";

describe("Health Check Endpoint", () => {
  it("returns health status payload with status code", async () => {
    let statusCode = 0;
    let jsonPayload: any = null;

    const req = {} as Request;
    const res = {
      status: (code: number) => {
        statusCode = code;
        return {
          json: (data: any) => {
            jsonPayload = data;
          },
        };
      },
    } as unknown as Response;

    await healthCheckHandler(req, res);

    expect(statusCode === 200 || statusCode === 503).toBeTrue();
    expect(jsonPayload).toHaveProperty("status");
    expect(jsonPayload).toHaveProperty("services");
    expect(jsonPayload.services).toHaveProperty("database");
    expect(jsonPayload.services).toHaveProperty("redis");
  });
});

