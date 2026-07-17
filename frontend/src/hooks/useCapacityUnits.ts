import { createMasterDataHooks } from './useMasterData'
export const { useList: useCapacityUnits, useCreate: useCreateCapacityUnit, useDelete: useDeleteCapacityUnit } = createMasterDataHooks('capacity-units', 'capacity-units')
