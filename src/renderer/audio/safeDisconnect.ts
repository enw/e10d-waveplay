/** Disconnect without throwing when the edge is already gone. */
export function safeDisconnect(from: AudioNode, to?: AudioNode): void {
  try {
    if (to !== undefined) from.disconnect(to)
    else from.disconnect()
  } catch {
    // Destination not connected — safe during graph teardown.
  }
}
