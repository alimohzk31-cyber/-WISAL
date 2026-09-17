// Runtime test of the join-target resolution and the modal gating logic
import { buildCategoryLookup } from '../src/lib/serviceCategoryLink';
import { resolveDirectoryCategory, directorySections } from '../src/data/categoryDirectory';
import { pickJoinTarget } from '../src/lib/serviceCategorySelection';

// ---- Scenario A: category list failed/empty (the reported bug scenario) ----
const emptyLookup = buildCategoryLookup([]);
console.log('A1: empty lookup size:', emptyLookup.slugToId.size);

// The page context for: /category/furniture/home-furniture (قسم الأثاث ← أثاث منزلي)
const route = { sectionSlug: 'furniture', childSlug: 'home-furniture' };
const target = pickJoinTarget(route, emptyLookup, []);
 succeed
