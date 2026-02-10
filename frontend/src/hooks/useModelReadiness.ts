import { useQuery } from "@tanstack/react-query";
import { healthService } from "../services";
import type { HealthResponse } from "../types";

export function useModelReadiness() {
  return useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: () => healthService.check(),
    refetchInterval: (query) =>
      query.state.data?.models_loaded ? false : 2000,
    retry: 2,
  });
}
