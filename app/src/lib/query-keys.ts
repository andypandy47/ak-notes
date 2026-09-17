export const localPageKeys = {
  all: (vaultId: string) => [vaultId, "local"] as const,
  detail: (vaultId: string, pageId: string | null) => [vaultId, "local", pageId] as const,
};

export const syncKeys = {
  status: (vaultId: string) => [vaultId, "sync"] as const,
};
