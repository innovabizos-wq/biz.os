/** Keep discovery useful without sending the entire skill catalog to the model. */
export function createActiveBrainTools(initial: string[], pinned: string[], limit = 60) {
  const fixed = new Set(pinned);
  const active = new Set(initial.slice(0, limit));
  return {
    activate(names: string[]) {
      for (const name of names) {
        active.delete(name);
        active.add(name);
      }
      while (active.size > limit) active.delete(active.values().next().value!);
    },
    list: () => [...new Set([...fixed, ...active])],
  };
}
