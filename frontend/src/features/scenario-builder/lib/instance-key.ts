import type { Node } from '@xyflow/react';

export function getInstanceDisplayName(node: Node): string {
  const label = typeof node.data?.label === 'string' ? node.data.label.trim() : '';
  const dn = typeof node.data?.dn === 'string' ? node.data.dn.trim() : '';
  if (dn && label) return `${dn} (${label})`;
  if (dn) return dn;
  return label || node.id;
}
