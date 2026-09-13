import type { ProviderManifest } from "@tikdd/providers";
import {
  DLPandaProvider,
  SnapInstaProvider,
  SSSTwitterProvider,
  SnapTikMonsterProvider,
  TikCDProvider,
  TikVidProvider,
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
    new SnapTikMonsterProvider({ enabled: enabled.has("snaptik-monster") }).manifest,
    new TikCDProvider({ enabled: enabled.has("tikcd") }).manifest,
    new TikVidProvider({ enabled: enabled.has("tikvid") }).manifest,
    new SnapInstaProvider({ enabled: enabled.has("snapinsta") }).manifest
  ];
}
