export function scoped(query, tenantId) {
  if (!tenantId) throw new Error('Tenant scope is required for every database query');
  if (typeof query.forTenant === 'function') return query.forTenant(tenantId);
  return query;
}

export default scoped;
