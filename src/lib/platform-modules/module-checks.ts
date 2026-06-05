import type { CoreResult, ModuleCode } from "@/types/core";
import { fail, ok } from "@/types/core";
import {
  getLockedModuleMessage,
  isModuleLocked,
} from "@/modules/platform-modules/module-catalog";

export function isCoreModule(moduleCode: ModuleCode): boolean {
  return isModuleLocked(moduleCode);
}

export function isModuleActive(
  activeModules: readonly ModuleCode[],
  moduleCode: ModuleCode,
): boolean {
  return isCoreModule(moduleCode) || activeModules.includes(moduleCode);
}

export function requireModule(
  activeModules: readonly ModuleCode[],
  moduleCode: ModuleCode,
): CoreResult<ModuleCode> {
  if (!isModuleActive(activeModules, moduleCode)) {
    return fail(
      "MODULE_INACTIVE",
      isCoreModule(moduleCode)
        ? getLockedModuleMessage(moduleCode)
        : "Este modulo no esta activo para tu empresa.",
    );
  }

  return ok(moduleCode);
}
