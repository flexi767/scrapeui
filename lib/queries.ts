export * from './query-modules/types';
export * from './query-modules/listings';
export * from './query-modules/core';
export * from './query-modules/tasks';
export * from './query-modules/expenses-articles';
export * from './query-modules/mobilebg';
export * from './query-modules/public';
export {
  listDealerTemplateConfigs,
  listAllDealerTemplateConfigs,
  getDealerTemplateConfig,
  getActiveDealerTemplateConfig,
  createDealerTemplateConfig,
  updateDealerTemplateConfig,
  forkDealerTemplateConfig,
  activateDealerTemplateConfig,
  deleteDealerTemplateConfig,
} from "./query-modules/dealer-templates";
export type { DealerTemplateConfig } from "./query-modules/dealer-templates";
