import { createMasterDataHooks } from './useMasterData'
export const { useList: useLeadSourcesMaster, useCreate: useCreateLeadSourceMaster, useDelete: useDeleteLeadSourceMaster } = createMasterDataHooks('lead-sources-master', 'lead-sources-master')
