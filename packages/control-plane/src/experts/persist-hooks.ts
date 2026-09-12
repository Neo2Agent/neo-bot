import type { Expert } from "@neo-bot/contracts";

type ExpertPersistHooks = {
  onWrite?: (items: Expert[]) => void;
};

let hooks: ExpertPersistHooks = {};

export function setExpertPersistHooks(next: ExpertPersistHooks): void {
  hooks = next;
}

export function expertPersistHooks(): ExpertPersistHooks {
  return hooks;
}
