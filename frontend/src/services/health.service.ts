import { fetchApi } from "./api";
import type { HealthResponse } from "../types";

export const healthService = {
  check: (): Promise<HealthResponse> => fetchApi("/health"),
};
