import type { ProviderManifest } from "@tikdd/providers";
import {
  DLPandaProvider,
  SSSTwitterProvider,
  SnapTikMonsterProvider,
  TwitterSaverProvider
} from "@tikdd/providers";

export function loadPreflightProviderManifests(
  enabledProviderIds: readonly string[]
): readonly ProviderManifest[] {
  const enabled = new Set(enabledProviderIds);
  return [
    new TwitterSaverProvider({ enabled: enabled.has("twittersaver") }).manifest,
    new DLPandaProvider({ enabled: enabled.has("dlpanda") }).manifest,
    new SSSTwitterProvider({ enabled: enabled.has("ssstwitter") }).manifest,
    new SnapTikMonsterProvider({ enabled: enabled.has("snaptik-monster") }).manifest
  ];
}
