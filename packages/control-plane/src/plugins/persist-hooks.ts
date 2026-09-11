import type { PluginInstall } from "@neo-bot/contracts";

type PluginPersistHooks = {
  onWrite?: (items: PluginInstall[]) => void;
};

let hooks: PluginPersistHooks = {};

export function setPluginPersistHooks(next: PluginPersistHooks): void {
  hooks = next;
}

export function pluginPersistHooks(): PluginPersistHooks {
  return hooks;
}
