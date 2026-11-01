const SCOPED_OPTION = 'tenantScope';

export function tenantPlugin(schema) {
  schema.query.forTenant = function forTenant(tenantId) {
    if (!tenantId) throw new Error('Tenant scope is required for every database query');
    this.setOptions({ [SCOPED_OPTION]: tenantId });
    return this;
  };

  schema.pre(/^find/, function enforceTenantScope() {
    const tenantId = this.getOptions()[SCOPED_OPTION];
    if (!tenantId) throw new Error('Tenant scope is required for every database query');
    this.setQuery({ ...this.getQuery(), tenantId });
  });

  schema.pre(/^findOneAnd/, function enforceTenantScope() {
    const tenantId = this.getOptions()[SCOPED_OPTION];
    if (!tenantId) throw new Error('Tenant scope is required for every database query');
    this.setQuery({ ...this.getQuery(), tenantId });
  });

  schema.pre(/^(update|delete)/, function enforceTenantScope() {
    const tenantId = this.getOptions()[SCOPED_OPTION];
    if (!tenantId) throw new Error('Tenant scope is required for every database query');
    this.setQuery({ ...this.getQuery(), tenantId });
  });
}

export default tenantPlugin;
