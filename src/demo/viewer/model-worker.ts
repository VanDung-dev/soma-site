import init, { prepare_model } from "../../generated/viewer/wasm";

self.onmessage = async ({ data }) => {
  try {
    await init();
    const prepared = prepare_model(data.bytes, data.ids);
    self.postMessage({ prepared }, { transfer: [prepared[0].buffer, prepared[1].buffer] });
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : String(cause) });
  }
};
