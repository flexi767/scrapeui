export function slugifyDealerName(name: string) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

export function hasHttpProtocol(url: string) {
  return /^https?:\/\//i.test(url.trim());
}
