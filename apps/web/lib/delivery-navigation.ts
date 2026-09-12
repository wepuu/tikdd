export type DeliveryNavigation = (url: string) => void;

/**
 * Navigates to an opaque Delivery URL without inspecting or exposing the
 * provider target. The Delivery service remains responsible for validating
 * the one-use ticket and issuing the reviewed redirect.
 */
export function navigateToDelivery(
  url: string,
  navigate: DeliveryNavigation
): boolean {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  if (target.protocol !== "https:" && target.protocol !== "http:") return false;
  navigate(target.toString());
  return true;
}
