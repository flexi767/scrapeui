import { NextRequest } from 'next/server';
import { getListings } from '@/lib/queries';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const make = sp.get('make') ?? '';
  const model = sp.get('model') ?? '';
  const dealerSlugs = sp.getAll('dealer');
  const sort = sp.get('sort') ?? 'last_edit';
  const order = sp.get('order') ?? 'desc';
  const search = sp.get('search') ?? '';
  const page = Math.max(1, parseInt(sp.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(sp.get('limit') ?? '25', 10)));

  const result = getListings({ make, model, dealerSlugs, sort, order, search, page, limit });

  return Response.json(result);
}
