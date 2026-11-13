// Объединяет частые обновления в один кадр; дискретные действия могут отменить кадр.
export function createFrameScheduler(render, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame) {
  let frame = null;
  let latest = [];
  return {
    schedule(...args) {
      latest = args;
      if (frame !== null) return;
      frame = requestFrame(() => {
        frame = null;
        const args = latest;
        latest = [];
        render(...args);
      });
    },
    cancel() {
      if (frame !== null) cancelFrame(frame);
      frame = null;
      latest = [];
    }
  };
}
