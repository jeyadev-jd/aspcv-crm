import { createMasterDataHooks } from './useMasterData'
export const { useList: useRegions, useCreate: useCreateRegion, useDelete: useDeleteRegion } = createMasterDataHooks('regions', 'regions')
