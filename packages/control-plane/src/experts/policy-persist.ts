import type { BundledExpertPolicyDocument } from "@neo-bot/contracts";

type BundledExpertPolicyPersistHooks = {
  onWrite?: (doc: BundledExpertPolicyDocument) => void;
};

let hooks: BundledExpertPolicyPersistHooks = {};

export function setBundledExpertPolicyPersistHooks(next: BundledExpertPolicyPersistHooks): void {
  hooks = next;
}

export function bundledExpertPolicyPersistHooks(): BundledExpertPolicyPersistHooks {
  return hooks;
}
