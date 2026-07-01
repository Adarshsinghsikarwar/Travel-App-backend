// Unit: ApiError and ApiResponse shape
// Validates the two objects that every controller and error middleware returns.

import ApiError from "../../src/utils/apiError.js";
import ApiResponse from "../../src/utils/apiResponse.js";

describe("ApiError", () => {
  it("sets statusCode, message, and success=false", () => {
    const err = new ApiError(404, "Not found");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err.success).toBe(false);
    expect(err).toBeInstanceOf(Error);
  });

  it("uses default message when none is provided", () => {
    const err = new ApiError(500);
    expect(err.message).toBe("Something went wrong");
  });
});

describe("ApiResponse", () => {
  it("sets success=true for 2xx codes", () => {
    const res = new ApiResponse(200, { id: 1 }, "OK");
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 1 });
    expect(res.message).toBe("OK");
  });

  it("sets success=false for 4xx codes", () => {
    const res = new ApiResponse(400, null, "Bad request");
    expect(res.success).toBe(false);
  });

  it("uses default message when none provided", () => {
    const res = new ApiResponse(201, {});
    expect(res.message).toBe("Success");
  });
});
