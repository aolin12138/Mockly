export function cn(...values) {
  return values
    .flatMap((v) => {
      if (!v) return [];
      if (typeof v === 'string') return v;
      if (Array.isArray(v)) return v;
      if (typeof v === 'object') {
        return Object.entries(v)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => key);
      }
      return [];
    })
    .join(' ')
    .trim();
}
