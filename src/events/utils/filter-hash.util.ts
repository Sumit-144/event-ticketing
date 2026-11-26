import { sha256Hex } from '../../common/utils/crypto.util';
import { FilterEventsDto } from '../dto/filter-events.dto';

/**
 * Stable cache-key hash for a list query. Keys are written in alphabetical order and
 * case-insensitive filters are lowercased, so equivalent queries share one cache entry.
 */
export const hashEventFilters = (f: FilterEventsDto): string =>
  sha256Hex(
    JSON.stringify({
      categoryId: f.categoryId || null,
      city: f.city?.toLowerCase() || null,
      dateFrom: f.dateFrom?.toISOString() ?? null,
      dateTo: f.dateTo?.toISOString() ?? null,
      limit: f.limit,
      page: f.page,
      search: f.search?.toLowerCase() || null,
      status: f.status ?? null,
    }),
  );