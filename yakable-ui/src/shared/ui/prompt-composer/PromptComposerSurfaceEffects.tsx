export function PromptComposerSurfaceEffects() {
  return (
    <span aria-hidden="true" className="yak-composer-fx-root">
      <span
        data-allow-shadow="true"
        data-composer-fx="drop-shadow"
        className="yak-composer-fx-layer"
      />
      <span data-composer-fx="base-fill" className="yak-composer-fx-layer" />
      <span
        data-allow-shadow="true"
        data-composer-fx="top-highlight"
        className="yak-composer-fx-layer"
      />
      <span data-allow-shadow="true" data-composer-fx="rim" className="yak-composer-fx-layer" />
      <span
        data-allow-shadow="true"
        data-composer-fx="focus-glow"
        className="yak-composer-fx-layer"
      />
    </span>
  );
}
