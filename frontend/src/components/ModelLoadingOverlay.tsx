interface ModelLoadingOverlayProps {
  status: "loading" | "error";
  loadedModels: string[];
}

export function ModelLoadingOverlay({
  status,
  loadedModels,
}: ModelLoadingOverlayProps) {
  const title = status === "error" ? "Backend unavailable" : "Loading model...";
  const subtitle =
    status === "error"
      ? "Waiting for the API and Ollama to come online."
      : "Warming models into VRAM. This can take a few minutes on first boot.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
      <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl">
        <div className="text-lg font-semibold text-foreground">{title}</div>
        <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
        {loadedModels.length > 0 ? (
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Loaded Models
            </div>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {loadedModels.map((model) => (
                <li key={model}>{model}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
