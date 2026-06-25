export type FranchiseRootRecord = {
  id: string;
  parentId: string | null;
};

export function getFranchiseRootOrgId(record: FranchiseRootRecord) {
  return record.parentId ?? record.id;
}

export function isSameFranchise(
  left: FranchiseRootRecord,
  right: FranchiseRootRecord,
) {
  return getFranchiseRootOrgId(left) === getFranchiseRootOrgId(right);
}