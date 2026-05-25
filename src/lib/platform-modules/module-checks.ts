import type { CoreResult, ModuleCode } from "@/types/core";
import { fail, ok } from "@/types/core";

export function isModuleActive(
  activeModules: readonly ModuleCode[],
  moduleCode: ModuleCode,
): boolean {
  return activeModules.includes(moduleCode);
}

export function requireModule(
  activeModules: readonly ModuleCode[],
  moduleCode: ModuleCode,
): CoreResult<ModuleCode> {
  if (!isModuleActive(activeModules, moduleCode)) {
    return fail("MODULE_INACTIVE", `Modulo inactivo: ${moduleCode}`);
  }

  return ok(moduleCode);
}
